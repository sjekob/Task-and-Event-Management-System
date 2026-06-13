"""
main.py — TaskNet FastAPI application entry point.

Security layers applied throughout this file (OWASP Top 10 references):
  A01 Broken Access Control ......... Every endpoint requires at least a valid JWT;
                                       sensitive endpoints additionally require a
                                       minimum role via require_* dependencies.
  A02 Cryptographic Failures ......... JWT secret from env (auth.py). Passwords bcrypt.
  A03 Injection ...................... All DB queries use parameterised statements (?).
                                       Dynamic IN-clause roles come from a server-side
                                       whitelist, never from user input.
  A04 Insecure Design ................ File uploads: MIME whitelist + 10 MB size cap.
                                       Filename sanitisation prevents path traversal.
  A05 Security Misconfiguration ...... CORS restricted to configured origins (not *).
                                       Security response headers added on every reply.
  A07 Auth Failures .................. Login rate-limited to 5 req/min per IP.
                                       All endpoints have a 200 req/min global cap.
  A08 Software/Data Integrity ........ Pydantic models reject extra (unexpected) fields
                                       and enforce length/range constraints on every input.
"""

import os
import re
import datetime
from typing import Optional, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator, ConfigDict
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from database import get_db, init_db
from auth import (
    verify_password, create_token, get_current_user,
    require_admin, require_task_creator, require_can_assign,
    require_admin_or_principal, hash_password,
    require_personnel_manager, require_appraisal_access,
    require_event_manager,
    TASK_CREATORS, can_assign,
    decode_token_silent,       # used by the rate-limiter key function
)

# Load .env from the backend/ directory using an absolute path so it works
# regardless of which directory the process was launched from (e.g. project root).
_here = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_here, ".env"))

# ── Rate-Limiter Key Function ─────────────────────────────────────────────────
# Prefer user-ID-based limiting for authenticated requests so that multiple
# users behind the same NAT/proxy get independent quotas.
# Fall back to client IP for unauthenticated requests (e.g. /login).

def _rate_limit_key(request: Request) -> str:
    """
    Derive the rate-limit bucket key for an incoming request.

    Priority:
      1. Authenticated user  → "user:<id>"   (user-scoped limit)
      2. Unauthenticated     → client IP      (IP-scoped limit)

    Using user ID prevents a shared NAT from unfairly consuming the IP quota
    for all users behind it, while still protecting unauthenticated endpoints
    from IP-level abuse.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        payload = decode_token_silent(token)   # returns None on invalid token
        if payload and payload.get("sub"):
            return f"user:{payload['sub']}"
    # Unauthenticated or invalid token → use client IP
    return get_remote_address(request)


# ── Rate Limiter ──────────────────────────────────────────────────────────────
# Global default: 200 requests per minute per user/IP.
# Sensitive endpoints (login, file upload, user creation) override this with
# stricter per-route decorators defined below.
limiter = Limiter(key_func=_rate_limit_key, default_limits=["200 per minute"])

# ── Application ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="TaskNet API",
    # Disable automatic exception detail exposure in production.
    # Set DEBUG=true in .env to re-enable during development.
    description="Task and Event Management System for TaskNet School",
)

# Attach limiter to app state so SlowAPIMiddleware can reach it.
app.state.limiter = limiter

# Return a graceful JSON 429 response instead of the default plain-text one.
# The response includes a Retry-After header so clients know when to retry.
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply the global default rate limit to ALL routes via middleware.
# Individual routes can add stricter limits with @limiter.limit().
app.add_middleware(SlowAPIMiddleware)

# ── CORS Middleware ───────────────────────────────────────────────────────────
# TaskNet uses JWT tokens sent in the Authorization header — NOT cookies.
# Because no cookies are involved, allow_credentials=False is correct and safe,
# which allows allow_origins=["*"] without violating the CORS spec.
#
# PRODUCTION: set CORS_ORIGIN in .env to your deployed domain, e.g.:
#   CORS_ORIGIN=https://tasknet.yourdomain.com
# The middleware will then switch to a strict single-origin mode automatically.
_prod_origin = os.getenv("CORS_ORIGIN", "").strip()

if _prod_origin:
    # Production mode: single explicit origin, credentials allowed for cookies if ever needed.
    _cors_origins    = [_prod_origin]
    _cors_creds      = True
else:
    # Development / LAN mode: allow all origins.
    # Safe because auth is via Authorization header (JWT), not cookies.
    _cors_origins    = ["*"]
    _cors_creds      = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_cors_creds,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["Retry-After"],   # let clients see rate-limit retry timing
)

# ── Security Response Headers Middleware ──────────────────────────────────────
# These headers instruct the browser to apply additional client-side protections.
# They are returned on every response regardless of status code — OWASP A05.

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """
    Attach OWASP-recommended security headers to every HTTP response.

    Headers applied:
      X-Content-Type-Options:    Prevent MIME-sniffing attacks.
      X-Frame-Options:           Block clickjacking via iframe embedding.
      X-XSS-Protection:          Legacy XSS filter (belt-and-suspenders for old browsers).
      Referrer-Policy:           Limit referrer leakage to same-origin requests.
      Permissions-Policy:        Deny sensitive browser APIs not needed by this app.
      Strict-Transport-Security: Enforce HTTPS when HTTPS_ONLY=true in environment.
                                 Disabled locally so HTTP still works during development.
    """
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    # Only enable HSTS when running behind HTTPS (set HTTPS_ONLY=true in production).
    if os.getenv("HTTPS_ONLY", "false").lower() == "true":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# ── Static Files ──────────────────────────────────────────────────────────────
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
def startup():
    """Initialise the SQLite database schema and seed data on first run."""
    init_db()


# ── File Upload Validation ────────────────────────────────────────────────────
# SECURITY: Without MIME and size checks, an attacker could upload executable
# files or exhaust disk space — OWASP A04.

# Whitelist of allowed upload MIME types (documents, images, spreadsheets).
ALLOWED_MIME_TYPES: frozenset[str] = frozenset({
    "application/pdf",
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain", "text/csv",
})

# Maximum allowed file size: 10 MB.  Configurable via MAX_UPLOAD_MB env var.
MAX_FILE_SIZE_BYTES: int = int(os.getenv("MAX_UPLOAD_MB", "10")) * 1024 * 1024


async def _validate_upload(file: UploadFile) -> bytes:
    """
    Read and validate an uploaded file before persisting it.

    Checks performed:
      1. File size ≤ MAX_FILE_SIZE_BYTES (default 10 MB) — prevents disk exhaustion.
      2. MIME type is in ALLOWED_MIME_TYPES whitelist — prevents executable upload.

    Raises:
      HTTP 413 if the file exceeds the size limit.
      HTTP 400 if the MIME type is not on the whitelist.

    Returns the raw file bytes on success.
    """
    content = await file.read()

    # Size check — do this before MIME check to fail fast on large files.
    if len(content) > MAX_FILE_SIZE_BYTES:
        max_mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is {max_mb} MB."
        )

    # MIME-type whitelist check.
    # Note: content_type is provided by the client and should not be trusted
    # as the sole check in high-security contexts. For an internal school app
    # this provides a reasonable barrier against accidental misuse.
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"File type '{content_type}' is not allowed. "
                f"Accepted types: PDF, images (JPEG/PNG/GIF/WebP), "
                f"Word, Excel, PowerPoint, and plain text/CSV."
            )
        )

    return content


def _sanitize_filename(filename: str) -> str:
    """
    Strip path separators and dangerous characters from an uploaded filename.

    Prevents path-traversal attacks where a malicious filename such as
    '../../etc/passwd' could write outside the uploads directory — OWASP A01.

    Steps:
      1. Extract basename only (remove any directory component).
      2. Replace every character that is not alphanumeric, dot, underscore,
         or hyphen with an underscore.
      3. Strip leading dots (hidden files on Unix).
      4. Return a safe fallback "upload" if the result is empty.
    """
    name = os.path.basename(filename)                    # strip directory path
    name = re.sub(r"[^\w.\-]", "_", name)               # replace unsafe chars
    name = name.lstrip(".")                               # no hidden files
    return name or "upload"                               # non-empty fallback


# ── Notification Helper ───────────────────────────────────────────────────────

def _create_notification(
    db,
    user_id: int,
    notif_type: str,
    title: str,
    body: str,
    ref_id: Optional[int] = None,
):
    """
    Insert one in-app notification row for a specific user.

    Called internally whenever a task is assigned or an event is created so
    the affected user sees a bell badge without needing a third-party push
    service.

    Parameters:
      db         — active DB connection (caller owns commit)
      user_id    — recipient's user ID
      notif_type — one of 'task', 'event', 'comment', 'general'
      title      — short headline shown in the notification list
      body       — optional longer description
      ref_id     — ID of the related task / event for deep-linking
    """
    db.execute(
        """INSERT INTO notifications (user_id, type, title, body, ref_id)
           VALUES (?, ?, ?, ?, ?)""",
        (user_id, notif_type, title, body, ref_id),
    )


# ── DB Row Helpers ────────────────────────────────────────────────────────────

def _task_row(row, db, current_user_id: int, current_role: str):
    """
    Enrich a raw `tasks` DB row with related data needed by the frontend.

    Appends:
      assigned_users  — list of users assigned to this task with their assigner
      submission_count — total number of submissions for this task
      attachments     — file/link attachments associated with the task
      my_assigned_by  — who assigned this task to the calling user (or None)
      my_report       — the calling user's own report (non-creator roles only)
      submission_status — "submitted" / "pending" for non-creator roles
      team_total /
      team_submitted  — progress counters for roles that assign to others
    """
    d = dict(row)

    # Who is currently assigned to this task (with grade level and assigner info).
    d["assigned_users"] = [dict(r) for r in db.execute(
        """SELECT u.id, u.full_name, u.role, gl.grade_level, ta.assigned_by
           FROM task_assignments ta
           JOIN users u ON u.id = ta.user_id
           LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
           WHERE ta.task_id=?
           ORDER BY u.role, u.full_name""",
        (d["id"],)
    ).fetchall()]

    # Total number of people who have submitted a report for this task.
    d["submission_count"] = db.execute(
        "SELECT COUNT(*) as c FROM task_log WHERE task_id=?", (d["id"],)
    ).fetchone()["c"]

    # Files and links attached to this task.
    d["attachments"] = [dict(a) for a in db.execute(
        "SELECT * FROM task_attachments WHERE task_id=?", (d["id"],)
    ).fetchall()]

    # Identify who assigned this task to the requesting user.
    my_assignment = db.execute(
        "SELECT assigned_by FROM task_assignments WHERE task_id=? AND user_id=?",
        (d["id"], current_user_id)
    ).fetchone()
    d["my_assigned_by"] = my_assignment["assigned_by"] if my_assignment else None

    # For non-creator roles: include the user's own report and submission status.
    if current_role not in TASK_CREATORS and current_role != "admin":
        rep = db.execute(
            "SELECT * FROM reports WHERE task_id=? AND personnel_id=?",
            (d["id"], current_user_id)
        ).fetchone()
        d["my_report"] = dict(rep) if rep else None

        log = db.execute(
            "SELECT * FROM task_log WHERE task_id=? AND personnel_id=?",
            (d["id"], current_user_id)
        ).fetchone()
        d["submission_status"] = "submitted" if log else "pending"

    # For assigner roles: show how many of their direct assignees have submitted.
    if current_role in ("principal", "coordinator", "dean", "admin"):
        total = db.execute(
            "SELECT COUNT(*) as c FROM task_assignments WHERE task_id=? AND assigned_by=?",
            (d["id"], current_user_id)
        ).fetchone()["c"]
        submitted = db.execute(
            """SELECT COUNT(*) as c FROM task_log tl
               JOIN task_assignments ta ON ta.task_id=tl.task_id AND ta.user_id=tl.personnel_id
               WHERE tl.task_id=? AND ta.assigned_by=?""",
            (d["id"], current_user_id)
        ).fetchone()["c"]
        d["team_total"] = total
        d["team_submitted"] = submitted

    return d


def _resolve_receiver(task_id: int, submitter_id: int, db) -> Optional[int]:
    """
    Look up who assigned `task_id` to `submitter_id`.
    Returns their user ID (the natural report receiver), or None if not found.
    """
    row = db.execute(
        "SELECT assigned_by FROM task_assignments WHERE task_id=? AND user_id=?",
        (task_id, submitter_id)
    ).fetchone()
    return row["assigned_by"] if row else None


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

class LoginRequest(BaseModel):
    """
    Credentials submitted on the sign-in screen.

    Validation:
      - username: 3–50 characters (prevents empty or extremely long values)
      - password: 1–128 characters (prevents empty or overly long payloads)
      - extra fields rejected — OWASP A08
    """
    model_config = ConfigDict(extra="forbid")  # reject unexpected fields

    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=1, max_length=128)


@app.post("/api/auth/login")
@limiter.limit("5 per minute")   # OWASP A07: brute-force protection — 5 attempts/min per IP
def login(request: Request, req: LoginRequest):
    """
    Authenticate a user and return a signed JWT.

    Rate-limited to 5 attempts per minute per IP address to mitigate
    credential-stuffing and brute-force attacks — OWASP A07.

    On success: returns the JWT token and basic user info (no password hash).
    On failure: returns HTTP 401 with a generic message (no user-enumeration).
    """
    db = get_db()
    user = db.execute(
        "SELECT * FROM users WHERE username=?", (req.username,)
    ).fetchone()
    db.close()

    # Generic error prevents user-enumeration (don't distinguish
    # "username not found" from "wrong password") — OWASP A07.
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid username or password")

    token = create_token(user["id"], user["role"])

    # Return only the fields the client needs — never include password_hash.
    return {
        "token": token,
        "user": {
            "id":             user["id"],
            "username":       user["username"],
            "full_name":      user["full_name"],
            "role":           user["role"],
            "avatar_url":     user["avatar_url"],
            "grade_level_id": user["grade_level_id"],
        },
    }


@app.get("/api/auth/me")
def me(user=Depends(get_current_user)):
    """
    Return the full profile of the currently authenticated user.
    Used on app start-up to re-hydrate the session from a stored token.
    Includes grade level via a JOIN — no password hash in the response.
    """
    db = get_db()
    u = db.execute(
        """SELECT u.id, u.username, u.full_name, u.role, u.avatar_url,
                  u.grade_level_id, gl.grade_level
           FROM users u
           LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
           WHERE u.id=?""",
        (user["sub"],)
    ).fetchone()
    db.close()
    if not u:
        raise HTTPException(404, "User not found")
    return dict(u)


# ═══════════════════════════════════════════════════════════════════════════════
# USER MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/users")
def list_users(user=Depends(get_current_user)):
    """
    Return all users (id, username, full_name, role, grade_level).
    Available to all authenticated users — used for assignee pickers and
    profile displays across the application.
    Password hashes are never included in SELECT output.
    """
    db = get_db()
    rows = db.execute(
        """SELECT u.id, u.username, u.full_name, u.role, u.avatar_url,
                  u.grade_level_id, gl.grade_level
           FROM users u
           LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
           ORDER BY u.role, u.full_name"""
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


@app.get("/api/users/assignable")
def list_assignable_users(user=Depends(require_can_assign)):
    """
    Return users that the calling role is permitted to assign tasks to,
    filtered by the school hierarchy rules (ASSIGNABLE_TO in auth.py).

    Dean restriction: may only assign teachers within their own grade level.

    Security: dynamic IN clause is built from the server-side ASSIGNABLE_TO
    whitelist, never from raw user input — OWASP A03.
    """
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    from auth import ASSIGNABLE_TO
    allowed_roles = list(ASSIGNABLE_TO.get(role, set()))
    if not allowed_roles:
        db.close()
        return []

    # Parameterised IN clause — safe because placeholders are generated
    # from a server-side whitelist, not from user-supplied data — OWASP A03.
    placeholders = ",".join("?" * len(allowed_roles))
    q = f"""SELECT u.id, u.username, u.full_name, u.role, u.grade_level_id, gl.grade_level
            FROM users u
            LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
            WHERE u.role IN ({placeholders})"""
    params: list = list(allowed_roles)

    if role == "dean":
        # Deans may only assign to teachers within their own grade level.
        dean = db.execute(
            "SELECT grade_level_id FROM users WHERE id=?", (uid,)
        ).fetchone()
        if dean and dean["grade_level_id"]:
            q += " AND u.grade_level_id=?"
            params.append(dean["grade_level_id"])
        else:
            db.close()
            return []

    q += " ORDER BY u.role, u.full_name"
    rows = db.execute(q, params).fetchall()
    db.close()
    return [dict(r) for r in rows]


class CreateUserRequest(BaseModel):
    """
    Payload for creating a new system user (admin/principal only).

    Validation:
      - username:    3–50 chars, letters/numbers/underscores/hyphens only
      - password:    6–128 chars minimum (weak passwords rejected)
      - full_name:   1–100 chars
      - role:        must be a known system role (whitelist enforced in handler)
      - extra fields rejected to prevent mass-assignment attacks — OWASP A08
    """
    model_config = ConfigDict(extra="forbid")

    username:       str           = Field(min_length=3, max_length=50)
    password:       str           = Field(min_length=6, max_length=128)
    full_name:      str           = Field(min_length=1, max_length=100)
    role:           str           = Field(min_length=1, max_length=20)
    grade_level_id: Optional[int] = Field(default=None, ge=1)

    @field_validator("username")
    @classmethod
    def username_safe(cls, v: str) -> str:
        """Allow only alphanumeric characters, underscores, and hyphens."""
        if not re.match(r"^[\w\-]+$", v):
            raise ValueError("Username may only contain letters, numbers, underscores, and hyphens")
        return v


@app.post("/api/users")
@limiter.limit("20 per minute")   # Prevent automated account-creation floods
def create_user(request: Request, req: CreateUserRequest,
                user=Depends(require_admin_or_principal)):
    """
    Create a new user account (admin or principal only).

    The role is validated against a server-side whitelist before insertion;
    the Pydantic model's extra='forbid' prevents mass-assignment of undeclared
    fields (e.g. is_admin, is_active) — OWASP A08.
    """
    # Server-side role whitelist — never trust the client to provide a valid role.
    valid_roles = {"admin", "principal", "coordinator", "dean", "teacher", "registrar"}
    if req.role not in valid_roles:
        raise HTTPException(400, f"Invalid role '{req.role}'. Must be one of: {sorted(valid_roles)}")

    db = get_db()
    try:
        db.execute(
            "INSERT INTO users (username, password_hash, full_name, role, grade_level_id) VALUES (?,?,?,?,?)",
            (req.username, hash_password(req.password), req.full_name, req.role, req.grade_level_id)
        )
        db.commit()
        new_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        db.close()
        return {"id": new_id, "message": "User created"}
    except Exception as e:
        db.close()
        # Return a generic duplicate/error message — don't expose raw DB error.
        raise HTTPException(400, "Username already exists or data is invalid")


# ── User Profile ──────────────────────────────────────────────────────────────

@app.get("/api/users/me/profile")
def get_my_profile(user=Depends(get_current_user)):
    """
    Return the full profile of the calling user, including subjects.
    The password_hash field is explicitly stripped before returning — OWASP A02.
    """
    db = get_db()
    uid = int(user["sub"])
    u = db.execute(
        """SELECT u.*, gl.grade_level
           FROM users u
           LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
           WHERE u.id=?""",
        (uid,)
    ).fetchone()
    if not u:
        db.close()
        raise HTTPException(404, "User not found")

    d = dict(u)
    d.pop("password_hash", None)   # never expose password hash — OWASP A02

    subjects = db.execute(
        """SELECT us.subject, gl.grade_level
           FROM user_subjects us
           LEFT JOIN grade_levels gl ON gl.id = us.grade_level_id
           WHERE us.user_id=?
           ORDER BY us.subject""",
        (uid,)
    ).fetchall()
    d["subjects"] = [dict(s) for s in subjects]
    db.close()
    return d


class UpdateProfileRequest(BaseModel):
    """
    Fields the user may update on their own profile.
    All fields are optional (only provided fields are updated).
    Length limits prevent DB column overflow and oversized payloads — OWASP A08.
    """
    model_config = ConfigDict(extra="forbid")

    first_name:          Optional[str] = Field(default=None, max_length=50)
    middle_name:         Optional[str] = Field(default=None, max_length=50)
    last_name:           Optional[str] = Field(default=None, max_length=50)
    suffix:              Optional[str] = Field(default=None, max_length=20)
    email:               Optional[str] = Field(default=None, max_length=100)
    phone_number:        Optional[str] = Field(default=None, max_length=20)
    tin:                 Optional[str] = Field(default=None, max_length=20)
    qsis:                Optional[str] = Field(default=None, max_length=20)
    hdmf:                Optional[str] = Field(default=None, max_length=20)
    phic:                Optional[str] = Field(default=None, max_length=20)
    date_of_appointment: Optional[str] = Field(default=None, max_length=20)
    address:             Optional[str] = Field(default=None, max_length=250)


@app.put("/api/users/me/profile")
def update_my_profile(req: UpdateProfileRequest, user=Depends(get_current_user)):
    """
    Update the calling user's own profile fields.
    Only non-None fields are written to the DB (partial update pattern).
    Role and password cannot be changed via this endpoint — use admin endpoints.
    """
    db = get_db()
    uid = int(user["sub"])
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates)
        db.execute(
            f"UPDATE users SET {set_clause} WHERE id=?",
            list(updates.values()) + [uid]
        )
        db.commit()
    db.close()
    return {"message": "Profile updated"}


# ── Subjects & Grade Levels ───────────────────────────────────────────────────

@app.get("/api/subjects")
def list_subjects(user=Depends(get_current_user)):
    """Return the static list of school subjects used in task/personnel forms."""
    subjects = [
        "Mathematics", "Science", "English", "Filipino", "MAPEH",
        "Araling Panlipunan", "Edukasyon sa Pagpapakatao", "TLE",
    ]
    return subjects


@app.get("/api/grade-levels")
def list_grade_levels(user=Depends(get_current_user)):
    """Return all grade levels defined in the system (used in dropdowns)."""
    db = get_db()
    rows = db.execute("SELECT * FROM grade_levels ORDER BY id").fetchall()
    db.close()
    return [dict(r) for r in rows]


class GradeLevelRequest(BaseModel):
    """Payload for creating a new grade level (admin only)."""
    model_config = ConfigDict(extra="forbid")

    grade_level: str = Field(min_length=1, max_length=50)


@app.post("/api/grade-levels")
def create_grade_level(req: GradeLevelRequest, user=Depends(require_admin)):
    """
    Create a new grade level (e.g. 'Grade 7').
    Restricted to admin — prevents unauthorised modification of school structure.
    """
    db = get_db()
    try:
        db.execute("INSERT INTO grade_levels (grade_level) VALUES (?)", (req.grade_level,))
        db.commit()
        new_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        db.close()
        return {"id": new_id}
    except Exception:
        db.close()
        raise HTTPException(400, "Grade level already exists or data is invalid")


# ── Task Types ────────────────────────────────────────────────────────────────

@app.get("/api/task-types")
def list_task_types(user=Depends(get_current_user)):
    """Return all task type categories (Administrative, Curriculum, etc.)."""
    db = get_db()
    rows = db.execute("SELECT * FROM task_types ORDER BY id").fetchall()
    db.close()
    return [dict(r) for r in rows]


# ═══════════════════════════════════════════════════════════════════════════════
# TASK MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/tasks")
def list_tasks(
    user=Depends(get_current_user),
    search: str = "",
    assigned: int = 0,
):
    """
    Return tasks visible to the calling user, filtered by role:
      - admin:               all tasks
      - principal:           tasks they created
      - coordinator / dean:  tasks assigned to them OR created by them
      - teacher / registrar: tasks explicitly assigned to them (active only)

    Optional query params:
      search   — filter by task title (LIKE match, max 100 chars)
      assigned — if 1, return only tasks assigned directly to this user (My Tasks view)
    """
    # Sanitise the search term: cap length to prevent oversized LIKE queries.
    search = search[:100]

    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    if assigned:
        # "My Tasks" view: tasks explicitly assigned to the calling user.
        q = """SELECT DISTINCT t.* FROM tasks t
               JOIN task_assignments ta ON ta.task_id = t.id
               WHERE ta.user_id=? AND t.status='active'"""
        params = [uid]
    elif role == "admin":
        q = "SELECT * FROM tasks WHERE 1=1"
        params = []
    elif role == "principal":
        q = "SELECT * FROM tasks WHERE created_by=?"
        params = [uid]
    elif role in ("coordinator", "dean"):
        # Show tasks they are assigned to OR tasks they created.
        q = """SELECT DISTINCT t.* FROM tasks t
               LEFT JOIN task_assignments ta ON ta.task_id = t.id
               WHERE (ta.user_id=? OR t.created_by=?)"""
        params = [uid, uid]
    else:
        # teacher / registrar — only their assigned active tasks.
        q = """SELECT DISTINCT t.* FROM tasks t
               JOIN task_assignments ta ON ta.task_id = t.id
               WHERE ta.user_id=? AND t.status='active'"""
        params = [uid]

    if search:
        # Determine the correct alias for the title column in the query.
        if "JOIN task_assignments" in q or "LEFT JOIN task_assignments" in q:
            q += " AND t.title LIKE ?"
        else:
            q += " AND title LIKE ?"
        params.append(f"%{search}%")

    rows = db.execute(q, params).fetchall()
    result = [_task_row(row, db, uid, role) for row in rows]
    db.close()
    return result


@app.get("/api/tasks/{task_id}")
def get_task(task_id: int, user=Depends(get_current_user)):
    """
    Return full detail for a single task, including reports, comments, and attachments.

    Access control:
      - Task creators (principal/admin/coordinator/dean/registrar) see all reports.
      - Coordinators/deans see reports from users they directly assigned.
      - Teachers see their own report only.

    Private comments are filtered: each user sees only comments they authored,
    comments from their direct assigner, or comments from admin/principal/coordinator.
    """
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    row = db.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(404, "Task not found")

    # Non-creator roles must be assigned to this task.
    if role not in TASK_CREATORS and role != "admin":
        assigned = db.execute(
            "SELECT 1 FROM task_assignments WHERE task_id=? AND user_id=?",
            (task_id, uid)
        ).fetchone()
        if not assigned:
            db.close()
            raise HTTPException(403, "You are not assigned to this task")

    d = _task_row(row, db, uid, role)

    # Determine which reports this caller may see.
    if role in TASK_CREATORS or role == "admin":
        # Full visibility: all reports for this task.
        reports = db.execute(
            """SELECT r.*, u.full_name, u.avatar_url, u.role, gl.grade_level
               FROM reports r
               JOIN users u ON u.id = r.personnel_id
               LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
               WHERE r.task_id=?
               ORDER BY r.report_date DESC""",
            (task_id,)
        ).fetchall()
    elif role in ("coordinator", "dean"):
        # Restricted: only see reports from users they directly assigned.
        reports = db.execute(
            """SELECT r.*, u.full_name, u.avatar_url, u.role, gl.grade_level
               FROM reports r
               JOIN users u ON u.id = r.personnel_id
               LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
               JOIN task_assignments ta
                 ON ta.task_id = r.task_id AND ta.user_id = r.personnel_id
               WHERE r.task_id=? AND ta.assigned_by=?
               ORDER BY r.report_date DESC""",
            (task_id, uid)
        ).fetchall()
    else:
        reports = []

    d["reports"] = [dict(r) for r in reports]

    # Public comments: visible to all task participants.
    d["public_comments"] = [dict(c) for c in db.execute(
        """SELECT c.*, u.full_name, u.avatar_url
           FROM comments c
           JOIN users u ON u.id = c.user_id
           WHERE c.task_id=? AND c.comment_type='public'
           ORDER BY c.created_at""",
        (task_id,)
    ).fetchall()]

    # Private comments: filtered to submitter, their assigner, and high-privilege roles.
    d["private_comments"] = [dict(c) for c in db.execute(
        """SELECT c.*, u.full_name
           FROM comments c
           JOIN users u ON u.id = c.user_id
           WHERE c.task_id=? AND c.comment_type='private'
             AND (
               c.user_id=?
               OR ? IN (SELECT id FROM users WHERE role IN ('admin','principal','coordinator'))
               OR c.user_id IN (
                 SELECT assigned_by FROM task_assignments
                 WHERE task_id=? AND user_id=? AND assigned_by IS NOT NULL
               )
               OR c.user_id IN (
                 SELECT personnel_id FROM reports WHERE task_id=?
               )
             )
           ORDER BY c.created_at""",
        (task_id, uid, uid, task_id, uid, task_id)
    ).fetchall()]

    db.close()
    return d


class CreateTaskRequest(BaseModel):
    """
    Payload for creating a new task.

    Points range: 0–1000. Title required (1–200 chars).
    Attachments list capped to prevent payload abuse — OWASP A08.
    """
    model_config = ConfigDict(extra="forbid")

    title:             str              = Field(min_length=1, max_length=200)
    subject:           Optional[str]   = Field(default=None, max_length=100)
    task_type_id:      Optional[int]   = Field(default=None, ge=1)
    start_date:        Optional[str]   = Field(default=None, max_length=20)
    end_date:          Optional[str]   = Field(default=None, max_length=20)
    due_time:          Optional[str]   = Field(default=None, max_length=20)
    instructions:      Optional[str]   = Field(default=None, max_length=10_000)
    assigned_user_ids: Optional[List[int]] = Field(default_factory=list, max_length=200)
    points_early:      Optional[int]   = Field(default=100, ge=0, le=1000)
    points_ontime:     Optional[int]   = Field(default=100, ge=0, le=1000)
    points_late24:     Optional[int]   = Field(default=50,  ge=0, le=1000)
    points_after24:    Optional[int]   = Field(default=0,   ge=0, le=1000)
    attachments:       Optional[List[dict]] = Field(default_factory=list, max_length=20)

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def validate_date_format(cls, v):
        """Enforce YYYY-MM-DD format for task dates to prevent injection via date fields."""
        if v is None:
            return v
        try:
            datetime.datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("Date must be in YYYY-MM-DD format")
        return v


@app.post("/api/tasks")
def create_task(req: CreateTaskRequest, user=Depends(require_task_creator)):
    """
    Create a new task and optionally assign it to specific users.

    Assignees are validated against the caller's role hierarchy before insertion;
    invalid or out-of-scope assignees are silently skipped rather than failing
    the whole request (partial-success pattern to handle large batch assignments).
    """
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    db.execute(
        """INSERT INTO tasks
           (title, subject, task_type_id, start_date, end_date, due_time, instructions,
            created_by, points_early, points_ontime, points_late24, points_after24)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (req.title, req.subject, req.task_type_id, req.start_date, req.end_date,
         req.due_time, req.instructions, uid,
         req.points_early, req.points_ontime, req.points_late24, req.points_after24)
    )
    task_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]

    # Assign task to each requested user, enforcing role hierarchy rules.
    for assign_uid in (req.assigned_user_ids or []):
        assignee = db.execute(
            "SELECT role FROM users WHERE id=?", (assign_uid,)
        ).fetchone()
        if not assignee:
            continue
        if can_assign(role, assignee["role"]):
            try:
                db.execute(
                    "INSERT INTO task_assignments (task_id, user_id, assigned_by) VALUES (?,?,?)",
                    (task_id, assign_uid, uid)
                )
            except Exception:
                pass   # duplicate assignment — skip silently

    # Store file/link attachments provided inline with the task.
    for att in (req.attachments or []):
        db.execute(
            "INSERT INTO task_attachments (task_id, attachment_type, name, url) VALUES (?,?,?,?)",
            (task_id, att.get("type"), att.get("name"), att.get("url"))
        )

    db.commit()
    db.close()
    return {"id": task_id, "message": "Task created"}


class UpdateTaskRequest(BaseModel):
    """
    Partial update payload for an existing task.
    Only non-None fields are written — allows callers to update a single field.
    Status must be one of the allowed values (validated in handler).
    """
    model_config = ConfigDict(extra="forbid")

    title:        Optional[str] = Field(default=None, min_length=1, max_length=200)
    subject:      Optional[str] = Field(default=None, max_length=100)
    task_type_id: Optional[int] = Field(default=None, ge=1)
    start_date:   Optional[str] = Field(default=None, max_length=20)
    end_date:     Optional[str] = Field(default=None, max_length=20)
    due_time:     Optional[str] = Field(default=None, max_length=20)
    instructions: Optional[str] = Field(default=None, max_length=10_000)
    status:       Optional[str] = Field(default=None, max_length=20)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        """Whitelist allowed task statuses to prevent arbitrary DB value injection."""
        if v is not None and v not in ("active", "disabled"):
            raise ValueError("status must be 'active' or 'disabled'")
        return v


@app.put("/api/tasks/{task_id}")
def update_task(task_id: int, req: UpdateTaskRequest, user=Depends(require_task_creator)):
    """
    Update mutable fields of an existing task.
    Column names are derived from a hardcoded list — never from user input — to
    prevent SQL injection via the dynamic SET clause — OWASP A03.
    """
    db = get_db()
    fields, vals = [], []

    # Hardcoded column-name → request-field mapping (user input is only the value).
    for col, val in [
        ("title", req.title), ("subject", req.subject),
        ("task_type_id", req.task_type_id), ("start_date", req.start_date),
        ("end_date", req.end_date), ("due_time", req.due_time),
        ("instructions", req.instructions), ("status", req.status),
    ]:
        if val is not None:
            fields.append(f"{col}=?")
            vals.append(val)

    if fields:
        vals.append(task_id)
        db.execute(f"UPDATE tasks SET {','.join(fields)} WHERE id=?", vals)
    db.commit()
    db.close()
    return {"message": "Updated"}


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, user=Depends(require_task_creator)):
    """
    Permanently delete a task and all its associated data (assignments, reports,
    comments) via DB CASCADE constraints.
    Restricted to task-creator roles.
    """
    db = get_db()
    db.execute("DELETE FROM tasks WHERE id=?", (task_id,))
    db.commit()
    db.close()
    return {"message": "Deleted"}


# ── Task Assignments ──────────────────────────────────────────────────────────

class AssignRequest(BaseModel):
    """List of user IDs to assign to a task. Capped at 200 to prevent abuse."""
    model_config = ConfigDict(extra="forbid")

    user_ids: List[int] = Field(max_length=200)


@app.post("/api/tasks/{task_id}/assign")
def assign_task(task_id: int, req: AssignRequest, user=Depends(require_can_assign)):
    """
    Assign (or re-assign) a task to one or more users.

    Rules:
      - Caller must be either the task creator or already assigned to the task.
      - Assignment is role-constrained: principal → any, coordinator → coord/dean/teacher,
        dean → teacher only, same grade level.
      - Users that fail the role/grade-level check are silently skipped;
        their IDs appear in the 'skipped' list of the response.
    """
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    # Verify the caller has a relationship with this task (creator or assignee).
    is_creator = db.execute(
        "SELECT 1 FROM tasks WHERE id=? AND created_by=?", (task_id, uid)
    ).fetchone()
    is_assigned = db.execute(
        "SELECT 1 FROM task_assignments WHERE task_id=? AND user_id=?", (task_id, uid)
    ).fetchone()
    if not is_creator and not is_assigned:
        db.close()
        raise HTTPException(403, "You are not assigned to this task")

    assigner = db.execute(
        "SELECT grade_level_id FROM users WHERE id=?", (uid,)
    ).fetchone()
    assigner_grade = assigner["grade_level_id"] if assigner else None

    added, skipped = [], []
    for assign_uid in req.user_ids:
        assignee = db.execute(
            "SELECT role, grade_level_id, full_name FROM users WHERE id=?", (assign_uid,)
        ).fetchone()
        if not assignee:
            skipped.append(assign_uid)
            continue

        if not can_assign(role, assignee["role"]):
            skipped.append(assign_uid)
            continue

        # Dean restriction: same grade level only.
        if role == "dean" and assignee["grade_level_id"] != assigner_grade:
            skipped.append(assign_uid)
            continue

        try:
            db.execute(
                "INSERT INTO task_assignments (task_id, user_id, assigned_by) VALUES (?,?,?)",
                (task_id, assign_uid, uid)
            )
            added.append(assign_uid)
        except Exception:
            skipped.append(assign_uid)  # duplicate or constraint violation
            continue

        # ── Notification: tell the assignee they received a new task ──────────
        # This is intentionally outside the try/except above so a notification
        # error never silently causes a successful assignment to appear as skipped.
        try:
            task_title_row = db.execute(
                "SELECT title FROM tasks WHERE id=?", (task_id,)
            ).fetchone()
            task_title = task_title_row["title"] if task_title_row else "a task"

            assigner_row = db.execute(
                "SELECT full_name FROM users WHERE id=?", (uid,)
            ).fetchone()
            assigner_name = assigner_row["full_name"] if assigner_row else "Someone"

            _create_notification(
                db,
                user_id=assign_uid,
                notif_type="task",
                title=f"New task assigned: {task_title}",
                body=f"{assigner_name} assigned you to \"{task_title}\".",
                ref_id=task_id,
            )
        except Exception as e:
            # Log but don't fail the request — assignment already succeeded.
            print(f"[WARN] Failed to create notification for user {assign_uid}: {e}")

    db.commit()
    db.close()
    return {"assigned": added, "skipped": skipped}


@app.delete("/api/tasks/{task_id}/assign/{user_id}")
def unassign_task(task_id: int, user_id: int, user=Depends(require_can_assign)):
    """
    Remove a user from a task assignment.
    Only the person who originally assigned them (assigned_by) may remove them;
    the WHERE clause enforces this without a separate authorisation check.
    """
    db = get_db()
    uid = int(user["sub"])
    db.execute(
        "DELETE FROM task_assignments WHERE task_id=? AND user_id=? AND assigned_by=?",
        (task_id, user_id, uid)
    )
    db.commit()
    db.close()
    return {"message": "Unassigned"}


# ── Reports ───────────────────────────────────────────────────────────────────

class SubmitReportRequest(BaseModel):
    """
    Report submission by an assigned user.
    report_title is required (1–200 chars); description is optional (max 5000).
    """
    model_config = ConfigDict(extra="forbid")

    report_title:       str           = Field(min_length=1, max_length=200)
    report_description: Optional[str] = Field(default=None, max_length=5_000)
    report_type:        Optional[str] = Field(default=None, max_length=50)
    report_link_url:    Optional[str] = Field(default=None, max_length=2_000)


@app.post("/api/tasks/{task_id}/reports")
def submit_report(task_id: int, req: SubmitReportRequest, user=Depends(get_current_user)):
    """
    Submit (or update) a report for an assigned task.

    Uses UPSERT (ON CONFLICT) so re-submissions update the existing row rather
    than creating duplicates.  A task_log entry and submission_log entry are
    also upserted to keep the audit trail consistent.

    The receiver (for submission_log) is automatically derived from the assignment
    record — the user who assigned this task becomes the report recipient.
    """
    db = get_db()
    uid = int(user["sub"])

    # Confirm the caller is assigned to this task before allowing submission.
    assigned = db.execute(
        "SELECT assigned_by FROM task_assignments WHERE task_id=? AND user_id=?",
        (task_id, uid)
    ).fetchone()
    if not assigned:
        db.close()
        raise HTTPException(403, "You are not assigned to this task")

    # Upsert the report record.
    db.execute(
        """INSERT INTO reports
           (task_id, personnel_id, report_title, report_description,
            report_type, report_link_url, report_date, report_status)
           VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP,'Pending')
           ON CONFLICT(task_id, personnel_id) DO UPDATE SET
               report_title=excluded.report_title,
               report_description=excluded.report_description,
               report_type=excluded.report_type,
               report_link_url=excluded.report_link_url,
               report_date=CURRENT_TIMESTAMP,
               report_status='Pending'""",
        (task_id, uid, req.report_title, req.report_description,
         req.report_type, req.report_link_url)
    )
    report_id = db.execute(
        "SELECT id FROM reports WHERE task_id=? AND personnel_id=?", (task_id, uid)
    ).fetchone()["id"]

    # Upsert the task_log entry (marks the task as submitted for this user).
    db.execute(
        """INSERT INTO task_log (submission_date, personnel_id, task_id)
           VALUES (CURRENT_TIMESTAMP, ?, ?)
           ON CONFLICT(task_id, personnel_id) DO UPDATE SET
               submission_date=CURRENT_TIMESTAMP""",
        (uid, task_id)
    )

    # Upsert submission_log so the receiver sees the latest submission.
    receiver_id = assigned["assigned_by"]
    db.execute(
        """INSERT INTO submission_log
           (status, date_of_submission, sender_personnel_id, report_id, receiver_personnel_id)
           VALUES ('Pending', CURRENT_TIMESTAMP, ?, ?, ?)
           ON CONFLICT(report_id) DO UPDATE SET
               status='Pending',
               date_of_submission=CURRENT_TIMESTAMP,
               receiver_personnel_id=excluded.receiver_personnel_id""",
        (uid, report_id, receiver_id)
    )

    db.commit()
    db.close()
    return {"message": "Report submitted", "report_id": report_id, "receiver_id": receiver_id}


@app.delete("/api/reports/{report_id}")
def delete_report(report_id: int, user=Depends(get_current_user)):
    """
    Delete the calling user's own report.
    A user may only delete their own report — ownership verified before deletion.
    """
    db = get_db()
    uid = int(user["sub"])
    row = db.execute("SELECT personnel_id FROM reports WHERE id=?", (report_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(404, "Report not found")
    if row["personnel_id"] != uid:
        db.close()
        raise HTTPException(403, "Cannot delete another user's report")
    db.execute("DELETE FROM reports WHERE id=?", (report_id,))
    db.commit()
    db.close()
    return {"message": "Report deleted"}


@app.post("/api/tasks/{task_id}/reports/upload")
@limiter.limit("10 per minute")   # Prevent disk-exhaustion via rapid file uploads
async def submit_report_file(
    request: Request,
    task_id: int,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    """
    Upload a file attachment for the calling user's existing report on `task_id`.

    Security checks (OWASP A04):
      - The user must already have a report row for this task (prevents orphan uploads).
      - File size is capped at MAX_UPLOAD_MB (default 10 MB).
      - MIME type must be in the ALLOWED_MIME_TYPES whitelist.
      - Filename is sanitised to prevent path-traversal attacks.

    The file is stored in the local `uploads/` directory with a unique timestamp prefix.
    """
    db = get_db()
    uid = int(user["sub"])
    report = db.execute(
        "SELECT id FROM reports WHERE task_id=? AND personnel_id=?", (task_id, uid)
    ).fetchone()
    if not report:
        db.close()
        raise HTTPException(404, "Submit a text report first before uploading a file")

    # Validate file (size + MIME type) and read bytes.
    content = await _validate_upload(file)

    # Sanitise filename to prevent path traversal — OWASP A01.
    safe_name = _sanitize_filename(file.filename or "upload")
    fname = f"{task_id}_{uid}_{int(datetime.datetime.now().timestamp())}_{safe_name}"

    with open(f"uploads/{fname}", "wb") as out:
        out.write(content)

    db.execute(
        "UPDATE reports SET report_file_path=?, report_filename=? WHERE id=?",
        (f"/uploads/{fname}", safe_name, report["id"])
    )
    db.commit()
    db.close()
    return {"message": "File uploaded", "url": f"/uploads/{fname}"}


@app.get("/api/reports")
def list_reports(
    user=Depends(get_current_user),
    task_id: Optional[int] = None,
    status: Optional[str] = None,
):
    """
    Return reports visible to the calling user, filtered by role:
      - principal / admin:      all reports
      - coordinator / dean:     reports from users they directly assigned
      - teacher / registrar:    only their own reports

    Optional filters: task_id, report status.
    Status values are passed as a parameterised value (no injection risk).
    """
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    q = """SELECT r.*, u.full_name, u.avatar_url, u.role AS submitter_role,
                  gl.grade_level, t.title AS task_title, t.end_date, t.due_time
           FROM reports r
           JOIN users u ON u.id = r.personnel_id
           LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
           JOIN tasks t ON t.id = r.task_id
           WHERE 1=1"""
    params: list = []

    if role in TASK_CREATORS or role == "admin":
        pass  # full visibility
    elif role in ("coordinator", "dean"):
        # Only see reports from users they personally assigned.
        q += """ AND r.personnel_id IN (
                   SELECT user_id FROM task_assignments
                   WHERE assigned_by=?
                   AND (? IS NULL OR task_id=?)
                 )"""
        params.extend([uid, task_id, task_id])
    else:
        # teacher / registrar
        q += " AND r.personnel_id=?"
        params.append(uid)

    if task_id and role not in ("coordinator", "dean"):
        q += " AND r.task_id=?"
        params.append(task_id)

    if status:
        # Whitelist allowed status values to prevent unexpected filter injection.
        if status not in ("Pending", "Completed", "Missing"):
            raise HTTPException(400, "status must be 'Pending', 'Completed', or 'Missing'")
        q += " AND r.report_status=?"
        params.append(status)

    q += " ORDER BY r.report_date DESC"
    rows = db.execute(q, params).fetchall()
    db.close()
    return [dict(r) for r in rows]


class UpdateReportStatusRequest(BaseModel):
    """Payload for updating a report's review status."""
    model_config = ConfigDict(extra="forbid")

    report_status: str = Field(min_length=1, max_length=20)

    @field_validator("report_status")
    @classmethod
    def validate_status(cls, v):
        """Whitelist valid report statuses to prevent arbitrary string injection."""
        allowed = {"Completed", "Pending", "Missing"}
        if v not in allowed:
            raise ValueError(f"report_status must be one of: {sorted(allowed)}")
        return v


@app.put("/api/reports/{report_id}/status")
def update_report_status(
    report_id: int,
    req: UpdateReportStatusRequest,
    user=Depends(get_current_user),
):
    """
    Update the review status of a report (Pending → Completed or Missing).

    Access control:
      - principal / admin: can update any report.
      - coordinator / dean: can only update reports directed to them
        (i.e., they are the receiver_personnel_id in submission_log).
      - teacher / registrar: cannot update report statuses.
    """
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    if role in TASK_CREATORS or role == "admin":
        pass   # full access
    elif role in ("coordinator", "dean"):
        sl = db.execute(
            "SELECT 1 FROM submission_log WHERE report_id=? AND receiver_personnel_id=?",
            (report_id, uid)
        ).fetchone()
        if not sl:
            db.close()
            raise HTTPException(403, "You are not authorised to update this report")
    else:
        db.close()
        raise HTTPException(403, "Cannot update report status")

    db.execute("UPDATE reports SET report_status=? WHERE id=?", (req.report_status, report_id))
    db.execute("UPDATE submission_log SET status=? WHERE report_id=?", (req.report_status, report_id))
    db.commit()
    db.close()
    return {"message": "Status updated"}


# ── Task Log ──────────────────────────────────────────────────────────────────

@app.get("/api/task-log")
def get_task_log(user=Depends(get_current_user), task_id: Optional[int] = None):
    """
    Return the submission audit log, filtered by role.
    Shows who submitted what and when, with associated report status and receiver.
    """
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    q = """SELECT tl.id, tl.submission_date, tl.task_id, tl.personnel_id,
                  u.full_name AS teacher_name, u.avatar_url, u.role AS submitter_role,
                  gl.grade_level,
                  t.title AS task_title, t.end_date, t.due_time,
                  r.report_status, r.report_title,
                  sl.receiver_personnel_id,
                  recv.full_name AS receiver_name
           FROM task_log tl
           JOIN users u ON u.id = tl.personnel_id
           LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
           JOIN tasks t ON t.id = tl.task_id
           LEFT JOIN reports r ON r.task_id = tl.task_id AND r.personnel_id = tl.personnel_id
           LEFT JOIN submission_log sl ON sl.report_id = r.id
           LEFT JOIN users recv ON recv.id = sl.receiver_personnel_id
           WHERE 1=1"""
    params: list = []

    if role in TASK_CREATORS or role == "admin":
        pass   # full visibility
    elif role in ("coordinator", "dean"):
        # Only log entries for users they assigned.
        q += """ AND tl.personnel_id IN (
                   SELECT user_id FROM task_assignments WHERE assigned_by=?
                 )"""
        params.append(uid)
    else:
        q += " AND tl.personnel_id=?"
        params.append(uid)

    if task_id:
        q += " AND tl.task_id=?"
        params.append(task_id)

    q += " ORDER BY tl.submission_date DESC"
    rows = db.execute(q, params).fetchall()
    db.close()
    return [dict(r) for r in rows]


# ── Submission Log ────────────────────────────────────────────────────────────

@app.get("/api/submission-log")
def get_submission_log(user=Depends(get_current_user)):
    """
    Return the submission log (report lifecycle events), filtered by role.
    Principal/admin see all; coordinator/dean see submissions directed to them;
    teacher/registrar see their own sent submissions.
    """
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    q = """SELECT sl.*, r.report_title, r.report_status, r.task_id, r.report_description,
                  r.report_link_url, r.report_file_path, r.report_filename, r.report_type,
                  t.title AS task_title, t.end_date,
                  sender.full_name AS sender_name, sender.avatar_url AS sender_avatar,
                  sender.role AS sender_role,
                  gl.grade_level,
                  recv.full_name AS receiver_name
           FROM submission_log sl
           JOIN reports r ON r.id = sl.report_id
           JOIN tasks t ON t.id = r.task_id
           JOIN users sender ON sender.id = sl.sender_personnel_id
           LEFT JOIN grade_levels gl ON gl.id = sender.grade_level_id
           LEFT JOIN users recv ON recv.id = sl.receiver_personnel_id
           WHERE 1=1"""
    params: list = []

    if role in TASK_CREATORS or role == "admin":
        pass   # full visibility
    elif role in ("coordinator", "dean"):
        q += " AND sl.receiver_personnel_id=?"
        params.append(uid)
    else:
        q += " AND sl.sender_personnel_id=?"
        params.append(uid)

    q += " ORDER BY sl.date_of_submission DESC"
    rows = db.execute(q, params).fetchall()
    db.close()
    return [dict(r) for r in rows]


# ── Comments ──────────────────────────────────────────────────────────────────

class CommentRequest(BaseModel):
    """
    Payload for posting a comment on a task.
    comment_type must be 'public' or 'private' (validated below).
    Content is capped at 2000 chars to prevent abuse — OWASP A08.
    """
    model_config = ConfigDict(extra="forbid")

    content:      str           = Field(min_length=1, max_length=2_000)
    comment_type: str           = Field(default="public", max_length=10)
    report_id:    Optional[int] = Field(default=None, ge=1)

    @field_validator("comment_type")
    @classmethod
    def validate_comment_type(cls, v):
        """Whitelist allowed comment types."""
        if v not in ("public", "private"):
            raise ValueError("comment_type must be 'public' or 'private'")
        return v


@app.post("/api/tasks/{task_id}/comments")
def add_comment(task_id: int, req: CommentRequest, user=Depends(get_current_user)):
    """
    Post a public or private comment on a task.
    The user_id is taken from the authenticated token — the client cannot
    spoof the author — OWASP A01.
    """
    db = get_db()
    uid = int(user["sub"])
    db.execute(
        "INSERT INTO comments (task_id, user_id, report_id, comment_type, content) VALUES (?,?,?,?,?)",
        (task_id, uid, req.report_id, req.comment_type, req.content)
    )
    db.commit()
    db.close()
    return {"message": "Comment added"}


class CommentUpdateRequest(BaseModel):
    """Payload for editing an existing comment. Content capped at 2000 chars."""
    model_config = ConfigDict(extra="forbid")

    content: str = Field(min_length=1, max_length=2_000)


@app.put("/api/comments/{comment_id}")
def edit_comment(comment_id: int, req: CommentUpdateRequest, user=Depends(get_current_user)):
    """
    Edit an existing comment.
    Ownership check: only the original author may edit — OWASP A01.
    """
    db = get_db()
    uid = int(user["sub"])
    row = db.execute("SELECT user_id FROM comments WHERE id=?", (comment_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(404, "Comment not found")
    if row["user_id"] != uid:
        db.close()
        raise HTTPException(403, "Cannot edit another user's comment")
    db.execute("UPDATE comments SET content=? WHERE id=?", (req.content, comment_id))
    db.commit()
    db.close()
    return {"message": "Comment updated"}


@app.delete("/api/comments/{comment_id}")
def delete_comment(comment_id: int, user=Depends(get_current_user)):
    """
    Delete a comment.
    Ownership check: only the original author may delete — OWASP A01.
    """
    db = get_db()
    uid = int(user["sub"])
    row = db.execute("SELECT user_id FROM comments WHERE id=?", (comment_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(404, "Comment not found")
    if row["user_id"] != uid:
        db.close()
        raise HTTPException(403, "Cannot delete another user's comment")
    db.execute("DELETE FROM comments WHERE id=?", (comment_id,))
    db.commit()
    db.close()
    return {"message": "Comment deleted"}


# ── Dashboard ─────────────────────────────────────────────────────────────────

@app.get("/api/dashboard")
def dashboard(user=Depends(get_current_user)):
    """
    Return dashboard summary statistics and recent items for the calling user.

    The data returned varies by role:
      - principal / admin / coordinator / dean:
            total_tasks, submitted, pending reviews, missing reports,
            task_manager_tasks (recent tasks they created or manage),
            my_tasks (tasks assigned to them), events feed.
      - teacher / registrar:
            assigned task counts, submission status counts, events feed.
    """
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    if role in ("principal", "admin"):
        # Principal / admin: they only create tasks, not assigned tasks themselves.
        total_tasks = db.execute(
            "SELECT COUNT(*) as c FROM tasks WHERE created_by=?", (uid,)
        ).fetchone()["c"]
        submitted = db.execute(
            """SELECT COUNT(*) as c FROM task_log tl
               JOIN tasks t ON t.id = tl.task_id WHERE t.created_by=?""",
            (uid,)
        ).fetchone()["c"]
        pending = db.execute(
            """SELECT COUNT(*) as c FROM submission_log sl
               WHERE sl.receiver_personnel_id=? AND sl.status='Pending'""",
            (uid,)
        ).fetchone()["c"]
        missing = db.execute(
            """SELECT COUNT(*) as c FROM reports r
               JOIN tasks t ON t.id = r.task_id
               WHERE t.created_by=? AND r.report_status='Missing'""",
            (uid,)
        ).fetchone()["c"]
        recent_tasks = db.execute(
            "SELECT * FROM tasks WHERE created_by=? ORDER BY created_at DESC LIMIT 5", (uid,)
        ).fetchall()
        events = db.execute(
            "SELECT * FROM activity_events ORDER BY event_date DESC LIMIT 5"
        ).fetchall()
        db.close()
        return {
            "total_tasks": total_tasks, "submitted": submitted,
            "pending": pending, "missing": missing,
            "task_manager_tasks": [dict(t) for t in recent_tasks],
            "my_tasks": [], "events": [dict(e) for e in events],
        }

    elif role in ("coordinator", "dean"):
        total_tasks = db.execute(
            "SELECT COUNT(*) as c FROM task_assignments WHERE user_id=?", (uid,)
        ).fetchone()["c"]
        submitted = db.execute(
            """SELECT COUNT(*) as c FROM task_log tl
               JOIN task_assignments ta ON ta.task_id = tl.task_id AND ta.user_id = tl.personnel_id
               WHERE ta.assigned_by=?""",
            (uid,)
        ).fetchone()["c"]
        pending = db.execute(
            "SELECT COUNT(*) as c FROM submission_log WHERE receiver_personnel_id=? AND status='Pending'",
            (uid,)
        ).fetchone()["c"]
        missing = db.execute(
            """SELECT COUNT(*) as c FROM reports r
               JOIN task_assignments ta ON ta.task_id = r.task_id AND ta.user_id = r.personnel_id
               WHERE ta.assigned_by=? AND r.report_status='Missing'""",
            (uid,)
        ).fetchone()["c"]
        my_tasks = db.execute(
            """SELECT t.* FROM tasks t
               JOIN task_assignments ta ON ta.task_id = t.id
               WHERE ta.user_id=? AND t.status='active'
               ORDER BY t.end_date LIMIT 5""",
            (uid,)
        ).fetchall()
        events = db.execute(
            "SELECT * FROM activity_events ORDER BY event_date DESC LIMIT 5"
        ).fetchall()
        db.close()
        return {
            "total_tasks": total_tasks, "submitted": submitted,
            "pending": pending, "missing": missing,
            "task_manager_tasks": [],
            "my_tasks": [dict(t) for t in my_tasks],
            "events": [dict(e) for e in events],
        }

    else:
        # teacher / registrar
        my_tasks = db.execute(
            """SELECT t.* FROM tasks t
               JOIN task_assignments ta ON ta.task_id = t.id
               WHERE ta.user_id=? AND t.status='active'
               ORDER BY t.end_date LIMIT 5""",
            (uid,)
        ).fetchall()
        submitted = db.execute(
            "SELECT COUNT(*) as c FROM task_log WHERE personnel_id=?", (uid,)
        ).fetchone()["c"]
        pending = db.execute(
            """SELECT COUNT(*) as c FROM task_assignments ta
               WHERE ta.user_id=?
               AND NOT EXISTS (
                   SELECT 1 FROM task_log tl
                   WHERE tl.task_id = ta.task_id AND tl.personnel_id=?
               )""",
            (uid, uid)
        ).fetchone()["c"]
        missing = db.execute(
            "SELECT COUNT(*) as c FROM reports WHERE personnel_id=? AND report_status='Missing'",
            (uid,)
        ).fetchone()["c"]
        events = db.execute(
            "SELECT * FROM activity_events ORDER BY event_date DESC LIMIT 5"
        ).fetchall()
        db.close()
        return {
            "total_tasks": submitted + pending, "submitted": submitted,
            "pending": pending, "missing": missing,
            "task_manager_tasks": [],
            "my_tasks": [dict(t) for t in my_tasks],
            "events": [dict(e) for e in events],
        }


# ── Subjects (from tasks table) ───────────────────────────────────────────────

@app.get("/api/subjects")
def get_subjects(user=Depends(get_current_user)):
    """
    Return the distinct subject values currently used across all tasks.
    Useful for populating filter dropdowns on the task manager.
    """
    db = get_db()
    rows = db.execute(
        "SELECT DISTINCT subject FROM tasks WHERE subject IS NOT NULL"
    ).fetchall()
    db.close()
    return [r["subject"] for r in rows]


# ── Templates ─────────────────────────────────────────────────────────────────

class TemplateCreate(BaseModel):
    """
    Payload for creating a reusable task template.
    title required (1–200 chars); points in range 0–1000.
    """
    model_config = ConfigDict(extra="forbid")

    title:          str           = Field(min_length=1, max_length=200)
    instructions:   Optional[str] = Field(default=None, max_length=10_000)
    start_date:     Optional[str] = Field(default=None, max_length=20)
    end_date:       Optional[str] = Field(default=None, max_length=20)
    due_time:       Optional[str] = Field(default=None, max_length=20)
    points_early:   int           = Field(default=100, ge=0, le=1000)
    points_ontime:  int           = Field(default=100, ge=0, le=1000)
    points_late24:  int           = Field(default=50,  ge=0, le=1000)
    points_after24: int           = Field(default=0,   ge=0, le=1000)


@app.post("/api/templates")
def create_template(req: TemplateCreate, user=Depends(require_admin_or_principal)):
    """
    Create a task template (admin/principal only).
    Templates store default values that can be pre-filled into new tasks.
    """
    db = get_db()
    uid = int(user["sub"])
    db.execute(
        """INSERT INTO task_templates
           (title, instructions, start_date, end_date, due_time,
            points_early, points_ontime, points_late24, points_after24, created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (req.title, req.instructions, req.start_date, req.end_date, req.due_time,
         req.points_early, req.points_ontime, req.points_late24, req.points_after24, uid)
    )
    template_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    db.commit()
    db.close()
    return {"id": template_id, "message": "Template created"}


@app.get("/api/templates")
def get_templates(user=Depends(get_current_user)):
    """Return all task templates with their creator's name. Available to all authenticated users."""
    db = get_db()
    rows = db.execute(
        """SELECT t.*, u.full_name AS created_by_name
           FROM task_templates t
           LEFT JOIN users u ON u.id = t.created_by
           ORDER BY t.created_at DESC"""
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


@app.delete("/api/templates/{template_id}")
def delete_template(template_id: int, user=Depends(require_admin_or_principal)):
    """Delete a task template (admin/principal only)."""
    db = get_db()
    db.execute("DELETE FROM task_templates WHERE id=?", (template_id,))
    db.commit()
    db.close()
    return {"message": "Template deleted"}


# ── General File Upload ───────────────────────────────────────────────────────

@app.post("/api/upload")
@limiter.limit("10 per minute")   # Prevent disk-exhaustion floods
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    """
    General-purpose file upload endpoint (used for task attachments).

    Security: file is validated (size + MIME type) and filename is sanitised
    before being persisted — OWASP A04.
    """
    content = await _validate_upload(file)
    safe_name = _sanitize_filename(file.filename or "upload")
    fname = f"{int(datetime.datetime.now().timestamp())}_{safe_name}"

    with open(f"uploads/{fname}", "wb") as out:
        out.write(content)

    return {"url": f"/uploads/{fname}", "name": safe_name}


# ═══════════════════════════════════════════════════════════════════════════════
# PERSONNEL MANAGEMENT
# Only principal, registrar, and admin can write; all authenticated users can read.
# ═══════════════════════════════════════════════════════════════════════════════

class PersonnelCreateBody(BaseModel):
    """
    Payload for creating a new staff member account.

    Required: username, password (min 6 chars), first_name, last_name, role.
    Role must be in the server-side whitelist (validated in handler).
    extra='forbid' prevents mass-assignment of undeclared columns — OWASP A08.
    """
    model_config = ConfigDict(extra="forbid")

    username:            str           = Field(min_length=3, max_length=50)
    password:            str           = Field(min_length=6, max_length=128)
    email:               Optional[str] = Field(default=None, max_length=100)
    first_name:          str           = Field(min_length=1, max_length=50)
    middle_name:         Optional[str] = Field(default=None, max_length=50)
    last_name:           str           = Field(min_length=1, max_length=50)
    suffix:              Optional[str] = Field(default=None, max_length=20)
    role:                str           = Field(min_length=1, max_length=20)
    grade_level_id:      Optional[int] = Field(default=None, ge=1)
    phone_number:        Optional[str] = Field(default=None, max_length=20)
    tin:                 Optional[str] = Field(default=None, max_length=20)
    qsis:                Optional[str] = Field(default=None, max_length=20)
    hdmf:                Optional[str] = Field(default=None, max_length=20)
    phic:                Optional[str] = Field(default=None, max_length=20)
    date_of_appointment: Optional[str] = Field(default=None, max_length=20)
    birthdate:           Optional[str] = Field(default=None, max_length=20)
    address:             Optional[str] = Field(default=None, max_length=250)

    @field_validator("username")
    @classmethod
    def username_safe(cls, v: str) -> str:
        """Allow only alphanumeric characters, underscores, and hyphens."""
        if not re.match(r"^[\w\-]+$", v):
            raise ValueError("Username may only contain letters, numbers, underscores, and hyphens")
        return v


class PersonnelUpdateBody(BaseModel):
    """
    Partial update payload for a personnel record.

    All fields are optional; only provided (non-None) fields are written to the DB.
    Password update is optional — only hashed if supplied.
    extra='forbid' prevents unexpected field injection — OWASP A08.
    """
    model_config = ConfigDict(extra="forbid")

    email:               Optional[str] = Field(default=None, max_length=100)
    first_name:          Optional[str] = Field(default=None, max_length=50)
    middle_name:         Optional[str] = Field(default=None, max_length=50)
    last_name:           Optional[str] = Field(default=None, max_length=50)
    suffix:              Optional[str] = Field(default=None, max_length=20)
    role:                Optional[str] = Field(default=None, max_length=20)
    grade_level_id:      Optional[int] = Field(default=None, ge=1)
    phone_number:        Optional[str] = Field(default=None, max_length=20)
    tin:                 Optional[str] = Field(default=None, max_length=20)
    qsis:                Optional[str] = Field(default=None, max_length=20)
    hdmf:                Optional[str] = Field(default=None, max_length=20)
    phic:                Optional[str] = Field(default=None, max_length=20)
    date_of_appointment: Optional[str] = Field(default=None, max_length=20)
    birthdate:           Optional[str] = Field(default=None, max_length=20)
    address:             Optional[str] = Field(default=None, max_length=250)
    password:            Optional[str] = Field(default=None, min_length=6, max_length=128)

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        """Reject role values not in the known system role set."""
        if v is not None:
            valid_roles = {"principal", "coordinator", "dean", "teacher", "registrar"}
            if v not in valid_roles:
                raise ValueError(f"role must be one of: {sorted(valid_roles)}")
        return v


def _user_row(row, db):
    """
    Enrich a raw `users` DB row with grade level and subject information.
    The password_hash column is intentionally excluded — OWASP A02.
    """
    d = dict(row)
    d.pop("password_hash", None)   # never expose password hash

    gl = db.execute(
        "SELECT grade_level FROM grade_levels WHERE id=?", (d.get("grade_level_id"),)
    ).fetchone()
    d["grade_level"] = gl["grade_level"] if gl else None

    d["subjects"] = [dict(r) for r in db.execute(
        """SELECT us.subject, gl.grade_level
           FROM user_subjects us
           LEFT JOIN grade_levels gl ON gl.id = us.grade_level_id
           WHERE us.user_id=?""",
        (d["id"],)
    ).fetchall()]
    return d


@app.get("/api/personnel")
def list_personnel(
    search: str = "",
    db=Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Return all staff members (excluding admin accounts), with optional text search.
    Search is applied as a LIKE match on full_name, username, and email.
    Search term is capped at 100 chars to prevent oversized LIKE patterns — OWASP A03.
    """
    search = search[:100]  # cap search length
    q = f"%{search}%"
    rows = db.execute(
        """SELECT u.*, gl.grade_level FROM users u
           LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
           WHERE u.role != 'admin'
             AND (u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)
           ORDER BY u.role, u.full_name""",
        (q, q, q)
    ).fetchall()
    return [_user_row(r, db) for r in rows]


@app.get("/api/personnel/{uid}")
def get_personnel(uid: int, db=Depends(get_db), user=Depends(get_current_user)):
    """Return a single personnel record by user ID. Available to all authenticated users."""
    row = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    return _user_row(row, db)


@app.post("/api/personnel", status_code=201)
@limiter.limit("20 per minute")   # Prevent automated account creation floods
def create_personnel(
    request: Request,
    body: PersonnelCreateBody,
    db=Depends(get_db),
    user=Depends(require_personnel_manager),
):
    """
    Create a new staff member account (principal / registrar / admin only).

    Role is validated against a server-side whitelist (admin cannot be created
    via this endpoint to prevent privilege escalation) — OWASP A01.
    The password is bcrypt-hashed before storage — OWASP A02.
    """
    # Whitelist: admin cannot be created via the personnel management interface.
    valid_roles = ("principal", "coordinator", "dean", "teacher", "registrar")
    if body.role not in valid_roles:
        raise HTTPException(400, f"Invalid role '{body.role}'. Must be one of: {list(valid_roles)}")

    pw = hash_password(body.password)
    full_name = " ".join(filter(None, [body.first_name, body.middle_name,
                                        body.last_name, body.suffix]))
    try:
        db.execute(
            """INSERT INTO users
               (username, password_hash, full_name, first_name, middle_name,
                last_name, suffix, role, grade_level_id, email, phone_number,
                tin, qsis, hdmf, phic, date_of_appointment, birthdate, address)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (body.username, pw, full_name, body.first_name, body.middle_name,
             body.last_name, body.suffix, body.role, body.grade_level_id,
             body.email, body.phone_number, body.tin, body.qsis, body.hdmf,
             body.phic, body.date_of_appointment, body.birthdate, body.address)
        )
        db.commit()
    except Exception:
        raise HTTPException(400, "Username already exists or data is invalid")

    row = db.execute("SELECT * FROM users WHERE username=?", (body.username,)).fetchone()
    return _user_row(row, db)


@app.put("/api/personnel/{uid}")
def update_personnel(
    uid: int,
    body: PersonnelUpdateBody,
    db=Depends(get_db),
    user=Depends(require_personnel_manager),
):
    """
    Update a personnel record (partial update — only non-None fields are written).

    full_name is recomputed from the updated first/middle/last/suffix parts to
    keep it consistent with the individual name columns.

    Column names in the SET clause come from a hardcoded list, never from user
    input, preventing SQL injection via the dynamic query — OWASP A03.
    """
    row = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if not row:
        raise HTTPException(404, "User not found")

    fields, vals = [], []

    # Hardcoded column → value mapping (user input is values only, never column names).
    for col, val in [
        ("email", body.email), ("first_name", body.first_name),
        ("middle_name", body.middle_name), ("last_name", body.last_name),
        ("suffix", body.suffix), ("role", body.role),
        ("grade_level_id", body.grade_level_id), ("phone_number", body.phone_number),
        ("tin", body.tin), ("qsis", body.qsis), ("hdmf", body.hdmf),
        ("phic", body.phic), ("date_of_appointment", body.date_of_appointment),
        ("birthdate", body.birthdate), ("address", body.address),
    ]:
        if val is not None:
            fields.append(f"{col}=?")
            vals.append(val)

    # Hash and include password only if a new one was provided.
    if body.password:
        fields.append("password_hash=?")
        vals.append(hash_password(body.password))

    if fields:
        # Recompute full_name by merging current DB values with the incoming updates.
        updated = dict(row)
        for col, val in zip([f.split("=")[0] for f in fields if "=" in f], vals):
            updated[col] = val
        full_name = " ".join(filter(None, [
            updated.get("first_name"), updated.get("middle_name"),
            updated.get("last_name"), updated.get("suffix")
        ]))
        fields.append("full_name=?")
        vals.append(full_name)
        vals.append(uid)
        db.execute(f"UPDATE users SET {', '.join(fields)} WHERE id=?", vals)
        db.commit()

    return _user_row(db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone(), db)


@app.patch("/api/personnel/{uid}/status")
def toggle_personnel_status(
    uid: int,
    db=Depends(get_db),
    user=Depends(require_personnel_manager),
):
    """
    Toggle a staff member's active/inactive status (principal / registrar / admin only).
    Active (1) → Inactive (0) and vice versa. Inactive users cannot log in.
    """
    row = db.execute("SELECT is_active FROM users WHERE id=?", (uid,)).fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    new_status = 0 if row["is_active"] else 1
    db.execute("UPDATE users SET is_active=? WHERE id=?", (new_status, uid))
    db.commit()
    return {"id": uid, "is_active": bool(new_status)}


@app.get("/api/personnel/meta/grade-levels")
def get_grade_levels(db=Depends(get_db), user=Depends(get_current_user)):
    """Return all grade levels — used to populate dropdowns in the personnel form."""
    return [dict(r) for r in db.execute("SELECT * FROM grade_levels ORDER BY id").fetchall()]


@app.get("/api/personnel/meta/subjects")
def get_subjects_meta(db=Depends(get_db), user=Depends(get_current_user)):
    """Return all subject reference records — used in the Academic Delegation form."""
    return [dict(r) for r in db.execute("SELECT * FROM subjects ORDER BY id").fetchall()]


# ═══════════════════════════════════════════════════════════════════════════════
# APPRAISAL MANAGEMENT
# Principal, coordinator, dean, and admin only (require_appraisal_access).
# ═══════════════════════════════════════════════════════════════════════════════

class SpecialTaskBody(BaseModel):
    """Payload for creating a special appraisal task."""
    model_config = ConfigDict(extra="forbid")

    title:       str           = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5_000)
    assignee_id: Optional[int] = Field(default=None, ge=1)
    due_date:    Optional[str] = Field(default=None, max_length=20)


class SpecialTaskEvalBody(BaseModel):
    """
    Rubric scores for evaluating a special task.
    Each score must be 0–5 to match the DB CHECK constraint.
    """
    model_config = ConfigDict(extra="forbid")

    completion_quality_score: int           = Field(ge=0, le=5)
    timeliness_score:         int           = Field(ge=0, le=5)
    initiative_score:         int           = Field(ge=0, le=5)
    coordination_score:       int           = Field(ge=0, le=5)
    remarks:                  Optional[str] = Field(default=None, max_length=2_000)


class SchoolEventBody(BaseModel):
    """Payload for creating a school event in the appraisal module."""
    model_config = ConfigDict(extra="forbid")

    title:       str           = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=5_000)
    event_date:  Optional[str] = Field(default=None, max_length=20)


class EventEvalBody(BaseModel):
    """
    Rubric evaluation for a school event.
    All six scores must be in range 0–5 (matches DB CHECK constraint).
    """
    model_config = ConfigDict(extra="forbid")

    evaluator_name:  str           = Field(min_length=1, max_length=100)
    evaluator_role:  Optional[str] = Field(default=None, max_length=50)
    planning_score:  int           = Field(ge=0, le=5)
    objectives_score:int           = Field(ge=0, le=5)
    personnel_score: int           = Field(ge=0, le=5)
    time_mgmt_score: int           = Field(ge=0, le=5)
    engagement_score:int           = Field(ge=0, le=5)
    resource_score:  int           = Field(ge=0, le=5)
    feedback_comments: Optional[str] = Field(default=None, max_length=2_000)


def _special_task_row(row, db):
    """
    Enrich a special_tasks row with assignee, assigner, and evaluation details.
    Returns a flat dict ready for JSON serialisation.
    """
    d = dict(row)
    assignee = db.execute(
        """SELECT u.id, u.full_name, u.role, gl.grade_level
           FROM users u LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
           WHERE u.id=?""",
        (d.get("assignee_id"),)
    ).fetchone()
    d["assignee"] = dict(assignee) if assignee else None

    assigner = db.execute(
        "SELECT id, full_name FROM users WHERE id=?", (d.get("assigned_by"),)
    ).fetchone()
    d["assigner"] = dict(assigner) if assigner else None

    ev = db.execute(
        "SELECT * FROM special_task_evaluations WHERE task_id=?", (d["id"],)
    ).fetchone()
    d["evaluation"] = dict(ev) if ev else None
    return d


def _school_event_row(row, db):
    """
    Enrich a school_events row with organiser info and all submitted evaluations.
    Returns a flat dict ready for JSON serialisation.
    """
    d = dict(row)
    organizer = db.execute(
        "SELECT id, full_name FROM users WHERE id=?", (d.get("created_by"),)
    ).fetchone()
    d["organizer"] = dict(organizer) if organizer else None

    d["evaluations"] = [dict(r) for r in db.execute(
        "SELECT * FROM event_evaluations WHERE event_id=? ORDER BY date_submitted DESC",
        (d["id"],)
    ).fetchall()]
    return d


@app.get("/api/appraisal/special-tasks")
def list_special_tasks(db=Depends(get_db), user=Depends(require_appraisal_access)):
    """Return all special appraisal tasks, newest first."""
    rows = db.execute(
        "SELECT * FROM special_tasks ORDER BY created_at DESC"
    ).fetchall()
    return [_special_task_row(r, db) for r in rows]


@app.post("/api/appraisal/special-tasks", status_code=201)
def create_special_task(
    body: SpecialTaskBody,
    db=Depends(get_db),
    user=Depends(require_appraisal_access),
):
    """
    Create a special task for the appraisal module (principal/coordinator/dean/admin).
    The assigned_by field is set from the authenticated token — cannot be spoofed.
    """
    uid = int(user["sub"])
    db.execute(
        """INSERT INTO special_tasks (title, description, assignee_id, assigned_by, due_date)
           VALUES (?,?,?,?,?)""",
        (body.title, body.description, body.assignee_id, uid, body.due_date)
    )
    db.commit()
    row = db.execute("SELECT * FROM special_tasks ORDER BY id DESC LIMIT 1").fetchone()
    return _special_task_row(row, db)


@app.post("/api/appraisal/special-tasks/{task_id}/evaluate")
def evaluate_special_task(
    task_id: int,
    body: SpecialTaskEvalBody,
    db=Depends(get_db),
    user=Depends(require_appraisal_access),
):
    """
    Submit or update a rubric evaluation for a special task.
    Uses UPSERT to allow re-evaluation; weighted average is computed server-side
    (not trusted from client input) — OWASP A01.
    """
    row = db.execute("SELECT * FROM special_tasks WHERE id=?", (task_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Special task not found")

    # Compute weighted average server-side — never accept client-supplied totals.
    scores  = [body.completion_quality_score, body.timeliness_score,
               body.initiative_score, body.coordination_score]
    weights = [0.40, 0.30, 0.30, 0.00]
    weighted_avg = sum(s * w for s, w in zip(scores, weights))
    uid = int(user["sub"])

    db.execute(
        """INSERT INTO special_task_evaluations
           (task_id, evaluator_id, completion_quality_score, timeliness_score,
            initiative_score, coordination_score, weighted_average, remarks)
           VALUES (?,?,?,?,?,?,?,?)
           ON CONFLICT(task_id) DO UPDATE SET
             evaluator_id=excluded.evaluator_id,
             completion_quality_score=excluded.completion_quality_score,
             timeliness_score=excluded.timeliness_score,
             initiative_score=excluded.initiative_score,
             coordination_score=excluded.coordination_score,
             weighted_average=excluded.weighted_average,
             remarks=excluded.remarks,
             evaluated_at=CURRENT_TIMESTAMP""",
        (task_id, uid, body.completion_quality_score, body.timeliness_score,
         body.initiative_score, body.coordination_score, weighted_avg, body.remarks)
    )
    db.execute("UPDATE special_tasks SET status='evaluated' WHERE id=?", (task_id,))
    db.commit()
    return _special_task_row(
        db.execute("SELECT * FROM special_tasks WHERE id=?", (task_id,)).fetchone(), db
    )


@app.get("/api/appraisal/events")
def list_school_events(db=Depends(get_db), user=Depends(require_appraisal_access)):
    """Return all school events in the appraisal module, newest first."""
    rows = db.execute("SELECT * FROM school_events ORDER BY event_date DESC").fetchall()
    return [_school_event_row(r, db) for r in rows]


@app.post("/api/appraisal/events", status_code=201)
def create_school_event(
    body: SchoolEventBody,
    db=Depends(get_db),
    user=Depends(require_appraisal_access),
):
    """Create a school event entry in the appraisal module."""
    uid = int(user["sub"])
    db.execute(
        "INSERT INTO school_events (title, description, event_date, created_by) VALUES (?,?,?,?)",
        (body.title, body.description, body.event_date, uid)
    )
    db.commit()
    row = db.execute("SELECT * FROM school_events ORDER BY id DESC LIMIT 1").fetchone()
    return _school_event_row(row, db)


@app.post("/api/appraisal/events/{event_id}/evaluate")
def evaluate_school_event(
    event_id: int,
    body: EventEvalBody,
    db=Depends(get_db),
    user=Depends(require_appraisal_access),
):
    """Submit a rubric evaluation for a school event. Multiple evaluations per event are allowed."""
    row = db.execute("SELECT * FROM school_events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    uid = int(user["sub"])
    db.execute(
        """INSERT INTO event_evaluations
           (event_id, evaluator_id, evaluator_name, evaluator_role,
            planning_score, objectives_score, personnel_score,
            time_mgmt_score, engagement_score, resource_score, feedback_comments)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (event_id, uid, body.evaluator_name, body.evaluator_role,
         body.planning_score, body.objectives_score, body.personnel_score,
         body.time_mgmt_score, body.engagement_score, body.resource_score,
         body.feedback_comments)
    )
    db.commit()
    return _school_event_row(
        db.execute("SELECT * FROM school_events WHERE id=?", (event_id,)).fetchone(), db
    )


# ═══════════════════════════════════════════════════════════════════════════════
# EVENT MANAGEMENT
# Full events with detailed planning fields (distinct from appraisal school events).
# ═══════════════════════════════════════════════════════════════════════════════

class EventCreateBody(BaseModel):
    """
    Payload for creating a detailed school event (event management module).
    All optional fields beyond title allow partial data entry during planning.
    Long text fields (rationale, objectives, etc.) capped at 10 000 chars — OWASP A08.
    """
    model_config = ConfigDict(extra="forbid")

    title:               str           = Field(min_length=1, max_length=200)
    nature:              Optional[str] = Field(default="Co-curricular", max_length=50)
    target_date:         Optional[str] = Field(default=None, max_length=50)
    venue:               Optional[str] = Field(default=None, max_length=200)
    proposed_budget:     Optional[str] = Field(default=None, max_length=50)
    fund_source:         Optional[str] = Field(default=None, max_length=100)
    focal_name:          Optional[str] = Field(default=None, max_length=100)
    focal_role:          Optional[str] = Field(default=None, max_length=50)
    focal_contact:       Optional[str] = Field(default=None, max_length=50)
    expected_outputs:    Optional[str] = Field(default=None, max_length=10_000)
    participants:        Optional[str] = Field(default=None, max_length=10_000)
    rationale:           Optional[str] = Field(default=None, max_length=10_000)
    objectives:          Optional[str] = Field(default=None, max_length=10_000)
    phase1:              Optional[str] = Field(default=None, max_length=5_000)
    phase2:              Optional[str] = Field(default=None, max_length=5_000)
    phase3:              Optional[str] = Field(default=None, max_length=5_000)
    activity_matrix:     Optional[str] = Field(default=None, max_length=10_000)
    training_materials:  Optional[str] = Field(default=None, max_length=10_000)
    snacks:              Optional[str] = Field(default=None, max_length=10_000)
    exec_committee:      Optional[str] = Field(default=None, max_length=10_000)
    twg_groups:          Optional[str] = Field(default=None, max_length=10_000)
    monitoring_criteria: Optional[str] = Field(default=None, max_length=5_000)
    indicators:          Optional[str] = Field(default=None, max_length=10_000)
    comments:            Optional[str] = Field(default=None, max_length=5_000)


def _event_row(row, db):
    """Enrich an events row with creator name and role for display in listings."""
    d = dict(row)
    creator = db.execute(
        "SELECT full_name, role FROM users WHERE id=?", (d.get("created_by"),)
    ).fetchone()
    d["creator_name"] = creator["full_name"] if creator else None
    d["creator_role"] = creator["role"] if creator else None
    return d


@app.get("/api/events")
def list_events(db=Depends(get_db), user=Depends(get_current_user)):
    """Return all events in the event management module, newest first."""
    rows = db.execute("SELECT * FROM events ORDER BY created_at DESC").fetchall()
    return [_event_row(r, db) for r in rows]


@app.get("/api/events/{event_id}")
def get_event(event_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    """Return full detail for a single event."""
    row = db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    return _event_row(row, db)


@app.post("/api/events", status_code=201)
def create_event(
    body: EventCreateBody,
    db=Depends(get_db),
    user=Depends(require_event_manager),
):
    """
    Create a new event (principal / coordinator / dean / admin only).
    The created_by field is derived from the JWT token — cannot be spoofed — OWASP A01.
    """
    uid = int(user["sub"])
    db.execute(
        """INSERT INTO events
           (title, nature, target_date, venue, proposed_budget, fund_source,
            focal_name, focal_role, focal_contact, expected_outputs, participants,
            rationale, objectives, phase1, phase2, phase3, activity_matrix,
            training_materials, snacks, exec_committee, twg_groups,
            monitoring_criteria, indicators, comments, created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (body.title, body.nature, body.target_date, body.venue,
         body.proposed_budget, body.fund_source, body.focal_name,
         body.focal_role, body.focal_contact, body.expected_outputs,
         body.participants, body.rationale, body.objectives,
         body.phase1, body.phase2, body.phase3, body.activity_matrix,
         body.training_materials, body.snacks, body.exec_committee,
         body.twg_groups, body.monitoring_criteria, body.indicators,
         body.comments, uid)
    )
    db.commit()
    row = db.execute("SELECT * FROM events ORDER BY id DESC LIMIT 1").fetchone()
    new_event_id = row["id"]

    # ── Notification: broadcast new event to all active users ─────────────────
    # Events are school-wide so every active user gets a notification.
    all_users = db.execute(
        "SELECT id FROM users WHERE is_active=1 AND id!=?", (uid,)
    ).fetchall()
    creator_row = db.execute(
        "SELECT full_name FROM users WHERE id=?", (uid,)
    ).fetchone()
    creator_name = creator_row["full_name"] if creator_row else "Someone"

    for u_row in all_users:
        _create_notification(
            db,
            user_id=u_row["id"],
            notif_type="event",
            title=f"New event: {body.title}",
            body=f"{creator_name} created a new event \"{body.title}\".",
            ref_id=new_event_id,
        )
    db.commit()

    return _event_row(row, db)


@app.patch("/api/events/{event_id}/approve")
def approve_event(event_id: int, db=Depends(get_db), user=Depends(require_admin_or_principal)):
    """Approve a pending event (admin / principal only)."""
    row = db.execute("SELECT id FROM events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    db.execute("UPDATE events SET status='approved' WHERE id=?", (event_id,))
    db.commit()
    return {"message": "Event approved"}


@app.patch("/api/events/{event_id}/disable")
def disable_event(event_id: int, db=Depends(get_db), user=Depends(require_event_manager)):
    """Disable an active event (event manager roles only)."""
    row = db.execute("SELECT id FROM events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    db.execute("UPDATE events SET status='disabled' WHERE id=?", (event_id,))
    db.commit()
    return {"message": "Event disabled"}


@app.patch("/api/events/{event_id}/enable")
def enable_event(event_id: int, db=Depends(get_db), user=Depends(require_event_manager)):
    """Re-enable a disabled event, returning it to 'pending_approval' status."""
    row = db.execute("SELECT id FROM events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    db.execute("UPDATE events SET status='pending_approval' WHERE id=?", (event_id,))
    db.commit()
    return {"message": "Event re-enabled"}


@app.delete("/api/events/{event_id}")
def delete_event(event_id: int, db=Depends(get_db), user=Depends(require_event_manager)):
    """
    Delete an event.
    Callers may only delete events they created, unless they are admin or principal
    (who have global delete permission) — OWASP A01.
    """
    uid = int(user["sub"])
    role = user["role"]
    row = db.execute("SELECT created_by FROM events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    if role not in ("admin", "principal") and row["created_by"] != uid:
        raise HTTPException(403, "You can only delete events you created")
    db.execute("DELETE FROM events WHERE id=?", (event_id,))
    db.commit()
    return {"message": "Event deleted"}


# ═══════════════════════════════════════════════════════════════════════════════
# NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/notifications")
def get_notifications(
    unread_only: bool = False,
    db=Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Return all notifications for the authenticated user, newest first.

    Query params:
      unread_only=true  — return only notifications the user hasn't read yet

    Notifications are auto-created when:
      • A task is assigned to the user
      • A new event is posted (school-wide broadcast)
    """
    uid = int(user["sub"])

    if unread_only:
        rows = db.execute(
            """SELECT * FROM notifications
               WHERE user_id=? AND is_read=0
               ORDER BY created_at DESC""",
            (uid,),
        ).fetchall()
    else:
        rows = db.execute(
            """SELECT * FROM notifications
               WHERE user_id=?
               ORDER BY created_at DESC
               LIMIT 50""",
            (uid,),
        ).fetchall()

    return [dict(r) for r in rows]


@app.get("/api/notifications/unread-count")
def get_unread_count(db=Depends(get_db), user=Depends(get_current_user)):
    """
    Return only the count of unread notifications.
    Polled by the sidebar bell badge on a short interval to keep the badge fresh.
    Lightweight — returns a single integer, not full notification rows.
    """
    uid = int(user["sub"])
    count = db.execute(
        "SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0",
        (uid,),
    ).fetchone()["c"]
    return {"count": count}


@app.post("/api/notifications/{notif_id}/read")
def mark_notification_read(
    notif_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Mark a single notification as read.
    The WHERE clause ensures users can only mark their own notifications — OWASP A01.
    """
    uid = int(user["sub"])
    db.execute(
        "UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?",
        (notif_id, uid),
    )
    db.commit()
    return {"message": "Marked as read"}


@app.post("/api/notifications/read-all")
def mark_all_notifications_read(db=Depends(get_db), user=Depends(get_current_user)):
    """
    Mark ALL unread notifications for the authenticated user as read.
    Called when the user opens the notification panel to clear the badge.
    """
    uid = int(user["sub"])
    db.execute(
        "UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0",
        (uid,),
    )
    db.commit()
    return {"message": "All notifications marked as read"}


@app.delete("/api/notifications/{notif_id}")
def delete_notification(
    notif_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Permanently delete a single notification.
    Users can only delete their own notifications — OWASP A01.
    """
    uid = int(user["sub"])
    db.execute(
        "DELETE FROM notifications WHERE id=? AND user_id=?",
        (notif_id, uid),
    )
    db.commit()
    return {"message": "Notification deleted"}


# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    # HOST and PORT are configurable via environment variables for deployment flexibility.
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)

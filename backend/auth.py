"""
auth.py — Authentication, authorisation, and JWT token management for TaskNet.

OWASP Security Controls Applied:
  A01 Broken Access Control ......... One server-side policy (ROLE_PERMISSIONS)
                                       decides what each role may do; require_*
                                       dependencies enforce it per endpoint, and the
                                       client only *reads* it (login / /me return the
                                       caller's permissions). Every request re-checks
                                       the database: the account must exist, be
                                       active, and still hold the role in its token,
                                       so deactivation / role removal apply at once.
  A02 Cryptographic Failures ......... Passwords hashed with bcrypt (salted, adaptive
                                       cost factor ~12). JWT secret loaded from the
                                       JWT_SECRET_KEY env var — never hardcoded.
  A07 Identification/Auth Failures ... Constant-time password comparison (bcrypt.checkpw)
                                       prevents timing attacks. Token expiry is enforced.
                                       Explicit 401 on invalid/expired tokens.
"""

import os
from typing import Optional
from datetime import datetime, timedelta

import bcrypt
from dotenv import load_dotenv
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

# Load .env from the backend/ directory, regardless of CWD.
_here = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_here, ".env"))

# ── JWT Secret Key ────────────────────────────────────────────────────────────
SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
if not SECRET_KEY:
    import secrets as _secrets
    SECRET_KEY = _secrets.token_hex(32)
    print(
        "\n⚠️  WARNING: JWT_SECRET_KEY not set — using a temporary auto-generated key.\n"
        "   All sessions will be lost on backend restart.\n"
        f"   Add this to backend/.env to make it permanent:\n"
        f"   JWT_SECRET_KEY={SECRET_KEY}\n"
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS: int = int(os.getenv("TOKEN_EXPIRE_HOURS", "12"))

# Sign-out after inactivity. The client warns a minute before and signs out at
# SESSION_IDLE_MINUTES; the server refuses the session a few minutes later (the
# grace covers clocks and a heartbeat in flight), so an abandoned or copied
# token stops working even if the client never ran its timer.
SESSION_IDLE_MINUTES: int = max(1, int(os.getenv("SESSION_IDLE_MINUTES", "30")))
SESSION_IDLE_GRACE_MINUTES = 5
# Last-activity writes are throttled to one per this many seconds per session.
_TOUCH_EVERY_S = 60

security = HTTPBearer()

# ── Role Definitions ──────────────────────────────────────────────────────────

TASK_CREATORS = {"admin", "principal", "coordinator", "dean", "registrar"}

# Who may assign tasks to whom (the hierarchy). Also drives "Assign as".
ASSIGNABLE_TO: dict[str, set[str]] = {
    "admin":       {"principal", "coordinator", "dean", "teacher", "registrar"},
    "principal":   {"coordinator", "dean", "teacher", "registrar"},
    "coordinator": {"coordinator", "dean", "teacher"},
    "registrar":   {"dean", "teacher"},
    "dean":        {"teacher"},
}

# The single source of truth for what each role may do. The client receives
# the caller's set (login, /api/auth/me) and only uses it to show or hide UI;
# every endpoint enforces it here.
ROLE_PERMISSIONS: dict[str, set[str]] = {
    # manage_personnel = add users and change roles/delegations;
    # view_personnel / deactivate_personnel / review_certificates are the
    # narrower rights the registrar also holds.
    "admin": {
        "create_tasks", "assign_tasks", "review_submissions", "manage_personnel",
        "view_personnel", "deactivate_personnel", "review_certificates", "view_audit",
        "manage_events", "approve_events", "manage_school_years", "manage_deped_calendar", "manage_templates",
        "post_school_calendar",
        "view_appraisal", "evaluate_appraisal", "view_all_appraisals", "view_all_tasks",
        "moderate",
    },
    "principal": {
        "create_tasks", "assign_tasks", "review_submissions", "manage_personnel",
        "view_personnel", "deactivate_personnel", "review_certificates", "view_audit",
        "approve_events", "manage_school_years", "manage_deped_calendar", "manage_templates",
        "post_school_calendar",
        "view_appraisal", "evaluate_appraisal", "view_all_appraisals", "view_all_tasks",
        "moderate",
    },
    "coordinator": {
        "create_tasks", "assign_tasks", "review_submissions", "receive_tasks",
        "manage_events", "view_appraisal", "evaluate_appraisal", "view_all_appraisals",
    },
    "dean": {
        "create_tasks", "assign_tasks", "review_submissions", "receive_tasks",
        "manage_events", "view_appraisal", "evaluate_appraisal",
    },
    "registrar": {
        "create_tasks", "assign_tasks", "receive_tasks", "manage_events",
        "view_personnel", "deactivate_personnel", "review_certificates",
        # post_school_calendar: scan the school calendar into automated tasks.
        "post_school_calendar",
    },
    "teacher": {"receive_tasks", "manage_events", "view_appraisal"},
}

# Roles in the order the client should offer them under "Assign as".
_ASSIGN_ORDER = ["teacher", "dean", "coordinator", "registrar", "principal"]


def permissions_for(role: str) -> list[str]:
    return sorted(ROLE_PERMISSIONS.get(role, set()))


def session_permissions(db, uid: int, role: str) -> list[str]:
    """What a session may do: its role's permissions, plus advise_section when
    the person advises a class (that is a duty of the person, not of a role)."""
    perms = set(ROLE_PERMISSIONS.get(role, set()))
    if db.execute("SELECT 1 FROM sections WHERE adviser_id=?", (uid,)).fetchone():
        perms.add("advise_section")
    return sorted(perms)


def assignable_roles_for(role: str) -> list[str]:
    allowed = ASSIGNABLE_TO.get(role, set())
    return [r for r in _ASSIGN_ORDER if r in allowed]


def has_permission(user: dict, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(user.get("role", ""), set())


# ── Core Helpers ──────────────────────────────────────────────────────────────

def can_assign(assigner_role: str, assignee_role: str) -> bool:
    return assignee_role in ASSIGNABLE_TO.get(assigner_role, set())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(user_id: int, role: str, session_id: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": str(user_id), "role": role, "sid": session_id, "exp": expire},
        SECRET_KEY, algorithm=ALGORITHM,
    )


def start_session(db, user_id: int, role: str, ip: Optional[str], user_agent: Optional[str]) -> str:
    """Records a new session and returns its id (put in the token). Also clears
    this user's sessions that ended long ago. Caller commits."""
    import secrets as _s
    sid = _s.token_urlsafe(24)
    db.execute("""DELETE FROM auth_session WHERE personnel_id=?
                  AND (expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days' OR revoked_at < CURRENT_TIMESTAMP - INTERVAL '7 days')""",
               (user_id,))
    db.execute("""INSERT INTO auth_session (id, personnel_id, role, expires_at, ip, user_agent)
                  VALUES (?,?,?, CURRENT_TIMESTAMP + make_interval(hours => ?), ?, ?)""",
               (sid, user_id, role, ACCESS_TOKEN_EXPIRE_HOURS, (ip or "")[:64], (user_agent or "")[:300]))
    return sid


def end_session(db, session_id: Optional[str]):
    """Revokes a session (sign-out). Caller commits."""
    if session_id:
        db.execute("UPDATE auth_session SET revoked_at=CURRENT_TIMESTAMP WHERE id=? AND revoked_at IS NULL", (session_id,))


def end_all_sessions(db, user_id: int):
    """Revokes every session of a user (deactivation, password reset). Caller commits."""
    db.execute("UPDATE auth_session SET revoked_at=CURRENT_TIMESTAMP WHERE personnel_id=? AND revoked_at IS NULL", (user_id,))


def touch_session(db, session_id: str):
    """Marks the session active now (throttled). Caller commits."""
    db.execute(f"""UPDATE auth_session SET last_active_at=CURRENT_TIMESTAMP
                   WHERE id=? AND last_active_at < CURRENT_TIMESTAMP - INTERVAL '{_TOUCH_EVERY_S} seconds'""", (session_id,))


def _session_problem(db, session_id: Optional[str]) -> Optional[str]:
    """Why the session can't be used, or None when it's live."""
    if not session_id:
        return "Please sign in again."
    row = db.execute(f"""SELECT revoked_at IS NOT NULL AS revoked, expires_at < CURRENT_TIMESTAMP AS expired,
                                last_active_at < CURRENT_TIMESTAMP - make_interval(mins => ?) AS idle
                         FROM auth_session WHERE id=?""",
                     (SESSION_IDLE_MINUTES + SESSION_IDLE_GRACE_MINUTES, session_id)).fetchone()
    if not row or row["revoked"]:
        return "You have been signed out. Please sign in again."
    if row["expired"]:
        return "Your session has expired. Please sign in again."
    if row["idle"]:
        return "You were signed out after a period of inactivity. Please sign in again."
    return None


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def decode_token_silent(token: str) -> Optional[dict]:
    """Non-raising variant — returns None on any JWT error."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


# ── FastAPI Dependencies ──────────────────────────────────────────────────────

def _held_roles(db, user_id: int) -> Optional[tuple]:
    """(is_active, roles held) for a user, or None if the account is gone."""
    row = db.execute("SELECT role, is_active FROM users WHERE id=?", (user_id,)).fetchone()
    if not row:
        return None
    roles = {r[0] for r in db.execute(
        """SELECT role AS roles FROM user_held_roles
           WHERE user_id=?""", (user_id,)).fetchall()} or {row["role"]}
    return bool(row["is_active"]), roles


def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """The verified caller. The token's signature and expiry are checked, then
    the database: the session must be live (not signed out, not idle too long),
    and the account must still exist, be active, and still hold the role the
    token was issued for — so deactivating an account or removing a role takes
    effect immediately instead of when the token expires.

    Changes (anything but GET/HEAD) count as activity. Reads don't, so
    background refreshes can't keep an unattended session alive; the client
    reports real use through POST /api/auth/heartbeat."""
    claims = decode_token(credentials.credentials)
    try:
        uid = int(claims.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(401, "Invalid or expired token")
    from database import db_session  # local import: database must not import auth
    with db_session() as db:
        problem = _session_problem(db, claims.get("sid"))
        if problem:
            raise HTTPException(401, problem)
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            touch_session(db, claims["sid"])
            db.commit()
        held = _held_roles(db, uid)
    if held is None:
        raise HTTPException(401, "This account no longer exists")
    active, roles = held
    if not active:
        raise HTTPException(401, "This account has been deactivated")
    if claims.get("role") not in roles:
        raise HTTPException(401, "Your role has changed. Please sign in again.")
    return claims


def require_permission(permission: str, message: str):
    """Dependency factory: the caller's role must grant `permission`."""
    def dependency(user=Depends(get_current_user)):
        if not has_permission(user, permission):
            raise HTTPException(403, message)
        return user
    return dependency


def require_admin(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin access required")
    return user


require_task_creator = require_permission(
    "create_tasks", "Task creation requires Principal, Coordinator, Dean, Registrar, or Admin role")
require_can_assign = require_permission(
    "assign_tasks", "Task assignment requires Admin, Principal, Coordinator, Registrar, or Dean role")
require_personnel_manager = require_permission(
    "manage_personnel", "Only the Principal or Admin can change personnel roles and delegations")
require_personnel_deactivator = require_permission(
    "deactivate_personnel", "Deactivating accounts requires Principal, Registrar, or Admin role")
require_appraisal_access = require_permission(
    "evaluate_appraisal", "Appraisal access requires Principal, Coordinator, Dean, or Admin role")
# Teachers may view their OWN records; deans see their grade-level teachers +
# own; the rest see all. Row scoping is applied per endpoint.
require_appraisal_view = require_permission(
    "view_appraisal", "Appraisal view requires a staff account")
# All personnel except principal create/manage their events; principal approves.
require_event_manager = require_permission(
    "manage_events", "Principal accounts are for oversight only and cannot create events")
require_event_approver = require_permission(
    "approve_events", "Only the Principal or Admin can approve events")
# DepEd school-calendar entries and the compliance tasks generated from them.
require_deped_manager = require_permission(
    "manage_deped_calendar", "Only the Principal or Admin can manage the DepEd calendar")


def require_admin_or_principal(user=Depends(get_current_user)):
    if user["role"] not in ("admin", "principal"):
        raise HTTPException(403, "Admin or Principal access required")
    return user

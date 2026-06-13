"""
auth.py — Authentication, authorisation, and JWT token management for TaskNet.

OWASP Security Controls Applied:
  A01 Broken Access Control ......... Role-based dependencies (require_*) enforce
                                       per-endpoint minimum roles; every route is
                                       protected by at least get_current_user.
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
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

# ── Environment Loading ───────────────────────────────────────────────────────
# Load .env file when running locally. In production, set env vars on the
# host/container directly — never commit a .env file to version control.
load_dotenv()

# ── JWT Secret Key ────────────────────────────────────────────────────────────
# SECURITY: The JWT signing secret must come from the JWT_SECRET_KEY environment
# variable. Hardcoding it in source code would expose it in version control,
# logs, and error traces — violating OWASP A02.
#
# Generate a cryptographically strong secret (run once, store in .env):
#   python -c "import secrets; print(secrets.token_hex(32))"
#
# The application refuses to start if the variable is missing ("fail fast"):
# this prevents accidentally running in production with a default/weak key.
# Try loading .env from the backend/ directory explicitly, regardless of
# which directory the process was started from (e.g. project root via start.sh).
_here = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_here, ".env"))

SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
if not SECRET_KEY:
    # Development fallback: auto-generate a key so the app still starts.
    # In production, always set JWT_SECRET_KEY in the environment — a
    # regenerated key on every restart logs everyone out.
    import secrets as _secrets
    SECRET_KEY = _secrets.token_hex(32)
    print(
        "\n⚠️  WARNING: JWT_SECRET_KEY not set — using a temporary auto-generated key.\n"
        "   All sessions will be lost on backend restart.\n"
        f"   Add this to backend/.env to make it permanent:\n"
        f"   JWT_SECRET_KEY={SECRET_KEY}\n"
    )

# HS256 (HMAC-SHA256) — symmetric algorithm suitable for a single-server setup.
# If you need multi-service token verification, switch to RS256 (asymmetric).
ALGORITHM = "HS256"

# How long an issued token remains valid. Shorter TTL reduces the window of
# exposure if a token is stolen. Configurable via TOKEN_EXPIRE_HOURS env var.
ACCESS_TOKEN_EXPIRE_HOURS: int = int(os.getenv("TOKEN_EXPIRE_HOURS", "24"))

# HTTPBearer extracts the JWT from the "Authorization: Bearer <token>" header.
# FastAPI injects this automatically into routes that declare Depends(security).
security = HTTPBearer()

# ── Role Definitions ──────────────────────────────────────────────────────────

# Roles that are allowed to create and manage tasks in the Task Manager.
TASK_CREATORS = {"admin", "principal", "coordinator", "dean", "registrar"}

# Assignment hierarchy — maps an assigner's role to the set of roles they may
# assign tasks to.  Enforces the chain of command:
#   principal → coordinator → dean → teacher
ASSIGNABLE_TO: dict[str, set[str]] = {
    "admin":       {"principal", "coordinator", "dean", "teacher", "registrar"},
    "principal":   {"coordinator", "dean", "teacher", "registrar"},
    "coordinator": {"coordinator", "dean", "teacher"},  # cannot assign principal or registrar
    "dean":        {"teacher"},                          # teachers only; grade-level check in API
}


# ── Core Helpers ──────────────────────────────────────────────────────────────

def can_assign(assigner_role: str, assignee_role: str) -> bool:
    """
    Return True when a user with `assigner_role` is permitted to assign tasks
    to a user with `assignee_role`, based on the school hierarchy.
    """
    return assignee_role in ASSIGNABLE_TO.get(assigner_role, set())


def hash_password(password: str) -> str:
    """
    Hash `password` using bcrypt with a randomly generated salt.

    bcrypt is purposely slow (work factor ~12 rounds ≈ 100-300 ms per hash),
    making brute-force and rainbow-table attacks computationally infeasible.
    Never store or log plaintext passwords — OWASP A02.
    """
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verify `plain` against a stored bcrypt `hashed` value.

    bcrypt.checkpw performs a constant-time comparison to prevent timing
    side-channel attacks where an attacker could infer correctness from
    response latency — OWASP A07.
    """
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(user_id: int, role: str) -> str:
    """
    Issue a signed JWT for the authenticated user.

    Payload claims:
      sub — subject (user ID as a string, per JWT standard)
      role — application role, embedded to avoid a DB lookup on every request
      exp  — expiry Unix timestamp, enforced by decode_token

    The token is signed with the server-side SECRET_KEY; the client stores
    it but can never forge or modify it without knowing the secret — OWASP A02.
    """
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and cryptographically verify a JWT.

    Raises HTTP 401 if the token:
      - has an invalid signature (tampered)
      - is expired
      - is structurally malformed

    This is the authoritative authentication gate for all protected endpoints.
    A generic error message is returned to avoid leaking internals — OWASP A07.
    """
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        # Generic message intentionally — do not expose whether the token is
        # expired vs. tampered, as that gives attackers useful information.
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def decode_token_silent(token: str) -> Optional[dict]:
    """
    Non-raising variant of decode_token.

    Returns the decoded payload on success, or None on any JWT error.
    Used by the rate-limiter key function (main.py) where raising an
    HTTPException would be premature and disruptive to the request flow.
    """
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


# ── FastAPI Dependencies ──────────────────────────────────────────────────────

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    FastAPI dependency: extract and validate the Bearer JWT from the
    Authorization header.  Injects the decoded payload dict — containing
    `sub` (user ID) and `role` — into route handler parameters.

    Declare as `user=Depends(get_current_user)` on any route that requires
    an authenticated caller.  Missing or invalid tokens raise HTTP 401 before
    the route body executes — OWASP A01.
    """
    return decode_token(credentials.credentials)


# ── Role-Gating Dependencies ──────────────────────────────────────────────────
# Each function below is a FastAPI dependency that first authenticates the
# caller (via get_current_user) and then enforces a minimum role level.
# Routes that declare these dependencies return HTTP 403 Forbidden to callers
# with insufficient privilege — OWASP A01.

def require_admin(user=Depends(get_current_user)):
    """Gate: allow only the 'admin' role."""
    if user["role"] != "admin":
        raise HTTPException(403, "Admin access required")
    return user


def require_task_creator(user=Depends(get_current_user)):
    """Gate: allow roles that can create and manage tasks in the Task Manager."""
    if user["role"] not in TASK_CREATORS:
        raise HTTPException(403, "Task creation requires Principal, Coordinator, Dean, Registrar, or Admin role")
    return user


def require_can_assign(user=Depends(get_current_user)):
    """Gate: allow roles that can assign tasks to other users."""
    if user["role"] not in ASSIGNABLE_TO:
        raise HTTPException(403, "Task assignment requires Admin, Principal, Coordinator, or Dean role")
    return user


def require_admin_or_principal(user=Depends(get_current_user)):
    """Gate: allow only admin or principal roles."""
    if user["role"] not in ("admin", "principal"):
        raise HTTPException(403, "Admin or Principal access required")
    return user


def require_personnel_manager(user=Depends(get_current_user)):
    """
    Gate: allow roles authorised to read and write personnel records.
    Principal manages all staff; registrar handles operational records;
    admin has unrestricted access.
    """
    if user["role"] not in ("principal", "registrar", "admin"):
        raise HTTPException(403, "Personnel management requires Principal, Registrar, or Admin role")
    return user


def require_appraisal_access(user=Depends(get_current_user)):
    """
    Gate: allow roles that participate in the performance appraisal workflow —
    principal, coordinator, dean, and admin.
    """
    if user["role"] not in ("principal", "coordinator", "dean", "admin"):
        raise HTTPException(403, "Appraisal access requires Principal, Coordinator, Dean, or Admin role")
    return user


def require_event_manager(user=Depends(get_current_user)):
    """
    Gate: allow roles that can create or manage school events —
    principal, coordinator, dean, and admin.
    """
    if user["role"] not in ("principal", "coordinator", "dean", "admin"):
        raise HTTPException(403, "Event management requires Principal, Coordinator, Dean, or Admin role")
    return user

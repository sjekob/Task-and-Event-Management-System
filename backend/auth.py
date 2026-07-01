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
ACCESS_TOKEN_EXPIRE_HOURS: int = int(os.getenv("TOKEN_EXPIRE_HOURS", "24"))

security = HTTPBearer()

# ── Role Definitions ──────────────────────────────────────────────────────────

TASK_CREATORS = {"admin", "principal", "coordinator", "dean", "registrar"}

ASSIGNABLE_TO: dict[str, set[str]] = {
    "admin":       {"principal", "coordinator", "dean", "teacher", "registrar"},
    "principal":   {"coordinator", "dean", "teacher", "registrar"},
    "coordinator": {"coordinator", "dean", "teacher"},
    "registrar":   {"dean", "teacher"},
    "dean":        {"teacher"},
}


# ── Core Helpers ──────────────────────────────────────────────────────────────

def can_assign(assigner_role: str, assignee_role: str) -> bool:
    return assignee_role in ASSIGNABLE_TO.get(assigner_role, set())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_token(user_id: int, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": str(user_id), "role": role, "exp": expire},
        SECRET_KEY, algorithm=ALGORITHM,
    )


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

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return decode_token(credentials.credentials)


def require_admin(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin access required")
    return user


def require_task_creator(user=Depends(get_current_user)):
    if user["role"] not in TASK_CREATORS:
        raise HTTPException(403, "Task creation requires Principal, Coordinator, Dean, Registrar, or Admin role")
    return user


def require_can_assign(user=Depends(get_current_user)):
    if user["role"] not in ASSIGNABLE_TO:
        raise HTTPException(403, "Task assignment requires Admin, Principal, Coordinator, or Dean role")
    return user


def require_admin_or_principal(user=Depends(get_current_user)):
    if user["role"] not in ("admin", "principal"):
        raise HTTPException(403, "Admin or Principal access required")
    return user


def require_personnel_manager(user=Depends(get_current_user)):
    if user["role"] not in ("principal", "registrar", "admin"):
        raise HTTPException(403, "Personnel management requires Principal, Registrar, or Admin role")
    return user


def require_appraisal_access(user=Depends(get_current_user)):
    """Full appraisal access — can evaluate. Excludes teachers."""
    if user["role"] not in ("principal", "coordinator", "dean", "admin"):
        raise HTTPException(403, "Appraisal access requires Principal, Coordinator, Dean, or Admin role")
    return user


def require_appraisal_view(user=Depends(get_current_user)):
    """Read access to appraisal data. Teachers may view their OWN records; deans
    see their grade-level teachers + own; the rest see all. Row scoping is applied
    per-endpoint via _visible_personnel_ids."""
    if user["role"] not in ("principal", "coordinator", "dean", "admin", "teacher"):
        raise HTTPException(403, "Appraisal view requires a staff account")
    return user


def require_event_manager(user=Depends(get_current_user)):
    """All personnel except principal can create/manage events. Principal is oversight-only."""
    if user["role"] not in ("teacher", "coordinator", "dean", "registrar", "admin"):
        raise HTTPException(403, "Principal accounts are for oversight only and cannot create events")
    return user

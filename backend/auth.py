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
        "manage_events", "approve_events", "manage_school_years", "manage_templates",
        "view_appraisal", "evaluate_appraisal", "view_all_appraisals", "view_all_tasks",
        "moderate",
    },
    "principal": {
        "create_tasks", "assign_tasks", "review_submissions", "manage_personnel",
        "view_personnel", "deactivate_personnel", "review_certificates", "view_audit",
        "approve_events", "manage_school_years", "manage_templates",
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
    },
    "teacher": {"receive_tasks", "manage_events", "view_appraisal"},
}

# Roles in the order the client should offer them under "Assign as".
_ASSIGN_ORDER = ["teacher", "dean", "coordinator", "registrar", "principal"]


def permissions_for(role: str) -> list[str]:
    return sorted(ROLE_PERMISSIONS.get(role, set()))


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

def _held_roles(db, user_id: int) -> Optional[tuple]:
    """(is_active, roles held) for a user, or None if the account is gone."""
    row = db.execute("SELECT role, is_active FROM users WHERE id=?", (user_id,)).fetchone()
    if not row:
        return None
    roles = {r[0] for r in db.execute(
        """SELECT role AS roles FROM user_held_roles
           WHERE user_id=?""", (user_id,)).fetchall()} or {row["role"]}
    return bool(row["is_active"]), roles


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """The verified caller. The token's signature and expiry are checked, then
    the database: the account must still exist, be active, and still hold the
    role the token was issued for — so deactivating an account or removing a
    role takes effect immediately instead of when the token expires."""
    claims = decode_token(credentials.credentials)
    try:
        uid = int(claims.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(401, "Invalid or expired token")
    from database import db_session  # local import: database must not import auth
    with db_session() as db:
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


def require_admin_or_principal(user=Depends(get_current_user)):
    if user["role"] not in ("admin", "principal"):
        raise HTTPException(403, "Admin or Principal access required")
    return user

import time
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from database import db_session
from auth import verify_password, create_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# ── Brute-force protection (OWASP A07) ──────────────────────────────────────────
# Simple in-memory sliding-window limiter keyed by client IP + username.
# Resets on process restart; adequate for a single-instance auth service.
_LOGIN_MAX_ATTEMPTS = 5      # failures allowed within the window
_LOGIN_WINDOW_SECS  = 300    # 5-minute window / lockout
_login_failures: dict[str, list[float]] = defaultdict(list)


def _rate_limit_key(request: Request, username: str) -> str:
    ip = request.client.host if request.client else "unknown"
    return f"{ip}:{username.lower()}"


def _check_rate_limit(key: str) -> None:
    now = time.time()
    attempts = [t for t in _login_failures[key] if now - t < _LOGIN_WINDOW_SECS]
    _login_failures[key] = attempts
    if len(attempts) >= _LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Please try again in a few minutes.",
        )


class LoginRequest(BaseModel):
    username: str
    password: str
    role: Optional[str] = None  # which identity to log in as (multi-role accounts)


@router.post("/login")
def login(req: LoginRequest, request: Request):
    key = _rate_limit_key(request, req.username)
    _check_rate_limit(key)

    with db_session() as db:
        user = db.execute("SELECT * FROM users WHERE username=?", (req.username,)).fetchone()
        if not user or not verify_password(req.password, user["password_hash"]):
            _login_failures[key].append(time.time())
            raise HTTPException(401, "Invalid credentials")
        roles = [r["roles"] for r in db.execute(
            """SELECT r.roles FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE ur.user_id=? ORDER BY r.roles""", (user["id"],)
        ).fetchall()]

    if not roles:
        roles = [user["role"]]

    # Successful credentials — clear any recorded failures for this key.
    _login_failures.pop(key, None)

    # Decide the active role for this session.
    if req.role:
        if req.role not in roles:
            raise HTTPException(403, "You do not have that role.")
        active_role = req.role
    elif len(roles) > 1:
        # Credentials are valid but the account holds multiple identities — ask
        # the client which one to log in as (no token issued yet).
        return {
            "needs_role_selection": True,
            "available_roles": roles,
            "full_name": user["full_name"],
        }
    else:
        active_role = roles[0]

    token = create_token(user["id"], active_role)
    return {"token": token, "user": {
        "id": user["id"], "username": user["username"],
        "full_name": user["full_name"], "role": active_role,
        "avatar_url": user["avatar_url"],
        "grade_level_id": user["grade_level_id"],
        "available_roles": roles,
    }}


@router.get("/me")
def me(user=Depends(get_current_user)):
    with db_session() as db:
        u = db.execute(
            """SELECT u.id, u.username, u.full_name, u.role, u.avatar_url,
                      u.grade_level_id, gl.grade_level
               FROM users u LEFT JOIN grade_levels gl ON gl.id=u.grade_level_id
               WHERE u.id=?""",
            (user["sub"],)
        ).fetchone()
        if not u:
            raise HTTPException(404, "User not found")
        roles = [r["roles"] for r in db.execute(
            """SELECT r.roles FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE ur.user_id=? ORDER BY r.roles""", (user["sub"],)
        ).fetchall()]
    d = dict(u)
    # The active role comes from the session token, not the stored primary role.
    d["role"] = user.get("role", d["role"])
    d["available_roles"] = roles or [d["role"]]
    return d

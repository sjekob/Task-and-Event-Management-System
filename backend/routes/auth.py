import time
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
import audit
from database import db_session
from auth import (verify_password, hash_password, create_token, get_current_user,
                  session_permissions, assignable_roles_for, start_session, end_session,
                  SESSION_IDLE_MINUTES)

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# ── Brute-force protection (OWASP A07) ──────────────────────────────────────────
# In-memory sliding windows of failed sign-ins: per client IP + username (a
# typo-prone person is locked out of that account briefly), and per username
# from any IP (stops guessing one account's password from many addresses).
# Resets on process restart; adequate for a single-instance auth service. The
# gateway also caps sign-in requests per IP.
_LOGIN_MAX_ATTEMPTS = 5      # failures per IP + username within the window
_ACCOUNT_MAX_ATTEMPTS = 10   # failures per username from any IP within the window
_LOGIN_WINDOW_SECS  = 300    # 5-minute window / lockout
_login_failures: dict[str, list[float]] = defaultdict(list)

# Checked when the username doesn't exist, so a wrong username takes as long as a
# wrong password and response times don't reveal which usernames are real.
_DUMMY_HASH = hash_password("tasknet-timing-equaliser")


def client_ip(request: Request) -> str:
    """The caller's address: the gateway puts the real one in X-Forwarded-For."""
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() or (request.client.host if request.client else "unknown")


def _recent(key: str, now: float) -> list:
    attempts = [t for t in _login_failures.get(key, []) if now - t < _LOGIN_WINDOW_SECS]
    if attempts:
        _login_failures[key] = attempts
    else:
        _login_failures.pop(key, None)
    return attempts


def _check_rate_limit(keys: tuple) -> None:
    now = time.time()
    ip_key, account_key = keys
    if len(_recent(ip_key, now)) >= _LOGIN_MAX_ATTEMPTS or len(_recent(account_key, now)) >= _ACCOUNT_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many failed sign-in attempts. Please try again in a few minutes.",
        )


def _record_failure(keys: tuple) -> None:
    now = time.time()
    for k in keys:
        _login_failures[k].append(now)


class LoginRequest(BaseModel):
    username: str
    password: str
    role: Optional[str] = None  # which identity to log in as (multi-role accounts)


def _audit_login(db, actor, action: str, user_id: int, summary: str, request: Request):
    """Record a sign-in (or failed attempt) in the audit trail. Never blocks the
    sign-in itself if the entry can't be written."""
    try:
        audit.record(db, actor, action, "user", user_id, summary, request=request)
        db.commit()
    except Exception:
        pass


@router.post("/login")
def login(req: LoginRequest, request: Request):
    name = req.username.strip().lower()
    keys = (f"{client_ip(request)}:{name}", f"*:{name}")
    _check_rate_limit(keys)

    with db_session() as db:
        user = db.execute("SELECT * FROM users WHERE username=?", (req.username,)).fetchone()
        ok = verify_password(req.password, user["password_hash"] if user else _DUMMY_HASH)
        if not user or not ok:
            _record_failure(keys)
            if user:
                _audit_login(db, None, "auth.login_failed", user["id"],
                             "Failed sign-in attempt (wrong password)", request)
            raise HTTPException(401, "Invalid credentials")
        if not user["is_active"]:
            raise HTTPException(403, "This account has been deactivated. Please contact the principal.")
        roles = [r["roles"] for r in db.execute(
            """SELECT role AS roles FROM user_held_roles
               WHERE user_id=? ORDER BY role""", (user["id"],)
        ).fetchall()]

    if not roles:
        roles = [user["role"]]

    # Successful credentials: clear this person's failures from this address.
    _login_failures.pop(keys[0], None)

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

    with db_session() as db:
        _audit_login(db, {"sub": user["id"], "role": active_role}, "auth.login", user["id"],
                     f"Signed in as {active_role}", request)

    with db_session() as db:
        sid = start_session(db, user["id"], active_role, client_ip(request), request.headers.get("user-agent"))
        db.commit()
        permissions = session_permissions(db, user["id"], active_role)
        missing = missing_profile(db, user["id"], active_role)
    token = create_token(user["id"], active_role, sid)
    return {"token": token, "idle_timeout_minutes": SESSION_IDLE_MINUTES, "user": {
        "id": user["id"], "username": user["username"],
        "full_name": user["full_name"], "role": active_role,
        "avatar_url": user["avatar_url"],
        "grade_level_id": user["grade_level_id"],
        "available_roles": roles,
        # Decided here, not by the client: what this session may do.
        "permissions": permissions,
        "assignable_roles": assignable_roles_for(active_role),
        "missing_profile": missing,
    }}


# Personal details a teacher must fill in before using TaskNet (first sign-in:
# the account was created with only a username and email).
_REQUIRED_PROFILE = (("first_name", "First name"), ("last_name", "Last name"),
                     ("phone_number", "Phone number"), ("birthdate", "Birthdate"), ("address", "Address"))


def missing_profile(db, uid: int, role: str) -> list:
    """Labels of the required details this person hasn't filled in yet (teachers only)."""
    if role != "teacher":
        return []
    u = db.execute("SELECT first_name, last_name, phone_number, birthdate, address FROM users WHERE id=?",
                   (uid,)).fetchone()
    if not u:
        return []
    return [label for col, label in _REQUIRED_PROFILE if not str(u[col] or "").strip()]


@router.post("/logout", status_code=204)
def logout(user=Depends(get_current_user)):
    """Ends this session on the server, so its token stops working everywhere."""
    with db_session() as db:
        end_session(db, user.get("sid"))
        db.commit()


@router.post("/heartbeat")
def heartbeat(user=Depends(get_current_user)):
    """The client reports that the person is using the app (typing, clicking),
    which keeps the session from timing out while no changes are being saved.
    (Being a POST, get_current_user has already marked it active.)"""
    return {"idle_timeout_minutes": SESSION_IDLE_MINUTES}


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
        permissions = session_permissions(db, int(user["sub"]), user.get("role", u["role"]))
        missing = missing_profile(db, int(user["sub"]), user.get("role", u["role"]))
        roles = [r["roles"] for r in db.execute(
            """SELECT role AS roles FROM user_held_roles
               WHERE user_id=? ORDER BY role""", (user["sub"],)
        ).fetchall()]
    d = dict(u)
    # The active role comes from the session token, not the stored primary role.
    d["role"] = user.get("role", d["role"])
    d["available_roles"] = roles or [d["role"]]
    d["permissions"] = permissions
    d["assignable_roles"] = assignable_roles_for(d["role"])
    d["idle_timeout_minutes"] = SESSION_IDLE_MINUTES
    d["missing_profile"] = missing
    return d

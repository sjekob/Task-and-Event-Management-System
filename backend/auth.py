import bcrypt
from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY = "tasknet-secret-key-2025"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

security = HTTPBearer()

# Roles that CAN create tasks
TASK_CREATORS = {"admin", "principal", "coordinator", "dean", "registrar"}

# Role assignment rules: who can assign to whom
# key = assigner role, value = set of roles they may assign to
ASSIGNABLE_TO = {
    "admin":       {"principal", "coordinator", "dean", "teacher", "registrar"},
    "principal":   {"coordinator", "dean", "teacher", "registrar"},
    "coordinator": {"coordinator", "dean", "teacher"},   # NOT principal, NOT registrar
    "dean":        {"teacher"},                           # only teachers, same grade level enforced in API
}


def can_assign(assigner_role: str, assignee_role: str) -> bool:
    allowed = ASSIGNABLE_TO.get(assigner_role, set())
    return assignee_role in allowed


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: int, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": str(user_id), "role": role, "exp": expire},
        SECRET_KEY, algorithm=ALGORITHM
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return decode_token(credentials.credentials)


def require_admin(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin required")
    return user


def require_task_creator(user=Depends(get_current_user)):
    """Only principal and admin can create tasks."""
    if user["role"] not in TASK_CREATORS:
        raise HTTPException(403, "Principal or Admin required to create tasks")
    return user


def require_can_assign(user=Depends(get_current_user)):
    """Roles that can assign tasks to others: admin, principal, coordinator, dean."""
    if user["role"] not in ASSIGNABLE_TO:
        raise HTTPException(403, "You do not have permission to assign tasks")
    return user


def require_admin_or_principal(user=Depends(get_current_user)):
    if user["role"] not in ("admin", "principal"):
        raise HTTPException(403, "Admin or Principal required")
    return user

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from database import get_db
from auth import verify_password, create_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(req: LoginRequest):
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE username=?", (req.username,)).fetchone()
    db.close()
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(user["id"], user["role"])
    return {"token": token, "user": {
        "id": user["id"], "username": user["username"],
        "full_name": user["full_name"], "role": user["role"],
        "avatar_url": user["avatar_url"],
        "grade_level_id": user["grade_level_id"],
    }}


@router.get("/me")
def me(user=Depends(get_current_user)):
    db = get_db()
    u = db.execute(
        """SELECT u.id, u.username, u.full_name, u.role, u.avatar_url,
                  u.grade_level_id, gl.grade_level
           FROM users u LEFT JOIN grade_levels gl ON gl.id=u.grade_level_id
           WHERE u.id=?""",
        (user["sub"],)
    ).fetchone()
    db.close()
    if not u:
        raise HTTPException(404, "User not found")
    return dict(u)

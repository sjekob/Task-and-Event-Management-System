from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from database import get_db
from auth import (get_current_user, require_admin, require_admin_or_principal,
                  require_can_assign, hash_password, ASSIGNABLE_TO)

router = APIRouter(tags=["Users"])


# ── User list ─────────────────────────────────────────────────────────────────

@router.get("/api/users")
def list_users(user=Depends(get_current_user)):
    db = get_db()
    rows = db.execute(
        """SELECT u.id, u.username, u.full_name, u.role, u.avatar_url,
                  u.grade_level_id, gl.grade_level
           FROM users u LEFT JOIN grade_levels gl ON gl.id=u.grade_level_id
           ORDER BY u.role, u.full_name"""
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


@router.get("/api/users/assignable")
def list_assignable_users(user=Depends(require_can_assign)):
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]
    allowed_roles = ASSIGNABLE_TO.get(role, set())
    if not allowed_roles:
        db.close()
        return []

    placeholders = ",".join(f"'{r}'" for r in allowed_roles)
    q = f"""SELECT u.id, u.username, u.full_name, u.role, u.grade_level_id, gl.grade_level
            FROM users u LEFT JOIN grade_levels gl ON gl.id=u.grade_level_id
            WHERE u.role IN ({placeholders})"""
    params = []

    if role == "dean":
        dean = db.execute("SELECT grade_level_id FROM users WHERE id=?", (uid,)).fetchone()
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
    username: str
    password: str
    full_name: str
    role: str
    grade_level_id: Optional[int] = None


@router.post("/api/users")
def create_user(req: CreateUserRequest, user=Depends(require_admin_or_principal)):
    valid_roles = {"admin", "principal", "coordinator", "dean", "teacher", "registrar"}
    if req.role not in valid_roles:
        raise HTTPException(400, f"Invalid role. Must be one of: {valid_roles}")
    db = get_db()
    try:
        db.execute(
            "INSERT INTO users (username,password_hash,full_name,role,grade_level_id) VALUES (?,?,?,?,?)",
            (req.username, hash_password(req.password), req.full_name, req.role, req.grade_level_id)
        )
        db.commit()
        new_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        db.close()
        return {"id": new_id, "message": "User created"}
    except Exception as e:
        db.close()
        raise HTTPException(400, str(e))


# ── Profile ───────────────────────────────────────────────────────────────────

@router.get("/api/users/me/profile")
def get_my_profile(user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])
    u = db.execute(
        """SELECT u.*, gl.grade_level FROM users u
           LEFT JOIN grade_levels gl ON gl.id=u.grade_level_id
           WHERE u.id=?""",
        (uid,)
    ).fetchone()
    if not u:
        db.close()
        raise HTTPException(404, "User not found")
    d = dict(u)
    d.pop("password_hash", None)
    subjects = db.execute(
        """SELECT us.subject, gl.grade_level FROM user_subjects us
           LEFT JOIN grade_levels gl ON gl.id=us.grade_level_id
           WHERE us.user_id=? ORDER BY us.subject""",
        (uid,)
    ).fetchall()
    d["subjects"] = [dict(s) for s in subjects]
    db.close()
    return d


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    suffix: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    tin: Optional[str] = None
    qsis: Optional[str] = None
    hdmf: Optional[str] = None
    phic: Optional[str] = None
    date_of_appointment: Optional[str] = None
    address: Optional[str] = None


@router.put("/api/users/me/profile")
def update_my_profile(req: UpdateProfileRequest, user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates)
        db.execute(f"UPDATE users SET {set_clause} WHERE id=?",
                   list(updates.values()) + [uid])
        db.commit()
    db.close()
    return {"message": "Profile updated"}


# ── Subjects & Grade Levels & Task Types ──────────────────────────────────────

@router.get("/api/subjects")
def list_subjects(user=Depends(get_current_user)):
    return ["Mathematics", "Science", "English", "Filipino", "MAPEH",
            "Araling Panlipunan", "Edukasyon sa Pagpapakatao", "TLE"]


@router.get("/api/grade-levels")
def list_grade_levels(user=Depends(get_current_user)):
    db = get_db()
    rows = db.execute("SELECT * FROM grade_levels ORDER BY id").fetchall()
    db.close()
    return [dict(r) for r in rows]


class GradeLevelRequest(BaseModel):
    grade_level: str


@router.post("/api/grade-levels")
def create_grade_level(req: GradeLevelRequest, user=Depends(require_admin)):
    db = get_db()
    try:
        db.execute("INSERT INTO grade_levels (grade_level) VALUES (?)", (req.grade_level,))
        db.commit()
        new_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        db.close()
        return {"id": new_id}
    except Exception as e:
        db.close()
        raise HTTPException(400, str(e))


@router.get("/api/task-types")
def list_task_types(user=Depends(get_current_user)):
    db = get_db()
    rows = db.execute("SELECT * FROM task_types ORDER BY id").fetchall()
    db.close()
    return [dict(r) for r in rows]

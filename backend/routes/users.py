from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from database import connect_db
from auth import (get_current_user, require_admin, require_admin_or_principal,
                  require_can_assign, hash_password, ASSIGNABLE_TO)

router = APIRouter(tags=["Users"])


# ── User list ─────────────────────────────────────────────────────────────────

@router.get("/api/users")
def list_users(user=Depends(get_current_user)):
    db = connect_db()
    rows = db.execute(
        """SELECT u.id, u.username, u.full_name, u.role, u.avatar_url,
                  u.grade_level_id, gl.grade_level
           FROM users u LEFT JOIN grade_levels gl ON gl.id=u.grade_level_id
           ORDER BY u.role, u.full_name"""
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


@router.get("/api/users/assignable")
def list_assignable_users(user=Depends(require_can_assign), target_role: str = ""):
    """Personnel the caller may assign a task to. Matching is by the *roles a
    person can act as* (user_roles), so a teacher-who-is-also-a-dean shows up
    under whichever identity is being targeted. When target_role is given, only
    holders of that role are returned (and the returned `role` is that target)."""
    db = connect_db()
    uid = int(user["sub"])
    role = user["role"]
    allowed_roles = ASSIGNABLE_TO.get(role, set())
    if not allowed_roles:
        db.close()
        return []

    if target_role:
        if target_role not in allowed_roles:
            db.close()
            return []
        roles_to_show = {target_role}
    else:
        roles_to_show = allowed_roles

    placeholders = ",".join("?" for _ in roles_to_show)
    # Match against the roles a person holds (user_roles → roles), and report that
    # role as the user's role so the UI assigns to the intended identity.
    q = f"""SELECT DISTINCT u.id, u.username, u.full_name, r.roles AS role,
                   u.grade_level_id, gl.grade_level
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN roles r ON r.id = ur.role_id
            LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
            WHERE r.roles IN ({placeholders})"""
    params = list(roles_to_show)

    if role == "dean":
        # A dean assigns only to teachers in the grade level she *handles*
        # (dean_assignment.grade_level_id), falling back to her own grade level.
        dean = db.execute(
            """SELECT COALESCE(da.grade_level_id, u.grade_level_id) AS gl
               FROM users u LEFT JOIN dean_assignment da ON da.user_id = u.id
               WHERE u.id=?""", (uid,)
        ).fetchone()
        if dean and dean["gl"]:
            q += " AND u.grade_level_id=?"
            params.append(dean["gl"])
        else:
            db.close()
            return []

    q += " ORDER BY r.roles, u.full_name"
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
    db = connect_db()
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
    db = connect_db()
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


# Explicit allowlist of columns the profile endpoint may ever write — even
# though req.dict() keys are already bounded by the Pydantic model, this makes
# the dynamic SET clause provably safe (defense in depth).
_PROFILE_COLUMNS = {
    "first_name", "middle_name", "last_name", "suffix", "email", "phone_number",
    "tin", "qsis", "hdmf", "phic", "date_of_appointment", "address",
}


@router.put("/api/users/me/profile")
def update_my_profile(req: UpdateProfileRequest, user=Depends(get_current_user)):
    db = connect_db()
    try:
        uid = int(user["sub"])
        updates = {k: v for k, v in req.dict().items()
                   if v is not None and k in _PROFILE_COLUMNS}
        if updates:
            # Keep the denormalized full_name in sync when a name part changes,
            # merging the new values with the existing ones for parts not sent.
            name_parts = ("first_name", "middle_name", "last_name", "suffix")
            if any(k in updates for k in name_parts):
                row = db.execute(
                    "SELECT first_name, middle_name, last_name, suffix FROM users WHERE id=?",
                    (uid,)
                ).fetchone()
                merged = dict(row) if row else {}
                merged.update({k: updates[k] for k in name_parts if k in updates})
                updates["full_name"] = " ".join(
                    p for p in (merged.get("first_name"), merged.get("middle_name"),
                                merged.get("last_name"), merged.get("suffix")) if p
                )
            set_clause = ", ".join(f"{k}=?" for k in updates)
            db.execute(f"UPDATE users SET {set_clause} WHERE id=?",
                       list(updates.values()) + [uid])
            db.commit()
        return {"message": "Profile updated"}
    finally:
        db.close()


# ── Subjects & Grade Levels & Task Types ──────────────────────────────────────

@router.get("/api/subjects")
def list_subjects(user=Depends(get_current_user)):
    return ["Mathematics", "Science", "English", "Filipino", "MAPEH",
            "Araling Panlipunan", "Edukasyon sa Pagpapakatao", "TLE"]


@router.get("/api/grade-levels")
def list_grade_levels(user=Depends(get_current_user)):
    db = connect_db()
    rows = db.execute("SELECT * FROM grade_levels ORDER BY id").fetchall()
    db.close()
    return [dict(r) for r in rows]


class GradeLevelRequest(BaseModel):
    grade_level: str


@router.post("/api/grade-levels")
def create_grade_level(req: GradeLevelRequest, user=Depends(require_admin)):
    db = connect_db()
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
    db = connect_db()
    rows = db.execute("SELECT * FROM task_types ORDER BY id").fetchall()
    db.close()
    return [dict(r) for r in rows]

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
from auth import get_current_user, require_personnel_manager, hash_password

router = APIRouter(tags=["Personnel"])


# ── Helper ────────────────────────────────────────────────────────────────────

def _user_row(row, db):
    d = dict(row)
    d.pop("password_hash", None)
    gl = db.execute(
        "SELECT grade_level FROM grade_levels WHERE id=?", (d.get("grade_level_id"),)
    ).fetchone()
    d["grade_level"] = gl["grade_level"] if gl else None
    d["subjects"] = [dict(r) for r in db.execute(
        """SELECT us.subject, gl.grade_level
           FROM user_subjects us
           LEFT JOIN grade_levels gl ON gl.id = us.grade_level_id
           WHERE us.user_id=?""", (d["id"],)
    ).fetchall()]
    ct = db.execute(
        "SELECT coordinator_type FROM coordinator_type WHERE user_id=?", (d["id"],)
    ).fetchone()
    d["coordinator_type"] = ct["coordinator_type"] if ct else None
    da = db.execute(
        """SELECT da.grade_level_id, gl.grade_level
           FROM dean_assignment da
           LEFT JOIN grade_levels gl ON gl.id = da.grade_level_id
           WHERE da.user_id=?""", (d["id"],)
    ).fetchone()
    d["dean_grade_level_id"] = da["grade_level_id"] if da else None
    d["dean_grade_level"] = da["grade_level"] if da else None
    return d


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/api/personnel")
def list_personnel(search: str = "", db=Depends(get_db), user=Depends(get_current_user)):
    q = f"%{search}%"
    rows = db.execute(
        """SELECT u.* FROM users u
           WHERE u.role != 'admin'
             AND (u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)
           ORDER BY u.role, u.full_name""",
        (q, q, q)
    ).fetchall()
    return [_user_row(r, db) for r in rows]


@router.get("/api/personnel/meta/grade-levels")
def get_grade_levels_meta(db=Depends(get_db), user=Depends(get_current_user)):
    return [dict(r) for r in db.execute("SELECT * FROM grade_levels ORDER BY id").fetchall()]


@router.get("/api/personnel/meta/subjects")
def get_subjects_meta(db=Depends(get_db), user=Depends(get_current_user)):
    return [dict(r) for r in db.execute("SELECT * FROM subjects ORDER BY id").fetchall()]


@router.get("/api/personnel/{uid}")
def get_personnel(uid: int, db=Depends(get_db), user=Depends(get_current_user)):
    row = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    return _user_row(row, db)


class PersonnelCreateBody(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    suffix: Optional[str] = None
    role: str
    grade_level_id: Optional[int] = None
    phone_number: Optional[str] = None
    tin: Optional[str] = None
    qsis: Optional[str] = None
    hdmf: Optional[str] = None
    phic: Optional[str] = None
    date_of_appointment: Optional[str] = None
    birthdate: Optional[str] = None
    address: Optional[str] = None


@router.post("/api/personnel", status_code=201)
def create_personnel(body: PersonnelCreateBody, db=Depends(get_db),
                     user=Depends(require_personnel_manager)):
    valid_roles = ('principal', 'coordinator', 'dean', 'teacher', 'registrar')
    if body.role not in valid_roles:
        raise HTTPException(400, f"Invalid role. Must be one of: {valid_roles}")
    pw = hash_password(body.password)
    full_name = " ".join(filter(None, [body.first_name, body.middle_name,
                                        body.last_name, body.suffix]))
    try:
        db.execute(
            """INSERT INTO users (username, password_hash, full_name, first_name, middle_name,
               last_name, suffix, role, grade_level_id, email, phone_number,
               tin, qsis, hdmf, phic, date_of_appointment, birthdate, address)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (body.username, pw, full_name, body.first_name, body.middle_name,
             body.last_name, body.suffix, body.role, body.grade_level_id,
             body.email, body.phone_number, body.tin, body.qsis, body.hdmf,
             body.phic, body.date_of_appointment, body.birthdate, body.address)
        )
        db.commit()
    except Exception as e:
        raise HTTPException(400, f"Username already exists or invalid data: {e}")
    row = db.execute("SELECT * FROM users WHERE username=?", (body.username,)).fetchone()
    return _user_row(row, db)


class PersonnelUpdateBody(BaseModel):
    email: Optional[str] = None
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    suffix: Optional[str] = None
    role: Optional[str] = None
    grade_level_id: Optional[int] = None
    phone_number: Optional[str] = None
    tin: Optional[str] = None
    qsis: Optional[str] = None
    hdmf: Optional[str] = None
    phic: Optional[str] = None
    date_of_appointment: Optional[str] = None
    birthdate: Optional[str] = None
    address: Optional[str] = None
    password: Optional[str] = None
    coordinator_type: Optional[str] = None
    dean_grade_level_id: Optional[int] = None


@router.put("/api/personnel/{uid}")
def update_personnel(uid: int, body: PersonnelUpdateBody, db=Depends(get_db),
                     user=Depends(require_personnel_manager)):
    row = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if not row:
        raise HTTPException(404, "User not found")

    fields, vals = [], []
    for col, val in [
        ("email", body.email), ("first_name", body.first_name),
        ("middle_name", body.middle_name), ("last_name", body.last_name),
        ("suffix", body.suffix), ("role", body.role),
        ("grade_level_id", body.grade_level_id), ("phone_number", body.phone_number),
        ("tin", body.tin), ("qsis", body.qsis), ("hdmf", body.hdmf),
        ("phic", body.phic), ("date_of_appointment", body.date_of_appointment),
        ("birthdate", body.birthdate), ("address", body.address),
    ]:
        if val is not None:
            fields.append(f"{col}=?")
            vals.append(val)

    if body.password:
        fields.append("password_hash=?")
        vals.append(hash_password(body.password))

    if fields:
        updated = dict(row)
        for col, val in zip([f.split("=")[0] for f in fields], vals):
            updated[col] = val
        full_name = " ".join(filter(None, [
            updated.get("first_name"), updated.get("middle_name"),
            updated.get("last_name"), updated.get("suffix")
        ]))
        fields.append("full_name=?")
        vals.append(full_name)
        vals.append(uid)
        db.execute(f"UPDATE users SET {', '.join(fields)} WHERE id=?", vals)
        db.commit()

    if body.coordinator_type is not None:
        db.execute(
            """INSERT INTO coordinator_type (user_id, coordinator_type) VALUES (?,?)
               ON CONFLICT(user_id) DO UPDATE SET coordinator_type=excluded.coordinator_type""",
            (uid, body.coordinator_type)
        )
        db.commit()

    if body.dean_grade_level_id is not None:
        db.execute(
            """INSERT INTO dean_assignment (user_id, grade_level_id) VALUES (?,?)
               ON CONFLICT(user_id) DO UPDATE SET grade_level_id=excluded.grade_level_id""",
            (uid, body.dean_grade_level_id)
        )
        db.commit()

    return _user_row(db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone(), db)


class SubjectEntry(BaseModel):
    grade_level_id: Optional[int] = None
    subject: str


class SubjectsUpdateBody(BaseModel):
    subjects: List[SubjectEntry]


@router.put("/api/personnel/{uid}/subjects")
def update_personnel_subjects(uid: int, body: SubjectsUpdateBody,
                              db=Depends(get_db),
                              user=Depends(require_personnel_manager)):
    if not db.execute("SELECT id FROM users WHERE id=?", (uid,)).fetchone():
        raise HTTPException(404, "User not found")
    db.execute("DELETE FROM user_subjects WHERE user_id=?", (uid,))
    for s in body.subjects:
        if s.subject.strip():
            db.execute(
                "INSERT INTO user_subjects (user_id, grade_level_id, subject) VALUES (?,?,?)",
                (uid, s.grade_level_id, s.subject.strip())
            )
    db.commit()
    return _user_row(db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone(), db)


@router.patch("/api/personnel/{uid}/status")
def toggle_personnel_status(uid: int, db=Depends(get_db),
                            user=Depends(require_personnel_manager)):
    row = db.execute("SELECT is_active FROM users WHERE id=?", (uid,)).fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    new_status = 0 if row["is_active"] else 1
    db.execute("UPDATE users SET is_active=? WHERE id=?", (new_status, uid))
    db.commit()
    return {"id": uid, "is_active": bool(new_status)}

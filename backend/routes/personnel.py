from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, ConfigDict
from datetime import date
from typing import Optional, List
from database import get_db
from auth import (get_current_user, require_personnel_manager, require_personnel_deactivator,
                  hash_password, has_permission, _held_roles)
from qualifications import get_qualifications, education_options
import audit

router = APIRouter(tags=["Personnel"])


# ── Helper ────────────────────────────────────────────────────────────────────

def _user_row(row, db):
    d = dict(row)
    d.pop("password_hash", None)
    gl = db.execute(
        "SELECT grade_level FROM grade_levels WHERE id=?", (d.get("grade_level_id"),)
    ).fetchone()
    d["grade_level"] = gl["grade_level"] if gl else None
    d.update(get_qualifications(db, d["id"]))
    d["subjects"] = [dict(r) for r in db.execute(
        """SELECT s.subject_name AS subject, gl.grade_level
           FROM user_subjects us
           JOIN subjects s ON s.id = us.subject_id
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
    roles = {r["roles"] for r in db.execute(
        """SELECT role AS roles FROM user_held_roles
           WHERE user_id=?""", (d["id"],)
    ).fetchall()}
    d["roles"] = sorted(roles)
    d["also_teaching"] = ("teacher" in roles) and d.get("role") != "teacher"
    return d


def _delegation(db, uid: int) -> dict:
    """The account/delegation fields an audit entry compares before and after."""
    u = db.execute("""SELECT u.role, u.is_active, u.date_of_appointment, gl.grade_level
                      FROM users u LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
                      WHERE u.id=?""", (uid,)).fetchone()
    if not u:
        return {}
    roles = sorted(r["roles"] for r in db.execute(
        """SELECT role AS roles FROM user_held_roles
           WHERE user_id=?""", (uid,)).fetchall())
    ct = db.execute("SELECT coordinator_type FROM coordinator_type WHERE user_id=?",
                    (uid,)).fetchone()
    dean = db.execute("""SELECT gl.grade_level FROM dean_assignment da
                         LEFT JOIN grade_levels gl ON gl.id = da.grade_level_id
                         WHERE da.user_id=?""", (uid,)).fetchone()
    subjects = sorted(
        f"{r['subject']} ({r['grade_level']})" if r["grade_level"] else r["subject"]
        for r in db.execute("""SELECT s.subject_name AS subject, gl.grade_level
                               FROM user_subjects us JOIN subjects s ON s.id = us.subject_id
                               LEFT JOIN grade_levels gl ON gl.id = us.grade_level_id
                               WHERE us.user_id=?""", (uid,)).fetchall())
    return {
        "role": u["role"],
        "roles": ", ".join(roles) or None,
        "grade_level": u["grade_level"],
        "date_of_appointment": u["date_of_appointment"],
        "coordinator_type": ct["coordinator_type"] if ct else None,
        "dean_grade_level": dean["grade_level"] if dean else None,
        "subjects": "; ".join(subjects) or None,
        "active": bool(u["is_active"]),
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/api/personnel")
def list_personnel(search: str = "", limit: int = 0, offset: int = 0,
                   db=Depends(get_db), user=Depends(get_current_user)):
    q = f"%{search}%"
    where = ("FROM users u WHERE u.role != 'admin' "
             "AND (u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ? "
             "OR EXISTS (SELECT 1 FROM user_skills us JOIN skills s ON s.id=us.skill_id "
             "WHERE us.user_id=u.id AND s.skill_name LIKE ?) "
             "OR EXISTS (SELECT 1 FROM certificate_files cf "
             "JOIN certifications c ON c.id=cf.certification_id "
             "WHERE cf.user_id=u.id AND cf.status IN ('submitted','verified') "
             "AND c.cert_name LIKE ?) "
             "OR EXISTS (SELECT 1 FROM education_background eb "
             "WHERE eb.user_id=u.id AND eb.specialization LIKE ?))")
    params = [q, q, q, q, q, q]
    order = " ORDER BY u.role, u.full_name"
    if limit and limit > 0:
        total = db.execute(f"SELECT COUNT(*) {where}", params).fetchone()[0]
        rows = db.execute(f"SELECT u.* {where}{order} LIMIT ? OFFSET ?",
                          params + [limit, offset]).fetchall()
        items = [_user_row(r, db) for r in rows]
        return {"items": items, "total": total, "limit": limit, "offset": offset,
                "has_more": offset + len(items) < total}
    rows = db.execute(f"SELECT u.* {where}{order}", params).fetchall()
    return [_user_row(r, db) for r in rows]


@router.get("/api/personnel/meta/grade-levels")
def get_grade_levels_meta(db=Depends(get_db), user=Depends(get_current_user)):
    return [dict(r) for r in db.execute("SELECT * FROM grade_levels ORDER BY id").fetchall()]


@router.get("/api/personnel/meta/subjects")
def get_subjects_meta(db=Depends(get_db), user=Depends(get_current_user)):
    return [dict(r) for r in db.execute("SELECT * FROM subjects ORDER BY id").fetchall()]


@router.get("/api/personnel/meta/skills")
def get_skills_meta(db=Depends(get_db), user=Depends(get_current_user)):
    return [dict(r) for r in db.execute(
        """SELECT s.id, s.skill_name, sc.category_name
           FROM skills s LEFT JOIN skill_categories sc ON sc.id = s.category_id
           ORDER BY sc.category_name IS NULL, sc.category_name, s.skill_name""").fetchall()]


@router.get("/api/personnel/meta/certifications")
def get_certifications_meta(db=Depends(get_db), user=Depends(get_current_user)):
    return [dict(r) for r in db.execute(
        """SELECT c.id, c.cert_name, cc.category_name, ci.issuer_name, ci.acronym
           FROM certifications c
           LEFT JOIN certification_categories cc ON cc.id = c.category_id
           LEFT JOIN certification_issuers ci ON ci.id = c.issuer_id
           ORDER BY cc.category_name IS NULL, cc.category_name, c.cert_name""").fetchall()]


@router.get("/api/personnel/meta/skill-categories")
def get_skill_categories_meta(db=Depends(get_db), user=Depends(get_current_user)):
    return [dict(r) for r in
            db.execute("SELECT * FROM skill_categories ORDER BY id").fetchall()]


@router.get("/api/personnel/meta/certification-categories")
def get_certification_categories_meta(db=Depends(get_db), user=Depends(get_current_user)):
    return [dict(r) for r in
            db.execute("SELECT * FROM certification_categories ORDER BY id").fetchall()]


@router.get("/api/personnel/meta/certification-issuers")
def get_certification_issuers_meta(db=Depends(get_db), user=Depends(get_current_user)):
    return [dict(r) for r in
            db.execute("SELECT * FROM certification_issuers ORDER BY issuer_name").fetchall()]


@router.get("/api/personnel/meta/education-options")
def get_education_options_meta(user=Depends(get_current_user)):
    return education_options()


@router.get("/api/personnel/meta/departments")
def get_departments_meta(db=Depends(get_db), user=Depends(get_current_user)):
    return [dict(r) for r in
            db.execute("SELECT * FROM departments ORDER BY department_name").fetchall()]


class DepartmentBody(BaseModel):
    department_name: str


@router.post("/api/personnel/departments", status_code=201)
def create_department(body: DepartmentBody, request: Request, db=Depends(get_db),
                      user=Depends(require_personnel_manager)):
    name = body.department_name.strip()
    if not name:
        raise HTTPException(400, "Department name is required")
    cur = db.execute("INSERT OR IGNORE INTO departments (department_name) VALUES (?)", (name,))
    if cur.rowcount:
        audit.record(db, user, "department.create", "department", cur.lastrowid,
                     f"Created department {name}", request=request)
    db.commit()
    row = db.execute("SELECT * FROM departments WHERE department_name=?", (name,)).fetchone()
    return dict(row)


@router.get("/api/personnel/{uid}")
def get_personnel(uid: int, db=Depends(get_db), user=Depends(get_current_user)):
    row = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    return _user_row(row, db)


# Personal information (contact details, birthdate, address, number of
# children, education, skills, certifications) is editable only by its owner via
# PUT /api/users/me/profile. Personnel managers handle accounts and role
# assignments only, so these bodies forbid any other field (422 if sent).

class PersonnelCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str
    password: str
    email: Optional[str] = None
    first_name: str  # initial display name; the owner completes their profile
    middle_name: Optional[str] = None
    last_name: str
    suffix: Optional[str] = None
    role: str
    grade_level_id: Optional[int] = None
    date_of_appointment: Optional[date] = None   # YYYY-MM-DD


@router.post("/api/personnel", status_code=201)
def create_personnel(body: PersonnelCreateBody, request: Request, db=Depends(get_db),
                     user=Depends(require_personnel_manager)):
    valid_roles = ('principal', 'coordinator', 'dean', 'teacher', 'registrar')
    if body.role not in valid_roles:
        raise HTTPException(400, f"Invalid role. Must be one of: {valid_roles}")
    pw = hash_password(body.password)
    try:
        db.execute(
            """INSERT INTO users (username, password_hash, first_name, middle_name,
               last_name, suffix, role, grade_level_id, email, date_of_appointment)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (body.username, pw, body.first_name, body.middle_name,
             body.last_name, body.suffix, body.role, body.grade_level_id,
             body.email,
             body.date_of_appointment.isoformat() if body.date_of_appointment else None)
        )
        new_id = db.execute("SELECT id FROM users WHERE username=?", (body.username,)).fetchone()["id"]
        audit.record(db, user, "account.create", "user", new_id,
                     f"Created account {body.username} as {body.role}",
                     changes=audit.diff({}, _delegation(db, new_id)), request=request)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(400, f"Username already exists or invalid data: {e}")
    row = db.execute("SELECT * FROM users WHERE username=?", (body.username,)).fetchone()
    return _user_row(row, db)


class PersonnelUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Optional[str] = None
    grade_level_id: Optional[int] = None
    date_of_appointment: Optional[date] = None   # YYYY-MM-DD
    password: Optional[str] = None  # account reset
    coordinator_type: Optional[str] = None
    dean_grade_level_id: Optional[int] = None
    also_teaching: Optional[bool] = None  # admin role who is also teaching staff


@router.put("/api/personnel/{uid}")
def update_personnel(uid: int, body: PersonnelUpdateBody, request: Request,
                     db=Depends(get_db), user=Depends(require_personnel_manager)):
    row = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    before = _delegation(db, uid)

    fields, vals = [], []
    for col, val in [
        ("role", body.role),
        ("grade_level_id", body.grade_level_id),
        ("date_of_appointment",
         body.date_of_appointment.isoformat() if body.date_of_appointment else None),
    ]:
        if val is not None:
            fields.append(f"{col}=?")
            vals.append(val)

    if body.password:
        fields.append("password_hash=?")
        vals.append(hash_password(body.password))

    if fields:
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

    # user_roles holds only additional roles (the primary one is users.role):
    # drop the new primary from it, and an admin role (dean/coordinator/
    # registrar) can additionally hold the teacher identity.
    primary_role = body.role if body.role is not None else row["role"]
    if primary_role:
        db.execute(
            """DELETE FROM user_roles WHERE user_id=?
               AND role_id=(SELECT id FROM roles WHERE roles=?)""", (uid, primary_role))
        if body.also_teaching is not None and primary_role != "teacher":
            if body.also_teaching:
                db.execute(
                    """INSERT OR IGNORE INTO user_roles (user_id, role_id)
                       SELECT ?, id FROM roles WHERE roles='teacher'""", (uid,))
            else:
                db.execute(
                    """DELETE FROM user_roles WHERE user_id=?
                       AND role_id=(SELECT id FROM roles WHERE roles='teacher')""", (uid,))
        db.commit()

    changes = audit.diff(before, _delegation(db, uid))
    if body.password:
        changes["password"] = ["(hidden)", "reset"]  # never log the value
    if changes:
        audit.record(db, user, "personnel.update", "user", uid,
                     "Changed " + ", ".join(k.replace("_", " ") for k in changes),
                     changes=changes, request=request)
        db.commit()

    return _user_row(db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone(), db)


class SubjectEntry(BaseModel):
    grade_level_id: Optional[int] = None
    subject: str


class SubjectsUpdateBody(BaseModel):
    subjects: List[SubjectEntry]


@router.put("/api/personnel/{uid}/subjects")
def update_personnel_subjects(uid: int, body: SubjectsUpdateBody, request: Request,
                              db=Depends(get_db),
                              user=Depends(require_personnel_manager)):
    if not db.execute("SELECT id FROM users WHERE id=?", (uid,)).fetchone():
        raise HTTPException(404, "User not found")
    names = {s.subject.strip() for s in body.subjects if s.subject.strip()}
    known = {r["subject_name"]: r["id"] for r in db.execute(
        f"SELECT id, subject_name FROM subjects WHERE subject_name IN ({','.join('?' * len(names))})",
        list(names)).fetchall()} if names else {}
    unknown = sorted(names - set(known))
    if unknown:
        raise HTTPException(400, f"Unknown subject: {', '.join(unknown)}")
    before = _delegation(db, uid)
    db.execute("DELETE FROM user_subjects WHERE user_id=?", (uid,))
    for s in body.subjects:
        if s.subject.strip():
            db.execute(
                "INSERT OR IGNORE INTO user_subjects (user_id, subject_id, grade_level_id) "
                "VALUES (?,?,?)", (uid, known[s.subject.strip()], s.grade_level_id))
    changes = audit.diff(before, _delegation(db, uid))
    if changes:
        audit.record(db, user, "personnel.subjects", "user", uid, "Changed subject-grade assignments",
                     changes=changes, request=request)
    db.commit()
    return _user_row(db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone(), db)


@router.patch("/api/personnel/{uid}/status")
def toggle_personnel_status(uid: int, request: Request, db=Depends(get_db),
                            user=Depends(require_personnel_deactivator)):
    row = db.execute("SELECT is_active FROM users WHERE id=?", (uid,)).fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    if uid == int(user["sub"]):
        raise HTTPException(403, "You can't deactivate your own account")
    # Only the principal/admin may (de)activate principal or admin accounts.
    held = _held_roles(db, uid)
    if held and held[1] & {"principal", "admin"} and not has_permission(user, "manage_personnel"):
        raise HTTPException(403, "Only the Principal or Admin can change this account's status")
    new_status = 0 if row["is_active"] else 1
    db.execute("UPDATE users SET is_active=? WHERE id=?", (new_status, uid))
    audit.record(db, user, "account.reactivate" if new_status else "account.deactivate", "user", uid,
                 "Reactivated account" if new_status else "Deactivated account",
                 changes={"active": [not new_status, bool(new_status)]}, request=request)
    db.commit()
    return {"id": uid, "is_active": bool(new_status)}

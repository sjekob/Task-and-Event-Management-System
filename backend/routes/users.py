from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile
import audit
from pydantic import BaseModel, Field
from datetime import date
from typing import List, Optional
import io
import re
import os
import secrets
from database import connect_db
from auth import (get_current_user, require_admin, require_admin_or_principal,
                  require_can_assign, hash_password, ASSIGNABLE_TO)
from qualifications import (EducationBody, get_qualifications, set_skills,
                            set_education, validate_education, task_timing,
                            validate_catalog_names, score_candidates)

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


def _assignable_rows(db, user, target_role: str = "") -> list:
    """Personnel the caller may assign a task to. Matching is by the *roles a
    person can act as* (user_roles), so a teacher-who-is-also-a-dean shows up
    under whichever identity is being targeted. When target_role is given, only
    holders of that role are returned (and the returned `role` is that target)."""
    uid = int(user["sub"])
    role = user["role"]
    allowed_roles = ASSIGNABLE_TO.get(role, set())
    if not allowed_roles:
        return []

    if target_role:
        if target_role not in allowed_roles:
            return []
        roles_to_show = {target_role}
    else:
        roles_to_show = allowed_roles

    placeholders = ",".join("?" for _ in roles_to_show)
    # Match against the roles a person holds (user_held_roles), and report that
    # role as the user's role so the UI assigns to the intended identity.
    q = f"""SELECT DISTINCT u.id, u.username, u.full_name, hr.role AS role,
                   u.grade_level_id, gl.grade_level, u.is_active
            FROM users u
            JOIN user_held_roles hr ON hr.user_id = u.id
            LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
            WHERE hr.role IN ({placeholders})"""
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
            return []

    q += " ORDER BY hr.role, u.full_name"
    return [dict(r) for r in db.execute(q, params).fetchall()]


@router.get("/api/users/assignable")
def list_assignable_users(user=Depends(require_can_assign), target_role: str = ""):
    db = connect_db()
    try:
        return _assignable_rows(db, user, target_role)
    finally:
        db.close()


class SuggestionRequest(BaseModel):
    target_role: Optional[str] = ""
    title: Optional[str] = ""
    subject: Optional[str] = ""
    instructions: Optional[str] = ""
    task_category: Optional[str] = "common"
    # When the task happens, for the life-context guard (off-hours detection).
    start_date: Optional[str] = None   # YYYY-MM-DD
    end_date: Optional[str] = None     # YYYY-MM-DD
    due_time: Optional[str] = None     # "4:30 PM" or "16:30"


@router.post("/api/users/assignable/suggestions")
def suggest_assignees(req: SuggestionRequest, user=Depends(require_can_assign)):
    """Assignable personnel ranked by a 0-100 fit score: competency (profile
    matching the task text), current workload, and a life-context guard for
    off-hours tasks. See qualifications.score_candidates for the rules."""
    db = connect_db()
    try:
        candidates = [r for r in _assignable_rows(db, user, req.target_role or "")
                      if r["is_active"]]
        task_text = " ".join(filter(None, [req.title, req.subject, req.instructions]))
        timing = task_timing(req.start_date, req.end_date, req.due_time,
                             req.task_category or "common")
        return score_candidates(db, candidates, task_text, req.task_category or "common",
                                timing)
    finally:
        db.close()


class CreateUserRequest(BaseModel):
    username: str
    password: str
    first_name: str
    last_name: str
    role: str
    grade_level_id: Optional[int] = None


@router.post("/api/users")
def create_user(req: CreateUserRequest, request: Request,
                user=Depends(require_admin_or_principal)):
    valid_roles = {"admin", "principal", "coordinator", "dean", "teacher", "registrar"}
    if req.role not in valid_roles:
        raise HTTPException(400, f"Invalid role. Must be one of: {valid_roles}")
    db = connect_db()
    try:
        db.execute(
            "INSERT INTO users (username,password_hash,first_name,last_name,role,grade_level_id) "
            "VALUES (?,?,?,?,?,?)",
            (req.username, hash_password(req.password), req.first_name.strip(),
             req.last_name.strip(), req.role, req.grade_level_id)
        )
        new_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        audit.record(db, user, "account.create", "user", new_id,
                     f"Created account {req.username} as {req.role}",
                     changes={"role": [None, req.role]}, request=request)
        db.commit()
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
        """SELECT s.subject_name AS subject, gl.grade_level FROM user_subjects us
           JOIN subjects s ON s.id = us.subject_id
           LEFT JOIN grade_levels gl ON gl.id=us.grade_level_id
           WHERE us.user_id=? ORDER BY s.subject_name""",
        (uid,)
    ).fetchall()
    d["subjects"] = [dict(s) for s in subjects]
    d.update(get_qualifications(db, uid))
    db.close()
    return d


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    suffix: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    birthdate: Optional[date] = None             # YYYY-MM-DD
    number_of_children: Optional[int] = Field(None, ge=0)
    has_elderly_or_infant_care: Optional[bool] = None
    overtime_opt_in: Optional[bool] = None
    skills: Optional[List[str]] = None
    education: Optional[EducationBody] = None
    date_of_appointment: Optional[date] = None   # YYYY-MM-DD
    address: Optional[str] = None


# Explicit allowlist of columns the profile endpoint may ever write — even
# though req.dict() keys are already bounded by the Pydantic model, this makes
# the dynamic SET clause provably safe (defense in depth).
_PROFILE_COLUMNS = {
    "first_name", "middle_name", "last_name", "suffix", "email", "phone_number",
    "birthdate", "number_of_children", "date_of_appointment", "address",
    "has_elderly_or_infant_care", "overtime_opt_in",
}


# ── Profile photo ─────────────────────────────────────────────────────────────
# An upload is kept twice, both re-encoded as JPEG (only real images survive,
# EXIF/GPS metadata is dropped): "<uid>_<tag>_src.jpg" (the whole photo, up to
# 1600 px, for re-positioning later) and "<uid>_<tag>_<v>.jpg" (the 400 px
# square shown as the avatar). Re-positioning writes a new <v> so browsers
# don't show a cached crop.

AVATAR_MAX_BYTES = 5 * 1024 * 1024
AVATAR_PX = 400
SOURCE_MAX_PX = 1600
_AVATAR_NAME = re.compile(r"^(\d+)_([0-9a-f]+)_([0-9a-z]+)\.jpg$")


def _avatar_dir() -> str:
    from files import UPLOAD_DIR
    path = os.path.join(UPLOAD_DIR, "avatars")
    os.makedirs(path, exist_ok=True)
    return path


def _source_name(avatar_url: Optional[str]) -> Optional[str]:
    """The kept full photo behind an avatar, if there is one."""
    m = _AVATAR_NAME.match(os.path.basename(avatar_url or ""))
    if not m or not (avatar_url or "").startswith("/uploads/avatars/"):
        return None
    name = f"{m.group(1)}_{m.group(2)}_src.jpg"
    return name if os.path.exists(os.path.join(_avatar_dir(), name)) else None


def _delete(name: Optional[str]):
    if name:
        try:
            os.remove(os.path.join(_avatar_dir(), os.path.basename(name)))
        except OSError:
            pass


def _crop_square(img, left: float, top: float, size: float):
    """Square crop given as fractions: left/top of the image width/height,
    size of the image's shorter side. Clamped to stay inside the image."""
    w, h = img.size
    side = max(1, round(min(w, h) * min(max(size, 0.05), 1.0)))
    x = min(max(round(left * w), 0), w - side)
    y = min(max(round(top * h), 0), h - side)
    return img.crop((x, y, x + side, y + side)).resize((AVATAR_PX, AVATAR_PX))


def _set_avatar(uid: int, url: Optional[str]) -> Optional[str]:
    """Store the new avatar URL; returns the previous one."""
    db = connect_db()
    try:
        old = db.execute("SELECT avatar_url FROM users WHERE id=?", (uid,)).fetchone()
        db.execute("UPDATE users SET avatar_url=? WHERE id=?", (url, uid))
        db.commit()
        return old[0] if old else None
    finally:
        db.close()


def _current_avatar(uid: int) -> Optional[str]:
    db = connect_db()
    try:
        row = db.execute("SELECT avatar_url FROM users WHERE id=?", (uid,)).fetchone()
        return row[0] if row else None
    finally:
        db.close()


@router.post("/api/users/me/avatar")
async def upload_my_avatar(file: UploadFile, user=Depends(get_current_user)):
    """Set the signed-in person's profile photo (centred square crop; adjust
    it afterwards with PUT /api/users/me/avatar/position)."""
    from PIL import Image, ImageOps, UnidentifiedImageError

    data = await file.read(AVATAR_MAX_BYTES + 1)
    if len(data) > AVATAR_MAX_BYTES:
        raise HTTPException(413, "The photo is larger than 5 MB. Choose a smaller one.")
    try:
        img = Image.open(io.BytesIO(data))
        if img.format not in ("JPEG", "PNG", "WEBP"):
            raise HTTPException(400, "Use a JPG, PNG or WEBP photo.")
        img = ImageOps.exif_transpose(img).convert("RGB")   # respect phone rotation
        img.thumbnail((SOURCE_MAX_PX, SOURCE_MAX_PX))
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "That file isn't a photo we can read. Use a JPG, PNG or WEBP.")

    uid = int(user["sub"])
    tag = secrets.token_hex(6)
    img.save(os.path.join(_avatar_dir(), f"{uid}_{tag}_src.jpg"), "JPEG", quality=88)
    w, h = img.size
    side = min(w, h)
    crop = _crop_square(img, (w - side) / 2 / w, (h - side) / 2 / h, 1.0)
    name = f"{uid}_{tag}_{secrets.token_hex(3)}.jpg"
    crop.save(os.path.join(_avatar_dir(), name), "JPEG", quality=85, optimize=True)

    old = _set_avatar(uid, f"/uploads/avatars/{name}")
    if old:
        _delete(_source_name(old))
        _delete(old if old.startswith("/uploads/avatars/") else None)
    return {"avatar_url": f"/uploads/avatars/{name}",
            "source_url": f"/uploads/avatars/{uid}_{tag}_src.jpg"}


@router.get("/api/users/me/avatar")
def my_avatar(user=Depends(get_current_user)):
    url = _current_avatar(int(user["sub"]))
    src = _source_name(url)
    return {"avatar_url": url, "source_url": f"/uploads/avatars/{src}" if src else None}


class AvatarPosition(BaseModel):
    left: float = Field(ge=0, le=1)    # fraction of the photo's width
    top: float = Field(ge=0, le=1)     # fraction of the photo's height
    size: float = Field(gt=0, le=1)    # fraction of the photo's shorter side


@router.put("/api/users/me/avatar/position")
def position_my_avatar(body: AvatarPosition, user=Depends(get_current_user)):
    """Re-crop the avatar from the kept full photo."""
    from PIL import Image

    uid = int(user["sub"])
    old = _current_avatar(uid)
    src = _source_name(old)
    if not src:
        raise HTTPException(404, "Upload a photo first.")
    m = _AVATAR_NAME.match(src)
    with Image.open(os.path.join(_avatar_dir(), src)) as img:
        crop = _crop_square(img.convert("RGB"), body.left, body.top, body.size)
    name = f"{uid}_{m.group(2)}_{secrets.token_hex(3)}.jpg"
    crop.save(os.path.join(_avatar_dir(), name), "JPEG", quality=85, optimize=True)
    _set_avatar(uid, f"/uploads/avatars/{name}")
    _delete(old)
    return {"avatar_url": f"/uploads/avatars/{name}"}


@router.delete("/api/users/me/avatar")
def remove_my_avatar(user=Depends(get_current_user)):
    old = _set_avatar(int(user["sub"]), None)
    if old and old.startswith("/uploads/avatars/"):
        _delete(_source_name(old))
        _delete(old)
    return {"message": "Profile photo removed"}


@router.put("/api/users/me/profile")
def update_my_profile(req: UpdateProfileRequest, user=Depends(get_current_user)):
    db = connect_db()
    try:
        try:
            if req.education is not None:
                validate_education(req.education.dict())
            validate_catalog_names(db, req.skills, None)
        except ValueError as e:
            raise HTTPException(400, str(e))
        uid = int(user["sub"])
        updates = {k: v for k, v in req.dict().items()
                   if v is not None and k in _PROFILE_COLUMNS}
        for flag in ("has_elderly_or_infant_care", "overtime_opt_in"):
            if flag in updates:
                updates[flag] = int(bool(updates[flag]))
        today = date.today()
        if req.birthdate and req.birthdate > today:
            raise HTTPException(400, "Birthdate can't be in the future")
        if req.date_of_appointment and req.date_of_appointment > today:
            raise HTTPException(400, "Date of appointment can't be in the future")
        if req.birthdate or req.date_of_appointment:
            cur = db.execute("SELECT birthdate, date_of_appointment FROM users WHERE id=?",
                             (int(user["sub"]),)).fetchone()
            born = req.birthdate or (date.fromisoformat(cur[0]) if cur and cur[0] else None)
            hired = req.date_of_appointment or (
                date.fromisoformat(cur[1]) if cur and cur[1] else None)
            if born and hired and hired <= born:
                raise HTTPException(400, "Date of appointment must be after the birthdate")
        for col in ("birthdate", "date_of_appointment"):
            if col in updates:
                updates[col] = updates[col].isoformat()
        if updates:
            # full_name is a generated column, so it follows the name parts.
            set_clause = ", ".join(f"{k}=?" for k in updates)
            db.execute(f"UPDATE users SET {set_clause} WHERE id=?",
                       list(updates.values()) + [uid])
        if req.skills is not None:
            set_skills(db, uid, req.skills)
        # Certifications are added only by uploading a certificate
        # (/api/certificates), so they can be checked and verified.
        if req.education is not None:
            set_education(db, uid, req.education.dict())
        db.commit()
        return {"message": "Profile updated"}
    finally:
        db.close()


# ── Subjects & Grade Levels & Task Types ──────────────────────────────────────

@router.get("/api/subjects")
def list_subjects(user=Depends(get_current_user)):
    db = connect_db()
    try:
        return [r[0] for r in db.execute("SELECT subject_name FROM subjects ORDER BY subject_name")]
    finally:
        db.close()


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

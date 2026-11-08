"""
Sections — the classes of the school ("Grade 1 - Rizal").

A section has one adviser (a teacher advises at most one section) and the
subject teachers who teach in it (section_teachers). Advisers receive the
calendar's class-level tasks (report cards, school forms) and review what their
section's subject teachers submit (grades); see calendar_tasks.py.

Served under /api/personnel/sections so the gateway routes it to the
personnel service; this router is included before the personnel router so
"sections" is never read as a personnel id.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, field_validator

import audit
import store
from auth import get_current_user, require_personnel_manager
from database import get_db

router = APIRouter(tags=["Sections"])


# ── Lookups other modules use ────────────────────────────────────────────────

def advisory_of(db, uid: int) -> Optional[dict]:
    """The section [uid] advises, or None."""
    r = db.execute("""SELECT s.id, s.name, s.grade_level_id, gl.grade_level FROM sections s
                      JOIN grade_levels gl ON gl.id = s.grade_level_id WHERE s.adviser_id=?""", (uid,)).fetchone()
    return dict(r) if r else None


def is_adviser(db, uid: int) -> bool:
    return db.execute("SELECT 1 FROM sections WHERE adviser_id=?", (uid,)).fetchone() is not None


def section_label(s: dict) -> str:
    return f"{s['grade_level']} - {s['name']}"


def all_sections(db) -> list:
    """Every section with its grade, adviser and subject teachers."""
    rows = [dict(r) for r in db.execute(
        """SELECT s.id, s.name, s.grade_level_id, gl.grade_level, s.adviser_id, u.full_name AS adviser_name,
                  u.is_active AS adviser_active
           FROM sections s JOIN grade_levels gl ON gl.id = s.grade_level_id
           LEFT JOIN users u ON u.id = s.adviser_id
           ORDER BY gl.id, s.name""").fetchall()]
    teachers = {}
    for t in db.execute(
            """SELECT st.section_id, st.user_id, u.full_name, sub.subject_name AS subject, u.is_active
               FROM section_teachers st JOIN users u ON u.id = st.user_id
               JOIN subjects sub ON sub.id = st.subject_id ORDER BY sub.subject_name""").fetchall():
        teachers.setdefault(t["section_id"], []).append(
            {"user_id": t["user_id"], "name": t["full_name"], "subject": t["subject"], "active": bool(t["is_active"])})
    for s in rows:
        s["label"] = section_label(s)
        s["teachers"] = teachers.get(s["id"], [])
    return rows


# ── Endpoints ────────────────────────────────────────────────────────────────

class SectionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str
    grade_level_id: int

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v:
            raise ValueError("Enter the section's name")
        if len(v) > 60:
            raise ValueError("Section names are at most 60 characters")
        return v


@router.get("/api/personnel/sections")
def list_sections(db=Depends(get_db), user=Depends(get_current_user)):
    return all_sections(db)


def _grade_exists(db, gid: int):
    if not db.execute("SELECT 1 FROM grade_levels WHERE id=?", (gid,)).fetchone():
        raise HTTPException(400, "Choose a grade level")


def _duplicate(db, body: SectionBody, skip: int = 0):
    if db.execute("SELECT 1 FROM sections WHERE grade_level_id=? AND name=? AND id<>?",
                  (body.grade_level_id, body.name, skip)).fetchone():
        raise HTTPException(400, f"That grade level already has a section named {body.name}")


@router.post("/api/personnel/sections")
def create_section(body: SectionBody, request: Request, db=Depends(get_db), user=Depends(require_personnel_manager)):
    _grade_exists(db, body.grade_level_id)
    _duplicate(db, body)
    sid = db.execute("INSERT INTO section (name, grade_level_id) VALUES (?, ?)",
                     (body.name, body.grade_level_id)).lastrowid
    audit.record(db, user, "section.create", "section", sid, f"Added section {body.name}", request=request)
    db.commit()
    return next(s for s in all_sections(db) if s["id"] == sid)


@router.put("/api/personnel/sections/{sid}")
def update_section(sid: int, body: SectionBody, request: Request, db=Depends(get_db), user=Depends(require_personnel_manager)):
    old = db.execute("SELECT name FROM sections WHERE id=?", (sid,)).fetchone()
    if not old:
        raise HTTPException(404, "Section not found")
    _grade_exists(db, body.grade_level_id)
    _duplicate(db, body, sid)
    db.execute("UPDATE section SET name=?, grade_level_id=? WHERE id=?", (body.name, body.grade_level_id, sid))
    audit.record(db, user, "section.update", "section", sid, f"Updated section {body.name}",
                 changes={"name": [old["name"], body.name]} if old["name"] != body.name else None, request=request)
    db.commit()
    return next(s for s in all_sections(db) if s["id"] == sid)


@router.delete("/api/personnel/sections/{sid}")
def delete_section(sid: int, request: Request, db=Depends(get_db), user=Depends(require_personnel_manager)):
    old = db.execute("SELECT name FROM sections WHERE id=?", (sid,)).fetchone()
    if not old:
        raise HTTPException(404, "Section not found")
    db.execute("DELETE FROM section WHERE id=?", (sid,))
    audit.record(db, user, "section.delete", "section", sid, f"Removed section {old['name']}", request=request)
    db.commit()
    return {"message": "Section removed"}


class AdvisoryBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    section_id: Optional[int] = None   # None: not an adviser


@router.put("/api/personnel/{uid}/advisory")
def set_advisory(uid: int, body: AdvisoryBody, request: Request, db=Depends(get_db), user=Depends(require_personnel_manager)):
    """Make [uid] the adviser of a section (replacing its previous adviser), or of none."""
    if not db.execute("SELECT 1 FROM users WHERE id=?", (uid,)).fetchone():
        raise HTTPException(404, "User not found")
    before = advisory_of(db, uid)
    if body.section_id is not None:
        sec = db.execute("SELECT id, adviser_id FROM sections WHERE id=?", (body.section_id,)).fetchone()
        if not sec:
            raise HTTPException(400, "That section no longer exists")
    db.execute("UPDATE section SET adviser_id=NULL WHERE adviser_id=?", (uid,))
    if body.section_id is not None:
        db.execute("UPDATE section SET adviser_id=? WHERE id=?", (uid, body.section_id))
        # Advising a class means teaching: an admin-role account gains the teacher identity.
        db.execute("""INSERT INTO user_roles (user_id, role_id)
                      SELECT u.id, r.id FROM personnel u, roles r
                      WHERE u.id=? AND r.roles='teacher' AND u.role<>'teacher'
                      ON CONFLICT DO NOTHING""", (uid,))
    after = advisory_of(db, uid)
    old_label, new_label = (section_label(before) if before else None), (section_label(after) if after else None)
    if old_label != new_label:
        audit.record(db, user, "personnel.advisory", "user", uid,
                     f"Set advisory class to {new_label}" if new_label else "Removed advisory class",
                     changes={"advisory_class": [old_label, new_label]}, request=request)
    db.commit()
    return {"advisory_section": after}

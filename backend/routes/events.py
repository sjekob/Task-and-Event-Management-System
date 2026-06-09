from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from database import get_db
from auth import get_current_user, require_admin_or_principal, require_event_manager

router = APIRouter(prefix="/api/events", tags=["Events"])


# ── Helper ────────────────────────────────────────────────────────────────────

def _event_row(row, db):
    d = dict(row)
    creator = db.execute(
        "SELECT full_name, role FROM users WHERE id=?", (d.get("created_by"),)
    ).fetchone()
    d["creator_name"] = creator["full_name"] if creator else None
    d["creator_role"] = creator["role"] if creator else None
    return d


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
def list_events(db=Depends(get_db), user=Depends(get_current_user)):
    rows = db.execute("SELECT * FROM events ORDER BY created_at DESC").fetchall()
    return [_event_row(r, db) for r in rows]


@router.get("/{event_id}")
def get_event(event_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    row = db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    return _event_row(row, db)


class EventCreateBody(BaseModel):
    title: str
    nature: Optional[str] = 'Co-curricular'
    target_date: Optional[str] = None
    venue: Optional[str] = None
    proposed_budget: Optional[str] = None
    fund_source: Optional[str] = None
    focal_name: Optional[str] = None
    focal_role: Optional[str] = None
    focal_contact: Optional[str] = None
    expected_outputs: Optional[str] = None
    participants: Optional[str] = None
    rationale: Optional[str] = None
    objectives: Optional[str] = None
    phase1: Optional[str] = None
    phase2: Optional[str] = None
    phase3: Optional[str] = None
    activity_matrix: Optional[str] = None
    training_materials: Optional[str] = None
    snacks: Optional[str] = None
    exec_committee: Optional[str] = None
    twg_groups: Optional[str] = None
    monitoring_criteria: Optional[str] = None
    indicators: Optional[str] = None
    comments: Optional[str] = None


@router.post("", status_code=201)
def create_event(body: EventCreateBody, db=Depends(get_db),
                 user=Depends(require_event_manager)):
    uid = int(user["sub"])
    db.execute(
        """INSERT INTO events
           (title, nature, target_date, venue, proposed_budget, fund_source,
            focal_name, focal_role, focal_contact, expected_outputs, participants,
            rationale, objectives, phase1, phase2, phase3, activity_matrix,
            training_materials, snacks, exec_committee, twg_groups,
            monitoring_criteria, indicators, comments, created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (body.title, body.nature, body.target_date, body.venue,
         body.proposed_budget, body.fund_source, body.focal_name,
         body.focal_role, body.focal_contact, body.expected_outputs,
         body.participants, body.rationale, body.objectives,
         body.phase1, body.phase2, body.phase3, body.activity_matrix,
         body.training_materials, body.snacks, body.exec_committee,
         body.twg_groups, body.monitoring_criteria, body.indicators,
         body.comments, uid)
    )
    db.commit()
    row = db.execute("SELECT * FROM events ORDER BY id DESC LIMIT 1").fetchone()
    return _event_row(row, db)


@router.put("/{event_id}")
def update_event(event_id: int, body: EventCreateBody, db=Depends(get_db),
                 user=Depends(require_event_manager)):
    uid = int(user["sub"])
    role = user["role"]
    row = db.execute("SELECT created_by FROM events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    if role not in ("admin",) and row["created_by"] != uid:
        raise HTTPException(403, "You can only edit events you created")
    db.execute(
        """UPDATE events SET
           title=?, nature=?, target_date=?, venue=?, proposed_budget=?, fund_source=?,
           focal_name=?, focal_role=?, focal_contact=?, expected_outputs=?, participants=?,
           rationale=?, objectives=?, phase1=?, phase2=?, phase3=?, activity_matrix=?,
           training_materials=?, snacks=?, exec_committee=?, twg_groups=?,
           monitoring_criteria=?, indicators=?, comments=?
           WHERE id=?""",
        (body.title, body.nature, body.target_date, body.venue,
         body.proposed_budget, body.fund_source, body.focal_name,
         body.focal_role, body.focal_contact, body.expected_outputs,
         body.participants, body.rationale, body.objectives,
         body.phase1, body.phase2, body.phase3, body.activity_matrix,
         body.training_materials, body.snacks, body.exec_committee,
         body.twg_groups, body.monitoring_criteria, body.indicators,
         body.comments, event_id)
    )
    db.commit()
    row = db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone()
    return _event_row(row, db)


@router.patch("/{event_id}/approve")
def approve_event(event_id: int, db=Depends(get_db), user=Depends(require_admin_or_principal)):
    if not db.execute("SELECT id FROM events WHERE id=?", (event_id,)).fetchone():
        raise HTTPException(404, "Event not found")
    db.execute("UPDATE events SET status='approved' WHERE id=?", (event_id,))
    db.commit()
    return {"message": "Event approved"}


@router.patch("/{event_id}/disable")
def disable_event(event_id: int, db=Depends(get_db), user=Depends(require_event_manager)):
    if not db.execute("SELECT id FROM events WHERE id=?", (event_id,)).fetchone():
        raise HTTPException(404, "Event not found")
    db.execute("UPDATE events SET status='disabled' WHERE id=?", (event_id,))
    db.commit()
    return {"message": "Event disabled"}


@router.patch("/{event_id}/enable")
def enable_event(event_id: int, db=Depends(get_db), user=Depends(require_event_manager)):
    if not db.execute("SELECT id FROM events WHERE id=?", (event_id,)).fetchone():
        raise HTTPException(404, "Event not found")
    db.execute("UPDATE events SET status='pending_approval' WHERE id=?", (event_id,))
    db.commit()
    return {"message": "Event re-enabled"}


@router.delete("/{event_id}")
def delete_event(event_id: int, db=Depends(get_db), user=Depends(require_event_manager)):
    uid = int(user["sub"])
    role = user["role"]
    row = db.execute("SELECT created_by FROM events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    if role not in ("admin", "principal") and row["created_by"] != uid:
        raise HTTPException(403, "You can only delete events you created")
    db.execute("DELETE FROM events WHERE id=?", (event_id,))
    db.commit()
    return {"message": "Event deleted"}
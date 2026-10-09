from datetime import date
from fastapi import APIRouter, HTTPException, Depends, Request
import audit
from pydantic import BaseModel
from typing import Optional
from database import get_db, create_notification
from auth import (get_current_user, require_event_manager, require_event_approver,
                  has_permission)
from date_utils import parse_event_date
from school_calendar import resolve_window, in_window

router = APIRouter(prefix="/api/events", tags=["Events"])


def _date_conflicts(db, d, exclude_id=None) -> list:
    """Live (pending/approved) events already on calendar day `d`."""
    rows = db.execute(
        "SELECT id, title, target_date, venue, status FROM events "
        "WHERE status IN ('pending_approval','approved')"
    ).fetchall()
    return [dict(r) for r in rows
            if not (exclude_id and r["id"] == exclude_id)
            and parse_event_date(r["target_date"]) == d]


def _validate_target_date(db, target_date, exclude_id=None):
    """Reject a proposed target date that has already passed or clashes with
    another live (pending/approved) event on the same day. Unparseable dates
    are left alone — we only gate dates we can understand."""
    d = parse_event_date(target_date)
    if d is None:
        return
    if d < date.today():
        raise HTTPException(400, "That target date has already passed — please choose a future date.")
    clash = _date_conflicts(db, d, exclude_id)
    if clash:
        c = clash[0]
        state = "approved" if c["status"] == "approved" else "pending approval"
        raise HTTPException(
            409, f"\"{c['title']}\" ({state}) is already scheduled on {d.isoformat()} — "
                 "please pick a different date.")


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

@router.get("/date-check")
def check_event_date(target_date: str, exclude_id: Optional[int] = None,
                     db=Depends(get_db), user=Depends(get_current_user)):
    """Conflict check for the proposal form, run as soon as a date is picked.
    Same rules the create/update endpoints enforce."""
    d = parse_event_date(target_date)
    if d is None:
        return {"date": None, "available": True, "past": False, "conflicts": [],
                "message": None}
    past = d < date.today()
    conflicts = _date_conflicts(db, d, exclude_id)
    if past:
        message = "That date has already passed."
    elif conflicts:
        c = conflicts[0]
        message = (f"\"{c['title']}\" is already scheduled on this date "
                   f"({'approved' if c['status'] == 'approved' else 'pending approval'}).")
    else:
        message = None
    return {"date": d.isoformat(), "available": not past and not conflicts,
            "past": past, "conflicts": conflicts, "message": message}


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
    status: Optional[str] = 'pending_approval'


CREATE_STATUSES = ('draft', 'pending_approval')


@router.get("")
def list_events(db=Depends(get_db), user=Depends(get_current_user),
                school_year: str = "current", term_id: Optional[int] = None):
    uid = int(user["sub"])
    role = user["role"]
    try:
        window = resolve_window(db, school_year, term_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    rows = db.execute("SELECT * FROM events ORDER BY created_at DESC").fetchall()
    result = []
    for r in rows:
        # Only the selected school year (default: current), by target date.
        if not in_window(window, r["target_date"], r["created_at"]):
            continue
        status = r["status"]
        is_mine = r["created_by"] == uid
        can_see_all_pending = role in ("principal", "admin")
        # Drafts: only the creator sees them
        if status == "draft" and not is_mine:
            continue
        # Pending: only the creator or principal/admin sees them
        if status == "pending_approval" and not is_mine and not can_see_all_pending:
            continue
        result.append(_event_row(r, db))
    return result


@router.post("", status_code=201)
def create_event(body: EventCreateBody, db=Depends(get_db),
                 user=Depends(require_event_manager)):
    uid = int(user["sub"])
    status = body.status or 'pending_approval'
    if status not in CREATE_STATUSES:
        raise HTTPException(400, f"status must be one of {CREATE_STATUSES}")
    # Only enforce the date checks for real proposals, not saved drafts.
    if status == 'pending_approval':
        _validate_target_date(db, body.target_date)
    db.execute(
        """INSERT INTO events
           (title, nature, target_date, venue, proposed_budget, fund_source,
            focal_name, focal_role, focal_contact, expected_outputs, participants,
            rationale, objectives, phase1, phase2, phase3, activity_matrix,
            training_materials, snacks, exec_committee, twg_groups,
            monitoring_criteria, indicators, comments, status, created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (body.title, body.nature, body.target_date, body.venue,
         body.proposed_budget, body.fund_source, body.focal_name,
         body.focal_role, body.focal_contact, body.expected_outputs,
         body.participants, body.rationale, body.objectives,
         body.phase1, body.phase2, body.phase3, body.activity_matrix,
         body.training_materials, body.snacks, body.exec_committee,
         body.twg_groups, body.monitoring_criteria, body.indicators,
         body.comments, status, uid)
    )
    db.commit()
    row = db.execute("SELECT * FROM events ORDER BY id DESC LIMIT 1").fetchone()
    event_id = row["id"]
    # Notify all active users when an event is submitted for approval
    if status == "pending_approval":
        try:
            recipients = db.execute(
                "SELECT id FROM users WHERE is_active=1 AND id!=?", (uid,)
            ).fetchall()
            for r in recipients:
                create_notification(
                    db, r["id"], "event",
                    f"New event proposal: {body.title}",
                    f"Submitted for approval — {body.target_date or 'date TBD'}",
                    event_id,
                )
            db.commit()
        except Exception:
            pass
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
    if body.status == 'pending_approval':
        _validate_target_date(db, body.target_date, exclude_id=event_id)
    if body.status in CREATE_STATUSES:
        db.execute(
            """UPDATE events SET
               title=?, nature=?, target_date=?, venue=?, proposed_budget=?, fund_source=?,
               focal_name=?, focal_role=?, focal_contact=?, expected_outputs=?, participants=?,
               rationale=?, objectives=?, phase1=?, phase2=?, phase3=?, activity_matrix=?,
               training_materials=?, snacks=?, exec_committee=?, twg_groups=?,
               monitoring_criteria=?, indicators=?, comments=?, status=?
               WHERE id=?""",
            (body.title, body.nature, body.target_date, body.venue,
             body.proposed_budget, body.fund_source, body.focal_name,
             body.focal_role, body.focal_contact, body.expected_outputs,
             body.participants, body.rationale, body.objectives,
             body.phase1, body.phase2, body.phase3, body.activity_matrix,
             body.training_materials, body.snacks, body.exec_committee,
             body.twg_groups, body.monitoring_criteria, body.indicators,
             body.comments, body.status, event_id)
        )
    else:
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
def approve_event(event_id: int, request: Request, db=Depends(get_db),
                  user=Depends(require_event_approver)):
    ev = db.execute("SELECT title, status FROM events WHERE id=?", (event_id,)).fetchone()
    if not ev:
        raise HTTPException(404, "Event not found")
    db.execute("UPDATE events SET status='approved' WHERE id=?", (event_id,))
    _audit_status(db, user, request, event_id, ev, "approved", "Approved event")
    db.commit()
    return {"message": "Event approved"}


def _require_event_control(db, event_id: int, user: dict):
    """Disabling/re-enabling an event: its creator, or principal/admin."""
    row = db.execute("SELECT created_by FROM events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    if not (has_permission(user, "approve_events")
            or (has_permission(user, "manage_events") and row["created_by"] == int(user["sub"]))):
        raise HTTPException(403, "Only the event's proposer or the principal can do this")


def _audit_status(db, user, request, event_id: int, ev, new_status: str, summary: str):
    audit.record(db, user, f"event.{new_status}", "event", event_id,
                 f"{summary} {ev['title']}", changes={"status": [ev["status"], new_status]}, request=request)


@router.patch("/{event_id}/disable")
def disable_event(event_id: int, request: Request, db=Depends(get_db),
                  user=Depends(get_current_user)):
    _require_event_control(db, event_id, user)
    ev = db.execute("SELECT title, status FROM events WHERE id=?", (event_id,)).fetchone()
    db.execute("UPDATE events SET status='disabled' WHERE id=?", (event_id,))
    _audit_status(db, user, request, event_id, ev, "disabled", "Disabled event")
    db.commit()
    return {"message": "Event disabled"}


@router.patch("/{event_id}/enable")
def enable_event(event_id: int, request: Request, db=Depends(get_db),
                 user=Depends(get_current_user)):
    _require_event_control(db, event_id, user)
    row = db.execute("SELECT id, title, status, target_date FROM events WHERE id=?",
                     (event_id,)).fetchone()
    # Re-enabling puts it back on the calendar, so the date must still be free.
    _validate_target_date(db, row["target_date"], exclude_id=event_id)
    db.execute("UPDATE events SET status='pending_approval' WHERE id=?", (event_id,))
    _audit_status(db, user, request, event_id, row, "pending_approval", "Re-enabled event")
    db.commit()
    return {"message": "Event re-enabled"}


@router.delete("/{event_id}")
def delete_event(event_id: int, request: Request, db=Depends(get_db),
                 user=Depends(require_event_manager)):
    uid = int(user["sub"])
    role = user["role"]
    row = db.execute("SELECT created_by, title, status FROM events WHERE id=?",
                     (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    if role not in ("admin", "principal") and row["created_by"] != uid:
        raise HTTPException(403, "You can only delete events you created")
    db.execute("DELETE FROM events WHERE id=?", (event_id,))
    audit.record(db, user, "event.delete", "event", event_id, f"Deleted event {row['title']}",
                 changes={"status": [row["status"], "deleted"]},
                 request=request)
    db.commit()
    return {"message": "Event deleted"}

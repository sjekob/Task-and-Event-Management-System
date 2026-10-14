"""Event attendance: QR Time In / Time Out per Activity Matrix row, the
per-activity attendee evaluation, and the automated Special Task it triggers.

Flow: the proponent prints two QR codes per activity (Time In, Time Out). An
attendee scans one and the server accepts it only inside its window (Option C):
  * Time In:  start - 15 min .. start + 15 min
  * Time Out: end   - 10 min .. end   + 30 min
The device's coordinates are logged with each scan for the record (passive —
never used to accept or reject a scan; missing when location is unavailable).
A successful Time Out unlocks the activity's evaluation; submitting it creates
an already-completed Special Task when the row has a `special_task_title`.

Times are school-local (date_utils.school_now) — the activity matrix holds
free text such as "4:00-5:00 PM", parsed here.
"""
import hashlib
import hmac
import json
import re
from datetime import datetime, time, timedelta
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import SECRET_KEY, get_current_user, has_permission
from database import create_notification, get_db
from date_utils import parse_event_date, school_now
from routes.public_evaluation import (AGE_GROUPS, SEX_OPTIONS, IndicatorResult,
                                      _feedback_text, _score_from_indicators)

router = APIRouter(prefix="/api/events", tags=["Attendance"])

TIME_IN_BEFORE = timedelta(minutes=15)
TIME_IN_AFTER = timedelta(minutes=15)
TIME_OUT_BEFORE = timedelta(minutes=10)
TIME_OUT_AFTER = timedelta(minutes=30)

_TS = "%Y-%m-%d %H:%M:%S"


# ── Activity schedule parsing ─────────────────────────────────────────────────

_CLOCK = re.compile(r"(\d{1,2})(?:[:.](\d{2}))?\s*(?:([ap])\.?\s*m\.?)?", re.I)
_RANGE_SPLIT = re.compile(r"\s*(?:-|–|—|\bto\b)\s*", re.I)


def _clock(text: str):
    m = _CLOCK.fullmatch(text.strip())
    if not m:
        return None
    h, mins = int(m.group(1)), int(m.group(2) or 0)
    mer = m.group(3).lower() if m.group(3) else None
    if mins > 59 or (mer and not 1 <= h <= 12) or h > 23:
        return None
    return h, mins, mer


def _to24(h: int, mer: Optional[str]) -> int:
    if mer is None:
        return h
    return h % 12 + (12 if mer == "p" else 0)


def parse_time_range(text: Optional[str]):
    """'4:00-5:00 PM' / '8:00 AM - 12:00 PM' / '13:00 to 15:00' → (start, end).
    A start without AM/PM borrows the end's, flipping it when that would put the
    start after the end ('11:00-1:00 PM'). None when it can't be read."""
    if not text or not text.strip():
        return None
    parts = _RANGE_SPLIT.split(text.strip(), maxsplit=1)
    if len(parts) != 2:
        return None
    a, b = _clock(parts[0]), _clock(parts[1])
    if not a or not b:
        return None
    mer_b = b[2] or a[2]
    mer_a = a[2] or mer_b
    start_h, end_h = _to24(a[0], mer_a), _to24(b[0], mer_b)
    if a[2] is None and b[2] and (start_h, a[1]) > (end_h, b[1]):
        start_h = _to24(a[0], "a" if b[2] == "p" else "p")
    start, end = time(start_h, a[1]), time(end_h, b[1])
    return (start, end) if start < end else None


def _activity_rows(event) -> list:
    try:
        rows = json.loads(event["activity_matrix"] or "[]")
    except (TypeError, ValueError):
        return []
    return [r for r in rows if isinstance(r, dict)] if isinstance(rows, list) else []


def _activity(event, index: int) -> dict:
    rows = _activity_rows(event)
    if not 0 <= index < len(rows):
        raise HTTPException(404, "Activity not found in this event's Activity Matrix")
    return rows[index]


def _schedule(event, row: dict):
    """(start, end) datetimes for an activity: the row's day (falling back to the
    event's target date) at the row's time range. None if unreadable."""
    day = parse_event_date(row.get("day")) or parse_event_date(event["target_date"])
    span = parse_time_range(row.get("time"))
    if day is None or span is None:
        return None
    return datetime.combine(day, span[0]), datetime.combine(day, span[1])


def _windows(start: datetime, end: datetime) -> dict:
    return {
        "time_in": (start - TIME_IN_BEFORE, start + TIME_IN_AFTER),
        "time_out": (end - TIME_OUT_BEFORE, end + TIME_OUT_AFTER),
    }


def _fmt(dt: datetime) -> str:
    return dt.strftime("%I:%M %p").lstrip("0")


# ── QR payload signing ────────────────────────────────────────────────────────

Action = Literal["time_in", "time_out"]


def qr_code(event_id: int, index: int, action: str) -> str:
    """Short signature binding a QR to one event/activity/action, so scans can't
    be forged by editing the URL. Rotating JWT_SECRET_KEY invalidates printed QRs."""
    msg = f"attendance:{event_id}:{index}:{action}".encode()
    return hmac.new(SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()[:20]


def _check_code(event_id: int, index: int, action: str, code: str):
    if not hmac.compare_digest(qr_code(event_id, index, action), code or ""):
        raise HTTPException(400, "This QR code is not valid for this activity.")


# ── Shared loaders ────────────────────────────────────────────────────────────

def _event(db, event_id: int):
    ev = db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone()
    if not ev:
        raise HTTPException(404, "Event not found")
    return ev


def _record(db, event_id: int, index: int, uid: int):
    return db.execute(
        "SELECT * FROM event_attendance WHERE event_id=? AND activity_index=? AND user_id=?",
        (event_id, index, uid)).fetchone()


def _record_out(rec) -> Optional[dict]:
    if not rec:
        return None
    return {k: rec[k] for k in ("time_in_at", "time_out_at", "evaluated_at", "special_task_id")}


# ── QR codes for the proponent ────────────────────────────────────────────────

@router.get("/{event_id}/attendance/qr-codes")
def attendance_qr_codes(event_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    """Time In / Time Out QR payloads for every activity row. Proponent or
    principal/admin only — whoever holds these can open the scan windows."""
    ev = _event(db, event_id)
    if not (has_permission(user, "approve_events") or ev["created_by"] == int(user["sub"])):
        raise HTTPException(403, "Only the event's proponent or the principal can get attendance QR codes")
    if ev["status"] != "approved":
        raise HTTPException(409, "Attendance QR codes are available once the event is approved.")
    activities = []
    for i, row in enumerate(_activity_rows(ev)):
        sched = _schedule(ev, row)
        activities.append({
            "index": i,
            "day": row.get("day"), "time": row.get("time"),
            "event": row.get("event"), "speaker": row.get("speaker"),
            "special_task_title": row.get("special_task_title"),
            "schedule_readable": sched is not None,
            "time_in_code": qr_code(event_id, i, "time_in"),
            "time_out_code": qr_code(event_id, i, "time_out"),
        })
    return {
        "event_id": event_id, "title": ev["title"], "venue": ev["venue"],
        "activities": activities,
    }


# ── Scan landing info ─────────────────────────────────────────────────────────

@router.get("/{event_id}/attendance/activities/{index}")
def attendance_activity(event_id: int, index: int, db=Depends(get_db),
                        user=Depends(get_current_user)):
    """What the scan page shows: the activity, its windows, and the caller's record."""
    ev = _event(db, event_id)
    row = _activity(ev, index)
    sched = _schedule(ev, row)
    windows = None
    if sched:
        w = _windows(*sched)
        windows = {k: {"opens": v[0].strftime(_TS), "closes": v[1].strftime(_TS),
                       "label": f"{_fmt(v[0])} – {_fmt(v[1])}"} for k, v in w.items()}
    return {
        "event_id": event_id, "event_title": ev["title"], "venue": ev["venue"],
        "activity_index": index,
        "activity": {k: row.get(k) for k in ("day", "time", "event", "speaker")},
        "has_special_task": bool(row.get("special_task_title")),
        "special_task_title": row.get("special_task_title"),
        "windows": windows,
        "record": _record_out(_record(db, event_id, index, int(user["sub"]))),
    }


# ── Scan ──────────────────────────────────────────────────────────────────────

class ScanBody(BaseModel):
    activity_index: int = Field(ge=0)
    action: Action
    code: str = Field(min_length=1, max_length=64)
    # Passive audit log only; null when the device couldn't share a location.
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)


@router.post("/{event_id}/attendance/scan")
def attendance_scan(event_id: int, body: ScanBody, db=Depends(get_db),
                    user=Depends(get_current_user)):
    uid = int(user["sub"])
    _check_code(event_id, body.activity_index, body.action, body.code)
    ev = _event(db, event_id)
    if ev["status"] != "approved":
        raise HTTPException(409, "This event is not approved, so attendance is closed.")
    row = _activity(ev, body.activity_index)

    # Window check.
    sched = _schedule(ev, row)
    if sched is None:
        raise HTTPException(409, "This activity's day/time in the Activity Matrix couldn't be "
                                 "read, so its scan windows can't be determined.")
    opens, closes = _windows(*sched)[body.action]
    now = school_now()
    if not opens <= now <= closes:
        label = "Time In" if body.action == "time_in" else "Time Out"
        raise HTTPException(403, f"{label} window is not active "
                                 f"(open {_fmt(opens)} – {_fmt(closes)}).")

    rec = _record(db, event_id, body.activity_index, uid)
    stamp = now.strftime(_TS)
    if body.action == "time_in":
        if rec and rec["time_in_at"]:
            raise HTTPException(409, f"You already timed in at {rec['time_in_at'][11:16]}.")
        db.execute(
            """INSERT INTO event_attendance
               (event_id, activity_index, user_id, time_in_at,
                time_in_latitude, time_in_longitude)
               VALUES (?,?,?,?,?,?)""",
            (event_id, body.activity_index, uid, stamp, body.latitude, body.longitude))
        db.commit()
        return {"success": True, "action": "time_in", "timestamp": stamp,
                "message": "Time In recorded.", "redirect_to_evaluation": False,
                "record": _record_out(_record(db, event_id, body.activity_index, uid))}

    # Time Out
    if not rec or not rec["time_in_at"]:
        raise HTTPException(409, "You need to Time In for this activity before you can Time Out.")
    if rec["time_out_at"]:
        # Re-scan after closing the page: let them get back to the evaluation.
        return {"success": True, "action": "time_out", "timestamp": rec["time_out_at"],
                "message": "You already timed out for this activity.",
                "redirect_to_evaluation": rec["evaluated_at"] is None,
                "record": _record_out(rec)}
    db.execute(
        """UPDATE event_attendance SET time_out_at=?, time_out_latitude=?,
               time_out_longitude=?
           WHERE id=?""",
        (stamp, body.latitude, body.longitude, rec["id"]))
    db.commit()
    return {"success": True, "action": "time_out", "timestamp": stamp,
            "message": "Time Out recorded. Please complete the evaluation.",
            "redirect_to_evaluation": True,
            "record": _record_out(_record(db, event_id, body.activity_index, uid))}


# ── Attendee evaluation → automated Special Task ──────────────────────────────

class ActivityEvalBody(BaseModel):
    sex: str
    age_group: str
    affiliation: Optional[str] = Field(default=None, max_length=200)
    indicators: List[IndicatorResult]
    comments: Optional[str] = Field(default=None, max_length=2000)


def _create_completed_special_task(db, ev, row: dict, uid: int, now: datetime) -> int:
    """A special task assigned to the attendee and already completed: task +
    assignment + a 'Completed' report and its submission log (the same records a
    manual completion produces), tagged with the source event."""
    title = row["special_task_title"]
    stamp = now.strftime(_TS)
    today = now.date().isoformat()
    activity = (row.get("event") or "").strip() or "Event activity"
    assigner = ev["created_by"] or uid
    details = (f"Event: {ev['title']}\nActivity: {activity}\n"
               f"Completed: {stamp}\n"
               "Automatically completed after attending the activity and submitting its evaluation.")
    task_id = db.execute(
        """INSERT INTO tasks (title, instructions, task_category, start_date, end_date,
                              due_time, status, created_by, source_event_id)
           VALUES (?,?,'special',?,?,'11:59 PM','active',?,?)""",
        (title, details, today, today, assigner, ev["id"])).lastrowid
    db.execute("INSERT INTO task_assignments (task_id, user_id, assigned_by) VALUES (?,?,?)",
               (task_id, uid, assigner))
    report_id = db.execute(
        """INSERT INTO reports (task_id, personnel_id, report_title, report_description,
                                report_type, report_date, report_status)
           VALUES (?,?,?,?,'attendance',CURRENT_TIMESTAMP,'Completed')""",
        (task_id, uid, title, details)).lastrowid
    db.execute("INSERT INTO task_log (submission_date, personnel_id, task_id) "
               "VALUES (CURRENT_TIMESTAMP,?,?)", (uid, task_id))
    db.execute(
        """INSERT INTO submission_log (status, date_of_submission, sender_personnel_id,
                                       report_id, receiver_personnel_id)
           VALUES ('Completed', CURRENT_TIMESTAMP, ?, ?, ?)""",
        (uid, report_id, assigner))
    create_notification(db, uid, "task", f"Special task completed: {title}",
                        f"From attending {ev['title']}", task_id)
    return task_id


@router.post("/{event_id}/attendance/activities/{index}/evaluate", status_code=201)
def evaluate_activity(event_id: int, index: int, body: ActivityEvalBody,
                      db=Depends(get_db), user=Depends(get_current_user)):
    uid = int(user["sub"])
    ev = _event(db, event_id)
    row = _activity(ev, index)
    if body.sex not in SEX_OPTIONS:
        raise HTTPException(400, f"sex must be one of {SEX_OPTIONS}")
    if body.age_group not in AGE_GROUPS:
        raise HTTPException(400, f"age_group must be one of {AGE_GROUPS}")
    if not body.indicators:
        raise HTTPException(400, "At least one indicator must be evaluated.")

    rec = _record(db, event_id, index, uid)
    if not rec or not rec["time_out_at"]:
        raise HTTPException(403, "Time Out of this activity before evaluating it.")
    # Claim the evaluation atomically so a double submit can't create two tasks.
    now = school_now()
    claimed = db.execute(
        "UPDATE event_attendance SET evaluated_at=? WHERE id=? AND evaluated_at IS NULL",
        (now.strftime(_TS), rec["id"])).rowcount
    if not claimed:
        raise HTTPException(409, "You have already evaluated this activity.")

    me = db.execute("SELECT full_name, email FROM users WHERE id=?", (uid,)).fetchone()
    score = _score_from_indicators(body.indicators)
    activity = (row.get("event") or "").strip()
    feedback = _feedback_text(body.indicators, body.comments)
    if activity:
        feedback = f"Activity: {activity} | {feedback}"
    db.execute(
        """INSERT INTO event_evaluations
           (event_id, activity_index, evaluator_id, evaluator_name, evaluator_email,
            evaluator_role, evaluator_sex, evaluator_age_group, evaluator_affiliation,
            planning_score, objectives_score, personnel_score,
            time_mgmt_score, engagement_score, resource_score, feedback_comments)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (event_id, index, uid, (me["full_name"] if me else None) or "Attendee",
         me["email"] if me else None, user.get("role"), body.sex, body.age_group,
         (body.affiliation or "").strip() or None,
         score, score, score, score, score, score, feedback))

    task = None
    if (row.get("special_task_title") or "").strip():
        row["special_task_title"] = row["special_task_title"].strip()
        task_id = _create_completed_special_task(db, ev, row, uid, now)
        db.execute("UPDATE event_attendance SET special_task_id=? WHERE id=?", (task_id, rec["id"]))
        task = {"id": task_id, "title": row["special_task_title"], "status": "COMPLETED",
                "event_title": ev["title"], "completed_at": now.strftime(_TS)}
    db.commit()
    return {"message": "Thank you! Your evaluation was submitted.", "special_task": task}

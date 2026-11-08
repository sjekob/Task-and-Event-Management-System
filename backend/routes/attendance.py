"""Event attendance: QR Time In / Time Out per Activity Matrix row, the
per-activity attendee evaluation, and the automated Special Task it triggers.

Flow: the proponent prints one QR code per activity. An attendee scans it:
  * Time In:  start - 15 min .. start + 1 hour (at the venue, when pinned)
  * Time Out: by submitting the activity's evaluation, from the end of the
    activity until midnight that day (from anywhere). Scanning the same QR
    again after the activity ends opens the evaluation.
Geofence: when the proponent pinned the venue (events.venue_latitude/
venue_longitude/venue_radius_m), a scan is accepted only from inside that
perimeter — the device's GPS position is required and its Haversine distance to
the pin must be within the radius (allowing for the reported GPS accuracy, up
to GPS_TOLERANCE_MAX_M). Events without a pin are checked by time window only;
any coordinates sent are still logged with the scan.
Submitting the evaluation records both Time Out and evaluated_at. No special
task is created. Old printed Time Out QRs still work: they act like the one QR.

Guests (students, parents, external stakeholders) scan the same QR codes without
an account: POST .../attendance/guest-scan with their details and Data Privacy
consent. The same gate (_scan_gate: QR signature, event status, time window)
and perimeter check apply; their rows have user_id NULL and guest_* columns,
matched by email per session. Their evaluation is the public form with the
session's activity_index (routes/public_evaluation.py).

Times are school-local (date_utils.school_now) — the activity matrix holds
free text such as "4:00-5:00 PM", parsed here.
"""
import hashlib
import hmac
import json
import math
import re
from datetime import datetime, time, timedelta
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import SECRET_KEY, get_current_user, has_permission
import store
from database import get_db
from date_utils import parse_event_date, school_now
from routes.public_evaluation import (AGE_GROUPS, ROLE_ORDER, SEX_OPTIONS, IndicatorResult, _EMAIL_RE,
                                      _feedback_text, _score_from_indicators)

router = APIRouter(prefix="/api/events", tags=["Attendance"])

TIME_IN_BEFORE = timedelta(minutes=15)
TIME_IN_AFTER = timedelta(hours=1)

_TS = "%Y-%m-%d %H:%M:%S"

# Attendance and its QR codes work for approved events; 'completed' is set only
# after the last Time Out window closes, but accept it too in case of a race.
OPEN_STATUSES = ("approved", "completed")

# GPS fixes indoors are often 20–50 m off; a scan counts as inside when the
# distance minus the device's reported accuracy (capped here) is within the radius.
GPS_TOLERANCE_MAX_M = 50.0


# ── Venue geofence ────────────────────────────────────────────────────────────

def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres."""
    r = 6371008.8  # mean Earth radius
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def venue_pin(ev) -> Optional[dict]:
    """{latitude, longitude, radius_m} when the event's venue is pinned."""
    lat, lon = ev["venue_latitude"], ev["venue_longitude"]
    if lat is None or lon is None:
        return None
    return {"latitude": lat, "longitude": lon, "radius_m": ev["venue_radius_m"] or 100}


def _distance_label(m: float) -> str:
    return f"{m / 1000:.1f} km" if m >= 1000 else f"{round(m)} m"


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
        # Time Out is the evaluation: from the end of the activity until midnight.
        "time_out": (end, datetime.combine(end.date(), time(23, 59, 59))),
    }


def evaluation_lock(ev, index: int, rec, now: Optional[datetime] = None) -> Optional[str]:
    """Why [rec]'s holder can't evaluate (= Time Out of) the activity now, or None."""
    if not rec or not rec["time_in_at"]:
        return "Time In for this activity first, by scanning its QR code at the start."
    if rec["evaluated_at"]:
        return "You have already evaluated this activity, which recorded your Time Out. Thank you!"
    sched = _schedule(ev, _activity(ev, index))
    if sched is None:
        return None
    opens, closes = _windows(*sched)["time_out"]
    now = now or school_now()
    if now < opens:
        return (f"The evaluation opens when the activity ends ({_fmt(opens)}). "
                "Submitting it records your Time Out; you have until midnight.")
    if now > closes:
        return "Time Out closed at midnight after the activity, so this evaluation can no longer be submitted."
    return None


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
    if ev["status"] not in OPEN_STATUSES:
        raise HTTPException(409, "Attendance QR codes are available once the event is approved.")
    activities = []
    for i, row in enumerate(_activity_rows(ev)):
        sched = _schedule(ev, row)
        activities.append({
            "index": i,
            "day": row.get("day"), "time": row.get("time"),
            "event": row.get("event"), "speaker": row.get("speaker"),
            "schedule_readable": sched is not None,
            "time_in_code": qr_code(event_id, i, "time_in"),
            "time_out_code": qr_code(event_id, i, "time_out"),
        })
    return {
        "event_id": event_id, "title": ev["title"], "venue": ev["venue"],
        "venue_location": venue_pin(ev),
        "activities": activities,
    }


# ── Scan landing info ─────────────────────────────────────────────────────────

@router.get("/{event_id}/attendance/activities/{index}")
def attendance_activity(event_id: int, index: int, db=Depends(get_db),
                        user=Depends(get_current_user)):
    """What the scan page shows: the activity, its windows, and the caller's record."""
    ev = _event(db, event_id)
    rec = _record(db, event_id, index, int(user["sub"]))
    return {**_activity_info(ev, index), "record": _record_out(rec), "evaluation_lock": evaluation_lock(ev, index, rec)}


def _activity_info(ev, index: int) -> dict:
    row = _activity(ev, index)
    sched = _schedule(ev, row)
    windows = None
    if sched:
        w = _windows(*sched)
        windows = {k: {"opens": v[0].strftime(_TS), "closes": v[1].strftime(_TS),
                       "label": f"{_fmt(v[0])} – {_fmt(v[1])}"} for k, v in w.items()}
    return {
        "event_id": ev["id"], "event_title": ev["title"], "venue": ev["venue"],
        "venue_location": venue_pin(ev),
        "gps_tolerance_max_m": GPS_TOLERANCE_MAX_M,
        "activity_index": index,
        "activity": {k: row.get(k) for k in ("day", "time", "event", "speaker")},
        "windows": windows,
    }


@router.get("/{event_id}/attendance/guest/activities/{index}")
def guest_attendance_activity(event_id: int, index: int, action: Action, code: str,
                              email: Optional[str] = None, db=Depends(get_db)):
    """Public scan landing info for a guest. Needs the QR's signed code, so only
    someone holding the QR can look up the activity (and a guest's own record)."""
    _check_code(event_id, index, action, code)
    ev = _event(db, event_id)
    info = _activity_info(ev, index)
    rec = _guest_record(db, event_id, index, email) if email else None
    return {**info, "record": _record_out(rec), "guest_options": _guest_options(),
            "evaluation_lock": evaluation_lock(ev, index, rec) if email else None}


def _guest_options() -> dict:
    return {"role": ROLE_ORDER, "sex": SEX_OPTIONS, "age_group": AGE_GROUPS}


# ── Scan ──────────────────────────────────────────────────────────────────────

class ScanBody(BaseModel):
    activity_index: int = Field(ge=0)
    action: Action
    code: str = Field(min_length=1, max_length=64)
    # Required when the event's venue is pinned (geofence); otherwise only logged.
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    # The device's reported accuracy radius in metres (GeolocationCoordinates.accuracy).
    accuracy: Optional[float] = Field(default=None, ge=0, le=100000)


def _check_perimeter(ev, body: ScanBody) -> Optional[float]:
    """Distance (m) from the pinned venue, or None when the event isn't pinned.
    Raises when the location is missing or outside the perimeter."""
    pin = venue_pin(ev)
    if pin is None:
        return None
    label = "Time In" if body.action == "time_in" else "Time Out"
    if body.latitude is None or body.longitude is None:
        raise HTTPException(400, f"Your location is needed to {label}: this event only accepts "
                                 "scans at the venue. Allow location access for this site, turn on "
                                 "your device's Location/GPS, then try again.")
    distance = haversine_m(body.latitude, body.longitude, pin["latitude"], pin["longitude"])
    slack = min(body.accuracy or 0.0, GPS_TOLERANCE_MAX_M)
    if distance - slack > pin["radius_m"]:
        raise HTTPException(403, f"You are outside the event perimeter: about "
                                 f"{_distance_label(distance)} from the venue (scans are accepted "
                                 f"within {pin['radius_m']} m). Go to the venue, then scan again.")
    return round(distance, 1)


def _ok_message(label: str, distance: Optional[float]) -> str:
    if distance is None:
        return f"{label} recorded."
    return f"{label} recorded. You're inside the event perimeter ({_distance_label(distance)} from the venue)."


def _scan_gate(db, event_id: int, body: ScanBody):
    """The rules every scan must pass, personnel or guest: the QR's signature,
    the event being approved, and the activity's Time In / Time Out window.
    Returns (event, now). The perimeter is checked right before recording."""
    _check_code(event_id, body.activity_index, body.action, body.code)
    ev = _event(db, event_id)
    if ev["status"] not in OPEN_STATUSES:
        raise HTTPException(409, "This event is not approved, so attendance is closed.")
    row = _activity(ev, body.activity_index)
    sched = _schedule(ev, row)
    if sched is None:
        raise HTTPException(409, "This activity's day/time in the Activity Matrix couldn't be "
                                 "read, so its scan windows can't be determined.")
    return ev, school_now(), sched


def _record_scan(db, ev, body: ScanBody, now: datetime, sched, rec, who: dict, reload) -> dict:
    """One QR per activity. The first scan is the Time In (inside its window and,
    when pinned, the perimeter). Scanning again after the activity ends opens the
    evaluation, whose submission is the Time Out. Shared by personnel and guests."""
    stamp = now.strftime(_TS)
    if rec and rec["time_in_at"]:
        lock = evaluation_lock(ev, body.activity_index, rec, now)
        if lock is None:
            return {"success": True, "action": "time_out", "timestamp": stamp,
                    "message": "Please complete the evaluation: submitting it records your Time Out.",
                    "redirect_to_evaluation": True, "record": _record_out(rec)}
        raise HTTPException(409, f"You timed in at {str(rec['time_in_at'])[11:16]}. {lock}")
    opens, closes = _windows(*sched)["time_in"]
    if not opens <= now <= closes:
        raise HTTPException(403, f"Time In is open {_fmt(opens)} – {_fmt(closes)} only.")
    distance = _check_perimeter(ev, body)  # geofence (pinned venues only)
    store.time_in(db, ev["id"], body.activity_index, stamp, who, body.latitude, body.longitude, distance)
    db.commit()
    return {"success": True, "action": "time_in", "timestamp": stamp,
            "message": _ok_message("Time In", distance), "redirect_to_evaluation": False,
            "distance_m": distance, "record": _record_out(reload())}


@router.post("/{event_id}/attendance/scan")
def attendance_scan(event_id: int, body: ScanBody, db=Depends(get_db),
                    user=Depends(get_current_user)):
    uid = int(user["sub"])
    ev, now, sched = _scan_gate(db, event_id, body)
    rec = _record(db, event_id, body.activity_index, uid)
    return _record_scan(db, ev, body, now, sched, rec, {"user_id": uid},
                        lambda: _record(db, event_id, body.activity_index, uid))


# ── Guest scan (no account) ───────────────────────────────────────────────────

class GuestInfo(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=3, max_length=200)
    role: str
    sex: str
    age_group: str
    affiliation: Optional[str] = Field(default=None, max_length=200)


class GuestScanBody(ScanBody):
    guest: GuestInfo
    # Data Privacy Act consent: must be true.
    consent: bool = False


def _guest_email(raw: Optional[str]) -> str:
    return (raw or "").strip().lower()


def _guest_record(db, event_id: int, index: int, email: Optional[str]):
    return db.execute(
        """SELECT * FROM event_attendance
           WHERE event_id=? AND activity_index=? AND user_id IS NULL AND guest_email=?""",
        (event_id, index, _guest_email(email))).fetchone()


def _check_guest(g: GuestInfo) -> GuestInfo:
    g.name = " ".join(g.name.split())
    g.email = _guest_email(g.email)
    g.role = g.role.strip().lower()
    if len(g.name) < 2:
        raise HTTPException(400, "Please enter your full name.")
    if not _EMAIL_RE.match(g.email):
        raise HTTPException(400, "Please enter a valid email address.")
    if g.role not in ROLE_ORDER:
        raise HTTPException(400, "Please choose your role.")
    if g.sex not in SEX_OPTIONS:
        raise HTTPException(400, "Please choose your sex.")
    if g.age_group not in AGE_GROUPS:
        raise HTTPException(400, "Please choose your age group.")
    g.affiliation = (g.affiliation or "").strip() or None
    return g


@router.post("/{event_id}/attendance/guest-scan")
def guest_attendance_scan(event_id: int, body: GuestScanBody, db=Depends(get_db)):
    """Time In / Time Out for someone without a TaskNet account. Same QR, window
    and perimeter rules as personnel; one Time In and one Time Out per email per
    session. Time Out finds the Time In by email."""
    if not body.consent:
        raise HTTPException(400, "Please agree to the Data Privacy notice to record your attendance.")
    g = _check_guest(body.guest)
    ev, now, sched = _scan_gate(db, event_id, body)
    rec = _guest_record(db, event_id, body.activity_index, g.email)
    who = {"guest_name": g.name, "guest_email": g.email, "guest_role": g.role, "guest_sex": g.sex,
           "guest_age_group": g.age_group, "guest_affiliation": g.affiliation,
           "guest_consent_at": now.strftime(_TS)}
    try:
        return _record_scan(db, ev, body, now, sched, rec, who,
                            lambda: _guest_record(db, event_id, body.activity_index, g.email))
    except HTTPException:
        raise
    except Exception:
        # Two Time Ins for the same email racing each other: the unique index wins.
        db.rollback()
        raise HTTPException(409, "This email has already timed in for this session.")


# ── Attendance list (proponent / approver) ────────────────────────────────────

@router.get("/{event_id}/attendance")
def attendance_list(event_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    """Everyone who scanned, per session: personnel and guests (marked as such)."""
    ev = _event(db, event_id)
    if not (has_permission(user, "approve_events") or ev["created_by"] == int(user["sub"])):
        raise HTTPException(403, "Only the event's proponent or the principal can see its attendance")
    rows = db.execute(
        """SELECT a.*, u.full_name, u.role AS user_role
           FROM event_attendance a LEFT JOIN users u ON u.id = a.user_id
           WHERE a.event_id=? ORDER BY a.activity_index, a.time_in_at""", (event_id,)).fetchall()
    activities = _activity_rows(ev)
    out = []
    for r in rows:
        guest = r["user_id"] is None
        i = r["activity_index"]
        out.append({
            "id": r["id"], "activity_index": i,
            "activity": (activities[i].get("event") if 0 <= i < len(activities) else None) or f"Session {i + 1}",
            "is_guest": guest,
            "name": r["guest_name"] if guest else r["full_name"],
            "role": r["guest_role"] if guest else r["user_role"],
            "email": r["guest_email"] if guest else None,
            "affiliation": r["guest_affiliation"] if guest else None,
            "time_in_at": str(r["time_in_at"]) if r["time_in_at"] else None,
            "time_out_at": str(r["time_out_at"]) if r["time_out_at"] else None,
            "evaluated_at": str(r["evaluated_at"]) if r["evaluated_at"] else None,
            "time_in_distance_m": r["time_in_distance_m"],
            "time_out_distance_m": r["time_out_distance_m"],
        })
    return {"event_id": event_id, "title": ev["title"],
            "sessions": [{"index": i, "event": (a.get("event") or f"Session {i + 1}"), "time": a.get("time"),
                          "day": a.get("day")} for i, a in enumerate(activities)],
            "attendees": out}


# ── Event end (for the automatic 'completed' status) ──────────────────────────

def event_ends_at(ev) -> Optional[datetime]:
    """When the last Time Out (evaluation) window closes: midnight after the
    latest Activity Matrix session, or the end of the target date when no session
    time can be read. None when neither can be read."""
    ends = [s[1] for s in (_schedule(ev, r) for r in _activity_rows(ev)) if s]
    if ends:
        return datetime.combine(max(ends).date(), time(23, 59, 59))
    d = parse_event_date(ev["target_date"])
    return datetime.combine(d, time(23, 59, 59)) if d else None


# ── Personnel activity evaluation ─────────────────────────────────────────────

class ActivityEvalBody(BaseModel):
    sex: str
    age_group: str
    affiliation: Optional[str] = Field(default=None, max_length=200)
    indicators: List[IndicatorResult]
    comments: Optional[str] = Field(default=None, max_length=2000)


@router.post("/{event_id}/attendance/activities/{index}/evaluate", status_code=201)
def evaluate_activity(event_id: int, index: int, body: ActivityEvalBody,
                      db=Depends(get_db), user=Depends(get_current_user)):
    """A signed-in attendee's evaluation of one session. Completes their
    attendance (evaluated_at); no special task is created."""
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
    now = school_now()
    lock = evaluation_lock(ev, index, rec, now)
    if lock:
        raise HTTPException(403, lock)
    # The evaluation is the Time Out; claimed atomically so a double submit can't record two.
    if not store.claim_evaluation(db, rec["id"], now.strftime(_TS)):
        raise HTTPException(409, "You have already evaluated this activity.")

    me = db.execute("SELECT full_name, email FROM users WHERE id=?", (uid,)).fetchone()
    score = _score_from_indicators(body.indicators)
    activity = (row.get("event") or "").strip()
    feedback = _feedback_text(body.indicators, body.comments)
    if activity:
        feedback = f"Activity: {activity} | {feedback}"
    store.add_evaluation(db, event_id, name=(me["full_name"] if me else None) or "Attendee", role=user.get("role") or "teacher",
                         sex=body.sex, age_group=body.age_group, scores=[score] * 6, account_id=uid,
                         email=me["email"] if me else None, feedback=feedback, affiliation=body.affiliation, session=index)
    db.commit()
    return {"message": "Thank you! Your evaluation was submitted and your Time Out recorded.", "special_task": None}

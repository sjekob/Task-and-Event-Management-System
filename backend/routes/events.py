import asyncio
import json
import os
import re
import time
from datetime import date

import httpx
from typing import List
from fastapi import APIRouter, HTTPException, Depends, File, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
import audit
import proposal_reader
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator
from typing import Any, Optional
from database import get_db, create_notification
from auth import (get_current_user, require_event_manager, require_event_approver,
                  has_permission)
from date_utils import parse_event_date
from school_calendar import resolve_window, in_window
from routes.deped_calendar import mandatory_on, conflict_warning

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


# ── Activity matrix ───────────────────────────────────────────────────────────

class ActivityMatrixRow(BaseModel):
    """One row of the proposal's Activity Matrix (stored as a JSON array in
    events.activity_matrix). Unknown keys are kept so nothing is dropped."""
    model_config = ConfigDict(extra="allow")

    day: Optional[str] = ""
    time: Optional[str] = ""
    event: Optional[str] = ""
    speaker: Optional[str] = ""
    # Title of the Special Task to auto-create for this activity; blank → None.
    special_task_title: Optional[str] = None

    @field_validator("special_task_title", mode="before")
    @classmethod
    def _blank_to_none(cls, v):
        if v is None:
            return None
        v = str(v).strip()
        return v or None


def _normalize_activity_matrix(raw: Any) -> Optional[str]:
    """Validate the activity matrix (JSON string or list) and return it as a
    JSON string where every row carries `special_task_title`."""
    if raw is None or raw == "":
        return None
    rows = json.loads(raw) if isinstance(raw, str) else raw
    if not isinstance(rows, list):
        raise ValueError("activity_matrix must be a JSON array")
    return json.dumps([ActivityMatrixRow.model_validate(r).model_dump() for r in rows])


# ── Helper ────────────────────────────────────────────────────────────────────

def _event_row(row, db):
    d = dict(row)
    # Older events predate special_task_title — backfill it on the way out.
    try:
        d["activity_matrix"] = _normalize_activity_matrix(d.get("activity_matrix"))
    except (ValueError, ValidationError):
        pass
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
    Same rules the create/update endpoints enforce. Overlaps with mandatory
    DepEd calendar entries are reported as a non-blocking warning."""
    d = parse_event_date(target_date)
    if d is None:
        return {"date": None, "available": True, "past": False, "conflicts": [],
                "message": None, "deped_conflicts": [], "deped_warning": None}
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
    deped = mandatory_on(db, d)
    return {"date": d.isoformat(), "available": not past and not conflicts,
            "past": past, "conflicts": conflicts, "message": message,
            "deped_conflicts": deped, "deped_warning": conflict_warning(deped)}


_HONORIFICS = {"mr", "mrs", "ms", "miss", "dr", "sir", "maam", "madam", "engr", "atty",
               "prof", "hon", "rev", "fr", "jr", "sr", "ii", "iii", "iv"}


def _name_key(name: str) -> tuple:
    """Comparable form of a person's name: lowercase words without honorifics
    or middle initials ('Mrs. GRACE M. TAN' → ('grace', 'tan'))."""
    words = re.sub(r"[^a-z ]+", " ", (name or "").lower().replace("ñ", "n")).split()
    return tuple(w for w in words if len(w) > 1 and w not in _HONORIFICS)


def _match_users(db, names: list) -> dict:
    """{name: {id, full_name}} for names that match exactly one active user."""
    users = [dict(r) for r in db.execute(
        "SELECT id, full_name FROM users WHERE is_active=1").fetchall()]
    by_key = {}
    for u in users:
        by_key.setdefault(_name_key(u["full_name"]), []).append(u)
    out = {}
    for n in names:
        k = _name_key(n)
        if not k:
            continue
        hits = by_key.get(k) or []
        if not hits:  # proposal gives more/fewer names than the account: first + last word
            hits = [u for u in users if _name_key(u["full_name"])[:1] == k[:1]
                    and _name_key(u["full_name"])[-1:] == k[-1:]]
        if len(hits) == 1:
            out[n] = {"id": hits[0]["id"], "full_name": hits[0]["full_name"]}
    return out


@router.post("/read-proposal")
async def read_proposal(files: List[UploadFile] = File(...), db=Depends(get_db),
                        user=Depends(require_event_manager)):
    """Read an uploaded proposal (one Word/PDF file, or photos of its pages) into
    the Add Event wizard's fields. Nothing is saved: the proponent reviews the
    result, then submits. Committee members are matched to TaskNet accounts."""
    uploads = [(f.filename or "", await f.read(proposal_reader.MAX_BYTES + 1))
               for f in files[:proposal_reader.MAX_PAGES + 1]]
    try:
        result = await run_in_threadpool(proposal_reader.read, uploads)  # OCR is slow
    except ValueError as e:
        raise HTTPException(400, str(e))
    form = result["form"]
    names = [m["name"] for g in form["twg"] for m in g["members"]]
    matches = _match_users(db, names)
    unmatched = []
    for g in form["twg"]:
        for m in g["members"]:
            hit = matches.get(m["name"])
            m["user_id"] = hit["id"] if hit else None
            m["user_name"] = hit["full_name"] if hit else None
            if not hit:
                unmatched.append(m["name"])
    if unmatched:
        result["warnings"].append(
            f"{len(unmatched)} committee member(s) didn't match a TaskNet account: "
            + ", ".join(unmatched[:6]) + ("…" if len(unmatched) > 6 else "")
            + ". Link them in the Budget step so they get their task or top score.")
    if form["targetDate"]:
        d = parse_event_date(form["targetDate"])
        if d is not None and d < date.today():
            result["warnings"].append(f"The target date ({form['targetDate']}) has already passed. Choose a new date.")
    return result


# ── Venue search (geocoding) ──────────────────────────────────────────────────
# OpenStreetMap's Nominatim, called from the server so its usage policy is
# kept: an identifying User-Agent, at most one request per second, and cached
# answers. Searches are limited to GEOCODE_COUNTRIES (default: the Philippines).

_GEOCODE_URL = os.getenv("GEOCODE_URL", "https://nominatim.openstreetmap.org/search")
_GEOCODE_COUNTRIES = os.getenv("GEOCODE_COUNTRIES", "ph")
_GEOCODE_UA = os.getenv("GEOCODE_USER_AGENT", "TaskNet-EventVenueSearch/1.0 (school event management system)")
_geocode_cache: dict = {}
_geocode_lock = asyncio.Lock()
_geocode_last = [0.0]


@router.get("/geocode")
async def geocode_venue(q: str, user=Depends(require_event_manager)):
    """Places matching a venue name or address: [{name, latitude, longitude}]."""
    query = " ".join((q or "").split())[:200]
    if len(query) < 3:
        raise HTTPException(400, "Type at least 3 characters of the venue or address.")
    key = query.lower()
    if key in _geocode_cache:
        return _geocode_cache[key]
    async with _geocode_lock:
        wait = 1.0 - (time.monotonic() - _geocode_last[0])
        if wait > 0:
            await asyncio.sleep(wait)
        try:
            async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": _GEOCODE_UA}) as client:
                resp = await client.get(_GEOCODE_URL, params={
                    "q": query, "format": "jsonv2", "limit": 6, "addressdetails": 0,
                    "countrycodes": _GEOCODE_COUNTRIES})
            _geocode_last[0] = time.monotonic()
            resp.raise_for_status()
            rows = resp.json()
        except (httpx.HTTPError, ValueError):
            raise HTTPException(502, "The map search isn't reachable right now. "
                                     "Move the map and click the venue to pin it instead.")
    results = [{"name": r.get("display_name") or r.get("name") or query,
                "latitude": float(r["lat"]), "longitude": float(r["lon"])}
               for r in rows if r.get("lat") and r.get("lon")]
    if len(_geocode_cache) > 500:
        _geocode_cache.clear()
    _geocode_cache[key] = results
    return results


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
    # Venue pin + attendance perimeter. Both coordinates or neither.
    venue_latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    venue_longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    venue_radius_m: Optional[int] = Field(default=None, ge=10, le=5000)
    # The proposal reader's summary (JSON object), kept with drafts.
    proposal_reading: Optional[str] = Field(default=None, max_length=200_000)

    @field_validator("proposal_reading", mode="before")
    @classmethod
    def _check_reading(cls, v):
        if v is None or v == "":
            return None
        try:
            data = json.loads(v) if isinstance(v, str) else v
        except ValueError:
            raise ValueError("proposal_reading must be valid JSON")
        if not isinstance(data, dict):
            raise ValueError("proposal_reading must be a JSON object")
        return json.dumps(data)

    @model_validator(mode="after")
    def _check_pin(self):
        if (self.venue_latitude is None) != (self.venue_longitude is None):
            raise ValueError("Send both venue_latitude and venue_longitude, or neither.")
        if self.venue_latitude is None:
            self.venue_radius_m = None
        elif self.venue_radius_m is None:
            self.venue_radius_m = DEFAULT_RADIUS_M
        return self

    @field_validator("activity_matrix", mode="before")
    @classmethod
    def _check_activity_matrix(cls, v):
        try:
            return _normalize_activity_matrix(v)
        except json.JSONDecodeError:
            raise ValueError("activity_matrix must be valid JSON")
        except ValidationError as e:
            raise ValueError(f"invalid activity_matrix row: {e.errors()[0]['msg']}")


CREATE_STATUSES = ('draft', 'pending_approval')
DEFAULT_RADIUS_M = 100


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
            monitoring_criteria, indicators, comments, status, created_by,
            venue_latitude, venue_longitude, venue_radius_m, proposal_reading)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (body.title, body.nature, body.target_date, body.venue,
         body.proposed_budget, body.fund_source, body.focal_name,
         body.focal_role, body.focal_contact, body.expected_outputs,
         body.participants, body.rationale, body.objectives,
         body.phase1, body.phase2, body.phase3, body.activity_matrix,
         body.training_materials, body.snacks, body.exec_committee,
         body.twg_groups, body.monitoring_criteria, body.indicators,
         body.comments, status, uid,
         body.venue_latitude, body.venue_longitude, body.venue_radius_m, body.proposal_reading)
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
               monitoring_criteria=?, indicators=?, comments=?, status=?,
               venue_latitude=?, venue_longitude=?, venue_radius_m=?, proposal_reading=?
               WHERE id=?""",
            (body.title, body.nature, body.target_date, body.venue,
             body.proposed_budget, body.fund_source, body.focal_name,
             body.focal_role, body.focal_contact, body.expected_outputs,
             body.participants, body.rationale, body.objectives,
             body.phase1, body.phase2, body.phase3, body.activity_matrix,
             body.training_materials, body.snacks, body.exec_committee,
             body.twg_groups, body.monitoring_criteria, body.indicators,
             body.comments, body.status,
             body.venue_latitude, body.venue_longitude, body.venue_radius_m, body.proposal_reading, event_id)
        )
    else:
        db.execute(
            """UPDATE events SET
               title=?, nature=?, target_date=?, venue=?, proposed_budget=?, fund_source=?,
               focal_name=?, focal_role=?, focal_contact=?, expected_outputs=?, participants=?,
               rationale=?, objectives=?, phase1=?, phase2=?, phase3=?, activity_matrix=?,
               training_materials=?, snacks=?, exec_committee=?, twg_groups=?,
               monitoring_criteria=?, indicators=?, comments=?,
               venue_latitude=?, venue_longitude=?, venue_radius_m=?, proposal_reading=?
               WHERE id=?""",
            (body.title, body.nature, body.target_date, body.venue,
             body.proposed_budget, body.fund_source, body.focal_name,
             body.focal_role, body.focal_contact, body.expected_outputs,
             body.participants, body.rationale, body.objectives,
             body.phase1, body.phase2, body.phase3, body.activity_matrix,
             body.training_materials, body.snacks, body.exec_committee,
             body.twg_groups, body.monitoring_criteria, body.indicators,
             body.comments,
             body.venue_latitude, body.venue_longitude, body.venue_radius_m, body.proposal_reading, event_id)
        )
    db.commit()
    row = db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone()
    return _event_row(row, db)


def _twg_assignee(db, member: dict) -> Optional[int]:
    """The TaskNet user a TWG member row refers to: its linked user_id, else a
    unique case-insensitive full-name match (older proposals). None if unknown."""
    uid = member.get("user_id")
    if isinstance(uid, int) and db.execute(
            "SELECT 1 FROM users WHERE id=? AND is_active=1", (uid,)).fetchone():
        return uid
    name = (member.get("name") or "").strip()
    if not name:
        return None
    hit = _match_users(db, [name]).get(name)
    return hit["id"] if hit else None


def _twg_task_instructions(event_title: str, committee: str, m: dict) -> str:
    """A committee member's special-task instructions: their Terms of Reference
    (the full description, as written) first, then where the task comes from."""
    tor = "\n".join(l.rstrip() for l in (m.get("tor") or "").strip().splitlines())
    about = [f"Event: {event_title}"]
    if committee:
        about.append(f"Committee: {committee}")
    if (m.get("designation") or "").strip():
        about.append(f"Designation: {m['designation'].strip()}")
    if (m.get("output") or "").strip():
        about.append(f"Expected output: {m['output'].strip()}")
    parts = [f"Terms of Reference:\n{tor}"] if tor else []
    parts.append("\n".join(about))
    return "\n\n".join(parts)


def _create_twg_special_tasks(db, event_id: int) -> dict:
    """On approval: one pending special task per TWG member flagged
    `automate_special_task`, assigned to that member and due on the event's
    target date. Members NOT flagged get no task; they're credited the top
    special-task score for this event instead (event_committee_credits).
    Re-approving never duplicates (same event + title + assignee / same user)."""
    ev = db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone()
    try:
        groups = json.loads(ev["twg_groups"] or "[]")
    except (TypeError, ValueError):
        groups = []
    target = parse_event_date(ev["target_date"])
    due = target.isoformat() if target else None
    assigner = ev["created_by"]
    created, skipped = [], []
    not_automated = []  # (member, committee) for the top-score credits
    for g in groups if isinstance(groups, list) else []:
        if not isinstance(g, dict):
            continue
        committee = (g.get("title") or "").strip()
        for m in g.get("members") or []:
            if not isinstance(m, dict):
                continue
            if m.get("automate_special_task") is not True:
                not_automated.append((m, committee))
                continue
            output = (m.get("output") or "").strip()
            tor = (m.get("tor") or "").strip()
            # Title: the Output; without one, the first line of the Terms of Reference.
            title = " ".join(output.split()) or next((l.strip() for l in tor.splitlines() if l.strip()), "")
            name = (m.get("name") or "").strip() or "Unnamed member"
            uid = _twg_assignee(db, m)
            if not title or uid is None:
                skipped.append(name)
                continue
            if db.execute(
                    """SELECT 1 FROM tasks t JOIN task_assignments ta ON ta.task_id=t.id
                       WHERE t.source_event_id=? AND t.task_category='special'
                         AND t.title=? AND ta.user_id=?""", (event_id, title, uid)).fetchone():
                continue
            task_id = db.execute(
                """INSERT INTO tasks (title, instructions, task_category, start_date, end_date,
                                      status, created_by, source_event_id)
                   VALUES (?,?,'special',?,?,'active',?,?)""",
                (title, _twg_task_instructions(ev["title"], committee, m), date.today().isoformat(), due,
                 assigner, event_id)).lastrowid
            db.execute("INSERT INTO task_assignments (task_id, user_id, assigned_by) VALUES (?,?,?)",
                       (task_id, uid, assigner))
            create_notification(db, uid, "task", f"New special task: {title}",
                                f"From the approved event {ev['title']}", task_id)
            created.append({"task_id": task_id, "title": title, "user_id": uid})

    # Not automated → top score, no task. Someone with an automated task for
    # this event is rated on that task instead.
    tasked = {r["user_id"] for r in db.execute(
        """SELECT ta.user_id FROM tasks t JOIN task_assignments ta ON ta.task_id=t.id
           WHERE t.source_event_id=? AND t.task_category='special'""", (event_id,)).fetchall()}
    credited, uncredited = [], []
    for m, committee in not_automated:
        name = (m.get("name") or "").strip()
        if not name:
            continue
        uid = _twg_assignee(db, m)
        if uid is None:
            uncredited.append(name)
            continue
        if uid in tasked:
            continue
        cur = db.execute(
            """INSERT INTO event_committee_credits
               (event_id, user_id, committee, designation, tor, output, score, created_by)
               VALUES (?,?,?,?,?,?,5.0,?) ON CONFLICT (event_id, user_id) DO NOTHING""",
            (event_id, uid, committee or None, (m.get("designation") or "").strip() or None,
             (m.get("tor") or "").strip() or None, (m.get("output") or "").strip() or None,
             assigner))
        if cur.rowcount:
            create_notification(db, uid, "task", f"Top score credited: {ev['title']}",
                                f"Your committee work ({committee or 'Working Committee'}) "
                                "was given the highest special-task score.", event_id)
            credited.append({"user_id": uid, "name": name})
    return {"created": created, "skipped": skipped,
            "credited": credited, "uncredited": uncredited}


@router.patch("/{event_id}/approve")
def approve_event(event_id: int, request: Request, db=Depends(get_db),
                  user=Depends(require_event_approver)):
    ev = db.execute("SELECT title, status FROM events WHERE id=?", (event_id,)).fetchone()
    if not ev:
        raise HTTPException(404, "Event not found")
    db.execute("UPDATE events SET status='approved' WHERE id=?", (event_id,))
    _audit_status(db, user, request, event_id, ev, "approved", "Approved event")
    tasks = _create_twg_special_tasks(db, event_id)
    db.commit()
    return {"message": "Event approved",
            "special_tasks_created": len(tasks["created"]),
            "special_tasks_skipped": tasks["skipped"],
            "top_scores_credited": len(tasks["credited"]),
            "top_scores_skipped": tasks["uncredited"]}


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

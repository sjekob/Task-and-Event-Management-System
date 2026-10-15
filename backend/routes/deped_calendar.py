"""DepEd school-calendar reference layer: the official memorandum dates
(examinations, quarter compliance, holidays, administrative periods).

* Everyone can read them (calendar overlays, proposal date warnings).
* The principal/admin maintains them and can turn an entry into a mandatory
  compliance task assigned to every active faculty member in chosen roles.
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

import audit
from auth import get_current_user, require_admin_or_principal
from database import DEPED_CATEGORIES, create_notification, get_db
from date_utils import parse_event_date

router = APIRouter(prefix="/api/deped-calendar", tags=["DepEd Calendar"])

FACULTY_ROLES = ("teacher", "dean", "coordinator", "registrar")


def _row(r) -> dict:
    d = dict(r)
    d["is_mandatory"] = bool(d["is_mandatory"])
    return d


def mandatory_on(db, d: date) -> List[dict]:
    """Mandatory DepEd entries whose date range covers day `d`."""
    iso = d.isoformat()
    return [_row(r) for r in db.execute(
        """SELECT * FROM deped_calendar_events
           WHERE is_mandatory=1 AND start_date<=? AND end_date>=?
           ORDER BY start_date""", (iso, iso)).fetchall()]


def conflict_warning(entries: List[dict]) -> Optional[str]:
    if not entries:
        return None
    titles = ", ".join(e["title"] for e in entries)
    return f"Conflict Warning: Selected date overlaps with DepEd Mandatory Calendar Event {titles}"


@router.get("")
def list_entries(start: Optional[str] = None, end: Optional[str] = None,
                 db=Depends(get_db), user=Depends(get_current_user)):
    """All entries, or those overlapping [start, end] (ISO dates)."""
    q, params = "SELECT * FROM deped_calendar_events WHERE 1=1", []
    if end:
        q += " AND start_date<=?"; params.append(end)
    if start:
        q += " AND end_date>=?"; params.append(start)
    return [_row(r) for r in db.execute(q + " ORDER BY start_date, id", params).fetchall()]


class EntryBody(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    start_date: str
    end_date: Optional[str] = None
    category: str
    is_mandatory: bool = True


def _validate(body: EntryBody):
    start = parse_event_date(body.start_date)
    end = parse_event_date(body.end_date) if body.end_date else start
    if start is None or end is None:
        raise HTTPException(400, "Dates must be valid (YYYY-MM-DD).")
    if end < start:
        raise HTTPException(400, "The end date can't be before the start date.")
    if body.category not in DEPED_CATEGORIES:
        raise HTTPException(400, f"category must be one of {list(DEPED_CATEGORIES)}")
    return start.isoformat(), end.isoformat()


def _get(db, entry_id: int):
    r = db.execute("SELECT * FROM deped_calendar_events WHERE id=?", (entry_id,)).fetchone()
    if not r:
        raise HTTPException(404, "DepEd calendar entry not found")
    return r


@router.post("", status_code=201)
def create_entry(body: EntryBody, request: Request, db=Depends(get_db),
                 user=Depends(require_admin_or_principal)):
    start, end = _validate(body)
    cur = db.execute(
        """INSERT INTO deped_calendar_events
           (title, description, start_date, end_date, category, is_mandatory, created_by)
           VALUES (?,?,?,?,?,?,?)""",
        (body.title.strip(), (body.description or "").strip() or None, start, end,
         body.category, int(body.is_mandatory), int(user["sub"])))
    audit.record(db, user, "deped_calendar.create", "deped_calendar", cur.lastrowid,
                 f"Added DepEd calendar entry {body.title.strip()}", request=request)
    db.commit()
    return _row(_get(db, cur.lastrowid))


@router.put("/{entry_id}")
def update_entry(entry_id: int, body: EntryBody, request: Request, db=Depends(get_db),
                 user=Depends(require_admin_or_principal)):
    _get(db, entry_id)
    start, end = _validate(body)
    db.execute(
        """UPDATE deped_calendar_events SET title=?, description=?, start_date=?, end_date=?,
               category=?, is_mandatory=? WHERE id=?""",
        (body.title.strip(), (body.description or "").strip() or None, start, end,
         body.category, int(body.is_mandatory), entry_id))
    audit.record(db, user, "deped_calendar.update", "deped_calendar", entry_id,
                 f"Updated DepEd calendar entry {body.title.strip()}", request=request)
    db.commit()
    return _row(_get(db, entry_id))


@router.delete("/{entry_id}")
def delete_entry(entry_id: int, request: Request, db=Depends(get_db),
                 user=Depends(require_admin_or_principal)):
    r = _get(db, entry_id)
    db.execute("DELETE FROM deped_calendar_events WHERE id=?", (entry_id,))
    audit.record(db, user, "deped_calendar.delete", "deped_calendar", entry_id,
                 f"Removed DepEd calendar entry {r['title']}", request=request)
    db.commit()
    return {"message": "Entry removed"}


# ── Mandatory compliance tasks ────────────────────────────────────────────────

class GenerateBody(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    instructions: Optional[str] = Field(default=None, max_length=4000)
    due_date: Optional[str] = None           # default: the entry's end date
    due_time: Optional[str] = "11:59 PM"
    roles: List[str] = Field(default_factory=lambda: ["teacher"], min_length=1)


@router.post("/{entry_id}/generate-tasks", status_code=201)
def generate_tasks(entry_id: int, body: GenerateBody, request: Request, db=Depends(get_db),
                   user=Depends(require_admin_or_principal)):
    """One compliance task assigned to every active user holding any of `roles`
    (primary or additional role), each receiving it as that role."""
    entry = _get(db, entry_id)
    roles = [r for r in dict.fromkeys(body.roles) if r in FACULTY_ROLES]
    if not roles:
        raise HTTPException(400, f"roles must include at least one of {list(FACULTY_ROLES)}")
    due = parse_event_date(body.due_date) if body.due_date else parse_event_date(entry["end_date"])
    if due is None:
        raise HTTPException(400, "due_date must be a valid date (YYYY-MM-DD).")
    title = body.title.strip()
    if db.execute("SELECT 1 FROM tasks WHERE source_deped_id=? AND title=? AND status='active'",
                  (entry_id, title)).fetchone():
        raise HTTPException(409, f"\"{title}\" was already generated from this DepEd entry.")

    uid = int(user["sub"])
    ph = ",".join("?" for _ in roles)
    # Each person once, as their first matching role (primary role preferred).
    people = {}
    for r in db.execute(
            f"""SELECT u.id, u.role AS role, 0 AS pri FROM users u
                WHERE u.is_active=1 AND u.role IN ({ph})
                UNION ALL
                SELECT u.id, ro.roles AS role, 1 AS pri FROM users u
                JOIN user_roles ur ON ur.user_id=u.id JOIN roles ro ON ro.id=ur.role_id
                WHERE u.is_active=1 AND ro.roles IN ({ph})
                ORDER BY pri""", roles + roles).fetchall():
        if r["id"] != uid:
            people.setdefault(r["id"], r["role"])
    if not people:
        raise HTTPException(409, "No active faculty accounts hold the selected roles.")

    instructions = (body.instructions or "").strip() or (
        f"Mandatory DepEd compliance: {entry['title']} "
        f"({entry['start_date']}{'' if entry['start_date'] == entry['end_date'] else ' to ' + entry['end_date']}).")
    task_id = db.execute(
        """INSERT INTO tasks (title, instructions, task_category, start_date, end_date, due_time,
                              status, created_by, source_deped_id)
           VALUES (?,?,'common',?,?,?,'active',?,?)""",
        (title, instructions, date.today().isoformat(), due.isoformat(),
         body.due_time or None, uid, entry_id)).lastrowid
    for pid, role in people.items():
        db.execute("INSERT INTO task_assignments (task_id, user_id, assigned_by, target_role) "
                   "VALUES (?,?,?,?)", (task_id, pid, uid, role))
        create_notification(db, pid, "task", f"New mandatory task: {title}",
                            f"DepEd calendar: {entry['title']}", task_id)
    audit.record(db, user, "deped_calendar.generate_tasks", "task", task_id,
                 f"Generated \"{title}\" from DepEd entry {entry['title']} for {len(people)} faculty",
                 request=request)
    db.commit()
    return {"task_id": task_id, "assigned": len(people), "roles": roles}

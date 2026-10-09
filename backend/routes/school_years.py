"""School year & term calendar. The principal (or admin) sets when each school
year and its terms start and end; everything else uses these ranges to tell
current records from archived ones (see school_calendar.py)."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from auth import get_current_user, require_admin_or_principal
from database import get_db
import audit
from date_utils import parse_event_date
from school_calendar import current_school_year, year_status

router = APIRouter(prefix="/api/school-years", tags=["School Years"])


class TermBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)   # e.g. "1st Quarter"
    start_date: str
    end_date: str


class SchoolYearBody(BaseModel):
    name: str = Field(min_length=1, max_length=40)   # e.g. "2026-2027"
    start_date: str
    end_date: str
    terms: List[TermBody] = []


def _iso(label: str, value: str):
    d = parse_event_date(value)
    if d is None:
        raise HTTPException(400, f"{label}: use the YYYY-MM-DD format.")
    return d


def _validate(db, body: SchoolYearBody, exclude_id: Optional[int] = None):
    """Dates parse, the year doesn't overlap another one, and terms sit inside
    the year without overlapping each other. Returns normalized ISO dates."""
    start, end = _iso("Start date", body.start_date), _iso("End date", body.end_date)
    if start >= end:
        raise HTTPException(400, "The school year must end after it starts.")
    for r in db.execute("SELECT * FROM school_years").fetchall():
        if exclude_id and r["id"] == exclude_id:
            continue
        if r["name"].strip().lower() == body.name.strip().lower():
            raise HTTPException(409, f"School year \"{body.name}\" already exists.")
        if start <= parse_event_date(r["end_date"]) and parse_event_date(r["start_date"]) <= end:
            raise HTTPException(409, f"Those dates overlap school year {r['name']} "
                                     f"({r['start_date']} to {r['end_date']}).")
    terms = []
    for t in body.terms:
        ts, te = _iso(f"{t.name} start date", t.start_date), _iso(f"{t.name} end date", t.end_date)
        if ts >= te:
            raise HTTPException(400, f"{t.name} must end after it starts.")
        if ts < start or te > end:
            raise HTTPException(400, f"{t.name} must fall within the school year ({start} to {end}).")
        terms.append((t.name.strip(), ts, te))
    terms.sort(key=lambda t: t[1])
    for a, b in zip(terms, terms[1:]):
        if b[1] <= a[2]:
            raise HTTPException(400, f"{a[0]} and {b[0]} overlap.")
    if len({t[0].lower() for t in terms}) != len(terms):
        raise HTTPException(400, "Each term needs a different name.")
    return start.isoformat(), end.isoformat(), [(n, s.isoformat(), e.isoformat()) for n, s, e in terms]


def _shape(db, row) -> dict:
    d = dict(row)
    d["status"] = year_status(row)  # current | upcoming | archived
    d["terms"] = []
    for t in db.execute("SELECT * FROM school_terms WHERE school_year_id=? ORDER BY start_date",
                        (row["id"],)).fetchall():
        td = dict(t)
        td["status"] = year_status(t)
        d["terms"].append(td)
    return d


def _save_terms(db, sy_id: int, terms):
    db.execute("DELETE FROM school_terms WHERE school_year_id=?", (sy_id,))
    for name, s, e in terms:
        db.execute("INSERT INTO school_terms (school_year_id, name, start_date, end_date) "
                   "VALUES (?,?,?,?)", (sy_id, name, s, e))


@router.get("")
def list_school_years(db=Depends(get_db), user=Depends(get_current_user)):
    rows = db.execute("SELECT * FROM school_years ORDER BY start_date DESC").fetchall()
    current = current_school_year(db)
    out = [_shape(db, r) for r in rows]
    for d in out:
        d["is_selected_default"] = bool(current and d["id"] == current["id"])
    return out


@router.get("/current")
def get_current_school_year(db=Depends(get_db), user=Depends(get_current_user)):
    row = current_school_year(db)
    return _shape(db, db.execute("SELECT * FROM school_years WHERE id=?",
                                 (row["id"],)).fetchone()) if row else None


def _audit_view(db, sy_id: int) -> dict:
    sy = db.execute("SELECT name, start_date, end_date FROM school_years WHERE id=?",
                    (sy_id,)).fetchone()
    if not sy:
        return {}
    terms = db.execute("SELECT name, start_date, end_date FROM school_terms "
                       "WHERE school_year_id=? ORDER BY start_date", (sy_id,)).fetchall()
    return {"name": sy["name"], "start_date": sy["start_date"], "end_date": sy["end_date"],
            "terms": "; ".join(f"{t['name']} {t['start_date']}–{t['end_date']}" for t in terms) or None}


@router.post("", status_code=201)
def create_school_year(body: SchoolYearBody, request: Request, db=Depends(get_db),
                       user=Depends(require_admin_or_principal)):
    start, end, terms = _validate(db, body)
    cur = db.execute("INSERT INTO school_years (name, start_date, end_date, created_by) "
                     "VALUES (?,?,?,?)", (body.name.strip(), start, end, int(user["sub"])))
    _save_terms(db, cur.lastrowid, terms)
    audit.record(db, user, "school_year.create", "school_year", cur.lastrowid,
                 f"Created school year {body.name.strip()}", entity_label=body.name.strip(),
                 changes=audit.diff({}, _audit_view(db, cur.lastrowid)), request=request)
    db.commit()
    return _shape(db, db.execute("SELECT * FROM school_years WHERE id=?",
                                 (cur.lastrowid,)).fetchone())


@router.put("/{sy_id}")
def update_school_year(sy_id: int, body: SchoolYearBody, request: Request,
                       db=Depends(get_db), user=Depends(require_admin_or_principal)):
    if not db.execute("SELECT 1 FROM school_years WHERE id=?", (sy_id,)).fetchone():
        raise HTTPException(404, "School year not found")
    start, end, terms = _validate(db, body, exclude_id=sy_id)
    before = _audit_view(db, sy_id)
    db.execute("UPDATE school_years SET name=?, start_date=?, end_date=? WHERE id=?",
               (body.name.strip(), start, end, sy_id))
    _save_terms(db, sy_id, terms)
    changes = audit.diff(before, _audit_view(db, sy_id))
    if changes:
        audit.record(db, user, "school_year.update", "school_year", sy_id,
                     f"Changed school year {body.name.strip()}", entity_label=body.name.strip(),
                     changes=changes, request=request)
    db.commit()
    return _shape(db, db.execute("SELECT * FROM school_years WHERE id=?", (sy_id,)).fetchone())


@router.delete("/{sy_id}")
def delete_school_year(sy_id: int, request: Request, db=Depends(get_db),
                       user=Depends(require_admin_or_principal)):
    """Removes only the calendar entry; tasks and events are never deleted —
    without the year they simply stop being grouped under it."""
    if not db.execute("SELECT 1 FROM school_years WHERE id=?", (sy_id,)).fetchone():
        raise HTTPException(404, "School year not found")
    before = _audit_view(db, sy_id)
    db.execute("DELETE FROM school_years WHERE id=?", (sy_id,))
    audit.record(db, user, "school_year.delete", "school_year", sy_id,
                 f"Removed school year {before.get('name')}", entity_label=before.get("name"),
                 changes=audit.diff(before, {}), request=request)
    db.commit()
    return {"message": "School year removed"}

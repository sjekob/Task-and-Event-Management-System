"""School years and terms, set by the principal, and the date windows used to
archive records.

A record belongs to the school year whose start/end range contains its anchor
date (a task's deadline, an event's target date, ...). Lists show the current
school year by default; records of school years that have ended are "archived"
and stay viewable by choosing that year. When no school year has been set up,
nothing is filtered, so the system behaves as before.

The `school_year` request parameter accepted by list endpoints:
    "current" (default)  the school year containing today; if today falls
                         between years, the most recent one that has started
    "all"                no filtering
    "<id>"               that school year
plus an optional `term_id` that narrows to one term of it.
"""
from datetime import date
from typing import Optional

from date_utils import parse_event_date, school_now


def _d(value) -> Optional[date]:
    return parse_event_date(value)


def year_status(row, today: Optional[date] = None) -> str:
    today = today or school_now().date()
    if today < _d(row["start_date"]):
        return "upcoming"
    if today > _d(row["end_date"]):
        return "archived"
    return "current"


def current_school_year(db) -> Optional[dict]:
    today = school_now().date()
    rows = [dict(r) for r in db.execute("SELECT * FROM school_years").fetchall()]
    started = [r for r in rows if _d(r["start_date"]) <= today]
    for r in started:
        if today <= _d(r["end_date"]):
            return r
    # Between school years (e.g. summer break): the latest one that started.
    return max(started, key=lambda r: _d(r["start_date"]), default=None)


def resolve_window(db, school_year: Optional[str] = "current",
                   term_id: Optional[int] = None):
    """(start, end) dates to filter by, or None for no filtering. Raises
    ValueError for an unknown school year / term."""
    if term_id:
        t = db.execute("SELECT * FROM school_terms WHERE id=?", (term_id,)).fetchone()
        if not t:
            raise ValueError("Unknown term")
        return _d(t["start_date"]), _d(t["end_date"])
    sy = (school_year or "current").strip().lower()
    if sy == "all":
        return None
    if sy == "current":
        row = current_school_year(db)
        return (_d(row["start_date"]), _d(row["end_date"])) if row else None
    try:
        row = db.execute("SELECT * FROM school_years WHERE id=?", (int(sy),)).fetchone()
    except ValueError:
        row = None
    if not row:
        raise ValueError("Unknown school year")
    return _d(row["start_date"]), _d(row["end_date"])


def in_window(window, *candidates) -> bool:
    """True when the first parseable candidate date falls inside the window
    (always True without a window, or when no candidate date is parseable)."""
    if window is None:
        return True
    for c in candidates:
        d = _d(c)
        if d is not None:
            return window[0] <= d <= window[1]
    return True


def task_in_window(window, row) -> bool:
    """A task is anchored on its deadline, else its start date, else when it
    was created."""
    keys = row.keys() if hasattr(row, "keys") else row
    get = (lambda k: row[k] if k in keys else None)
    return in_window(window, get("end_date"), get("start_date"), get("created_at"))

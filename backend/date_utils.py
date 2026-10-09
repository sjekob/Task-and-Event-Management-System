"""Shared date helpers: a best-effort parser for the free-text event
target_date field, and task deadline / overdue checks in school-local time.

The event parser mirrors the frontend's parseEventDate (date_parse.dart): ISO
first, then a 'Month D, YYYY' style. Used by event proposal validation and the public
evaluation date-gate so both agree on what a date means.
"""
import os
import re
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def parse_event_date(raw: Optional[str]) -> Optional[date]:
    if not raw or not str(raw).strip():
        return None
    text = str(raw).strip()
    try:
        return datetime.fromisoformat(text[:10]).date()
    except ValueError:
        pass
    md = re.search(r"([A-Za-z]{3,9})\.?\s+(\d{1,2})", text)
    ym = re.search(r"(19|20)\d{2}", text)
    if md and ym:
        mon = _MONTHS.get(md.group(1).lower()[:3])
        if mon:
            try:
                return date(int(ym.group(0)), mon, int(md.group(2)))
            except ValueError:
                pass
    return None


# ── Task deadlines ────────────────────────────────────────────────────────────
# Deadlines are entered in school-local time, but the services may run in UTC
# (Docker), so "now" is taken at a fixed school offset. The Philippines has no
# DST; override with SCHOOL_UTC_OFFSET_HOURS if the school is elsewhere.
_SCHOOL_TZ = timezone(timedelta(hours=float(os.getenv("SCHOOL_UTC_OFFSET_HOURS", "8"))))


def school_now() -> datetime:
    """Current school-local time (naive, comparable with task_deadline)."""
    return datetime.now(_SCHOOL_TZ).replace(tzinfo=None)


def task_deadline(end_date: Optional[str], due_time: Optional[str]) -> Optional[datetime]:
    """When a task is due: end_date at due_time ('5:00 PM'), or the end of
    end_date when no time is set. None when there is no parseable end date.
    Mirrors Task.deadline in the frontend (models.dart)."""
    d = parse_event_date(end_date)
    if d is None:
        return None
    t = time(23, 59, 59)
    if due_time and due_time.strip():
        try:
            t = datetime.strptime(due_time.strip().upper(), "%I:%M %p").time()
        except ValueError:
            pass
    return datetime.combine(d, t)


def is_overdue(end_date: Optional[str], due_time: Optional[str]) -> bool:
    dl = task_deadline(end_date, due_time)
    return dl is not None and dl < school_now()

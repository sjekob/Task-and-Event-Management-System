"""Shared best-effort parser for the free-text event target_date field.
Mirrors the frontend's parseEventDate (date_parse.dart): ISO first, then a
'Month D, YYYY' style. Used by event proposal validation and the public
evaluation date-gate so both agree on what a date means.
"""
import re
from datetime import date, datetime
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

"""
event_store.py — Saving an event proposal into its normalized tables.

The apps send a proposal as one payload whose lists are JSON text
(activity_matrix, twg_groups, comments, ...), the same shape the `events`
view gives back. save_event() takes it apart: the simple details are columns
of `event`, and each list goes to its child table, one row per item in order.
Nothing here stores JSON.
"""
import json
from typing import Optional

from store import replace_list

# The proposal's simple details: columns of `event`, named as in the payload.
_COLUMNS = ("target_date", "start_time", "end_time", "venue", "proposed_budget", "fund_source", "focal_name", "focal_role", "focal_contact",
            "rationale", "methodology_intro", "monitoring_criteria")
_RICH_FIELDS = ("title", "venue", "focalRole", "rationale", "objectives", "monitoring")


def _json(v, default):
    if v is None or v == "":
        return default
    if isinstance(v, (list, dict)):
        return v
    try:
        return json.loads(v)
    except (TypeError, ValueError):
        return default


def _s(v) -> str:
    return "" if v is None else str(v)


def _n(v) -> int:
    try:
        return max(int(v or 0), 0)
    except (TypeError, ValueError):
        return 0


def _objectives(v) -> str:
    """Objectives are a text block; older proposals sent a JSON list of lines."""
    parsed = _json(v, None) if isinstance(v, str) and v.strip().startswith("[") else None
    return "\n".join(_s(x) for x in parsed if _s(x).strip()) if isinstance(parsed, list) else _s(v)


def _participants(v) -> list:
    p = _json(v, None)
    if isinstance(p, dict) and isinstance(p.get("rows"), list):
        return [{"category": _s(r.get("category")), "male": _n(r.get("male")), "female": _n(r.get("female"))} for r in p["rows"]]
    if isinstance(p, dict):   # older shape: {"teachers": {...}, "students": {...}}
        return [{"category": k.title(), "male": _n(g.get("male")), "female": _n(g.get("female"))}
                for k, g in p.items() if isinstance(g, dict)]
    return []


def _phases(body: dict) -> list:
    rows = _json(body.get("phase1"), None)
    if isinstance(rows, list):
        return [{"stage": _s(r.get("stage")), "activities": _s(r.get("activities"))} for r in rows if isinstance(r, dict)]
    # Older proposals: the three stages as plain text.
    stages = ("Pre-Implementation Stage", "Implementation", "Post-Implementation")
    return [{"stage": st, "activities": _s(body.get(k))} for st, k in zip(stages, ("phase1", "phase2", "phase3")) if _s(body.get(k)).strip()]


def save_event(db, body: dict, *, event_id: Optional[int] = None, status: Optional[str] = None,
               created_by: Optional[int] = None) -> int:
    """Creates (no [event_id]) or replaces a proposal from its payload; returns its id."""
    lat, lng = body.get("venue_latitude"), body.get("venue_longitude")
    pinned = lat is not None and lng is not None
    reading = _json(body.get("proposal_reading"), None)
    reading = reading if isinstance(reading, dict) and reading.get("method") else None
    fields = {
        "title": _s(body.get("title")), "nature": body.get("nature") or "Co-curricular",
        **{k: (_s(body.get(k)).strip() or None) for k in _COLUMNS},
        "objectives": _objectives(body.get("objectives")).strip() or None,
        # Venue pin: all three or none.
        "venue_latitude": lat if pinned else None, "venue_longitude": lng if pinned else None,
        "venue_radius_m": (body.get("venue_radius_m") or 100) if pinned else None,
        "reading_method": reading["method"] if reading else None,
        "reading_at": (_s(reading.get("read_at")) or None) if reading else None,
        # Submitted as the original file, without reviewing the form read from it.
        "submitted_as_file": 1 if body.get("submitted_as_file") else 0,
    }
    if event_id is None:
        fields.update(status=status or "pending_approval", created_by=created_by)
        event_id = db.execute(f"INSERT INTO event ({', '.join(fields)}) VALUES ({', '.join('?' * len(fields))})",
                              tuple(fields.values())).lastrowid
    else:
        if status:
            fields["status"] = status
        db.execute(f"UPDATE event SET {', '.join(f'{k}=?' for k in fields)} WHERE id=?", (*fields.values(), event_id))

    replace_list(db, "event_output", "event_id", event_id, [{"output": _s(o)} for o in _json(body.get("expected_outputs"), [])])
    replace_list(db, "event_participant_group", "event_id", event_id, _participants(body.get("participants")))
    replace_list(db, "event_phase", "event_id", event_id, _phases(body))
    replace_list(db, "event_session", "event_id", event_id, [
        {"day": _s(r.get("day")), "time": _s(r.get("time")), "activity": _s(r.get("event")), "speaker": _s(r.get("speaker"))}
        for r in _json(body.get("activity_matrix"), []) if isinstance(r, dict)])
    replace_list(db, "event_material", "event_id", event_id, [
        {"item": _s(r.get("item")), "qty": _s(r.get("qty")), "cost": _s(r.get("cost")), "total": _s(r.get("total"))}
        for r in _json(body.get("training_materials"), []) if isinstance(r, dict)])
    replace_list(db, "event_snack", "event_id", event_id, [
        {"item": _s(r.get("item")), "pax": _s(r.get("pax")), "cost": _s(r.get("cost")), "total": _s(r.get("total"))}
        for r in _json(body.get("snacks"), []) if isinstance(r, dict)])
    replace_list(db, "event_executive", "event_id", event_id, [
        {"name": _s(r.get("name")), "role_title": _s(r.get("position") or r.get("designation"))}
        for r in _json(body.get("exec_committee"), []) if isinstance(r, dict)])
    replace_list(db, "event_indicator", "event_id", event_id, [
        {"label": _s(r.get("label") if isinstance(r, dict) else r)} for r in _json(body.get("indicators"), [])])
    _save_committees(db, event_id, _json(body.get("twg_groups"), []))
    _save_comments(db, event_id, _json(body.get("comments"), {}))
    _save_reading(db, event_id, _json(body.get("proposal_reading"), None))
    return event_id


def _save_committees(db, event_id: int, groups: list):
    db.execute("DELETE FROM event_committee WHERE event_id=?", (event_id,))
    for gi, g in enumerate(g for g in groups if isinstance(g, dict)):
        cid = db.execute("INSERT INTO event_committee (event_id, position, title) VALUES (?,?,?)",
                         (event_id, gi, _s(g.get("title")))).lastrowid
        for mi, m in enumerate(m for m in (g.get("members") or []) if isinstance(m, dict)):
            db.execute("""INSERT INTO event_committee_member (committee_id, position, name, designation, tor, output, automate,
                                                                due_days, personnel_id)
                          VALUES (?,?,?,?,?,?,?,?,?)""",
                       (cid, mi, _s(m.get("name")), _s(m.get("designation")), _s(m.get("tor")), _s(m.get("output")),
                        1 if m.get("automate_special_task") else 0, _due_days(m.get("due_days")),
                        m["user_id"] if isinstance(m.get("user_id"), int) else None))


def _due_days(v) -> int:
    """Days after the event an automated committee task is due: 0-365, default 7."""
    try:
        return min(max(int(v), 0), 365)
    except (TypeError, ValueError):
        return 7


def _save_comments(db, event_id: int, comments):
    """`comments` carries the signatories and the rich-text formatting."""
    comments = comments if isinstance(comments, dict) else {}
    replace_list(db, "event_signatory", "event_id", event_id, [
        {"role": _s(s.get("role")), "name": _s(s.get("name")), "title": _s(s.get("title"))}
        for s in (comments.get("signatories") or []) if isinstance(s, dict)])
    rich = comments.get("rich") if isinstance(comments.get("rich"), dict) else {}
    db.execute("DELETE FROM event_rich_text WHERE event_id=?", (event_id,))
    for field in _RICH_FIELDS:
        if _s(rich.get(field)).strip():
            db.execute("INSERT INTO event_rich_text (event_id, field, html) VALUES (?,?,?) RETURNING event_id",
                       (event_id, field, rich[field]))
    replace_list(db, "event_rich_output", "event_id", event_id, [{"html": _s(h)} for h in (rich.get("outputs") or [])])


def _save_reading(db, event_id: int, r):
    """What the proposal reader found, when the form was filled from a file."""
    for table in ("event_reading_file", "event_reading_section", "event_reading_message"):
        db.execute(f"DELETE FROM {table} WHERE event_id=?", (event_id,))
    if not isinstance(r, dict) or not r.get("method"):
        return   # how it was read (method, time) is on the event itself
    replace_list(db, "event_reading_file", "event_id", event_id, [{"file_name": _s(f)} for f in r.get("files") or []])
    sections = [s for s in (r.get("sections") or []) if isinstance(s, dict)]
    replace_list(db, "event_reading_section", "event_id", event_id,
                 [{"label": _s(s.get("label")), "found": 1 if s.get("found") else 0} for s in sections])
    for si, s in enumerate(sections):
        for fi, f in enumerate(s.get("fields") or []):
            db.execute("""INSERT INTO event_reading_section_field (event_id, section_position, position, field)
                          VALUES (?,?,?,?) RETURNING event_id""", (event_id, si, fi, _s(f)))
    for kind, key in (("warning", "warnings"), ("note", "notes")):
        for i, msg in enumerate(r.get(key) or []):
            db.execute("INSERT INTO event_reading_message (event_id, kind, position, message) VALUES (?,?,?,?) RETURNING event_id",
                       (event_id, kind, i, _s(msg)))

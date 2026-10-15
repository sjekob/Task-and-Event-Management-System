"""Audit trail: who changed what, when (UTC), with before/after values.

Call `record(...)` in the same transaction as the change it describes, before
the endpoint commits, so the change and its audit entry are saved together.
The audit_log table is append-only (database triggers reject UPDATE/DELETE).
Never put secrets in `changes` — e.g. a password reset is logged as an event,
not a value.
"""
import json
from typing import Optional

from fastapi import Request


def client_ip(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()[:64]
    return request.client.host if request.client else None


def diff(before: dict, after: dict) -> dict:
    """{field: [before, after]} for the fields that changed."""
    return {k: [before.get(k), after.get(k)]
            for k in sorted(set(before) | set(after))
            if before.get(k) != after.get(k)}


def record(db, user: Optional[dict], action: str, entity_type: str,
           entity_id: Optional[int], summary: str, *,
           changes: Optional[dict] = None, request: Optional[Request] = None) -> None:
    """One audit_log row, plus one audit_log_changes row per changed field.
    Names (actor, record) are not copied in; they are looked up when read."""
    cur = db.execute(
        """INSERT INTO audit_log (actor_id, actor_role, action, entity_type, entity_id,
                                  summary, ip_address)
           VALUES (?,?,?,?,?,?,?)""",
        (int(user["sub"]) if user else None, user.get("role") if user else None,
         action, entity_type, entity_id, summary[:500], client_ip(request)))
    for field, (old, new) in (changes or {}).items():
        db.execute(
            """INSERT INTO audit_log_changes (audit_id, field_name, old_value, new_value)
               VALUES (?,?,?,?)""",
            (cur.lastrowid, field, json.dumps(old, default=str), json.dumps(new, default=str)))


def user_label(db, uid: int) -> Optional[str]:
    row = db.execute("SELECT full_name, username FROM users WHERE id=?", (uid,)).fetchone()
    return f"{row['full_name']} ({row['username']})" if row else None

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


def _actor(db, user: Optional[dict]) -> tuple:
    if not user:
        return None, None, None
    uid = int(user["sub"])
    row = db.execute("SELECT full_name FROM users WHERE id=?", (uid,)).fetchone()
    return uid, (row["full_name"] if row else None), user.get("role")


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
           entity_id: Optional[int], summary: str, *, entity_label: Optional[str] = None,
           changes: Optional[dict] = None, request: Optional[Request] = None) -> None:
    actor_id, actor_name, actor_role = _actor(db, user)
    db.execute(
        """INSERT INTO audit_log (actor_id, actor_name, actor_role, action, entity_type,
                                  entity_id, entity_label, summary, changes, ip_address)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (actor_id, actor_name, actor_role, action, entity_type, entity_id, entity_label,
         summary[:500], json.dumps(changes, default=str) if changes else None,
         client_ip(request)))


def user_label(db, uid: int) -> Optional[str]:
    row = db.execute("SELECT full_name, username FROM users WHERE id=?", (uid,)).fetchone()
    return f"{row['full_name']} ({row['username']})" if row else None

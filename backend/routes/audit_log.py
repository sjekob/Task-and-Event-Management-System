"""Read-only access to the audit trail (principal/admin). There are no write,
edit or delete endpoints: entries are only created by the actions they
describe (see audit.py), and the table itself rejects UPDATE/DELETE."""
import json
from typing import Optional

from fastapi import APIRouter, Depends, Query

from auth import require_permission
from database import get_db

router = APIRouter(prefix="/api/audit", tags=["Audit"])

require_audit_viewer = require_permission(
    "view_audit", "Only the Principal or Admin can view the audit trail")


# The record an entry is about, looked up by type when read (not stored).
_LABEL_SQL = """CASE a.entity_type
    WHEN 'user' THEN (SELECT x.full_name || ' (' || x.username || ')' FROM users x WHERE x.id = a.entity_id)
    WHEN 'certificate' THEN (SELECT COALESCE(c.cert_name, f.detected_title, f.original_name)
                                    || ' — ' || o.full_name
                             FROM certificate_files f JOIN users o ON o.id = f.user_id
                             LEFT JOIN certifications c ON c.id = f.certification_id
                             WHERE f.id = a.entity_id)
    WHEN 'school_year' THEN (SELECT name FROM school_years WHERE id = a.entity_id)
    WHEN 'event' THEN (SELECT title FROM events WHERE id = a.entity_id)
    WHEN 'task' THEN (SELECT title FROM tasks WHERE id = a.entity_id)
    WHEN 'department' THEN (SELECT department_name FROM departments WHERE id = a.entity_id)
END"""


@router.get("")
def list_audit(entity_type: Optional[str] = None, entity_id: Optional[int] = None,
               actor_id: Optional[int] = None, action: Optional[str] = None,
               q: Optional[str] = None, date_from: Optional[str] = None,
               date_to: Optional[str] = None,
               limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
               db=Depends(get_db), user=Depends(require_audit_viewer)):
    """Newest first. `action` matches a prefix (e.g. 'account' or
    'personnel.update'); dates are YYYY-MM-DD (UTC), inclusive."""
    where, args = [], []
    if entity_type:
        where.append("a.entity_type=?"); args.append(entity_type)
    if entity_id is not None:
        where.append("a.entity_id=?"); args.append(entity_id)
    if actor_id is not None:
        where.append("a.actor_id=?"); args.append(actor_id)
    if action:
        where.append("a.action LIKE ?"); args.append(action.replace("%", "") + "%")
    if q:
        like = f"%{q.strip()}%"
        where.append(f"(a.summary LIKE ? OR u.full_name LIKE ? OR ({_LABEL_SQL}) LIKE ?)")
        args += [like, like, like]
    if date_from:
        where.append("a.created_at >= ?"); args.append(date_from[:10])
    if date_to:
        where.append("a.created_at < date(?, '+1 day')"); args.append(date_to[:10])
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    base = "FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id"
    total = db.execute(f"SELECT COUNT(*) {base} {clause}", args).fetchone()[0]
    rows = db.execute(
        f"""SELECT a.*, u.full_name AS actor_name, ({_LABEL_SQL}) AS entity_label
            {base} {clause} ORDER BY a.id DESC LIMIT ? OFFSET ?""",
        args + [limit, offset]).fetchall()
    items = []
    for r in rows:
        d = dict(r)
        d["changes"] = {
            c["field_name"]: [json.loads(c["old_value"]) if c["old_value"] is not None else None,
                              json.loads(c["new_value"]) if c["new_value"] is not None else None]
            for c in db.execute("SELECT field_name, old_value, new_value FROM audit_log_changes "
                                "WHERE audit_id=? ORDER BY id", (d["id"],))}
        items.append(d)
    return {"items": items, "total": total}

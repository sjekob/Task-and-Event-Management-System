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
        where.append("entity_type=?"); args.append(entity_type)
    if entity_id is not None:
        where.append("entity_id=?"); args.append(entity_id)
    if actor_id is not None:
        where.append("actor_id=?"); args.append(actor_id)
    if action:
        where.append("action LIKE ?"); args.append(action.replace("%", "") + "%")
    if q:
        like = f"%{q.strip()}%"
        where.append("(summary LIKE ? OR entity_label LIKE ? OR actor_name LIKE ?)")
        args += [like, like, like]
    if date_from:
        where.append("created_at >= ?"); args.append(date_from[:10])
    if date_to:
        where.append("created_at < date(?, '+1 day')"); args.append(date_to[:10])
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    total = db.execute(f"SELECT COUNT(*) FROM audit_log {clause}", args).fetchone()[0]
    rows = db.execute(f"SELECT * FROM audit_log {clause} ORDER BY id DESC LIMIT ? OFFSET ?",
                      args + [limit, offset]).fetchall()
    items = []
    for r in rows:
        d = dict(r)
        d["changes"] = json.loads(d["changes"]) if d.get("changes") else {}
        items.append(d)
    return {"items": items, "total": total}

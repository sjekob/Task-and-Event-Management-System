from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from database import connect_db, create_notification
from auth import (get_current_user, require_task_creator, require_can_assign,
                  TASK_CREATORS, can_assign)

router = APIRouter(tags=["Tasks"])


# ── Helper ────────────────────────────────────────────────────────────────────

def _task_row(row, db, current_user_id: int, current_role: str):
    d = dict(row)
    d["assigned_users"] = [dict(r) for r in db.execute(
        """SELECT u.id, u.full_name, u.role, gl.grade_level, ta.assigned_by
           FROM task_assignments ta
           JOIN users u ON u.id = ta.user_id
           LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
           WHERE ta.task_id=?
           ORDER BY u.role, u.full_name""",
        (d["id"],)
    ).fetchall()]

    d["submission_count"] = db.execute(
        "SELECT COUNT(*) as c FROM task_log WHERE task_id=?", (d["id"],)
    ).fetchone()["c"]

    d["attachments"] = [dict(a) for a in db.execute(
        "SELECT * FROM task_attachments WHERE task_id=?", (d["id"],)
    ).fetchall()]

    my_assignment = db.execute(
        "SELECT assigned_by FROM task_assignments WHERE task_id=? AND user_id=?",
        (d["id"], current_user_id)
    ).fetchone()
    d["my_assigned_by"] = my_assignment["assigned_by"] if my_assignment else None

    if current_role not in TASK_CREATORS and current_role != "admin":
        rep = db.execute(
            "SELECT * FROM reports WHERE task_id=? AND personnel_id=?",
            (d["id"], current_user_id)
        ).fetchone()
        d["my_report"] = dict(rep) if rep else None

        log = db.execute(
            "SELECT * FROM task_log WHERE task_id=? AND personnel_id=?",
            (d["id"], current_user_id)
        ).fetchone()
        d["submission_status"] = "submitted" if log else "pending"

    if current_role in ("principal", "coordinator", "dean", "admin"):
        total = db.execute(
            "SELECT COUNT(*) as c FROM task_assignments WHERE task_id=? AND assigned_by=?",
            (d["id"], current_user_id)
        ).fetchone()["c"]
        submitted = db.execute(
            """SELECT COUNT(*) as c FROM task_log tl
               JOIN task_assignments ta ON ta.task_id=tl.task_id AND ta.user_id=tl.personnel_id
               WHERE tl.task_id=? AND ta.assigned_by=?""",
            (d["id"], current_user_id)
        ).fetchone()["c"]
        d["team_total"] = total
        d["team_submitted"] = submitted

    return d


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/api/tasks")
def list_tasks(user=Depends(get_current_user), search: str = "",
               assigned: int = 0, scope: str = "mine", category: str = "",
               limit: int = 0, offset: int = 0):
    db = connect_db()
    uid = int(user["sub"])
    role = user["role"]

    if assigned:
        # Only tasks targeted at the identity (role) the user is logged in as —
        # plus legacy untargeted assignments (target_role IS NULL).
        q = """SELECT DISTINCT t.* FROM tasks t
               JOIN task_assignments ta ON ta.task_id=t.id
               WHERE ta.user_id=? AND t.status='active'
                 AND (ta.target_role=? OR ta.target_role IS NULL)"""
        params = [uid, role]
    elif role == "admin":
        q = "SELECT * FROM tasks WHERE 1=1"
        params = []
    elif role == "principal":
        # scope=all → every task in the system; otherwise only those they created.
        if scope == "all":
            q = "SELECT * FROM tasks WHERE 1=1"
            params = []
        else:
            q = "SELECT * FROM tasks WHERE created_by=?"
            params = [uid]
    elif role in ("coordinator", "dean"):
        q = """SELECT DISTINCT t.* FROM tasks t
               LEFT JOIN task_assignments ta ON ta.task_id=t.id
               WHERE (ta.user_id=? OR t.created_by=?)"""
        params = [uid, uid]
    else:
        q = """SELECT DISTINCT t.* FROM tasks t
               JOIN task_assignments ta ON ta.task_id=t.id
               WHERE ta.user_id=? AND t.status='active'"""
        params = [uid]

    # Column prefix differs between the joined queries (alias t) and the plain ones.
    pref = "t." if "task_assignments" in q else ""
    if search:
        q += f" AND {pref}title LIKE ?"
        params.append(f"%{search}%")
    if category:
        q += f" AND {pref}task_category=?"
        params.append(category)

    order = f" ORDER BY {pref}id DESC"
    if limit and limit > 0:
        # Paginated: return an envelope with the page + total so the client can
        # decide whether to keep scrolling, instead of dumping every row.
        total = db.execute(f"SELECT COUNT(*) FROM ({q})", params).fetchone()[0]
        rows = db.execute(f"{q}{order} LIMIT ? OFFSET ?", params + [limit, offset]).fetchall()
        items = [_task_row(row, db, uid, role) for row in rows]
        db.close()
        return {"items": items, "total": total, "limit": limit, "offset": offset,
                "has_more": offset + len(items) < total}

    rows = db.execute(f"{q}{order}", params).fetchall()
    result = [_task_row(row, db, uid, role) for row in rows]
    db.close()
    return result


@router.get("/api/tasks/{task_id}")
def get_task(task_id: int, user=Depends(get_current_user)):
    db = connect_db()
    uid = int(user["sub"])
    role = user["role"]

    row = db.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(404, "Task not found")

    if role not in TASK_CREATORS and role != "admin":
        assigned = db.execute(
            "SELECT 1 FROM task_assignments WHERE task_id=? AND user_id=?",
            (task_id, uid)
        ).fetchone()
        if not assigned:
            db.close()
            raise HTTPException(403, "Not assigned to this task")

    d = _task_row(row, db, uid, role)

    if role in TASK_CREATORS or role == "admin":
        reports = db.execute(
            """SELECT r.*, u.full_name, u.avatar_url, u.role, gl.grade_level
               FROM reports r
               JOIN users u ON u.id=r.personnel_id
               LEFT JOIN grade_levels gl ON gl.id=u.grade_level_id
               WHERE r.task_id=? ORDER BY r.report_date DESC""",
            (task_id,)
        ).fetchall()
    elif role in ("coordinator", "dean"):
        reports = db.execute(
            """SELECT r.*, u.full_name, u.avatar_url, u.role, gl.grade_level
               FROM reports r
               JOIN users u ON u.id=r.personnel_id
               LEFT JOIN grade_levels gl ON gl.id=u.grade_level_id
               JOIN task_assignments ta ON ta.task_id=r.task_id AND ta.user_id=r.personnel_id
               WHERE r.task_id=? AND ta.assigned_by=?
               ORDER BY r.report_date DESC""",
            (task_id, uid)
        ).fetchall()
    else:
        reports = []

    d["reports"] = [dict(r) for r in reports]

    d["public_comments"] = [dict(c) for c in db.execute(
        """SELECT c.*, u.full_name, u.avatar_url FROM comments c
           JOIN users u ON u.id=c.user_id
           WHERE c.task_id=? AND c.comment_type='public'
           ORDER BY c.created_at""",
        (task_id,)
    ).fetchall()]

    d["private_comments"] = [dict(c) for c in db.execute(
        """SELECT c.*, u.full_name FROM comments c
           JOIN users u ON u.id=c.user_id
           WHERE c.task_id=? AND c.comment_type='private'
             AND (
               c.user_id=?
               OR ? IN (SELECT id FROM users WHERE role IN ('admin','principal','coordinator'))
               OR c.user_id IN (
                 SELECT assigned_by FROM task_assignments
                 WHERE task_id=? AND user_id=? AND assigned_by IS NOT NULL
               )
               OR c.user_id IN (
                 SELECT personnel_id FROM reports WHERE task_id=?
               )
             )
           ORDER BY c.created_at""",
        (task_id, uid, uid, task_id, uid, task_id)
    ).fetchall()]

    db.close()
    return d


class CreateTaskRequest(BaseModel):
    title: str
    subject: Optional[str] = None
    task_category: Optional[str] = 'common'  # 'common' | 'special'
    task_type_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    due_time: Optional[str] = None
    instructions: Optional[str] = None
    assigned_user_ids: Optional[List[int]] = []
    target_role: Optional[str] = None  # which identity the assignees receive this as
    points_early: Optional[int] = 100
    points_ontime: Optional[int] = 100
    points_late24: Optional[int] = 50
    points_after24: Optional[int] = 0
    attachments: Optional[List[dict]] = []


@router.post("/api/tasks")
def create_task(req: CreateTaskRequest, user=Depends(require_task_creator)):
    db = connect_db()
    uid = int(user["sub"])
    role = user["role"]

    category = req.task_category if req.task_category in ('common', 'special') else 'common'
    db.execute(
        """INSERT INTO tasks
           (title, subject, task_category, task_type_id, start_date, end_date, due_time,
            instructions, created_by, points_early, points_ontime, points_late24, points_after24)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (req.title, req.subject, category, req.task_type_id, req.start_date, req.end_date,
         req.due_time, req.instructions, uid,
         req.points_early, req.points_ontime, req.points_late24, req.points_after24)
    )
    task_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]

    # Which identity these assignees receive the task as. If given it must be one
    # the creator may assign to; otherwise we fall back per-assignee to their role.
    target_role = req.target_role
    if target_role and not can_assign(role, target_role):
        target_role = None

    for assign_uid in (req.assigned_user_ids or []):
        # The assignee must actually hold the target identity (or, with no target,
        # we use their primary role for the hierarchy check).
        roles_held = {r["roles"] for r in db.execute(
            """SELECT rr.roles FROM user_roles ur JOIN roles rr ON rr.id = ur.role_id
               WHERE ur.user_id=?""", (assign_uid,)
        ).fetchall()}
        if not roles_held:
            primary = db.execute("SELECT role FROM users WHERE id=?", (assign_uid,)).fetchone()
            if primary:
                roles_held = {primary["role"]}
        if not roles_held:
            continue

        if target_role:
            if target_role not in roles_held:
                continue
            row_target = target_role
        else:
            row_target = next((r for r in roles_held if can_assign(role, r)), None)
            if row_target is None:
                continue

        try:
            db.execute(
                "INSERT INTO task_assignments (task_id, user_id, assigned_by, target_role) VALUES (?,?,?,?)",
                (task_id, assign_uid, uid, row_target)
            )
            try:
                create_notification(
                    db, assign_uid, "task",
                    f"New task assigned: {req.title}",
                    req.instructions[:120] if req.instructions else "",
                    task_id,
                )
            except Exception:
                pass
        except Exception:
            pass

    for att in (req.attachments or []):
        db.execute(
            "INSERT INTO task_attachments (task_id, attachment_type, name, url) VALUES (?,?,?,?)",
            (task_id, att.get("type"), att.get("name"), att.get("url"))
        )

    db.commit()
    db.close()
    return {"id": task_id, "message": "Task created"}


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    subject: Optional[str] = None
    task_type_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    due_time: Optional[str] = None
    instructions: Optional[str] = None
    status: Optional[str] = None


@router.put("/api/tasks/{task_id}")
def update_task(task_id: int, req: UpdateTaskRequest, user=Depends(require_task_creator)):
    db = connect_db()
    fields, vals = [], []
    for f, v in [("title", req.title), ("subject", req.subject),
                 ("task_type_id", req.task_type_id), ("start_date", req.start_date),
                 ("end_date", req.end_date), ("due_time", req.due_time),
                 ("instructions", req.instructions), ("status", req.status)]:
        if v is not None:
            fields.append(f"{f}=?")
            vals.append(v)
    if fields:
        vals.append(task_id)
        db.execute(f"UPDATE tasks SET {','.join(fields)} WHERE id=?", vals)
    db.commit()
    db.close()
    return {"message": "Updated"}


@router.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, user=Depends(require_task_creator)):
    db = connect_db()
    db.execute("DELETE FROM tasks WHERE id=?", (task_id,))
    db.commit()
    db.close()
    return {"message": "Deleted"}


# ── Assignments ───────────────────────────────────────────────────────────────

class AssignRequest(BaseModel):
    user_ids: List[int]


@router.post("/api/tasks/{task_id}/assign")
def assign_task(task_id: int, req: AssignRequest, user=Depends(require_can_assign)):
    db = connect_db()
    uid = int(user["sub"])
    role = user["role"]

    is_creator = db.execute(
        "SELECT 1 FROM tasks WHERE id=? AND created_by=?", (task_id, uid)
    ).fetchone()
    is_assigned = db.execute(
        "SELECT 1 FROM task_assignments WHERE task_id=? AND user_id=?", (task_id, uid)
    ).fetchone()
    if not is_creator and not is_assigned:
        db.close()
        raise HTTPException(403, "You are not assigned to this task")

    assigner = db.execute("SELECT grade_level_id FROM users WHERE id=?", (uid,)).fetchone()
    assigner_grade = assigner["grade_level_id"] if assigner else None

    added, skipped = [], []
    for assign_uid in req.user_ids:
        assignee = db.execute(
            "SELECT role, grade_level_id, full_name FROM users WHERE id=?", (assign_uid,)
        ).fetchone()
        if not assignee or not can_assign(role, assignee["role"]):
            skipped.append(assign_uid)
            continue
        if role == "dean" and assignee["grade_level_id"] != assigner_grade:
            skipped.append(assign_uid)
            continue
        try:
            db.execute(
                "INSERT INTO task_assignments (task_id, user_id, assigned_by) VALUES (?,?,?)",
                (task_id, assign_uid, uid)
            )
            added.append(assign_uid)
            task_title = db.execute("SELECT title FROM tasks WHERE id=?", (task_id,)).fetchone()
            try:
                create_notification(
                    db, assign_uid, "task",
                    f"New task assigned: {task_title['title'] if task_title else 'a task'}",
                    "", task_id,
                )
            except Exception:
                pass
        except Exception:
            skipped.append(assign_uid)

    db.commit()
    db.close()
    return {"assigned": added, "skipped": skipped}


@router.delete("/api/tasks/{task_id}/assign/{user_id}")
def unassign_task(task_id: int, user_id: int, user=Depends(require_can_assign)):
    db = connect_db()
    uid = int(user["sub"])
    db.execute(
        "DELETE FROM task_assignments WHERE task_id=? AND user_id=? AND assigned_by=?",
        (task_id, user_id, uid)
    )
    db.commit()
    db.close()
    return {"message": "Unassigned"}

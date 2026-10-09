from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from database import connect_db, create_notification
from auth import (get_current_user, require_task_creator, require_can_assign,
                  TASK_CREATORS, can_assign)
from date_utils import task_deadline
from datetime import datetime
from school_calendar import resolve_window, task_in_window

router = APIRouter(tags=["Tasks"])


# ── Helper ────────────────────────────────────────────────────────────────────

def _task_row(row, db, current_user_id: int, current_role: str):
    d = dict(row)
    d["assigned_users"] = [dict(r) for r in db.execute(
        """SELECT u.id, u.full_name, u.role, gl.grade_level, ta.assigned_by,
                  (EXISTS (SELECT 1 FROM task_log tl
                           WHERE tl.task_id=ta.task_id AND tl.personnel_id=ta.user_id)
                   OR EXISTS (SELECT 1 FROM reports r
                              WHERE r.task_id=ta.task_id AND r.personnel_id=ta.user_id))
                  AS submitted
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

    # The caller's own submission state — for anyone assigned this task, so a
    # dean/coordinator/registrar's My Tasks shows it too (not only teachers).
    if my_assignment or (current_role not in TASK_CREATORS and current_role != "admin"):
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

    if current_role in TASK_CREATORS or current_role == "admin":
        # The task's creator (and principal/admin) track everyone assigned; a
        # coordinator/dean who only delegated part of it tracks the people they
        # assigned. "Submitted" = a task_log entry or a report, as on My Tasks.
        whole_task = d.get("created_by") == current_user_id or current_role in ("principal", "admin")
        scope = "" if whole_task else " AND ta.assigned_by=?"
        params = (d["id"],) if whole_task else (d["id"], current_user_id)
        d["team_total"] = db.execute(
            f"SELECT COUNT(*) AS c FROM task_assignments ta WHERE ta.task_id=?{scope}", params
        ).fetchone()["c"]
        d["team_submitted"] = db.execute(
            f"""SELECT COUNT(*) AS c FROM task_assignments ta
                WHERE ta.task_id=?{scope}
                  AND (EXISTS (SELECT 1 FROM task_log tl
                               WHERE tl.task_id=ta.task_id AND tl.personnel_id=ta.user_id)
                    OR EXISTS (SELECT 1 FROM reports r
                               WHERE r.task_id=ta.task_id AND r.personnel_id=ta.user_id))""",
            params
        ).fetchone()["c"]
        d["team_scope"] = "all" if whole_task else "mine"

    return d


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/api/tasks")
def list_tasks(user=Depends(get_current_user), search: str = "",
               assigned: int = 0, scope: str = "mine", category: str = "",
               limit: int = 0, offset: int = 0,
               school_year: str = "current", term_id: Optional[int] = None):
    db = connect_db()
    uid = int(user["sub"])
    try:
        window = resolve_window(db, school_year, term_id)
    except ValueError as e:
        db.close()
        raise HTTPException(400, str(e))
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

    # Urgency order, computed on the real deadline (end_date + due_time, so
    # "10:00 AM" sorts before "5:00 PM"): still-open work first — overdue and
    # soonest-due at the top — then work already submitted (for assignees) or
    # disabled (for creators); no-deadline tasks last within each group, newest
    # first. Sorted in Python, then paginated.
    # Only the selected school year (default: current); older years are archived.
    rows = [r for r in db.execute(q, params).fetchall() if task_in_window(window, r)]
    rows = sorted(rows, key=lambda r: _urgency_key(db, r, uid, assigned_view=bool(assigned)))
    total = len(rows)
    if limit and limit > 0:
        # Paginated: return an envelope with the page + total so the client can
        # decide whether to keep scrolling, instead of dumping every row.
        page = rows[offset:offset + limit]
        items = [_task_row(row, db, uid, role) for row in page]
        db.close()
        return {"items": items, "total": total, "limit": limit, "offset": offset,
                "has_more": offset + len(items) < total}

    result = [_task_row(row, db, uid, role) for row in rows]
    db.close()
    return result


def _urgency_key(db, row, uid: int, assigned_view: bool):
    if assigned_view:
        done = db.execute(
            """SELECT 1 FROM task_log WHERE task_id=? AND personnel_id=?
               UNION SELECT 1 FROM reports WHERE task_id=? AND personnel_id=?""",
            (row["id"], uid, row["id"], uid)).fetchone() is not None
    else:
        done = row["status"] != "active"
    dl = task_deadline(row["end_date"], row["due_time"])
    return (done, dl is None, dl or datetime.max, -row["id"])


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

    # Reviewers see the same submissions their progress count covers: the whole
    # task for its creator and principal/admin, otherwise only the people they
    # assigned (see _task_row's team_scope).
    if d.get("team_scope") == "all":
        reports = db.execute(
            """SELECT r.*, u.full_name, u.avatar_url, u.role, gl.grade_level
               FROM reports r
               JOIN users u ON u.id=r.personnel_id
               LEFT JOIN grade_levels gl ON gl.id=u.grade_level_id
               WHERE r.task_id=? ORDER BY r.report_date DESC""",
            (task_id,)
        ).fetchall()
    elif d.get("team_scope") == "mine":
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


def _assign_users(db, task_id: int, uid: int, role: str, user_ids, target_role,
                  title: str, note: str = "") -> tuple:
    """Assign people to a task, enforcing the hierarchy (auth.ASSIGNABLE_TO):
    `target_role` is the identity they receive it as and must be one the
    assigner may assign to; each person must hold that role (via user_roles).
    Without a target, their first assignable role is used. A dean may only
    assign within the grade level they handle. Returns (added, skipped).
    Caller owns the commit."""
    if target_role and not can_assign(role, target_role):
        return [], list(user_ids or [])
    dean_grade = None
    if role == "dean":
        r = db.execute(
            """SELECT COALESCE(da.grade_level_id, u.grade_level_id) AS gl
               FROM users u LEFT JOIN dean_assignment da ON da.user_id = u.id
               WHERE u.id=?""", (uid,)).fetchone()
        dean_grade = r["gl"] if r else None

    added, skipped = [], []
    for assign_uid in (user_ids or []):
        person = db.execute("SELECT role, grade_level_id FROM users WHERE id=?",
                            (assign_uid,)).fetchone()
        roles_held = {r["roles"] for r in db.execute(
            """SELECT rr.roles FROM user_roles ur JOIN roles rr ON rr.id = ur.role_id
               WHERE ur.user_id=?""", (assign_uid,)).fetchall()}
        if not roles_held and person:
            roles_held = {person["role"]}
        if target_role:
            row_target = target_role if target_role in roles_held else None
        else:
            row_target = next((r for r in sorted(roles_held) if can_assign(role, r)), None)
        if (not person or row_target is None
                or (role == "dean" and person["grade_level_id"] != dean_grade)):
            skipped.append(assign_uid)
            continue
        try:
            db.execute(
                "INSERT INTO task_assignments (task_id, user_id, assigned_by, target_role) "
                "VALUES (?,?,?,?)", (task_id, assign_uid, uid, row_target))
        except Exception:
            skipped.append(assign_uid)  # already assigned
            continue
        added.append(assign_uid)
        try:
            create_notification(db, assign_uid, "task", f"New task assigned: {title}",
                                note[:120] if note else "", task_id)
        except Exception:
            pass
    return added, skipped


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

    # Which identity these assignees receive the task as (see _assign_users).
    target_role = req.target_role if req.target_role and can_assign(role, req.target_role) else None
    _assign_users(db, task_id, uid, role, req.assigned_user_ids, target_role,
                  req.title, req.instructions or "")

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
    target_role: Optional[str] = None  # identity they receive the task as


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

    if req.target_role and not can_assign(role, req.target_role):
        db.close()
        raise HTTPException(403, f"You cannot assign tasks to the {req.target_role} role")
    task = db.execute("SELECT title, instructions FROM tasks WHERE id=?", (task_id,)).fetchone()
    added, skipped = _assign_users(db, task_id, uid, role, req.user_ids, req.target_role,
                                   task["title"] if task else "a task",
                                   (task["instructions"] or "") if task else "")
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

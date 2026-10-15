from fastapi import APIRouter, Depends
from database import connect_db
from auth import get_current_user, TASK_CREATORS
from date_utils import is_overdue, task_deadline
from school_calendar import resolve_window, task_in_window, in_window

router = APIRouter(tags=["Dashboard"])

# Everything on the dashboard is derived from the same data — and the same
# rules — as the pages it summarizes:
#
#   * stat cards / My Task  → My Tasks + My Special Tasks: active tasks assigned
#     to the identity (role) the user is logged in as. An assignment is
#     "submitted" once a task_log entry or report exists (Task.isSubmitted),
#     "missing" when unsubmitted past its deadline (the overdue flag on My
#     Tasks), and "pending" otherwise.
#   * Task Manager          → active tasks the user created, with how many
#     assignees have submitted (task creators only).
#   * Pending Approval      → the Events module: proposals awaiting approval —
#     every one for approvers (principal/admin), otherwise the user's own.
#
# Principal/admin have no My Tasks page, so their stat cards summarize the
# assignments on the tasks they created instead.

_APPROVERS = ("principal", "admin")

_SUBMITTED = """(EXISTS (SELECT 1 FROM task_log tl
                         WHERE tl.task_id=ta.task_id AND tl.personnel_id=ta.user_id)
              OR EXISTS (SELECT 1 FROM reports r
                         WHERE r.task_id=ta.task_id AND r.personnel_id=ta.user_id))"""


def _assignments(db, where: str, params, window) -> list:
    """Active-task assignments matching `where` in the school-year window, each
    with its task's deadline fields and whether that assignee has submitted."""
    return [dict(r) for r in db.execute(
        f"""SELECT t.*, ta.user_id AS assignee_id, {_SUBMITTED} AS is_submitted
            FROM task_assignments ta JOIN tasks t ON t.id = ta.task_id
            WHERE t.status='active' AND {where}""", params).fetchall()
        if task_in_window(window, r)]


def _tally(rows: list) -> dict:
    submitted = sum(1 for r in rows if r["is_submitted"])
    missing = sum(1 for r in rows
                  if not r["is_submitted"] and is_overdue(r["end_date"], r["due_time"]))
    return {"submitted": submitted, "missing": missing,
            "pending": len(rows) - submitted - missing, "total_tasks": len(rows)}


def _by_deadline(task: dict):
    dl = task_deadline(task.get("end_date"), task.get("due_time"))
    return (dl is None, dl or 0, -task["id"])


@router.get("/api/dashboard")
def dashboard(user=Depends(get_current_user)):
    db = connect_db()
    try:
        uid = int(user["sub"])
        role = user["role"]
        # Like the pages it summarizes, the dashboard covers the current school
        # year; earlier years are archived.
        window = resolve_window(db, "current")

        # The user's own assigned work, for the identity they are logged in as
        # (same filter as GET /api/tasks?assigned=1).
        mine = _assignments(db, "ta.user_id=? AND (ta.target_role=? OR ta.target_role IS NULL)",
                            (uid, role), window)
        my_tasks = sorted((r for r in mine if not r["is_submitted"]), key=_by_deadline)[:5]

        task_manager_tasks = []
        team = []
        if role in TASK_CREATORS or role == "admin":
            team = _assignments(db, "t.created_by=?", (uid,), window)
            created = [r for r in db.execute(
                "SELECT * FROM tasks WHERE created_by=? AND status='active'", (uid,)
            ).fetchall() if task_in_window(window, r)]
            for t in sorted((dict(r) for r in created), key=_by_deadline)[:5]:
                rows = [r for r in team if r["id"] == t["id"]]
                t["team_total"] = len(rows)
                t["team_submitted"] = sum(1 for r in rows if r["is_submitted"])
                task_manager_tasks.append(t)

        stats = _tally(team if role in _APPROVERS else mine)

        if role in _APPROVERS:
            events = db.execute(
                "SELECT * FROM events WHERE status='pending_approval' ORDER BY created_at DESC"
            ).fetchall()
        else:
            events = db.execute(
                "SELECT * FROM events WHERE status='pending_approval' AND created_by=? "
                "ORDER BY created_at DESC", (uid,)
            ).fetchall()
        events = [e for e in events if in_window(window, e["target_date"], e["created_at"])]

        # Calendar markers: every open deadline behind the lists above.
        deadline_dates = sorted({
            dl.date().isoformat()
            for r in [*mine, *team] if not r["is_submitted"]
            if (dl := task_deadline(r["end_date"], r["due_time"]))
        })

        for r in my_tasks:
            r.pop("assignee_id", None)
            r.pop("is_submitted", None)
        return {
            **stats,
            "task_manager_tasks": task_manager_tasks,
            "my_tasks": my_tasks,
            "events": [dict(e) for e in events[:5]],
            "events_total": len(events),
            "deadline_dates": deadline_dates,
        }
    finally:
        db.close()

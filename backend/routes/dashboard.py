from fastapi import APIRouter, Depends
from database import get_db
from auth import get_current_user, TASK_CREATORS

router = APIRouter(tags=["Dashboard"])


@router.get("/api/dashboard")
def dashboard(user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    if role in TASK_CREATORS or role == "admin":
        total_tasks = db.execute(
            "SELECT COUNT(*) as c FROM tasks WHERE created_by=?", (uid,)
        ).fetchone()["c"]
        submitted = db.execute(
            """SELECT COUNT(*) as c FROM task_log tl
               JOIN tasks t ON t.id=tl.task_id WHERE t.created_by=?""",
            (uid,)
        ).fetchone()["c"]
        pending = db.execute(
            """SELECT COUNT(*) as c FROM submission_log sl
               WHERE sl.receiver_personnel_id=? AND sl.status='Pending'""",
            (uid,)
        ).fetchone()["c"]
        missing = db.execute(
            """SELECT COUNT(*) as c FROM reports r
               JOIN tasks t ON t.id=r.task_id
               WHERE t.created_by=? AND r.report_status='Missing'""",
            (uid,)
        ).fetchone()["c"]
        recent_tasks = db.execute(
            "SELECT * FROM tasks WHERE created_by=? ORDER BY created_at DESC LIMIT 5", (uid,)
        ).fetchall()
        events = db.execute(
            "SELECT * FROM activity_events ORDER BY event_date DESC LIMIT 5"
        ).fetchall()
        db.close()
        return {
            "total_tasks": total_tasks, "submitted": submitted,
            "pending": pending, "missing": missing,
            "task_manager_tasks": [dict(t) for t in recent_tasks],
            "my_tasks": [], "events": [dict(e) for e in events],
        }

    elif role in ("coordinator", "dean"):
        total_tasks = db.execute(
            "SELECT COUNT(*) as c FROM task_assignments WHERE user_id=?", (uid,)
        ).fetchone()["c"]
        submitted = db.execute(
            """SELECT COUNT(*) as c FROM task_log tl
               JOIN task_assignments ta ON ta.task_id=tl.task_id AND ta.user_id=tl.personnel_id
               WHERE ta.assigned_by=?""",
            (uid,)
        ).fetchone()["c"]
        pending = db.execute(
            "SELECT COUNT(*) as c FROM submission_log WHERE receiver_personnel_id=? AND status='Pending'",
            (uid,)
        ).fetchone()["c"]
        missing = db.execute(
            """SELECT COUNT(*) as c FROM reports r
               JOIN task_assignments ta ON ta.task_id=r.task_id AND ta.user_id=r.personnel_id
               WHERE ta.assigned_by=? AND r.report_status='Missing'""",
            (uid,)
        ).fetchone()["c"]
        my_tasks = db.execute(
            """SELECT t.* FROM tasks t
               JOIN task_assignments ta ON ta.task_id=t.id
               WHERE ta.user_id=? AND t.status='active'
               ORDER BY t.end_date LIMIT 5""",
            (uid,)
        ).fetchall()
        events = db.execute(
            "SELECT * FROM activity_events ORDER BY event_date DESC LIMIT 5"
        ).fetchall()
        db.close()
        return {
            "total_tasks": total_tasks, "submitted": submitted,
            "pending": pending, "missing": missing,
            "task_manager_tasks": [],
            "my_tasks": [dict(t) for t in my_tasks],
            "events": [dict(e) for e in events],
        }

    else:
        my_tasks = db.execute(
            """SELECT t.* FROM tasks t
               JOIN task_assignments ta ON ta.task_id=t.id
               WHERE ta.user_id=? AND t.status='active'
               ORDER BY t.end_date LIMIT 5""",
            (uid,)
        ).fetchall()
        submitted = db.execute(
            "SELECT COUNT(*) as c FROM task_log WHERE personnel_id=?", (uid,)
        ).fetchone()["c"]
        pending = db.execute(
            """SELECT COUNT(*) as c FROM task_assignments ta
               WHERE ta.user_id=?
               AND NOT EXISTS (
                   SELECT 1 FROM task_log tl
                   WHERE tl.task_id=ta.task_id AND tl.personnel_id=?
               )""",
            (uid, uid)
        ).fetchone()["c"]
        missing = db.execute(
            "SELECT COUNT(*) as c FROM reports WHERE personnel_id=? AND report_status='Missing'",
            (uid,)
        ).fetchone()["c"]
        events = db.execute(
            "SELECT * FROM activity_events ORDER BY event_date DESC LIMIT 5"
        ).fetchall()
        db.close()
        return {
            "total_tasks": submitted + pending, "submitted": submitted,
            "pending": pending, "missing": missing,
            "task_manager_tasks": [],
            "my_tasks": [dict(t) for t in my_tasks],
            "events": [dict(e) for e in events],
        }

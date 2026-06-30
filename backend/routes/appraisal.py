from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from database import get_db
from auth import require_appraisal_access

router = APIRouter(prefix="/api/appraisal", tags=["Appraisal"])


# ── Timing Points (report submission compliance) ──────────────────────────────
# All timing scoring is computed here in Python from the server-recorded
# submission time vs the task deadline — the frontend only renders the result.
TIMING_ON_TIME = 100
TIMING_LATE_24H = 50
TIMING_LATE_OVER = 0


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    """Parse the assorted date/time string shapes stored across the schema."""
    if not value or not str(value).strip():
        return None
    s = str(value).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d", "%I:%M %p", "%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _deadline_dt(end_date: Optional[str], due_time: Optional[str]) -> Optional[datetime]:
    d = _parse_dt(end_date)
    if d is None:
        return None
    t = _parse_dt(due_time)
    if t is not None:
        d = d.replace(hour=t.hour, minute=t.minute, second=t.second)
    else:
        d = d.replace(hour=23, minute=59, second=59)
    return d


def _compute_timing(submitted_at: Optional[str], end_date: Optional[str],
                    due_time: Optional[str]) -> tuple[str, int]:
    """(status, points): On Time=100, Late <=24h=50, Late >24h / Missing=0."""
    sub = _parse_dt(submitted_at)
    dl = _deadline_dt(end_date, due_time)
    if sub is None:
        return "Missing", TIMING_LATE_OVER
    if dl is None:
        return "On Time", TIMING_ON_TIME
    if sub <= dl:
        return "On Time", TIMING_ON_TIME
    if sub <= dl + timedelta(hours=24):
        return "Late within 24 hours", TIMING_LATE_24H
    return "Late after 24 hours", TIMING_LATE_OVER


@router.get("/report-submissions")
def list_report_submissions(db=Depends(get_db), user=Depends(require_appraisal_access)):
    """Report submissions with server-computed timing status/points, for the
    Timing Points tab. Timing is derived from the submission time vs the task
    deadline (end_date + due_time)."""
    rows = db.execute(
        """SELECT sl.id, sl.report_id, sl.date_of_submission,
                  r.report_title, r.task_id,
                  t.title AS task_title, t.end_date, t.due_time,
                  u.full_name AS personnel_name, u.role AS personnel_role,
                  gl.grade_level AS personnel_department
           FROM submission_log sl
           JOIN reports r ON r.id = sl.report_id
           JOIN tasks t ON t.id = r.task_id
           JOIN users u ON u.id = sl.sender_personnel_id
           LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
           ORDER BY sl.date_of_submission DESC"""
    ).fetchall()

    out = []
    for r in rows:
        d = dict(r)
        status, points = _compute_timing(d["date_of_submission"], d["end_date"], d["due_time"])
        dl = _deadline_dt(d["end_date"], d["due_time"])
        out.append({
            "id": d["id"],
            "report_id": d["report_id"],
            "task_id": d["task_id"],
            "task_name": d["task_title"] or d["report_title"],
            "personnel_name": d["personnel_name"] or "Unknown",
            "personnel_department": d["personnel_department"],
            "deadline": dl.strftime("%Y-%m-%d %H:%M:%S") if dl else None,
            "submitted_at": d["date_of_submission"],
            "timing_status": status,
            "timing_points": points,
            # Report rubric scoring is not captured in this backend yet.
            "content_quality_score": None,
            "format_compliance_score": None,
            "completeness_score": None,
        })
    return out


# ── Helpers ───────────────────────────────────────────────────────────────────

def _special_task_row(row, db):
    d = dict(row)
    assignee = db.execute(
        """SELECT u.id, u.full_name, u.role, gl.grade_level
           FROM users u LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
           WHERE u.id=?""", (d.get("assignee_id"),)
    ).fetchone()
    d["assignee"] = dict(assignee) if assignee else None
    assigner = db.execute(
        "SELECT id, full_name FROM users WHERE id=?", (d.get("assigned_by"),)
    ).fetchone()
    d["assigner"] = dict(assigner) if assigner else None
    ev = db.execute(
        "SELECT * FROM special_task_evaluations WHERE task_id=?", (d["id"],)
    ).fetchone()
    d["evaluation"] = dict(ev) if ev else None
    return d


def _event_evaluation_row(event_row, db):
    """Format an event with its evaluations for appraisal view."""
    d = dict(event_row)
    organizer = db.execute(
        "SELECT id, full_name FROM users WHERE id=?", (d.get("created_by"),)
    ).fetchone()
    d["organizer"] = dict(organizer) if organizer else None
    d["evaluations"] = [dict(r) for r in db.execute(
        "SELECT * FROM event_evaluations WHERE event_id=? ORDER BY date_submitted DESC",
        (d["id"],)
    ).fetchall()]
    return d


# ── Special Tasks ─────────────────────────────────────────────────────────────

class SpecialTaskBody(BaseModel):
    title: str
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    due_date: Optional[str] = None


class SpecialTaskEvalBody(BaseModel):
    completion_quality_score: int
    timeliness_score: int
    initiative_score: int
    coordination_score: int
    remarks: Optional[str] = None


@router.get("/special-tasks")
def list_special_tasks(db=Depends(get_db), user=Depends(require_appraisal_access)):
    rows = db.execute("SELECT * FROM special_tasks ORDER BY created_at DESC").fetchall()
    return [_special_task_row(r, db) for r in rows]


@router.post("/special-tasks", status_code=201)
def create_special_task(body: SpecialTaskBody, db=Depends(get_db),
                        user=Depends(require_appraisal_access)):
    uid = int(user["sub"])
    db.execute(
        """INSERT INTO special_tasks (title, description, assignee_id, assigned_by, due_date)
           VALUES (?,?,?,?,?)""",
        (body.title, body.description, body.assignee_id, uid, body.due_date)
    )
    db.commit()
    row = db.execute("SELECT * FROM special_tasks ORDER BY id DESC LIMIT 1").fetchone()
    return _special_task_row(row, db)


@router.post("/special-tasks/{task_id}/evaluate")
def evaluate_special_task(task_id: int, body: SpecialTaskEvalBody,
                          db=Depends(get_db), user=Depends(require_appraisal_access)):
    row = db.execute("SELECT * FROM special_tasks WHERE id=?", (task_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Special task not found")
    scores = [body.completion_quality_score, body.timeliness_score,
              body.initiative_score, body.coordination_score]
    weights = [0.40, 0.30, 0.30, 0.00]
    weighted_avg = sum(s * w for s, w in zip(scores, weights))
    uid = int(user["sub"])
    db.execute(
        """INSERT INTO special_task_evaluations
           (task_id, evaluator_id, completion_quality_score, timeliness_score,
            initiative_score, coordination_score, weighted_average, remarks)
           VALUES (?,?,?,?,?,?,?,?)
           ON CONFLICT(task_id) DO UPDATE SET
             evaluator_id=excluded.evaluator_id,
             completion_quality_score=excluded.completion_quality_score,
             timeliness_score=excluded.timeliness_score,
             initiative_score=excluded.initiative_score,
             coordination_score=excluded.coordination_score,
             weighted_average=excluded.weighted_average,
             remarks=excluded.remarks,
             evaluated_at=CURRENT_TIMESTAMP""",
        (task_id, uid, body.completion_quality_score, body.timeliness_score,
         body.initiative_score, body.coordination_score, weighted_avg, body.remarks)
    )
    db.execute("UPDATE special_tasks SET status='evaluated' WHERE id=?", (task_id,))
    db.commit()
    return _special_task_row(
        db.execute("SELECT * FROM special_tasks WHERE id=?", (task_id,)).fetchone(), db
    )


# ── Event Evaluation (appraisal rubric on EVENTS) ──────────────────────────────

class EventEvalBody(BaseModel):
    evaluator_name: str
    evaluator_role: Optional[str] = None
    planning_score: int
    objectives_score: int
    personnel_score: int
    time_mgmt_score: int
    engagement_score: int
    resource_score: int
    feedback_comments: Optional[str] = None


@router.get("/events")
def list_events_for_evaluation(db=Depends(get_db), user=Depends(require_appraisal_access)):
    """List events available for evaluation."""
    rows = db.execute(
        "SELECT * FROM events WHERE status != 'draft' ORDER BY target_date DESC"
    ).fetchall()
    return [_event_evaluation_row(r, db) for r in rows]


@router.get("/events/{event_id}")
def get_event_for_evaluation(event_id: int, db=Depends(get_db),
                             user=Depends(require_appraisal_access)):
    """Get single event with all evaluations."""
    row = db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    return _event_evaluation_row(row, db)


@router.post("/events/{event_id}/evaluate", status_code=201)
def evaluate_event(event_id: int, body: EventEvalBody, db=Depends(get_db),
                   user=Depends(require_appraisal_access)):
    """Submit a supervisor evaluation rubric for an event."""
    row = db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")

    # Validate scores are in range [0,5]
    scores = [body.planning_score, body.objectives_score, body.personnel_score,
              body.time_mgmt_score, body.engagement_score, body.resource_score]
    if not all(0 <= s <= 5 for s in scores):
        raise HTTPException(400, "All scores must be between 0 and 5")

    uid = int(user["sub"])
    db.execute(
        """INSERT INTO event_evaluations
           (event_id, evaluator_id, evaluator_name, evaluator_role,
            planning_score, objectives_score, personnel_score,
            time_mgmt_score, engagement_score, resource_score, feedback_comments)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (event_id, uid, body.evaluator_name.strip(), body.evaluator_role,
         body.planning_score, body.objectives_score, body.personnel_score,
         body.time_mgmt_score, body.engagement_score, body.resource_score,
         body.feedback_comments.strip() if body.feedback_comments else None)
    )
    db.commit()
    return _event_evaluation_row(
        db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone(), db
    )

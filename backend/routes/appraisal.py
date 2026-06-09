from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from database import get_db
from auth import require_appraisal_access

router = APIRouter(prefix="/api/appraisal", tags=["Appraisal"])


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


def _school_event_row(row, db):
    d = dict(row)
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


# ── School Events ─────────────────────────────────────────────────────────────

class SchoolEventBody(BaseModel):
    title: str
    description: Optional[str] = None
    event_date: Optional[str] = None


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
def list_school_events(db=Depends(get_db), user=Depends(require_appraisal_access)):
    rows = db.execute("SELECT * FROM school_events ORDER BY event_date DESC").fetchall()
    return [_school_event_row(r, db) for r in rows]


@router.post("/events", status_code=201)
def create_school_event(body: SchoolEventBody, db=Depends(get_db),
                        user=Depends(require_appraisal_access)):
    uid = int(user["sub"])
    db.execute(
        "INSERT INTO school_events (title, description, event_date, created_by) VALUES (?,?,?,?)",
        (body.title, body.description, body.event_date, uid)
    )
    db.commit()
    row = db.execute("SELECT * FROM school_events ORDER BY id DESC LIMIT 1").fetchone()
    return _school_event_row(row, db)


@router.post("/events/{event_id}/evaluate")
def evaluate_school_event(event_id: int, body: EventEvalBody,
                          db=Depends(get_db), user=Depends(require_appraisal_access)):
    row = db.execute("SELECT * FROM school_events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    uid = int(user["sub"])
    db.execute(
        """INSERT INTO event_evaluations
           (event_id, evaluator_id, evaluator_name, evaluator_role,
            planning_score, objectives_score, personnel_score,
            time_mgmt_score, engagement_score, resource_score, feedback_comments)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (event_id, uid, body.evaluator_name, body.evaluator_role,
         body.planning_score, body.objectives_score, body.personnel_score,
         body.time_mgmt_score, body.engagement_score, body.resource_score,
         body.feedback_comments)
    )
    db.commit()
    return _school_event_row(
        db.execute("SELECT * FROM school_events WHERE id=?", (event_id,)).fetchone(), db
    )

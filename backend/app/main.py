"""
Personnel Appraisal Module — FastAPI Application
All endpoints aligned to the data dictionary and paper SRS.

Endpoints:
  GET  /health
  GET  /special-tasks
  GET  /special-tasks/{task_id}
  POST /special-tasks/{task_id}/evaluate

  GET  /events
  GET  /events/{event_id}
  GET  /events/{event_id}/results
  POST /events/{event_id}/evaluate

  POST /report-submissions
  GET  /report-submissions/{submission_id}

  GET  /appraisal-records
  GET  /appraisal-records/{appraisal_id}
  PATCH /appraisal-records/{appraisal_id}/lock
  PATCH /appraisal-records/{appraisal_id}/archive

  GET  /performance-summaries
  GET  /performance-summaries/{summary_id}
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .models import (
    AppraisalRecord,
    AppraisalRecordOut,
    Base,
    Event,
    EventEvaluation,
    EventEvaluationIn,
    EventEvaluationOut,
    EventOut,
    PerformanceSummary,
    PerformanceSummaryOut,
    ReportSubmission,
    ReportSubmissionIn,
    ReportSubmissionOut,
    SpecialTask,
    SpecialTaskEvaluation,
    SpecialTaskEvaluationIn,
    SpecialTaskEvaluationOut,
    SpecialTaskOut,
    User,
)

# ─────────────────────────────────────────────────────────────────────────────
# App & CORS
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Personnel Appraisal API",
    description="Task & Event Management System — Naga Central School II",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────────────────────────────────────

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./dev.db")
_connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
engine = create_engine(DATABASE_URL, echo=False, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def _compute_weighted_average(
    completion: int, timeliness: int, initiative: int, coordination: int
) -> float:
    """
    Weighted average [0.00–5.00]
    Weights: completion 35% | timeliness 30% | initiative 20% | coordination 15%
    """
    return round(
        completion  * 0.35 +
        timeliness  * 0.30 +
        initiative  * 0.20 +
        coordination * 0.15,
        2,
    )


def _weighted_avg_to_score(weighted_avg: float) -> int:
    """Convert [0.00–5.00] weighted avg to [0–100] score."""
    return round(weighted_avg * 20)


def _compute_timing(submitted_at: str, deadline: str) -> tuple[str, int]:
    """
    Returns (timing_status, timing_points) per paper SRS:
      Early              → 150
      On Time            → 100
      Late within 24h    →  50
      Late after 24h     →   0
    """
    fmt = "%Y-%m-%d %H:%M:%S"
    try:
        sub = datetime.strptime(submitted_at, fmt)
        dl  = datetime.strptime(deadline,     fmt)
    except ValueError:
        return "Not Submitted", 0

    delta_hours = (sub - dl).total_seconds() / 3600

    if delta_hours < -1:           # submitted more than 1 hour before deadline
        return "Early", 150
    elif delta_hours <= 0:
        return "On Time", 100
    elif delta_hours <= 24:
        return "Late within 24 hours", 50
    else:
        return "Late after 24 hours", 0


def _event_status_from_avg(avg: Optional[float]) -> str:
    if avg is None:
        return "awaitingRatings"
    return "flagged" if avg < 3.0 else "rated"


def _appraisal_grade(total_points: float) -> str:
    """RPMS/DepEd scale."""
    if total_points >= 90:
        return "Outstanding"
    elif total_points >= 75:
        return "Very Satisfactory"
    elif total_points >= 60:
        return "Satisfactory"
    else:
        return "Unsatisfactory"


def _star_rating_from_points(total_points: float) -> float:
    """Convert 0–100 score to 1.0–5.0 star rating."""
    return round((total_points / 100) * 4 + 1, 1)


def _upsert_appraisal_record(
    db: Session,
    *,
    personnel_id: Optional[int],
    appraisal_type: str,
    reference_id: int,
    total_points: float,
) -> AppraisalRecord:
    """Create or update an AppraisalRecord for this reference."""
    rec = db.query(AppraisalRecord).filter(
        AppraisalRecord.reference_id == reference_id,
        AppraisalRecord.appraisal_type == appraisal_type,
    ).first()

    star = _star_rating_from_points(total_points)
    appraisal_status = "Flagged" if star < 3.0 else "Completed"

    if rec:
        if rec.is_locked:
            return rec   # locked records are not modified
        rec.total_points     = total_points
        rec.star_rating      = star
        rec.appraisal_status = appraisal_status
    else:
        rec = AppraisalRecord(
            personnel_id     = personnel_id,
            appraisal_type   = appraisal_type,
            reference_id     = reference_id,
            total_points     = total_points,
            star_rating      = star,
            appraisal_status = appraisal_status,
            is_locked        = False,
            is_archived      = False,
            date_created     = _now(),
        )
        db.add(rec)

    db.flush()
    return rec


# ─────────────────────────────────────────────────────────────────────────────
# Startup / seed
# ─────────────────────────────────────────────────────────────────────────────

@app.on_event("startup")
def on_startup():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _seed_users(db)
        _seed_special_tasks(db)
        _seed_events(db)
    finally:
        db.close()


def _seed_users(db: Session):
    if db.query(User).count() > 0:
        return
    users = [
        User(name="Dr. Rivera",    role="Coordinator", department="Engineering"),
        User(name="Dr. Cruz",      role="Coordinator", department="Business"),
        User(name="Dr. Santos",    role="Coordinator", department="Sciences"),
        User(name="Dr. Reyes",     role="Coordinator", department="Humanities"),
        User(name="Dr. Lopez",     role="Coordinator", department="HR & Training"),
        User(name="John Smith",    role="Teacher",     department="Engineering"),
        User(name="Sarah Johnson", role="Teacher",     department="Business"),
        User(name="Mike Chen",     role="Teacher",     department="Sciences"),
        User(name="Alice Brown",   role="Teacher",     department="Humanities"),
        User(name="David Lee",     role="Teacher",     department="HR & Training"),
        User(name="Maria Santos",  role="Teacher",     department="Sciences"),
        User(name="Student A",     role="Student",     department=None),
        User(name="Student B",     role="Student",     department=None),
        User(name="Prof. Garcia",  role="Teacher",     department="Sciences"),
    ]
    db.add_all(users)
    db.commit()


def _seed_special_tasks(db: Session):
    if db.query(SpecialTask).count() > 0:
        return
    tasks = [
        SpecialTask(id="ST001", personnel="John Smith",    department="Engineering",
                    task="Curriculum Review Documentation",
                    assigned_by="Dr. Rivera", due_date="2025-04-15",
                    submitted_date="2025-04-14", status="pending", score=None),
        SpecialTask(id="ST002", personnel="Sarah Johnson", department="Business",
                    task="Faculty Development Workshop Facilitation",
                    assigned_by="Dr. Cruz",   due_date="2025-04-10",
                    submitted_date="2025-04-11", status="evaluated", score=67),
        SpecialTask(id="ST003", personnel="Mike Chen",     department="Sciences",
                    task="Laboratory Safety Compliance Report",
                    assigned_by="Dr. Santos", due_date="2025-04-05",
                    submitted_date="2025-04-03", status="evaluated", score=100),
        SpecialTask(id="ST004", personnel="Alice Brown",   department="Humanities",
                    task="Research Output Documentation",
                    assigned_by="Dr. Reyes",  due_date="2025-03-30",
                    submitted_date=None,        status="flagged",   score=28),
        SpecialTask(id="ST005", personnel="John Smith",    department="Engineering",
                    task="Faculty Development Workshop Facilitation",
                    assigned_by="Dr. Rivera", due_date="2025-04-20",
                    submitted_date="2025-04-19", status="evaluated", score=88),
        SpecialTask(id="ST006", personnel="Sarah Johnson", department="Business",
                    task="Laboratory Safety Compliance Report",
                    assigned_by="Dr. Cruz",   due_date="2025-04-25",
                    submitted_date=None,        status="notSubmitted", score=None),
    ]
    db.add_all(tasks)
    db.commit()

    # Seed existing evaluations for ST002–ST005
    evals = [
        SpecialTaskEvaluation(
            task_id="ST002", completion_quality_score=4, timeliness_score=3,
            initiative_score=3, coordination_score=4,
            weighted_average=_compute_weighted_average(4,3,3,4),
            is_flagged=False, remarks="Good performance. Timeliness needs improvement.",
            date_submitted="2025-04-12 09:30:00",
        ),
        SpecialTaskEvaluation(
            task_id="ST003", completion_quality_score=5, timeliness_score=5,
            initiative_score=5, coordination_score=5,
            weighted_average=5.0, is_flagged=False,
            remarks="Exceptional. Exceeded all expectations.",
            date_submitted="2025-04-04 14:00:00",
        ),
        SpecialTaskEvaluation(
            task_id="ST004", completion_quality_score=1, timeliness_score=1,
            initiative_score=2, coordination_score=2,
            weighted_average=_compute_weighted_average(1,1,2,2),
            is_flagged=True, remarks="Task not submitted. Significant deficiencies.",
            date_submitted="2025-04-01 10:00:00",
        ),
        SpecialTaskEvaluation(
            task_id="ST005", completion_quality_score=5, timeliness_score=4,
            initiative_score=4, coordination_score=4,
            weighted_average=_compute_weighted_average(5,4,4,4),
            is_flagged=False, remarks="Well executed.",
            date_submitted="2025-04-20 16:00:00",
        ),
    ]
    db.add_all(evals)
    db.commit()


def _seed_events(db: Session):
    if db.query(Event).count() > 0:
        return
    events = [
        Event(id="EV001", name="Leadership Seminar 2025",          date="2025-04-20",
              organizer="David Lee",    department="HR & Training", attendees=250, status="rated"),
        Event(id="EV002", name="Science Fair Coordination",         date="2025-04-10",
              organizer="Maria Santos", department="Sciences",      attendees=180, status="flagged"),
        Event(id="EV003", name="Tech Innovation Summit",            date="2025-05-05",
              organizer="Robert Cruz",  department="Engineering",   attendees=120, status="awaitingRatings"),
        Event(id="EV004", name="Professional Development Workshop", date="2025-04-25",
              organizer="Jennifer Park",department="Business",      attendees=80,  status="rated"),
    ]
    db.add_all(events)
    db.commit()

    # Seed evaluations for EV001 (Leadership Seminar)
    ev001_evals = [
        EventEvaluation(
            event_id="EV001", evaluator_name="Student A", evaluator_role="Student",
            planning_score=5, objectives_score=5, personnel_score=5,
            time_mgmt_score=4, engagement_score=5, resource_score=4,
            template_used=True, date_submitted="2025-04-21 10:00:00",
        ),
        EventEvaluation(
            event_id="EV001", evaluator_name="Student B", evaluator_role="Student",
            planning_score=4, objectives_score=4, personnel_score=4,
            time_mgmt_score=5, engagement_score=4, resource_score=4,
            template_used=True, date_submitted="2025-04-21 10:30:00",
        ),
        EventEvaluation(
            event_id="EV001", evaluator_name="Prof. Garcia", evaluator_role="Teacher",
            planning_score=5, objectives_score=5, personnel_score=5,
            time_mgmt_score=5, engagement_score=5, resource_score=5,
            template_used=True, feedback_comments="Excellent seminar.",
            date_submitted="2025-04-21 11:00:00",
        ),
    ]
    # EV002 (flagged — low scores)
    ev002_evals = [
        EventEvaluation(
            event_id="EV002", evaluator_name="Student C", evaluator_role="Student",
            planning_score=2, objectives_score=2, personnel_score=3,
            time_mgmt_score=2, engagement_score=2, resource_score=3,
            template_used=False, feedback_comments="Poorly organized.",
            date_submitted="2025-04-11 09:00:00",
        ),
        EventEvaluation(
            event_id="EV002", evaluator_name="Teacher B", evaluator_role="Teacher",
            planning_score=3, objectives_score=2, personnel_score=2,
            time_mgmt_score=3, engagement_score=2, resource_score=2,
            template_used=False, date_submitted="2025-04-11 10:00:00",
        ),
    ]
    # EV004 (Professional Development Workshop)
    ev004_evals = [
        EventEvaluation(
            event_id="EV004", evaluator_name="Dean Lopez", evaluator_role="Dean",
            planning_score=4, objectives_score=5, personnel_score=4,
            time_mgmt_score=4, engagement_score=4, resource_score=5,
            template_used=True, feedback_comments="Very informative.",
            date_submitted="2025-04-26 08:00:00",
        ),
        EventEvaluation(
            event_id="EV004", evaluator_name="Teacher C", evaluator_role="Teacher",
            planning_score=4, objectives_score=4, personnel_score=4,
            time_mgmt_score=5, engagement_score=4, resource_score=4,
            template_used=True, date_submitted="2025-04-26 08:30:00",
        ),
        EventEvaluation(
            event_id="EV004", evaluator_name="Teacher D", evaluator_role="Teacher",
            planning_score=5, objectives_score=4, personnel_score=5,
            time_mgmt_score=4, engagement_score=5, resource_score=4,
            template_used=True, date_submitted="2025-04-26 09:00:00",
        ),
        EventEvaluation(
            event_id="EV004", evaluator_name="Student D", evaluator_role="Student",
            planning_score=4, objectives_score=4, personnel_score=4,
            time_mgmt_score=4, engagement_score=4, resource_score=4,
            template_used=True, date_submitted="2025-04-26 09:30:00",
        ),
    ]
    db.add_all(ev001_evals + ev002_evals + ev004_evals)
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Routes — Health
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "time": _now()}


# ─────────────────────────────────────────────────────────────────────────────
# Routes — Special Tasks
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/special-tasks", response_model=List[SpecialTaskOut], tags=["Special Tasks"])
def list_special_tasks(db: Session = Depends(get_db)):
    return db.query(SpecialTask).all()


@app.get("/special-tasks/{task_id}", tags=["Special Tasks"])
def get_special_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(SpecialTask).filter(SpecialTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    evaluation = db.query(SpecialTaskEvaluation).filter(
        SpecialTaskEvaluation.task_id == task_id
    ).first()
    return {"task": SpecialTaskOut.model_validate(task), "evaluation": evaluation}


@app.post("/special-tasks/{task_id}/evaluate", tags=["Special Tasks"])
def evaluate_special_task(
    task_id: str,
    payload: SpecialTaskEvaluationIn,
    db: Session = Depends(get_db),
):
    """
    UC003 — Coordinator evaluates a special task assigned to Dean.
    Computes weighted_average and is_flagged automatically.
    Creates/updates AppraisalRecord on success.
    """
    task = db.query(SpecialTask).filter(SpecialTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Compute derived fields
    wa    = _compute_weighted_average(
        payload.completion_quality_score,
        payload.timeliness_score,
        payload.initiative_score,
        payload.coordination_score,
    )
    score     = _weighted_avg_to_score(wa)
    is_flagged = wa < 3.0

    # Upsert evaluation
    existing = db.query(SpecialTaskEvaluation).filter(
        SpecialTaskEvaluation.task_id == task_id
    ).first()

    if existing:
        existing.personnel_id             = payload.personnel_id
        existing.coordinator_id           = payload.coordinator_id
        existing.completion_quality_score = payload.completion_quality_score
        existing.timeliness_score         = payload.timeliness_score
        existing.initiative_score         = payload.initiative_score
        existing.coordination_score       = payload.coordination_score
        existing.weighted_average         = wa
        existing.is_flagged               = is_flagged
        existing.remarks                  = payload.remarks
        existing.date_submitted           = _now()
        eval_obj = existing
    else:
        eval_obj = SpecialTaskEvaluation(
            task_id                  = task_id,
            personnel_id             = payload.personnel_id,
            coordinator_id           = payload.coordinator_id,
            completion_quality_score = payload.completion_quality_score,
            timeliness_score         = payload.timeliness_score,
            initiative_score         = payload.initiative_score,
            coordination_score       = payload.coordination_score,
            weighted_average         = wa,
            is_flagged               = is_flagged,
            remarks                  = payload.remarks,
            date_submitted           = _now(),
        )
        db.add(eval_obj)

    db.flush()

    # Update SpecialTask status & score
    task.score  = score
    task.status = "flagged" if is_flagged else "evaluated"
    db.add(task)

    # Upsert AppraisalRecord (UC003 step 9)
    _upsert_appraisal_record(
        db,
        personnel_id   = payload.personnel_id,
        appraisal_type = "Special Task",
        reference_id   = eval_obj.special_task_eval_id,
        total_points   = float(score),
    )

    db.commit()
    db.refresh(task)

    return {
        "task":       SpecialTaskOut.model_validate(task),
        "evaluation": SpecialTaskEvaluationOut.model_validate(eval_obj),
        "score":      score,
        "is_flagged": is_flagged,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Routes — Events
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/events", response_model=List[EventOut], tags=["Events"])
def list_events(db: Session = Depends(get_db)):
    return db.query(Event).all()


@app.get("/events/{event_id}", tags=["Events"])
def get_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    evaluations = db.query(EventEvaluation).filter(
        EventEvaluation.event_id == event_id
    ).all()
    avg = (
        sum(e.average_score for e in evaluations) / len(evaluations)
        if evaluations else None
    )
    return {
        "event":        EventOut.model_validate(event),
        "responses":    len(evaluations),
        "avg_rating":   round(avg, 2) if avg is not None else None,
        "evaluations":  [EventEvaluationOut.model_validate(e) for e in evaluations],
    }


@app.get("/events/{event_id}/results", tags=["Events"])
def get_event_results(event_id: str, db: Session = Depends(get_db)):
    """
    Aggregated rubric scores per criterion — feeds the radar chart.
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    evals = db.query(EventEvaluation).filter(
        EventEvaluation.event_id == event_id
    ).all()

    if not evals:
        return {"event_id": event_id, "raters": 0, "avg_overall": None, "criteria": {}}

    n = len(evals)
    criteria = {
        "planning_score":   round(sum(e.planning_score   for e in evals) / n, 2),
        "objectives_score": round(sum(e.objectives_score for e in evals) / n, 2),
        "personnel_score":  round(sum(e.personnel_score  for e in evals) / n, 2),
        "time_mgmt_score":  round(sum(e.time_mgmt_score  for e in evals) / n, 2),
        "engagement_score": round(sum(e.engagement_score for e in evals) / n, 2),
        "resource_score":   round(sum(e.resource_score   for e in evals) / n, 2),
    }
    avg_overall = round(sum(criteria.values()) / 6, 2)

    return {
        "event_id":    event_id,
        "raters":      n,
        "avg_overall": avg_overall,
        "criteria":    criteria,
        "attendee_ratings": [
            {
                "name":         e.evaluator_name,
                "role":         e.evaluator_role,
                "overall_score": round(e.average_score, 2),
                "date_submitted": e.date_submitted,
            }
            for e in evals
        ],
    }


@app.post("/events/{event_id}/evaluate", tags=["Events"])
def evaluate_event(
    event_id: str,
    payload: EventEvaluationIn,
    db: Session = Depends(get_db),
):
    """
    UC002 — Attendee submits event evaluation form.
    All 6 rubric criteria are required [1–5].
    Computes average score, updates event status, creates AppraisalRecord.
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Create evaluation record
    eval_obj = EventEvaluation(
        event_id         = event_id,
        evaluator_id     = payload.evaluator_id,
        evaluator_name   = payload.evaluator_name,
        evaluator_role   = payload.evaluator_role,
        planning_score   = payload.planning_score,
        objectives_score = payload.objectives_score,
        personnel_score  = payload.personnel_score,
        time_mgmt_score  = payload.time_mgmt_score,
        engagement_score = payload.engagement_score,
        resource_score   = payload.resource_score,
        template_used    = payload.template_used,
        feedback_comments= payload.feedback_comments,
        date_submitted   = _now(),
    )
    db.add(eval_obj)
    db.flush()

    # Recompute event average & update status
    all_evals = db.query(EventEvaluation).filter(
        EventEvaluation.event_id == event_id
    ).all()
    avg = sum(e.average_score for e in all_evals) / len(all_evals)
    event.status = _event_status_from_avg(avg)
    db.add(event)

    # Score out of 100 for AppraisalRecord (avg/5 × 100)
    total_points = round((avg / 5.0) * 100, 2)

    # Upsert AppraisalRecord (UC002 step 7)
    _upsert_appraisal_record(
        db,
        personnel_id   = payload.evaluator_id,
        appraisal_type = "Event",
        reference_id   = eval_obj.evaluation_id,
        total_points   = total_points,
    )

    db.commit()
    db.refresh(eval_obj)

    return {
        "evaluation":      EventEvaluationOut.model_validate(eval_obj),
        "avg_score":       round(eval_obj.average_score, 2),
        "event_avg":       round(avg, 2),
        "event_status":    event.status,
        "total_responses": len(all_evals),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Routes — Report Submissions  (UC001)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/report-submissions", response_model=ReportSubmissionOut, tags=["Reports"])
def submit_report(payload: ReportSubmissionIn, db: Session = Depends(get_db)):
    """
    UC001 — System computes timing points using server time vs deadline.
    Timing point values (paper SRS): Early=150, On Time=100, Late≤24h=50, Late>24h=0
    """
    submitted_at             = _now()
    timing_status, timing_pts = _compute_timing(submitted_at, payload.deadline)

    sub = ReportSubmission(
        report_id               = payload.report_id,
        personnel_id            = payload.personnel_id,
        deadline                = payload.deadline,
        submitted_at            = submitted_at,
        timing_status           = timing_status,
        timing_points           = timing_pts,
        content_quality_score   = payload.content_quality_score,
        format_compliance_score = payload.format_compliance_score,
        completeness_score      = payload.completeness_score,
    )
    db.add(sub)
    db.flush()

    # Compute total_points for AppraisalRecord
    rubric_avg   = (payload.content_quality_score +
                    payload.format_compliance_score +
                    payload.completeness_score) / 3.0
    rubric_pts   = (rubric_avg / 5.0) * 70           # rubric = 70% of score
    timing_pct   = (timing_pts / 150.0) * 30         # timing = 30% of score
    total_points = round(rubric_pts + timing_pct, 2)

    _upsert_appraisal_record(
        db,
        personnel_id   = payload.personnel_id,
        appraisal_type = "Report",
        reference_id   = sub.submission_id,
        total_points   = total_points,
    )

    db.commit()
    db.refresh(sub)
    return sub


@app.get("/report-submissions/{submission_id}",
         response_model=ReportSubmissionOut, tags=["Reports"])
def get_report_submission(submission_id: int, db: Session = Depends(get_db)):
    sub = db.query(ReportSubmission).filter(
        ReportSubmission.submission_id == submission_id
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    return sub


# ─────────────────────────────────────────────────────────────────────────────
# Routes — Appraisal Records
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/appraisal-records", response_model=List[AppraisalRecordOut], tags=["Appraisal Records"])
def list_appraisal_records(
    personnel_id:    Optional[int] = None,
    appraisal_type:  Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(AppraisalRecord)
    if personnel_id:
        q = q.filter(AppraisalRecord.personnel_id == personnel_id)
    if appraisal_type:
        q = q.filter(AppraisalRecord.appraisal_type == appraisal_type)
    return q.all()


@app.get("/appraisal-records/{appraisal_id}",
         response_model=AppraisalRecordOut, tags=["Appraisal Records"])
def get_appraisal_record(appraisal_id: int, db: Session = Depends(get_db)):
    rec = db.query(AppraisalRecord).filter(
        AppraisalRecord.appraisal_id == appraisal_id
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Appraisal record not found")
    return rec


@app.patch("/appraisal-records/{appraisal_id}/lock", tags=["Appraisal Records"])
def lock_appraisal(appraisal_id: int, db: Session = Depends(get_db)):
    """Lock an appraisal record — locked records cannot be modified."""
    rec = db.query(AppraisalRecord).filter(
        AppraisalRecord.appraisal_id == appraisal_id
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")
    rec.is_locked = True
    db.commit()
    return {"appraisal_id": appraisal_id, "is_locked": True}


@app.patch("/appraisal-records/{appraisal_id}/archive", tags=["Appraisal Records"])
def archive_appraisal(appraisal_id: int, db: Session = Depends(get_db)):
    """Archive an appraisal record — moves it to historical records."""
    rec = db.query(AppraisalRecord).filter(
        AppraisalRecord.appraisal_id == appraisal_id
    ).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")
    rec.is_archived = True
    db.commit()
    return {"appraisal_id": appraisal_id, "is_archived": True}


# ─────────────────────────────────────────────────────────────────────────────
# Routes — Performance Summaries
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/performance-summaries", response_model=List[PerformanceSummaryOut], tags=["Performance"])
def list_summaries(
    personnel_id: Optional[int] = None,
    period:       Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(PerformanceSummary)
    if personnel_id:
        q = q.filter(PerformanceSummary.personnel_id == personnel_id)
    if period:
        q = q.filter(PerformanceSummary.period == period)
    return q.all()


@app.get("/performance-summaries/{summary_id}",
         response_model=PerformanceSummaryOut, tags=["Performance"])
def get_summary(summary_id: int, db: Session = Depends(get_db)):
    s = db.query(PerformanceSummary).filter(
        PerformanceSummary.summary_id == summary_id
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Summary not found")
    return s


@app.post("/performance-summaries/generate", tags=["Performance"])
def generate_summary(
    personnel_id: int,
    period: str,        # YYYY-MM
    db: Session = Depends(get_db),
):
    """
    Generate (or refresh) a PerformanceSummary for a given personnel + period.
    Aggregates all AppraisalRecords for that period.
    """
    month_start = f"{period}-01 00:00:00"
    month_end   = f"{period}-31 23:59:59"

    records = db.query(AppraisalRecord).filter(
        AppraisalRecord.personnel_id == personnel_id,
        AppraisalRecord.date_created >= month_start,
        AppraisalRecord.date_created <= month_end,
        AppraisalRecord.is_archived  == False,
    ).all()

    if not records:
        raise HTTPException(status_code=404, detail="No appraisal records found for this period")

    total_pts   = round(sum(r.total_points for r in records) / len(records), 2)
    escalations = sum(1 for r in records if r.appraisal_status == "Flagged")

    event_records = [r for r in records if r.appraisal_type == "Event"]
    task_records  = [r for r in records if r.appraisal_type == "Special Task"]
    rpt_records   = [r for r in records if r.appraisal_type == "Report"]

    avg_event = (sum(r.total_points for r in event_records) / len(event_records)
                 if event_records else None)
    avg_task  = (sum(r.total_points for r in task_records)  / len(task_records)
                 if task_records else None)

    # timing points: sum the actual timing_points from ReportSubmission records
    rpt_timing = 0
    for rr in rpt_records:
        sub = db.query(ReportSubmission).filter(
            ReportSubmission.submission_id == rr.reference_id
        ).first()
        if sub:
            rpt_timing += sub.timing_points

    grade = _appraisal_grade(total_pts)

    # Upsert summary
    existing = db.query(PerformanceSummary).filter(
        PerformanceSummary.personnel_id == personnel_id,
        PerformanceSummary.period       == period,
    ).first()

    if existing:
        existing.total_appraisal_points = total_pts
        existing.avg_event_score        = round(avg_event / 100 * 5, 2) if avg_event else None
        existing.avg_task_score         = round(avg_task  / 100 * 5, 2) if avg_task  else None
        existing.report_timing_points   = rpt_timing
        existing.escalation_count       = escalations
        existing.overall_grade          = grade
        existing.summary_date           = _now()
        summary = existing
    else:
        summary = PerformanceSummary(
            personnel_id           = personnel_id,
            period                 = period,
            total_appraisal_points = total_pts,
            avg_event_score        = round(avg_event / 100 * 5, 2) if avg_event else None,
            avg_task_score         = round(avg_task  / 100 * 5, 2) if avg_task  else None,
            report_timing_points   = rpt_timing,
            escalation_count       = escalations,
            overall_grade          = grade,
            summary_date           = _now(),
        )
        db.add(summary)

    db.commit()
    db.refresh(summary)
    return PerformanceSummaryOut.model_validate(summary)


# ─────────────────────────────────────────────────────────────────────────────
# Routes — Role-Based Dashboards & Access Control
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/dashboard/teacher/{personnel_id}", tags=["Dashboard - Teacher"])
def teacher_dashboard(personnel_id: int, db: Session = Depends(get_db)):
    """
    TEACHER CAN:
    - View their own report evaluation scores (Content Quality, Format Compliance, Completeness)
    - View their own compliance points (Star Rating × 20)
    - View their own event evaluation submissions and ratings
    - View their own performance summary breakdown
    """
    user = db.query(User).filter(User.id == personnel_id).first()
    if not user or user.role != "Teacher":
        raise HTTPException(status_code=403, detail="Access denied")

    # Get all appraisal records for this teacher
    appraisals = db.query(AppraisalRecord).filter(
        AppraisalRecord.personnel_id == personnel_id,
        AppraisalRecord.is_archived == False,
    ).all()

    # Separate by type
    report_appraisals = [a for a in appraisals if a.appraisal_type == "Report"]
    event_appraisals = [a for a in appraisals if a.appraisal_type == "Event"]

    # Get actual submissions for details
    report_submissions = db.query(ReportSubmission).filter(
        ReportSubmission.personnel_id == personnel_id
    ).all()

    event_evaluations = db.query(EventEvaluation).filter(
        EventEvaluation.evaluator_id == personnel_id
    ).all()

    # Calculate compliance points
    total_compliance_points = sum(a.star_rating * 20 for a in appraisals)

    return {
        "personnel_id": personnel_id,
        "name": user.name,
        "role": user.role,
        "report_scores": [
            {
                "submission_id": s.submission_id,
                "content_quality": s.content_quality_score,
                "format_compliance": s.format_compliance_score,
                "completeness": s.completeness_score,
                "timing_status": s.timing_status,
                "timing_points": s.timing_points,
                "date_submitted": s.submitted_at,
            }
            for s in report_submissions
        ],
        "event_submissions": [
            {
                "evaluation_id": e.evaluation_id,
                "event_name": db.query(Event).filter(Event.id == e.event_id).first().name,
                "overall_score": round(e.average_score, 2),
                "scores": {
                    "planning": e.planning_score,
                    "objectives": e.objectives_score,
                    "personnel": e.personnel_score,
                    "time_mgmt": e.time_mgmt_score,
                    "engagement": e.engagement_score,
                    "resource": e.resource_score,
                },
                "date_submitted": e.date_submitted,
            }
            for e in event_evaluations
        ],
        "compliance_points": total_compliance_points,
        "performance_summary": {
            "report_avg": round(
                sum(a.total_points for a in report_appraisals) / len(report_appraisals), 2
            ) if report_appraisals else None,
            "event_avg": round(
                sum(a.total_points for a in event_appraisals) / len(event_appraisals), 2
            ) if event_appraisals else None,
            "overall_avg": round(
                sum(a.total_points for a in appraisals) / len(appraisals), 2
            ) if appraisals else None,
            "flagged_count": sum(1 for a in appraisals if a.appraisal_status == "Flagged"),
        },
    }


@app.get("/dashboard/dean/{personnel_id}", tags=["Dashboard - Dean"])
def dean_dashboard(personnel_id: int, db: Session = Depends(get_db)):
    """
    DEAN CAN:
    - View their own special task ratings from coordinators
    - View their own compliance points
    - Receive notifications when evaluated
    - Receive escalation alerts
    """
    user = db.query(User).filter(User.id == personnel_id).first()
    if not user or user.role != "Dean":
        raise HTTPException(status_code=403, detail="Access denied")

    # Get special tasks assigned to this dean
    tasks = db.query(SpecialTask).filter(
        SpecialTask.personnel == user.name
    ).all()

    task_evaluations = []
    for task in tasks:
        eval_record = db.query(SpecialTaskEvaluation).filter(
            SpecialTaskEvaluation.task_id == task.id
        ).first()
        if eval_record:
            task_evaluations.append({
                "task_id": task.id,
                "task_name": task.task,
                "assigned_by": task.assigned_by,
                "completion_quality": eval_record.completion_quality_score,
                "timeliness": eval_record.timeliness_score,
                "initiative": eval_record.initiative_score,
                "coordination": eval_record.coordination_score,
                "weighted_average": eval_record.weighted_average,
                "is_flagged": eval_record.is_flagged,
                "remarks": eval_record.remarks,
                "date_submitted": eval_record.date_submitted,
            })

    # Get appraisal records
    appraisals = db.query(AppraisalRecord).filter(
        AppraisalRecord.personnel_id == personnel_id,
        AppraisalRecord.is_archived == False,
    ).all()

    total_compliance_points = sum(a.star_rating * 20 for a in appraisals)
    escalation_alerts = [a for a in appraisals if a.appraisal_status == "Flagged"]

    return {
        "personnel_id": personnel_id,
        "name": user.name,
        "role": user.role,
        "special_task_ratings": task_evaluations,
        "compliance_points": total_compliance_points,
        "escalation_alerts": [
            {
                "appraisal_id": a.appraisal_id,
                "type": a.appraisal_type,
                "score": a.total_points,
                "star_rating": a.star_rating,
                "date_created": a.date_created,
            }
            for a in escalation_alerts
        ],
    }


@app.get("/dashboard/coordinator/{personnel_id}", tags=["Dashboard - Coordinator"])
def coordinator_dashboard(
    personnel_id: int,
    area: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    COORDINATOR CAN:
    - Evaluate deans on special tasks
    - View compliance dashboard of all personnel under their area
    - Receive escalation alerts for area personnel
    """
    user = db.query(User).filter(User.id == personnel_id).first()
    if not user or user.role != "Coordinator":
        raise HTTPException(status_code=403, detail="Access denied")

    # If no area specified, use coordinator's department
    area = area or user.department

    # Get all personnel in this area
    area_personnel = db.query(User).filter(
        User.department == area
    ).all()

    personnel_compliance = []
    total_escalations = 0

    for person in area_personnel:
        appraisals = db.query(AppraisalRecord).filter(
            AppraisalRecord.personnel_id == person.id,
            AppraisalRecord.is_archived == False,
        ).all()

        compliance_points = sum(a.star_rating * 20 for a in appraisals)
        flagged = sum(1 for a in appraisals if a.appraisal_status == "Flagged")
        total_escalations += flagged

        personnel_compliance.append({
            "personnel_id": person.id,
            "name": person.name,
            "role": person.role,
            "compliance_points": compliance_points,
            "flagged_count": flagged,
            "avg_score": round(
                sum(a.total_points for a in appraisals) / len(appraisals), 2
            ) if appraisals else None,
        })

    # Get escalation alerts
    escalation_records = db.query(AppraisalRecord).filter(
        AppraisalRecord.appraisal_status == "Flagged",
        AppraisalRecord.is_archived == False,
    ).all()

    escalation_alerts = []
    for rec in escalation_records:
        if rec.personnel and rec.personnel.department == area:
            escalation_alerts.append({
                "appraisal_id": rec.appraisal_id,
                "personnel_name": rec.personnel.name,
                "appraisal_type": rec.appraisal_type,
                "score": rec.total_points,
                "star_rating": rec.star_rating,
                "date_created": rec.date_created,
            })

    return {
        "coordinator_id": personnel_id,
        "name": user.name,
        "area": area,
        "personnel_compliance": sorted(
            personnel_compliance,
            key=lambda x: x["compliance_points"],
            reverse=True
        ),
        "total_personnel": len(area_personnel),
        "total_escalations": total_escalations,
        "escalation_alerts": escalation_alerts,
    }


@app.get("/dashboard/principal", tags=["Dashboard - Principal"])
def principal_dashboard(
    personnel_id: int,
    db: Session = Depends(get_db),
):
    """
    PRINCIPAL CAN:
    - View school-wide compliance dashboard
    - View department-level averages and distributions
    - View all escalation alerts
    - Export consolidated summary
    """
    user = db.query(User).filter(User.id == personnel_id).first()
    if not user or user.role != "Principal":
        raise HTTPException(status_code=403, detail="Access denied")

    # Get all departments
    departments = db.query(User.department).distinct().filter(
        User.department != None
    ).all()

    department_stats = []
    for dept_tuple in departments:
        dept = dept_tuple[0]
        dept_personnel = db.query(User).filter(User.department == dept).all()

        dept_appraisals = db.query(AppraisalRecord).filter(
            AppraisalRecord.personnel_id.in_([p.id for p in dept_personnel]),
            AppraisalRecord.is_archived == False,
        ).all()

        if dept_appraisals:
            avg_score = round(
                sum(a.total_points for a in dept_appraisals) / len(dept_appraisals), 2
            )
            avg_rating = round(
                sum(a.star_rating for a in dept_appraisals) / len(dept_appraisals), 2
            )
            flagged = sum(1 for a in dept_appraisals if a.appraisal_status == "Flagged")
        else:
            avg_score = None
            avg_rating = None
            flagged = 0

        # Rating distribution
        rating_dist = {}
        for a in dept_appraisals:
            bucket = f"{int(a.star_rating)} star{'s' if int(a.star_rating) != 1 else ''}"
            rating_dist[bucket] = rating_dist.get(bucket, 0) + 1

        department_stats.append({
            "department": dept,
            "personnel_count": len(dept_personnel),
            "avg_score": avg_score,
            "avg_rating": avg_rating,
            "flagged_count": flagged,
            "rating_distribution": rating_dist,
        })

    # Get all escalation alerts
    all_escalations = db.query(AppraisalRecord).filter(
        AppraisalRecord.appraisal_status == "Flagged",
        AppraisalRecord.is_archived == False,
    ).all()

    escalation_alerts = [
        {
            "appraisal_id": a.appraisal_id,
            "personnel_name": a.personnel.name if a.personnel else "Unknown",
            "department": a.personnel.department if a.personnel else None,
            "appraisal_type": a.appraisal_type,
            "score": a.total_points,
            "star_rating": a.star_rating,
            "date_created": a.date_created,
        }
        for a in all_escalations
    ]

    # Calculate school-wide stats
    all_appraisals = db.query(AppraisalRecord).filter(
        AppraisalRecord.is_archived == False,
    ).all()

    school_avg_score = round(
        sum(a.total_points for a in all_appraisals) / len(all_appraisals), 2
    ) if all_appraisals else None

    school_avg_rating = round(
        sum(a.star_rating for a in all_appraisals) / len(all_appraisals), 2
    ) if all_appraisals else None

    return {
        "principal_id": personnel_id,
        "name": user.name,
        "school_overview": {
            "total_departments": len(department_stats),
            "total_personnel": sum(d["personnel_count"] for d in department_stats),
            "avg_school_score": school_avg_score,
            "avg_school_rating": school_avg_rating,
            "total_escalations": len(escalation_alerts),
        },
        "department_statistics": sorted(
            department_stats,
            key=lambda x: x["avg_score"] if x["avg_score"] else 0,
            reverse=True
        ),
        "escalation_alerts": escalation_alerts,
    }


@app.get("/escalation-alerts", tags=["Escalation Alerts"])
def get_escalation_alerts(
    role: Optional[str] = None,
    personnel_id: Optional[int] = None,
    area: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Get escalation alerts based on role and context.
    - COORDINATOR: Alerts for their area
    - PRINCIPAL: All alerts
    - TEACHER/DEAN: Their own alerts
    """
    alerts = db.query(AppraisalRecord).filter(
        AppraisalRecord.appraisal_status == "Flagged",
        AppraisalRecord.is_archived == False,
    ).all()

    if role == "coordinator" and area:
        alerts = [
            a for a in alerts
            if a.personnel and a.personnel.department == area
        ]
    elif role == "teacher" or role == "dean":
        alerts = [a for a in alerts if a.personnel_id == personnel_id]

    return {
        "total_alerts": len(alerts),
        "alerts": [
            {
                "appraisal_id": a.appraisal_id,
                "personnel_name": a.personnel.name if a.personnel else "Unknown",
                "appraisal_type": a.appraisal_type,
                "score": a.total_points,
                "star_rating": a.star_rating,
                "status": a.appraisal_status,
                "date_created": a.date_created,
            }
            for a in alerts
        ],
    }


@app.get("/export-performance-summary", tags=["Export"])
def export_performance_summary(
    period: str,  # YYYY-MM
    role: str,    # principal|coordinator
    personnel_id: Optional[int] = None,
    area: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Export consolidated performance summary for DepEd Annual Faculty Evaluation.
    """
    if role == "principal":
        # Export all personnel summaries for the period
        summaries = db.query(PerformanceSummary).filter(
            PerformanceSummary.period == period,
        ).all()
    elif role == "coordinator" and area:
        # Export area personnel summaries
        area_personnel = db.query(User).filter(User.department == area).all()
        summaries = db.query(PerformanceSummary).filter(
            PerformanceSummary.period == period,
            PerformanceSummary.personnel_id.in_([p.id for p in area_personnel]),
        ).all()
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    export_data = []
    for s in summaries:
        user = db.query(User).filter(User.id == s.personnel_id).first()
        if user:
            export_data.append({
                "personnel_name": user.name,
                "department": user.department,
                "role": user.role,
                "period": s.period,
                "total_points": s.total_appraisal_points,
                "overall_grade": s.overall_grade,
                "event_score": s.avg_event_score,
                "task_score": s.avg_task_score,
                "report_timing_points": s.report_timing_points,
                "escalation_count": s.escalation_count,
            })

    return {
        "period": period,
        "export_date": _now(),
        "total_records": len(export_data),
        "data": export_data,
    }

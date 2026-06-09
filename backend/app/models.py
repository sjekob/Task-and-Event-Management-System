"""
Personnel Appraisal Module — SQLAlchemy Models + Pydantic Schemas
Aligned to the final data dictionary and paper SRS.

Data Dictionary sources:
  - Timing Points Record      (paper DD)
  - Event Evaluation Form     (paper DD + corrected rubric)
  - Special Task Evaluation   (paper DD + 4th criterion added)
  - Appraisal Record          (paper DD + locking/archiving)
  - Performance Summary       (paper DD + task avg + grade)
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text, create_engine,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


# ─────────────────────────────────────────────────────────────────────────────
# ORM Models
# ─────────────────────────────────────────────────────────────────────────────

class User(Base):
    """
    Stakeholders: Teacher, Student, Dean, Coordinator, Principal, Admin
    """
    __tablename__ = "user"

    id         = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name       = Column(String(120), nullable=False)
    role       = Column(String(20),  nullable=False)   # Teacher|Student|Dean|Coordinator|Principal|Admin
    department = Column(String(100), nullable=True)

    # relationships
    event_evaluations    = relationship("EventEvaluation",    back_populates="evaluator",  foreign_keys="EventEvaluation.evaluator_id")
    task_evaluations     = relationship("SpecialTaskEvaluation", back_populates="coordinator", foreign_keys="SpecialTaskEvaluation.coordinator_id")
    report_submissions   = relationship("ReportSubmission",   back_populates="personnel",  foreign_keys="ReportSubmission.personnel_id")
    appraisal_records    = relationship("AppraisalRecord",    back_populates="personnel",  foreign_keys="AppraisalRecord.personnel_id")
    performance_summaries= relationship("PerformanceSummary", back_populates="personnel",  foreign_keys="PerformanceSummary.personnel_id")


class SpecialTask(Base):
    """
    Special tasks assigned to personnel (typically Dean) by a coordinator.
    """
    __tablename__ = "special_task"

    id             = Column(String(20),  primary_key=True, index=True)
    personnel      = Column(String(120), nullable=False)   # display name (denormalized for simplicity)
    department     = Column(String(100), nullable=False)
    task           = Column(String(255), nullable=False)   # full task name
    assigned_by    = Column(String(120), nullable=False)   # coordinator display name
    due_date       = Column(String(20),  nullable=False)   # YYYY-MM-DD
    submitted_date = Column(String(20),  nullable=True)
    status         = Column(String(20),  nullable=False, default="pending")
    # score is derived from the evaluation record; kept here for fast reads
    score          = Column(Integer,     nullable=True)

    evaluation = relationship("SpecialTaskEvaluation", back_populates="task",
                              uselist=False, foreign_keys="SpecialTaskEvaluation.task_id")


class SpecialTaskEvaluation(Base):
    """
    special_task_evaluation — data dictionary entity
    Coordinator rates Dean using weighted rubric.

    Weights (must sum to 100%):
      completion_quality_score  35%  — Task Completion Quality
      timeliness_score          30%  — Timeliness and Reliability
      initiative_score          20%  — Initiative and Problem-Solving
      coordination_score        15%  — Coordination & Communication

    weighted_average [0.00–5.00] = (c×0.35)+(t×0.30)+(i×0.20)+(co×0.15)
    is_flagged = TRUE if weighted_average < 3.0  (i.e. score < 60/100)
    """
    __tablename__ = "special_task_evaluation"

    # PK
    special_task_eval_id      = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # FKs  (DD: task_id, personnel_id, coordinator_id)
    task_id                   = Column(String(20),  ForeignKey("special_task.id"),  nullable=False)
    personnel_id              = Column(Integer,     ForeignKey("user.id"),           nullable=True)
    coordinator_id            = Column(Integer,     ForeignKey("user.id"),           nullable=True)

    # Rubric scores [1–5]
    completion_quality_score  = Column(Integer, nullable=False)   # 35%
    timeliness_score          = Column(Integer, nullable=False)   # 30%
    initiative_score          = Column(Integer, nullable=False)   # 20%
    coordination_score        = Column(Integer, nullable=False)   # 15%

    # Derived
    weighted_average          = Column(Float,   nullable=False)   # [0.00–5.00]
    is_flagged                = Column(Boolean, nullable=False, default=False)

    # Optional remarks
    remarks                   = Column(Text,    nullable=True)

    # Timestamp
    date_submitted            = Column(String(30), nullable=False,
                                       default=lambda: datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))

    # relationships
    task        = relationship("SpecialTask", back_populates="evaluation", foreign_keys=[task_id])
    coordinator = relationship("User",        back_populates="task_evaluations", foreign_keys=[coordinator_id])


class Event(Base):
    """
    School event entity.
    """
    __tablename__ = "event"

    id         = Column(String(20),  primary_key=True, index=True)
    name       = Column(String(255), nullable=False)
    date       = Column(String(20),  nullable=False)   # YYYY-MM-DD
    organizer  = Column(String(120), nullable=False)
    department = Column(String(100), nullable=False)
    attendees  = Column(Integer,     nullable=False, default=0)
    status     = Column(String(25),  nullable=False, default="awaitingRatings")
    # awaitingRatings | rated | flagged

    evaluations = relationship("EventEvaluation", back_populates="event",
                               foreign_keys="EventEvaluation.event_id")


class EventEvaluation(Base):
    """
    event_evaluation — data dictionary entity
    Rubric collected from attendees. 6-criteria, each [1–5].

    Criteria (equal weight, average = overall score):
      planning_score    — Planning & Organization
      objectives_score  — Achievement of Objectives
      personnel_score   — Personnel Performance
      time_mgmt_score   — Time Management
      engagement_score  — Participant Engagement
      resource_score    — Resource Management

    template_used  — FALSE when no observation tool template was provided
    is_flagged     — TRUE when average < 3.0
    """
    __tablename__ = "event_evaluation"

    # PK
    evaluation_id    = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # FKs (DD: event_id, evaluator_id)
    event_id         = Column(String(20), ForeignKey("event.id"), nullable=False)
    evaluator_id     = Column(Integer,    ForeignKey("user.id"),  nullable=True)

    # Evaluator meta
    evaluator_name   = Column(String(120), nullable=False)   # captured at submission
    evaluator_role   = Column(String(20),  nullable=False)   # Teacher|Student|Coordinator|Dean|Principal

    # Rubric scores [1–5] — names match data dictionary exactly
    planning_score   = Column(Integer, nullable=False)
    objectives_score = Column(Integer, nullable=False)
    personnel_score  = Column(Integer, nullable=False)
    time_mgmt_score  = Column(Integer, nullable=False)
    engagement_score = Column(Integer, nullable=False)
    resource_score   = Column(Integer, nullable=False)

    # DD: template_used BOOLEAN NN DEFAULT FALSE
    template_used    = Column(Boolean, nullable=False, default=False)

    # DD: feedback_comments TEXT OPT  [A–Z, a–z, 0–9, ,.-|] max 1000 chars
    feedback_comments = Column(Text, nullable=True)

    # Timestamp  DD: date_submitted DATETIME NN
    date_submitted   = Column(String(30), nullable=False,
                              default=lambda: datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))

    # relationships
    event     = relationship("Event", back_populates="evaluations", foreign_keys=[event_id])
    evaluator = relationship("User",  back_populates="event_evaluations", foreign_keys=[evaluator_id])

    @property
    def average_score(self) -> float:
        return (
            self.planning_score + self.objectives_score + self.personnel_score +
            self.time_mgmt_score + self.engagement_score + self.resource_score
        ) / 6.0


class ReportSubmission(Base):
    """
    report_submission — data dictionary entity (NEW)
    Automated timing point computation.

    Timing points (from paper SRS):
      Early              = 150
      On Time            = 100
      Late ≤ 24h         =  50
      Late > 24h / None  =   0
    """
    __tablename__ = "report_submission"

    # PK
    submission_id          = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # FKs
    report_id              = Column(Integer, nullable=False)                         # REF reports(report_id)
    personnel_id           = Column(Integer, ForeignKey("user.id"), nullable=True)

    # Deadline & submission timestamps
    deadline               = Column(String(30), nullable=False)   # YYYY-MM-DD HH:MM:SS
    submitted_at           = Column(String(30), nullable=False)   # server timestamp

    # Computed timing
    timing_status          = Column(String(25), nullable=False)   # Early|On Time|Late within 24 hours|Late after 24 hours|Not Submitted
    timing_points          = Column(Integer,    nullable=False)   # 150|100|50|0  (paper SRS values)

    # Report quality rubric scores [1–5]
    content_quality_score  = Column(Integer, nullable=False)
    format_compliance_score= Column(Integer, nullable=False)
    completeness_score     = Column(Integer, nullable=False)

    # relationship
    personnel = relationship("User", back_populates="report_submissions", foreign_keys=[personnel_id])


class AppraisalRecord(Base):
    """
    appraisal_record — data dictionary entity
    One record per appraisal event. Supports locking & archiving.
    """
    __tablename__ = "appraisal_record"

    # PK
    appraisal_id    = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # FKs
    personnel_id    = Column(Integer, ForeignKey("user.id"), nullable=True)

    # Type
    appraisal_type  = Column(String(20),  nullable=False)   # Report|Event|Special Task
    reference_id    = Column(Integer,     nullable=True)    # polymorphic FK to source record

    # Scores  (FIXED: was INT, now DECIMAL to handle weighted averages)
    total_points    = Column(Float,   nullable=False)   # [0.00–100.00]
    star_rating     = Column(Float,   nullable=False)   # [1.0–5.0] derived from total_points

    # Status
    appraisal_status= Column(String(20), nullable=False, default="Pending")  # Pending|Completed|Flagged

    # Locking & archiving (NEW)
    is_locked       = Column(Boolean, nullable=False, default=False)
    is_archived     = Column(Boolean, nullable=False, default=False)

    # Timestamp
    date_created    = Column(String(30), nullable=False,
                             default=lambda: datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))

    # relationship
    personnel = relationship("User", back_populates="appraisal_records", foreign_keys=[personnel_id])


class PerformanceSummary(Base):
    """
    performance_summary — data dictionary entity
    Monthly aggregate per personnel. Feeds Annual Faculty Performance Evaluation.
    """
    __tablename__ = "performance_summary"

    # PK
    summary_id             = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # FK
    personnel_id           = Column(Integer, ForeignKey("user.id"), nullable=True)

    # Period  CHAR(7)  YYYY-MM
    period                 = Column(String(7),  nullable=False)

    # Aggregates
    total_appraisal_points = Column(Float,   nullable=False)       # [0.00–100.00]
    avg_event_score        = Column(Float,   nullable=True)        # [0.00–5.00] NULL if no events
    avg_task_score         = Column(Float,   nullable=True)        # [0.00–5.00] NULL if no tasks (NEW)
    report_timing_points   = Column(Integer, nullable=False, default=0)  # sum of timing_points for period
    escalation_count       = Column(Integer, nullable=False, default=0)  # flagged appraisals (NEW)

    # Grade (NEW) — RPMS/DepEd scale
    overall_grade          = Column(String(25), nullable=True)
    # Outstanding|Very Satisfactory|Satisfactory|Unsatisfactory

    # Timestamp
    summary_date           = Column(String(30), nullable=False,
                                    default=lambda: datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"))

    # relationship
    personnel = relationship("User", back_populates="performance_summaries", foreign_keys=[personnel_id])


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────────────────────────────────────

# ── SpecialTask ───────────────────────────────────────────────────────────────

class SpecialTaskOut(BaseModel):
    id: str
    personnel: str
    department: str
    task: str
    assigned_by: str
    due_date: str
    submitted_date: Optional[str] = None
    status: str
    score: Optional[int] = None

    model_config = {"from_attributes": True}


class SpecialTaskEvaluationIn(BaseModel):
    """POST /special-tasks/{id}/evaluate"""
    personnel_id: Optional[int] = None
    coordinator_id: Optional[int] = None

    # Rubric scores [1–5] matching DD field names
    completion_quality_score: int
    timeliness_score:          int
    initiative_score:          int
    coordination_score:        int

    remarks: Optional[str] = None

    @field_validator("completion_quality_score", "timeliness_score",
                     "initiative_score", "coordination_score")
    @classmethod
    def score_range(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("Score must be between 1 and 5")
        return v


class SpecialTaskEvaluationOut(BaseModel):
    special_task_eval_id:     int
    task_id:                  str
    personnel_id:             Optional[int]
    coordinator_id:           Optional[int]
    completion_quality_score: int
    timeliness_score:         int
    initiative_score:         int
    coordination_score:       int
    weighted_average:         float
    is_flagged:               bool
    remarks:                  Optional[str]
    date_submitted:           str

    model_config = {"from_attributes": True}


# ── Event ─────────────────────────────────────────────────────────────────────

class EventOut(BaseModel):
    id: str
    name: str
    date: str
    organizer: str
    department: str
    attendees: int
    status: str

    model_config = {"from_attributes": True}


# ── EventEvaluation ───────────────────────────────────────────────────────────

class EventEvaluationIn(BaseModel):
    """POST /events/{id}/evaluate"""
    evaluator_id:     Optional[int] = None
    evaluator_name:   str
    evaluator_role:   str   # Teacher|Student|Coordinator|Dean|Principal

    # Rubric scores [1–5] — DD field names
    planning_score:   int
    objectives_score: int
    personnel_score:  int
    time_mgmt_score:  int
    engagement_score: int
    resource_score:   int

    template_used:       bool = False
    feedback_comments:   Optional[str] = None

    @field_validator("planning_score", "objectives_score", "personnel_score",
                     "time_mgmt_score", "engagement_score", "resource_score")
    @classmethod
    def score_range(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("Score must be between 1 and 5")
        return v

    @field_validator("evaluator_role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        allowed = {"Teacher", "Student", "Coordinator", "Dean", "Principal"}
        if v not in allowed:
            raise ValueError(f"Role must be one of {allowed}")
        return v


class EventEvaluationOut(BaseModel):
    evaluation_id:    int
    event_id:         str
    evaluator_id:     Optional[int]
    evaluator_name:   str
    evaluator_role:   str
    planning_score:   int
    objectives_score: int
    personnel_score:  int
    time_mgmt_score:  int
    engagement_score: int
    resource_score:   int
    template_used:    bool
    feedback_comments: Optional[str]
    date_submitted:   str

    model_config = {"from_attributes": True}


# ── ReportSubmission ──────────────────────────────────────────────────────────

class ReportSubmissionIn(BaseModel):
    """POST /report-submissions/"""
    report_id:               int
    personnel_id:            Optional[int] = None
    deadline:                str    # YYYY-MM-DD HH:MM:SS
    content_quality_score:   int
    format_compliance_score: int
    completeness_score:      int

    @field_validator("content_quality_score", "format_compliance_score", "completeness_score")
    @classmethod
    def score_range(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("Score must be between 1 and 5")
        return v


class ReportSubmissionOut(BaseModel):
    submission_id:           int
    report_id:               int
    personnel_id:            Optional[int]
    deadline:                str
    submitted_at:            str
    timing_status:           str
    timing_points:           int
    content_quality_score:   int
    format_compliance_score: int
    completeness_score:      int

    model_config = {"from_attributes": True}


# ── AppraisalRecord ───────────────────────────────────────────────────────────

class AppraisalRecordOut(BaseModel):
    appraisal_id:    int
    personnel_id:    Optional[int]
    appraisal_type:  str
    reference_id:    Optional[int]
    total_points:    float
    star_rating:     float
    appraisal_status:str
    is_locked:       bool
    is_archived:     bool
    date_created:    str

    model_config = {"from_attributes": True}


# ── PerformanceSummary ────────────────────────────────────────────────────────

class PerformanceSummaryOut(BaseModel):
    summary_id:             int
    personnel_id:           Optional[int]
    period:                 str
    total_appraisal_points: float
    avg_event_score:        Optional[float]
    avg_task_score:         Optional[float]
    report_timing_points:   int
    escalation_count:       int
    overall_grade:          Optional[str]
    summary_date:           str

    model_config = {"from_attributes": True}


# ── Legacy alias (keeps EvaluationIn working if any code still imports it) ────
class EvaluationIn(BaseModel):
    ratings: dict
    remarks: Optional[str] = ""

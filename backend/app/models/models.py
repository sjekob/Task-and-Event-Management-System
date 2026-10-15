from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base
import enum

class UserRole(str, enum.Enum):
    admin       = "admin"
    coordinator = "coordinator"
    teacher     = "teacher"

class TaskStatus(str, enum.Enum):
    pending   = "pending"
    submitted = "submitted"
    missing   = "missing"
    approved  = "approved"
    rejected  = "rejected"

# ─── User ────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    username   = Column(String(50), unique=True, nullable=False, index=True)
    email      = Column(String(255), unique=True, nullable=False, index=True)
    full_name  = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role       = Column(Enum(UserRole), default=UserRole.teacher, nullable=False)
    is_active  = Column(Boolean, default=True)
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    assigned_tasks = relationship("Task", back_populates="assignee",
                                  foreign_keys="Task.assignee_id")
    created_tasks  = relationship("Task", back_populates="creator",
                                  foreign_keys="Task.creator_id")

# ─── Task ────────────────────────────────────────────────────────────────────
class Task(Base):
    __tablename__ = "tasks"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status      = Column(Enum(TaskStatus), default=TaskStatus.pending, nullable=False)
    due_date    = Column(DateTime(timezone=True), nullable=True)
    creator_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    event_id    = Column(Integer, ForeignKey("events.id"), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    creator  = relationship("User", back_populates="created_tasks",
                            foreign_keys=[creator_id])
    assignee = relationship("User", back_populates="assigned_tasks",
                            foreign_keys=[assignee_id])
    event    = relationship("Event", back_populates="tasks")
    submissions = relationship("TaskSubmission", back_populates="task")

# ─── Task Submission ─────────────────────────────────────────────────────────
class TaskSubmission(Base):
    __tablename__ = "task_submissions"

    id          = Column(Integer, primary_key=True, index=True)
    task_id     = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    file_url    = Column(String(500), nullable=True)
    notes       = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("Task", back_populates="submissions")

# ─── Event ───────────────────────────────────────────────────────────────────
class EventStatus(str, enum.Enum):
    upcoming         = "upcoming"
    pending_approval = "pending_approval"
    created_by_me    = "created_by_me"
    disabled         = "disabled"

class Event(Base):
    __tablename__ = "events"

    id          = Column(Integer, primary_key=True, index=True)
    created_by  = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())
    status      = Column(Enum(EventStatus),
                         default=EventStatus.pending_approval, nullable=False)

    # I. Proposal Brief
    title           = Column(String(500), nullable=False)
    nature          = Column(String(50), nullable=True)
    target_date     = Column(String(255), nullable=True)
    venue           = Column(String(500), nullable=True)
    proposed_budget = Column(String(100), nullable=True)
    fund_source     = Column(String(255), nullable=True)
    focal_name      = Column(String(255), nullable=True)
    focal_role      = Column(String(255), nullable=True)
    focal_contact   = Column(String(100), nullable=True)
    expected_outputs = Column(Text, nullable=True)  # JSON string
    participants    = Column(Text, nullable=True)    # JSON string

    # II. Rationale & Objectives
    rationale   = Column(Text, nullable=True)
    objectives  = Column(Text, nullable=True)   # JSON string

    # III. Methodology
    phase1 = Column(Text, nullable=True)
    phase2 = Column(Text, nullable=True)
    phase3 = Column(Text, nullable=True)

    # IV. Activity Matrix
    activity_matrix = Column(Text, nullable=True)  # JSON string

    # V. Budget
    training_materials = Column(Text, nullable=True)  # JSON string
    snacks             = Column(Text, nullable=True)  # JSON string

    # VI. Working Committee
    exec_committee = Column(Text, nullable=True)   # JSON string
    twg_groups     = Column(Text, nullable=True)   # JSON string

    # VII. Monitoring & Evaluation
    monitoring_criteria = Column(Text, nullable=True)
    indicators          = Column(Text, nullable=True)  # JSON string
    comments            = Column(Text, nullable=True)

    tasks = relationship("Task", back_populates="event")

# ─── Appraisal ───────────────────────────────────────────────────────────────
class Appraisal(Base):
    __tablename__ = "appraisals"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    reviewer_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    period       = Column(String(100), nullable=False)
    score        = Column(Integer, nullable=True)
    comments     = Column(Text, nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

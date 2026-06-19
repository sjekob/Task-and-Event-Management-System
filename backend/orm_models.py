"""
orm_models.py — SQLAlchemy models mirroring the TaskNet schema 1:1.

These replace the inaccurate sketch under app/models/. Column names, types,
foreign keys, defaults, and CHECK/UNIQUE constraints match database.py exactly
so the ORM can run against the same data (sqlite today, Postgres after cutover).
"""
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float, ForeignKey,
    TIMESTAMP, CheckConstraint, UniqueConstraint, func,
)
from db import Base


class GradeLevel(Base):
    __tablename__ = "grade_levels"
    id = Column(Integer, primary_key=True)
    grade_level = Column(Text, nullable=False, unique=True)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(Text, unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    full_name = Column(Text, nullable=False)
    first_name = Column(Text)
    middle_name = Column(Text)
    last_name = Column(Text)
    suffix = Column(Text)
    role = Column(Text, nullable=False)
    grade_level_id = Column(Integer, ForeignKey("grade_levels.id", ondelete="SET NULL"))
    avatar_url = Column(Text)
    email = Column(Text)
    phone_number = Column(Text)
    tin = Column(Text)
    qsis = Column(Text)
    hdmf = Column(Text)
    phic = Column(Text)
    date_of_appointment = Column(Text)
    birthdate = Column(Text)
    address = Column(Text)
    is_active = Column(Integer, nullable=False, default=1)
    created_at = Column(TIMESTAMP, server_default=func.now())
    __table_args__ = (
        CheckConstraint(
            "role IN ('admin','principal','coordinator','dean','teacher','registrar')",
            name="ck_users_role",
        ),
    )


class UserSubject(Base):
    __tablename__ = "user_subjects"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subject = Column(Text, nullable=False)
    grade_level_id = Column(Integer, ForeignKey("grade_levels.id"))
    __table_args__ = (UniqueConstraint("user_id", "subject", "grade_level_id"),)


class CoordinatorAssignment(Base):
    __tablename__ = "coordinator_assignments"
    id = Column(Integer, primary_key=True)
    coordinator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    grade_level_id = Column(Integer, ForeignKey("grade_levels.id", ondelete="CASCADE"), nullable=False)
    __table_args__ = (UniqueConstraint("coordinator_id", "grade_level_id"),)


class CoordinatorType(Base):
    __tablename__ = "coordinator_type"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    coordinator_type = Column(Text, nullable=False)


class DeanAssignment(Base):
    __tablename__ = "dean_assignment"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    grade_level_id = Column(Integer, ForeignKey("grade_levels.id"), nullable=False)


class TaskType(Base):
    __tablename__ = "task_types"
    id = Column(Integer, primary_key=True)
    task_type = Column(Text, nullable=False, unique=True)


class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True)
    title = Column(Text, nullable=False)
    instructions = Column(Text)
    subject = Column(Text)
    task_type_id = Column(Integer, ForeignKey("task_types.id", ondelete="SET NULL"))
    start_date = Column(Text)
    end_date = Column(Text)
    due_time = Column(Text)
    status = Column(Text, default="active")
    created_by = Column(Integer, ForeignKey("users.id"))
    points_early = Column(Integer, default=100)
    points_ontime = Column(Integer, default=100)
    points_late24 = Column(Integer, default=50)
    points_after24 = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())
    __table_args__ = (
        CheckConstraint("status IN ('active','disabled')", name="ck_tasks_status"),
    )


class TaskAssignment(Base):
    __tablename__ = "task_assignments"
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assigned_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    __table_args__ = (UniqueConstraint("task_id", "user_id"),)


class TaskTemplate(Base):
    __tablename__ = "task_templates"
    id = Column(Integer, primary_key=True)
    title = Column(Text, nullable=False)
    instructions = Column(Text)
    start_date = Column(Text)
    end_date = Column(Text)
    due_time = Column(Text)
    points_early = Column(Integer, default=100)
    points_ontime = Column(Integer, default=100)
    points_late24 = Column(Integer, default=50)
    points_after24 = Column(Integer, default=0)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(TIMESTAMP, server_default=func.now())


class TaskAttachment(Base):
    __tablename__ = "task_attachments"
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    attachment_type = Column(Text)
    name = Column(Text)
    url = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    __table_args__ = (
        CheckConstraint(
            "attachment_type IN ('file','link','gdrive','youtube')",
            name="ck_attachment_type",
        ),
    )


class TaskLog(Base):
    __tablename__ = "task_log"
    id = Column(Integer, primary_key=True)
    submission_date = Column(TIMESTAMP, server_default=func.now())
    personnel_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    __table_args__ = (UniqueConstraint("task_id", "personnel_id"),)


class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    personnel_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    report_title = Column(Text, nullable=False)
    report_description = Column(Text)
    report_type = Column(Text)
    report_file_path = Column(Text)
    report_filename = Column(Text)
    report_link_url = Column(Text)
    report_date = Column(TIMESTAMP, server_default=func.now())
    report_status = Column(Text, default="Pending")
    __table_args__ = (
        CheckConstraint(
            "report_status IN ('Completed','Pending','Missing')",
            name="ck_report_status",
        ),
        UniqueConstraint("task_id", "personnel_id"),
    )


class SubmissionLog(Base):
    __tablename__ = "submission_log"
    id = Column(Integer, primary_key=True)
    status = Column(Text, default="Pending")
    date_of_submission = Column(TIMESTAMP, server_default=func.now())
    sender_personnel_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    report_id = Column(Integer, ForeignKey("reports.id", ondelete="CASCADE"), nullable=False)
    receiver_personnel_id = Column(Integer, ForeignKey("users.id"))
    __table_args__ = (
        CheckConstraint(
            "status IN ('Completed','Pending','Missing')",
            name="ck_submission_status",
        ),
        UniqueConstraint("report_id"),
    )


class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    report_id = Column(Integer, ForeignKey("reports.id", ondelete="CASCADE"))
    comment_type = Column(Text, default="public")
    content = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    __table_args__ = (
        CheckConstraint("comment_type IN ('public','private')", name="ck_comment_type"),
    )


class ActivityEvent(Base):
    __tablename__ = "activity_events"
    id = Column(Integer, primary_key=True)
    title = Column(Text, nullable=False)
    description = Column(Text)
    event_date = Column(Text)
    status = Column(Text, default="pending")
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(TIMESTAMP, server_default=func.now())
    __table_args__ = (
        CheckConstraint("status IN ('pending','approved','rejected')", name="ck_activity_status"),
    )


# ── Event proposal (normalized — replaces the old JSON-blob events table) ───────
class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    title = Column(Text, nullable=False)
    nature = Column(Text, default="Co-curricular")
    target_date = Column(Text)
    venue = Column(Text)
    proposed_budget = Column(Text)
    fund_source = Column(Text)
    focal_name = Column(Text)
    focal_role = Column(Text)
    focal_contact = Column(Text)
    rationale = Column(Text)
    objectives = Column(Text)
    monitoring_criteria = Column(Text)
    status = Column(Text, nullable=False, default="pending_approval")
    created_at = Column(TIMESTAMP, server_default=func.now())
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending_approval','approved','disabled','draft')",
            name="ck_events_status",
        ),
    )


class EventOutput(Base):
    __tablename__ = "event_outputs"
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    output_text = Column(Text, nullable=False)


class EventParticipant(Base):
    __tablename__ = "event_participants"
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    category = Column(Text, nullable=False)
    male_count = Column(Integer, default=0)
    female_count = Column(Integer, default=0)


class EventMethodology(Base):
    __tablename__ = "event_methodology"
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    phase_no = Column(Integer, nullable=False, default=1)
    stage = Column(Text)
    activities = Column(Text)


class EventActivity(Base):
    __tablename__ = "event_activities"
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    activity_day = Column(Text)
    activity_time = Column(Text)
    activity_name = Column(Text)
    speaker = Column(Text)


class EventBudgetItem(Base):
    __tablename__ = "event_budget_items"
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    item_category = Column(Text, nullable=False)  # 'material' | 'snack'
    item_name = Column(Text)
    quantity = Column(Text)
    cost_per_unit = Column(Text)
    total_cost = Column(Text)
    __table_args__ = (
        CheckConstraint("item_category IN ('material','snack')", name="ck_budget_item_category"),
    )


class EventCommittee(Base):
    __tablename__ = "event_committees"
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    committee_type = Column(Text, nullable=False)  # 'executive' | 'twg'
    title = Column(Text)
    __table_args__ = (
        CheckConstraint("committee_type IN ('executive','twg')", name="ck_committee_type"),
    )


class CommitteeMember(Base):
    __tablename__ = "committee_members"
    id = Column(Integer, primary_key=True)
    event_committee_id = Column(Integer, ForeignKey("event_committees.id", ondelete="CASCADE"), nullable=False)
    personnel_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    member_name = Column(Text)
    designation = Column(Text)
    terms_of_reference = Column(Text)
    output = Column(Text)


class EventIndicator(Base):
    __tablename__ = "event_indicators"
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    label = Column(Text, nullable=False)


class EventSignatory(Base):
    __tablename__ = "event_signatories"
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    role = Column(Text, nullable=False)          # Noted / Endorsed / Recommending Approval / Approved
    signatory_name = Column(Text)
    signatory_title = Column(Text)
    sequence = Column(Integer, default=0)


class Subject(Base):
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True)
    subject_name = Column(Text, nullable=False, unique=True)


class SpecialTask(Base):
    __tablename__ = "special_tasks"
    id = Column(Integer, primary_key=True)
    title = Column(Text, nullable=False)
    description = Column(Text)
    assignee_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    assigned_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    due_date = Column(Text)
    status = Column(Text, nullable=False, default="pending")
    created_at = Column(TIMESTAMP, server_default=func.now())
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','submitted','evaluated','flagged')",
            name="ck_special_task_status",
        ),
    )


class SpecialTaskEvaluation(Base):
    __tablename__ = "special_task_evaluations"
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("special_tasks.id", ondelete="CASCADE"), nullable=False)
    evaluator_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    completion_quality_score = Column(Integer, nullable=False, default=0)
    timeliness_score = Column(Integer, nullable=False, default=0)
    initiative_score = Column(Integer, nullable=False, default=0)
    coordination_score = Column(Integer, nullable=False, default=0)
    weighted_average = Column(Float)
    remarks = Column(Text)
    evaluated_at = Column(TIMESTAMP, server_default=func.now())
    __table_args__ = (
        CheckConstraint("completion_quality_score BETWEEN 0 AND 5", name="ck_st_quality"),
        CheckConstraint("timeliness_score BETWEEN 0 AND 5", name="ck_st_timeliness"),
        CheckConstraint("initiative_score BETWEEN 0 AND 5", name="ck_st_initiative"),
        CheckConstraint("coordination_score BETWEEN 0 AND 5", name="ck_st_coordination"),
        UniqueConstraint("task_id"),
    )


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(Text, nullable=False)
    title = Column(Text, nullable=False)
    body = Column(Text)
    ref_id = Column(Integer)
    is_read = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())
    __table_args__ = (
        CheckConstraint(
            "type IN ('task','event','comment','general')",
            name="ck_notification_type",
        ),
    )


# NOTE: Left as-is — the existing supervisor appraisal rubric on school_events.
# A future attendee/QR satisfaction review (venue/speaker/relevance/satisfaction
# on the proposal `events`) will be added separately, not folded into this.
class SchoolEvent(Base):
    __tablename__ = "school_events"
    id = Column(Integer, primary_key=True)
    title = Column(Text, nullable=False)
    description = Column(Text)
    event_date = Column(Text)
    status = Column(Text, nullable=False, default="upcoming")
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(TIMESTAMP, server_default=func.now())
    __table_args__ = (
        CheckConstraint(
            "status IN ('upcoming','ongoing','completed','cancelled')",
            name="ck_school_event_status",
        ),
    )


class EventEvaluation(Base):
    __tablename__ = "event_evaluations"
    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey("school_events.id", ondelete="CASCADE"), nullable=False)
    evaluator_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    evaluator_name = Column(Text, nullable=False)
    evaluator_role = Column(Text)
    planning_score = Column(Integer, nullable=False, default=0)
    objectives_score = Column(Integer, nullable=False, default=0)
    personnel_score = Column(Integer, nullable=False, default=0)
    time_mgmt_score = Column(Integer, nullable=False, default=0)
    engagement_score = Column(Integer, nullable=False, default=0)
    resource_score = Column(Integer, nullable=False, default=0)
    feedback_comments = Column(Text)
    date_submitted = Column(TIMESTAMP, server_default=func.now())
    __table_args__ = (
        CheckConstraint("planning_score BETWEEN 0 AND 5", name="ck_ee_planning"),
        CheckConstraint("objectives_score BETWEEN 0 AND 5", name="ck_ee_objectives"),
        CheckConstraint("personnel_score BETWEEN 0 AND 5", name="ck_ee_personnel"),
        CheckConstraint("time_mgmt_score BETWEEN 0 AND 5", name="ck_ee_time"),
        CheckConstraint("engagement_score BETWEEN 0 AND 5", name="ck_ee_engagement"),
        CheckConstraint("resource_score BETWEEN 0 AND 5", name="ck_ee_resource"),
    )

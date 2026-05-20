"""
TaskNet - User Model (SQLAlchemy ORM)
File: backend-fastapi/models/user_model.py

Declarative mapping for the `users` table and related junction tables.
All FKs, unique constraints, and ORM relationships are explicitly defined.
"""

import enum
from datetime import date, datetime
from sqlalchemy import (
    BigInteger, Boolean, Column, Date, DateTime, Enum,
    ForeignKey, Integer, String, Table, Text, func,
)
from sqlalchemy.orm import DeclarativeBase, relationship


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class UserRole(str, enum.Enum):
    PRINCIPAL   = "principal"
    DEAN        = "dean"
    COORDINATOR = "coordinator"
    REGISTRAR   = "registrar"
    TEACHER     = "teacher"


class UserStatus(str, enum.Enum):
    ACTIVE      = "active"
    DEACTIVATED = "deactivated"


# ---------------------------------------------------------------------------
# Junction: user ↔ grade_level  (many-to-many)
# ---------------------------------------------------------------------------
user_grade_levels = Table(
    "user_grade_levels",
    Base.metadata,
    Column("user_id",        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("grade_level_id", Integer, ForeignKey("grade_levels.id", ondelete="CASCADE"), primary_key=True),
)

# Junction: user ↔ subject  (many-to-many via subject_grade_assignments)
# A teacher can teach multiple subject-grade pairs.
user_subject_grade = Table(
    "user_subject_grade_assignments",
    Base.metadata,
    Column("id",             Integer, primary_key=True, autoincrement=True),
    Column("user_id",        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    Column("grade_level_id", Integer, ForeignKey("grade_levels.id", ondelete="CASCADE"), nullable=False),
    Column("subject_id",     Integer, ForeignKey("subjects.id",      ondelete="CASCADE"), nullable=False),
)


# ---------------------------------------------------------------------------
# GradeLevel
# ---------------------------------------------------------------------------
class GradeLevel(Base):
    __tablename__ = "grade_levels"

    id    = Column(Integer, primary_key=True, autoincrement=True)
    name  = Column(String(50), nullable=False, unique=True)   # e.g. "Grade 1"

    # Relationships
    users = relationship("User", secondary=user_grade_levels, back_populates="grade_levels")


# ---------------------------------------------------------------------------
# Subject
# ---------------------------------------------------------------------------
class Subject(Base):
    __tablename__ = "subjects"

    id   = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)   # e.g. "Mathematics"


# ---------------------------------------------------------------------------
# Department  (used by Dean)
# ---------------------------------------------------------------------------
class Department(Base):
    __tablename__ = "departments"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    name        = Column(String(150), nullable=False, unique=True)
    grade_range = Column(String(50))

    deans = relationship("User", back_populates="department")


# ---------------------------------------------------------------------------
# CoordinatorType  (used by Coordinator)
# ---------------------------------------------------------------------------
class CoordinatorType(Base):
    __tablename__ = "coordinator_types"

    id   = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)

    coordinators = relationship("User", back_populates="coordinator_type")


# ---------------------------------------------------------------------------
# User  (central entity – represents all staff roles)
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    # ── Primary Key ─────────────────────────────────────────────────────────
    id = Column(Integer, primary_key=True, autoincrement=True)

    # ── Identity ─────────────────────────────────────────────────────────────
    employee_no = Column(String(20), unique=True, nullable=True)   # displayed as "ID" in UI
    first_name  = Column(String(80),  nullable=False)
    middle_name = Column(String(80),  nullable=True)
    last_name   = Column(String(80),  nullable=False)
    suffix      = Column(String(20),  nullable=True)

    # ── Account ──────────────────────────────────────────────────────────────
    username        = Column(String(80), unique=True, nullable=True)
    hashed_password = Column(String(256), nullable=False)
    email           = Column(String(200), unique=True, nullable=False)

    # ── Role & Status ─────────────────────────────────────────────────────────
    role   = Column(Enum(UserRole,   name="userrole",   create_type=False, values_callable=lambda x: [e.value for e in x]), nullable=False, default=UserRole.TEACHER)
    status = Column(Enum(UserStatus, name="userstatus", create_type=False, values_callable=lambda x: [e.value for e in x]), nullable=False, default=UserStatus.ACTIVE)

    # ── Contact ──────────────────────────────────────────────────────────────
    contact_number = Column(String(30), nullable=True)
    birthdate      = Column(Date,       nullable=True)
    address        = Column(Text,       nullable=True)

    # ── Government IDs ────────────────────────────────────────────────────────
    tin_number    = Column(String(30), nullable=True)
    gsis_number   = Column(String(30), nullable=True)
    pagibig_number = Column(String(30), nullable=True)
    philhealth_number = Column(String(30), nullable=True)

    # ── Employment ───────────────────────────────────────────────────────────
    date_hired       = Column(Date, nullable=True)
    date_of_appointment = Column(Date, nullable=True)

    # ── Profile Photo ─────────────────────────────────────────────────────────
    avatar_url = Column(String(500), nullable=True)

    # ── FK: Department (for Deans) ────────────────────────────────────────────
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)

    # ── FK: CoordinatorType (for Coordinators) ────────────────────────────────
    coordinator_type_id = Column(Integer, ForeignKey("coordinator_types.id", ondelete="SET NULL"), nullable=True)

    # ── First login flag (cleared after user completes profile setup) ─────────
    first_login = Column(Boolean, nullable=False, default=True, server_default='true')

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    # Granular last-updated timestamps for UI display
    personal_info_updated_at      = Column(DateTime(timezone=True), nullable=True)
    academic_delegation_updated_at = Column(DateTime(timezone=True), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    department       = relationship("Department",      back_populates="deans")
    coordinator_type = relationship("CoordinatorType", back_populates="coordinators")
    grade_levels     = relationship("GradeLevel", secondary=user_grade_levels, back_populates="users")
    delegation_history = relationship("UserDelegationHistory", back_populates="user",
                                      foreign_keys="UserDelegationHistory.user_id",
                                      order_by="UserDelegationHistory.changed_at.desc()")

    # ── Computed helpers ──────────────────────────────────────────────────────
    @property
    def full_name(self) -> str:
        parts = [self.first_name]
        if self.middle_name:
            parts.append(self.middle_name[0] + ".")
        parts.append(self.last_name)
        if self.suffix:
            parts.append(self.suffix)
        return " ".join(parts)

    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE


# ---------------------------------------------------------------------------
# Delegation History  (auto-recorded whenever academic delegation changes)
# ---------------------------------------------------------------------------
class UserDelegationHistory(Base):
    __tablename__ = "user_delegation_history"

    id             = Column(Integer,  primary_key=True, autoincrement=True)
    user_id        = Column(Integer,  ForeignKey("users.id", ondelete="CASCADE"),   nullable=False)
    changed_by_id  = Column(Integer,  ForeignKey("users.id", ondelete="SET NULL"),  nullable=True)
    changed_at     = Column(DateTime(timezone=True), server_default=func.now(),     nullable=False)

    # Snapshot of the delegation state at the time of change
    role                   = Column(String(20),  nullable=True)
    grade_level_handled    = Column(String(50),  nullable=True)   # Dean: grade level name
    coordinator_type       = Column(String(100), nullable=True)   # Coordinator: type name
    subject_grade_summary  = Column(Text,        nullable=True)   # "Math (Grade 1), ..."
    notes                  = Column(String(200), nullable=True)   # Human-readable summary

    # Relationships
    user       = relationship("User", back_populates="delegation_history", foreign_keys=[user_id])
    changed_by = relationship("User", foreign_keys=[changed_by_id])

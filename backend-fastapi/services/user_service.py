"""
TaskNet - User Service (Business Logic)
File: backend-fastapi/services/user_service.py

Strict OOP class-based service. All DB operations live here.
The FastAPI controller never touches SQLAlchemy directly.
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import List, Optional, Tuple
import bcrypt as _bcrypt
from fastapi import HTTPException, status
from sqlalchemy import select, or_, delete
from sqlalchemy.orm import Session, selectinload

from models.user_model import (
    CoordinatorType, Department, GradeLevel, Subject, User, UserDelegationHistory,
    UserRole, UserStatus, user_grade_levels, user_subject_grade,
)
from schemas.user_schema import (
    DelegationHistoryItem, DelegationHistoryResponse,
    GradeLevelBase, SubjectGradeAssignment, UserBriefResponse, UserCreateRequest,
    UserDetailResponse, UserListResponse, UserQuickCreateRequest,
    UserStatusUpdateRequest, UserUpdateRequest,
)

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
def _hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt()).decode()


def _verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _brief(user: User) -> UserBriefResponse:
    """Build a lightweight row response from an ORM User."""
    # Gather subject names from the junction table (loaded via relationship)
    subjects: list[str] = []
    # NOTE: subject_grade_assignments are not a direct relationship on User for brevity;
    # the controller must eagerly load via _load_subjects() below.
    return UserBriefResponse(
        id=user.id,
        employee_no=user.employee_no,
        full_name=user.full_name,
        username=user.username,
        contact_number=user.contact_number,
        email=user.email,
        role=user.role,
        status=user.status,
        grade_levels=user.grade_levels,
        subjects=subjects,
    )


def _require_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _resolve_grade_levels(db: Session, ids: List[int]) -> List[GradeLevel]:
    if not ids:
        return []
    items = db.execute(select(GradeLevel).where(GradeLevel.id.in_(ids))).scalars().all()
    if len(items) != len(set(ids)):
        raise HTTPException(status_code=400, detail="One or more grade_level_ids are invalid")
    return list(items)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------
class UserService:
    """
    Encapsulates all User CRUD, search, and RBAC-aware listing logic.

    Instantiated once per request via FastAPI Dependency Injection.
    """

    def __init__(self, db: Session):
        self._db = db

    # ── List ────────────────────────────────────────────────────────────────
    def list_users(
        self,
        search: Optional[str] = None,
        requesting_user: Optional["User"] = None,
    ) -> UserListResponse:
        """
        RBAC visibility:
          Principal / Registrar  → all users
          Coordinator            → all users (view-only, no edit/deactivate)
          Dean                   → users whose grade_levels overlap with the dean's
                                   department grade levels
          Teacher                → should not reach this endpoint
        """
        stmt = (
            select(User)
            .options(selectinload(User.grade_levels))
            .order_by(User.last_name, User.first_name)
        )

        if search:
            like = f"%{search}%"
            stmt = stmt.where(
                or_(
                    User.first_name.ilike(like),
                    User.last_name.ilike(like),
                    User.email.ilike(like),
                    User.employee_no.ilike(like),
                )
            )

        # Dean: scope to users in the dean's assigned grade level ("department").
        # The dean has exactly one grade level in user_grade_levels — that is their scope.
        # A user is visible to the dean if their grade levels OR subject-grade assignments
        # include the dean's assigned grade level.
        if requesting_user and requesting_user.role == UserRole.DEAN:
            from sqlalchemy import exists
            dean_gl_ids = (
                select(user_grade_levels.c.grade_level_id)
                .where(user_grade_levels.c.user_id == requesting_user.id)
            )
            stmt = stmt.where(
                or_(
                    exists(
                        select(user_grade_levels.c.user_id)
                        .where(user_grade_levels.c.user_id == User.id)
                        .where(user_grade_levels.c.grade_level_id.in_(dean_gl_ids))
                    ),
                    exists(
                        select(user_subject_grade.c.user_id)
                        .where(user_subject_grade.c.user_id == User.id)
                        .where(user_subject_grade.c.grade_level_id.in_(dean_gl_ids))
                    ),
                )
            )

        users: List[User] = self._db.execute(stmt).scalars().all()

        # Attach subject names and derive grade levels from subject assignments
        subject_map   = self._load_subject_names(users)
        subj_gl_map   = self._load_grade_levels_from_subjects(users)

        active, deactivated = [], []
        for u in users:
            brief = _brief(u)
            brief.subjects = subject_map.get(u.id, [])
            # If no grade levels from direct assignment (non-dean roles), derive from subjects
            if not brief.grade_levels:
                brief.grade_levels = subj_gl_map.get(u.id, [])
            if u.status == UserStatus.ACTIVE:
                active.append(brief)
            else:
                deactivated.append(brief)

        return UserListResponse(active=active, deactivated=deactivated, total=len(users))

    # ── Retrieve ────────────────────────────────────────────────────────────
    def get_user(self, user_id: int) -> UserDetailResponse:
        user = self._db.execute(
            select(User)
            .where(User.id == user_id)
            .options(
                selectinload(User.grade_levels),
                selectinload(User.department),
                selectinload(User.coordinator_type),
            )
        ).scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        response = UserDetailResponse.model_validate(user)
        # Load subject-grade assignments (no ORM relationship — query directly)
        rows = self._db.execute(
            select(user_subject_grade.c.grade_level_id, user_subject_grade.c.subject_id)
            .where(user_subject_grade.c.user_id == user_id)
        ).all()
        response.subject_grade_assignments = [
            SubjectGradeAssignment(grade_level_id=r[0], subject_id=r[1]) for r in rows
        ]
        return response

    # ── Quick Create (email + username only, auto-generates password) ────────
    def quick_create_user(self, payload: UserQuickCreateRequest) -> UserDetailResponse:
        existing = self._db.execute(
            select(User).where(or_(User.email == payload.email,
                                   User.username == payload.username if payload.username else False))
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Email or username already in use")

        user = User(
            first_name="",
            last_name="",
            username=payload.username,
            hashed_password=_hash_password(payload.password),
            email=payload.email,
            role=UserRole.TEACHER,
            first_login=True,
        )
        self._db.add(user)
        self._db.commit()
        self._db.refresh(user)
        return UserDetailResponse.model_validate(user)

    # ── Create ──────────────────────────────────────────────────────────────
    def create_user(self, payload: UserCreateRequest) -> UserDetailResponse:
        # Uniqueness guard
        existing = self._db.execute(
            select(User).where(or_(User.email == payload.email,
                                   User.username == payload.username))
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Email or username already in use")

        grade_levels = _resolve_grade_levels(self._db, payload.grade_level_ids)

        user = User(
            first_name=payload.first_name,
            middle_name=payload.middle_name,
            last_name=payload.last_name,
            suffix=payload.suffix,
            username=payload.username,
            hashed_password=_hash_password(payload.password),
            email=payload.email,
            contact_number=payload.contact_number,
            birthdate=payload.birthdate,
            address=payload.address,
            role=payload.role,
            date_of_appointment=payload.date_of_appointment,
            tin_number=payload.tin_number,
            gsis_number=payload.gsis_number,
            pagibig_number=payload.pagibig_number,
            philhealth_number=payload.philhealth_number,
            date_hired=payload.date_hired,
            department_id=payload.department_id,
            grade_levels=grade_levels,
        )
        self._db.add(user)
        self._db.flush()  # get user.id before inserting junction rows

        self._upsert_subject_assignments(user.id, payload.subject_grade_assignments)

        self._db.commit()
        self._db.refresh(user)
        return UserDetailResponse.model_validate(user)

    # ── Update ──────────────────────────────────────────────────────────────
    def update_user(
        self,
        user_id: int,
        payload: UserUpdateRequest,
        changed_by_id: Optional[int] = None,
    ) -> UserDetailResponse:
        user = _require_user(self._db, user_id)

        _PERSONAL_FIELDS = {
            "first_name", "middle_name", "last_name", "suffix",
            "contact_number", "birthdate", "address",
            "tin_number", "gsis_number", "pagibig_number", "philhealth_number",
        }
        _ACADEMIC_FIELDS = {
            "role", "date_of_appointment", "department_id", "coordinator_type_id",
        }

        update_map = payload.model_dump(
            exclude_none=True,
            exclude={"new_password", "grade_level_ids", "subject_grade_assignments"},
        )

        personal_changed  = bool(update_map.keys() & _PERSONAL_FIELDS)
        academic_changed  = bool(update_map.keys() & _ACADEMIC_FIELDS)
        if payload.grade_level_ids is not None:
            academic_changed = True
        if payload.subject_grade_assignments is not None:
            academic_changed = True

        for field, value in update_map.items():
            setattr(user, field, value)

        if payload.new_password:
            user.hashed_password = _hash_password(payload.new_password)

        if payload.first_name and user.first_login:
            user.first_login = False

        if payload.grade_level_ids is not None:
            user.grade_levels = _resolve_grade_levels(self._db, payload.grade_level_ids)

        if payload.subject_grade_assignments is not None:
            self._upsert_subject_assignments(user_id, payload.subject_grade_assignments)

        now = datetime.now(timezone.utc)
        if personal_changed:
            user.personal_info_updated_at = now
        if academic_changed:
            user.academic_delegation_updated_at = now
            self._record_delegation_history(user, user_id, changed_by_id)

        self._db.commit()
        self._db.refresh(user)
        return UserDetailResponse.model_validate(user)

    # ── Status toggle ────────────────────────────────────────────────────────
    def update_status(self, user_id: int, payload: UserStatusUpdateRequest) -> UserDetailResponse:
        """
        RBAC NOTE: Only PRINCIPAL and REGISTRAR may deactivate/reactivate users.
        Enforced in the controller.
        """
        user = _require_user(self._db, user_id)
        user.status = payload.status
        self._db.commit()
        self._db.refresh(user)
        return UserDetailResponse.model_validate(user)

    # ── Lookup helpers ───────────────────────────────────────────────────────
    def list_grade_levels(self) -> List[GradeLevel]:
        from sqlalchemy import case as sa_case
        order = sa_case(
            (GradeLevel.name == 'Kinder', 0),
            else_=GradeLevel.id,
        )
        return self._db.execute(select(GradeLevel).order_by(order)).scalars().all()

    def list_subjects(self) -> List[Subject]:
        return self._db.execute(select(Subject).order_by(Subject.name)).scalars().all()

    def list_departments(self) -> List[Department]:
        return self._db.execute(select(Department).order_by(Department.name)).scalars().all()

    def list_coordinator_types(self) -> List[CoordinatorType]:
        return self._db.execute(select(CoordinatorType).order_by(CoordinatorType.name)).scalars().all()

    # ── Private helpers ──────────────────────────────────────────────────────
    def _upsert_subject_assignments(self, user_id: int, assignments) -> None:
        """Replace subject-grade assignments atomically."""
        self._db.execute(
            delete(user_subject_grade).where(
                user_subject_grade.c.user_id == user_id
            )
        )
        if assignments:
            rows = [
                {"user_id": user_id, "grade_level_id": a.grade_level_id, "subject_id": a.subject_id}
                for a in assignments
            ]
            self._db.execute(user_subject_grade.insert(), rows)

    def _load_subject_names(self, users: List[User]) -> dict[int, list[str]]:
        """Batch-load unique subject names for a list of users to avoid N+1."""
        if not users:
            return {}
        user_ids = [u.id for u in users]
        rows = self._db.execute(
            select(
                user_subject_grade.c.user_id,
                Subject.name,
            )
            .join(Subject, Subject.id == user_subject_grade.c.subject_id)
            .where(user_subject_grade.c.user_id.in_(user_ids))
        ).all()
        result: dict[int, list[str]] = {}
        seen:   dict[int, set[str]]  = {}
        for uid, sname in rows:
            if uid not in seen:
                seen[uid]   = set()
                result[uid] = []
            if sname not in seen[uid]:
                seen[uid].add(sname)
                result[uid].append(sname)
        return result

    def _load_grade_levels_from_subjects(self, users: List[User]) -> dict[int, list]:
        """Batch-load unique grade levels from subject assignments (for non-dean roles)."""
        if not users:
            return {}
        user_ids = [u.id for u in users]
        rows = self._db.execute(
            select(
                user_subject_grade.c.user_id,
                GradeLevel.id,
                GradeLevel.name,
            )
            .join(GradeLevel, GradeLevel.id == user_subject_grade.c.grade_level_id)
            .where(user_subject_grade.c.user_id.in_(user_ids))
        ).all()
        result: dict[int, list] = {}
        seen:   dict[int, set]  = {}
        for uid, gl_id, gl_name in rows:
            if uid not in seen:
                seen[uid]   = set()
                result[uid] = []
            if gl_id not in seen[uid]:
                seen[uid].add(gl_id)
                result[uid].append(GradeLevelBase(id=gl_id, name=gl_name))
        return result

    # ── Delegation history ───────────────────────────────────────────────────
    def get_delegation_history(self, user_id: int) -> DelegationHistoryResponse:
        _require_user(self._db, user_id)
        rows = self._db.execute(
            select(UserDelegationHistory)
            .where(UserDelegationHistory.user_id == user_id)
            .options(selectinload(UserDelegationHistory.changed_by))
            .order_by(UserDelegationHistory.changed_at.desc())
        ).scalars().all()

        items = [
            DelegationHistoryItem(
                id=r.id,
                changed_at=r.changed_at,
                changed_by_name=r.changed_by.full_name if r.changed_by else "System",
                role=r.role,
                grade_level_handled=r.grade_level_handled,
                coordinator_type=r.coordinator_type,
                subject_grade_summary=r.subject_grade_summary,
                notes=r.notes,
            )
            for r in rows
        ]
        return DelegationHistoryResponse(items=items, total=len(items))

    def _record_delegation_history(
        self, user: User, user_id: int, changed_by_id: Optional[int]
    ) -> None:
        """Snapshot the current academic delegation state as a history record."""
        # Build subject-grade summary from junction table
        rows = self._db.execute(
            select(GradeLevel.name, Subject.name)
            .join(user_subject_grade, user_subject_grade.c.grade_level_id == GradeLevel.id)
            .join(Subject, Subject.id == user_subject_grade.c.subject_id)
            .where(user_subject_grade.c.user_id == user_id)
        ).all()
        subj_summary = ", ".join(f"{sn} ({gn})" for gn, sn in rows) or None

        # Grade level handled (for Dean)
        gl_handled = None
        if user.grade_levels:
            gl_handled = user.grade_levels[0].name if user.grade_levels else None

        # Coordinator type name
        ct_name = None
        if user.coordinator_type_id:
            ct = self._db.get(CoordinatorType, user.coordinator_type_id)
            ct_name = ct.name if ct else None

        # Human-readable notes
        parts = [f"Role: {user.role.value}"]
        if gl_handled:
            parts.append(f"Department: {gl_handled}")
        if ct_name:
            parts.append(f"Coordinator type: {ct_name}")
        if subj_summary:
            parts.append(f"Subjects: {subj_summary}")

        record = UserDelegationHistory(
            user_id=user_id,
            changed_by_id=changed_by_id,
            role=user.role.value,
            grade_level_handled=gl_handled,
            coordinator_type=ct_name,
            subject_grade_summary=subj_summary,
            notes=" | ".join(parts),
        )
        self._db.add(record)

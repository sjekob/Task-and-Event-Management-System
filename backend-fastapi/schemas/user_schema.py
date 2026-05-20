"""
TaskNet - User Schemas (Pydantic v2)
File: backend-fastapi/schemas/user_schema.py

Request validation & response serialization. Passwords are write-only (never
returned in responses). All optional fields mirror the nullable ORM columns.
"""

from __future__ import annotations
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from models.user_model import UserRole, UserStatus


# ---------------------------------------------------------------------------
# Shared primitives
# ---------------------------------------------------------------------------
class GradeLevelBase(BaseModel):
    id:   int
    name: str

    model_config = ConfigDict(from_attributes=True)


class SubjectBase(BaseModel):
    id:   int
    name: str

    model_config = ConfigDict(from_attributes=True)


class DepartmentBase(BaseModel):
    id:          int
    name:        str
    grade_range: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CoordinatorTypeBase(BaseModel):
    id:   int
    name: str

    model_config = ConfigDict(from_attributes=True)


class SubjectGradeAssignment(BaseModel):
    """Represents one subject-grade pair in the form (no DB id needed for input)."""
    grade_level_id: int
    subject_id:     int


# ---------------------------------------------------------------------------
# User – create / update payloads
# ---------------------------------------------------------------------------
class UserQuickCreateRequest(BaseModel):
    """Used by the 'Add New User' dialog — admin sets the initial password."""
    email:    EmailStr
    username: str      = Field(..., max_length=80)
    password: str      = Field(..., min_length=6)


class UserCreateRequest(BaseModel):
    # Personal
    first_name:  str = Field(..., min_length=1, max_length=80)
    middle_name: Optional[str] = Field(None, max_length=80)
    last_name:   str = Field(..., min_length=1, max_length=80)
    suffix:      Optional[str] = Field(None, max_length=20)

    # Account
    username: Optional[str] = Field(None, max_length=80)
    password: str           = Field(..., min_length=6)
    email:    EmailStr

    # Contact
    contact_number: Optional[str] = None
    birthdate:      Optional[date] = None
    address:        Optional[str]  = None

    # Role
    role:               UserRole
    date_of_appointment: Optional[date] = None

    # Academic
    grade_level_ids:          List[int]                   = Field(default_factory=list)
    subject_grade_assignments: List[SubjectGradeAssignment] = Field(default_factory=list)

    # IDs
    tin_number:        Optional[str] = None
    gsis_number:       Optional[str] = None
    pagibig_number:    Optional[str] = None
    philhealth_number: Optional[str] = None

    # Employment
    date_hired:          Optional[date] = None
    department_id:       Optional[int]  = None
    coordinator_type_id: Optional[int]  = None


class UserUpdateRequest(BaseModel):
    """All fields optional for PATCH-style updates."""
    first_name:  Optional[str] = Field(None, min_length=1, max_length=80)
    middle_name: Optional[str] = Field(None, max_length=80)
    last_name:   Optional[str] = Field(None, min_length=1, max_length=80)
    suffix:      Optional[str] = Field(None, max_length=20)

    username:     Optional[str]      = Field(None, max_length=80)
    new_password: Optional[str]      = Field(None, min_length=6,
                                             description="Leave blank to keep current password")
    email:        Optional[EmailStr] = None

    contact_number: Optional[str]  = None
    birthdate:      Optional[date]  = None
    address:        Optional[str]   = None

    role:               Optional[UserRole] = None
    date_of_appointment: Optional[date]    = None

    grade_level_ids:          Optional[List[int]]                   = None
    subject_grade_assignments: Optional[List[SubjectGradeAssignment]] = None

    tin_number:        Optional[str] = None
    gsis_number:       Optional[str] = None
    pagibig_number:    Optional[str] = None
    philhealth_number: Optional[str] = None

    date_hired:          Optional[date] = None
    department_id:       Optional[int]  = None
    coordinator_type_id: Optional[int]  = None


class UserStatusUpdateRequest(BaseModel):
    status: UserStatus


# ---------------------------------------------------------------------------
# User – response payloads
# ---------------------------------------------------------------------------
class UserBriefResponse(BaseModel):
    """Lightweight row used in the table listing."""
    id:             int
    employee_no:    Optional[str]
    full_name:      str
    username:       Optional[str]
    contact_number: Optional[str]
    email:          str
    role:           UserRole
    status:         UserStatus
    grade_levels:   List[GradeLevelBase]
    subjects:       List[str]            = Field(default_factory=list,
                                                  description="Flat list of subject names")

    model_config = ConfigDict(from_attributes=True)


class UserDetailResponse(BaseModel):
    """Full record returned from GET /users/{id}."""
    id:             int
    employee_no:    Optional[str]
    first_name:     str
    middle_name:    Optional[str]
    last_name:      str
    suffix:         Optional[str]
    full_name:      str
    username:       Optional[str]
    email:          str
    role:           UserRole
    status:         UserStatus

    contact_number: Optional[str]
    birthdate:      Optional[date]
    address:        Optional[str]

    tin_number:        Optional[str]
    gsis_number:       Optional[str]
    pagibig_number:    Optional[str]
    philhealth_number: Optional[str]

    date_hired:         Optional[date]
    date_of_appointment: Optional[date]

    avatar_url:       Optional[str]
    department:       Optional[DepartmentBase]
    coordinator_type: Optional[CoordinatorTypeBase] = None
    grade_levels:     List[GradeLevelBase]
    subject_grade_assignments: List[SubjectGradeAssignment] = Field(default_factory=list)

    first_login: bool = True

    created_at: datetime
    updated_at: datetime
    personal_info_updated_at:       Optional[datetime] = None
    academic_delegation_updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DelegationHistoryItem(BaseModel):
    id:                    int
    changed_at:            datetime
    changed_by_name:       Optional[str] = None
    role:                  Optional[str] = None
    grade_level_handled:   Optional[str] = None
    coordinator_type:      Optional[str] = None
    subject_grade_summary: Optional[str] = None
    notes:                 Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DelegationHistoryResponse(BaseModel):
    items: List[DelegationHistoryItem]
    total: int


class UserListResponse(BaseModel):
    active:      List[UserBriefResponse]
    deactivated: List[UserBriefResponse]
    total:       int


# ---------------------------------------------------------------------------
# Lookup helpers (dropdowns)
# ---------------------------------------------------------------------------
class GradeLevelListResponse(BaseModel):
    items: List[GradeLevelBase]


class SubjectListResponse(BaseModel):
    items: List[SubjectBase]


class DepartmentListResponse(BaseModel):
    items: List[DepartmentBase]


class CoordinatorTypeListResponse(BaseModel):
    items: List[CoordinatorTypeBase]

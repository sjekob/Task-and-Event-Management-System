from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
from app.models.models import UserRole, TaskStatus

# ─── Auth ────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

# ─── User ────────────────────────────────────────────────────────────────────
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.teacher

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    avatar_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# ─── Task ────────────────────────────────────────────────────────────────────
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    assignee_id: Optional[int] = None
    event_id: Optional[int] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    due_date: Optional[datetime] = None
    assignee_id: Optional[int] = None

class TaskResponse(TaskBase):
    id: int
    status: TaskStatus
    creator_id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

# ─── Event ───────────────────────────────────────────────────────────────────
# ─── Event ───────────────────────────────────────────────
from app.models.models import EventStatus

class EventCreate(BaseModel):
    title:           str
    nature:          Optional[str] = None
    target_date:     Optional[str] = None
    venue:           Optional[str] = None
    proposed_budget: Optional[str] = None
    fund_source:     Optional[str] = None
    focal_name:      Optional[str] = None
    focal_role:      Optional[str] = None
    focal_contact:   Optional[str] = None
    expected_outputs: Optional[str] = None
    participants:    Optional[str] = None
    rationale:       Optional[str] = None
    objectives:      Optional[str] = None
    phase1:          Optional[str] = None
    phase2:          Optional[str] = None
    phase3:          Optional[str] = None
    activity_matrix:    Optional[str] = None
    training_materials: Optional[str] = None
    snacks:             Optional[str] = None
    exec_committee:     Optional[str] = None
    twg_groups:         Optional[str] = None
    monitoring_criteria: Optional[str] = None
    indicators:          Optional[str] = None
    comments:            Optional[str] = None

class EventUpdate(BaseModel):
    status: Optional[EventStatus] = None
    title:  Optional[str] = None
    nature: Optional[str] = None
    target_date: Optional[str] = None
    venue:  Optional[str] = None

class EventResponse(EventCreate):
    id:         int
    status:     EventStatus
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# ─── Dashboard ───────────────────────────────────────────────────────────────
class DashboardStats(BaseModel):
    pending_count: int
    submitted_count: int
    missing_count: int

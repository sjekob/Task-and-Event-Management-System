from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.session import get_db
from app.models.models import User, Task, TaskStatus
from app.schemas.schemas import LoginRequest, TokenResponse, UserResponse, DashboardStats
from app.core.security import (
    verify_password, create_access_token,
    create_refresh_token, get_current_user
)

router = APIRouter()

# ─── POST /auth/login ─────────────────────────────────────────────────────────
@router.post("/auth/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password")

    return TokenResponse(
        access_token=create_access_token({"sub": user.username}),
        refresh_token=create_refresh_token({"sub": user.username}),
    )

# ─── GET /auth/me ─────────────────────────────────────────────────────────────
@router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ─── GET /dashboard/stats ────────────────────────────────────────────────────
@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    async def count_tasks(status: TaskStatus) -> int:
        result = await db.execute(
            select(func.count(Task.id))
            .where(Task.assignee_id == current_user.id,
                   Task.status == status))
        return result.scalar() or 0

    return DashboardStats(
        pending_count=await count_tasks(TaskStatus.pending),
        submitted_count=await count_tasks(TaskStatus.submitted),
        missing_count=await count_tasks(TaskStatus.missing),
    )

from app.schemas.schemas import UserCreate
from app.core.security import hash_password
from app.models.models import UserRole

# POST /auth/register
@router.post("/auth/register", response_model=UserResponse,
             status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    # Check if username exists
    result = await db.execute(
        select(User).where(User.username == payload.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Username already registered")

    user = User(
        username=payload.username,
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
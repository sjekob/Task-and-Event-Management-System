"""
TaskNet - User Controller (FastAPI Router)
File: backend-fastapi/controllers/user_controller.py

All routes are RBAC-guarded. The controller delegates 100% of
business logic to UserService — it only validates auth and marshals responses.

Mount in main.py:
    from controllers.user_controller import router as user_router
    app.include_router(user_router, prefix="/api/v1/users", tags=["User Management"])
"""

import os, shutil
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_user  # JWT decode → User ORM object
from models.user_model import User, UserRole
from schemas.user_schema import (
    CoordinatorTypeListResponse,
    DelegationHistoryResponse,
    DepartmentListResponse,
    GradeLevelListResponse,
    SubjectListResponse,
    UserCreateRequest,
    UserDetailResponse,
    UserListResponse,
    UserQuickCreateRequest,
    UserStatusUpdateRequest,
    UserUpdateRequest,
)
from services.user_service import UserService

router = APIRouter()

# ---------------------------------------------------------------------------
# Dependency: DB session
# ---------------------------------------------------------------------------
DbDep = Annotated[Session, Depends(get_db)]

# ---------------------------------------------------------------------------
# RBAC helpers
# ---------------------------------------------------------------------------
_MANAGE_USERS_ROLES = {UserRole.PRINCIPAL, UserRole.REGISTRAR}  # Principal + Registrar manage users
_VIEW_USERS_ROLES   = {UserRole.PRINCIPAL, UserRole.REGISTRAR, UserRole.DEAN, UserRole.COORDINATOR}


def _require_role(allowed: set[UserRole]):
    """
    Returns a FastAPI dependency factory that raises 403 if the
    authenticated user's role is not in `allowed`.
    """
    def _guard(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of: {[r.value for r in allowed]}",
            )
        return current_user
    return _guard


ManagersOnly = Depends(_require_role(_MANAGE_USERS_ROLES))
ViewersOnly   = Depends(_require_role(_VIEW_USERS_ROLES))


# ---------------------------------------------------------------------------
# Service factory (DI)
# ---------------------------------------------------------------------------
def get_service(db: DbDep) -> UserService:
    return UserService(db)

ServiceDep = Annotated[UserService, Depends(get_service)]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=UserListResponse,
    summary="List all users (active + deactivated)",
    description="Returns two separate lists. RBAC: Principal/Registrar sees all; Dean/Coordinator are scoped server-side.",
)
def list_users(
    service: ServiceDep,
    search: Optional[str] = Query(None, description="Search by name, email, or ID"),
    current_user: User = ViewersOnly,
):
    return service.list_users(search=search, requesting_user=current_user)


@router.get(
    "/{user_id}",
    response_model=UserDetailResponse,
    summary="Get full details for a single user",
)
def get_user(
    user_id: int,
    service: ServiceDep,
    current_user: Annotated[User, Depends(get_current_user)],
):
    # Any authenticated user may fetch their own profile (needed for first-login flow).
    # Fetching another user's profile requires a viewer role.
    if current_user.id != user_id and current_user.role not in _VIEW_USERS_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Requires one of: {[r.value for r in _VIEW_USERS_ROLES]}",
        )
    return service.get_user(user_id)


@router.post(
    "/quick-create",
    response_model=UserDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a user with just email + username (auto-generates password)",
    description="RBAC: Principal and Registrar only. User fills profile on first login.",
)
def quick_create_user(
    payload: UserQuickCreateRequest,
    service: ServiceDep,
    current_user: User = ManagersOnly,
):
    return service.quick_create_user(payload)


@router.post(
    "",
    response_model=UserDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user",
    description="RBAC: Principal and Registrar only.",
)
def create_user(
    payload: UserCreateRequest,
    service: ServiceDep,
    current_user: User = ManagersOnly,
):
    return service.create_user(payload)


@router.patch(
    "/{user_id}",
    response_model=UserDetailResponse,
    summary="Update an existing user",
    description="RBAC: Users may update their own profile; Principal/Registrar may update anyone.",
)
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    service: ServiceDep,
    current_user: Annotated[User, Depends(get_current_user)],
):
    # Any user can update their own profile (first-login setup, profile edits).
    # Updating another user requires manager role.
    if current_user.id != user_id and current_user.role not in _MANAGE_USERS_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Requires one of: {[r.value for r in _MANAGE_USERS_ROLES]}",
        )
    return service.update_user(user_id, payload, changed_by_id=current_user.id)


@router.patch(
    "/{user_id}/status",
    response_model=UserDetailResponse,
    summary="Activate or deactivate a user",
    description="RBAC: Principal and Registrar only.",
)
def update_user_status(
    user_id: int,
    payload: UserStatusUpdateRequest,
    service: ServiceDep,
    current_user: User = ManagersOnly,
):
    # [RBAC] Prevent principal/registrar from deactivating themselves
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own account status")
    return service.update_status(user_id, payload)


# ---------------------------------------------------------------------------
# Avatar upload
# ---------------------------------------------------------------------------

@router.post(
    "/{user_id}/avatar",
    response_model=UserDetailResponse,
    summary="Upload or replace a user's profile photo",
)
async def upload_avatar(
    user_id: int,
    file: UploadFile,
    db: DbDep,
    current_user: Annotated[User, Depends(get_current_user)],
):
    if current_user.id != user_id and current_user.role not in _MANAGE_USERS_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    ext = os.path.splitext(file.filename or "avatar.jpg")[1] or ".jpg"
    fname = f"user_{user_id}{ext}"
    dest = f"/app/uploads/avatars/{fname}"
    with open(dest, "wb") as out:
        shutil.copyfileobj(file.file, out)

    user: User = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.avatar_url = f"/static/avatars/{fname}"
    db.commit()
    db.refresh(user)
    return UserDetailResponse.model_validate(user)


# ---------------------------------------------------------------------------
# Delegation history
# ---------------------------------------------------------------------------

@router.get(
    "/{user_id}/history",
    response_model=DelegationHistoryResponse,
    summary="Get academic delegation history for a user",
)
def get_delegation_history(
    user_id: int,
    service: ServiceDep,
    current_user: Annotated[User, Depends(get_current_user)],
):
    if current_user.id != user_id and current_user.role not in _VIEW_USERS_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return service.get_delegation_history(user_id)


# ---------------------------------------------------------------------------
# Lookup endpoints (used to populate dropdowns in the Flutter form)
# ---------------------------------------------------------------------------

@router.get(
    "/meta/grade-levels",
    response_model=GradeLevelListResponse,
    summary="List all grade levels (for dropdowns)",
)
def list_grade_levels(
    service: ServiceDep,
    current_user: User = ViewersOnly,
):
    return GradeLevelListResponse(items=service.list_grade_levels())


@router.get(
    "/meta/subjects",
    response_model=SubjectListResponse,
    summary="List all subjects (for dropdowns)",
)
def list_subjects(
    service: ServiceDep,
    current_user: User = ViewersOnly,
):
    return SubjectListResponse(items=service.list_subjects())


@router.get(
    "/meta/departments",
    response_model=DepartmentListResponse,
    summary="List all departments (for Dean assignment)",
)
def list_departments(
    service: ServiceDep,
    current_user: User = ViewersOnly,
):
    return DepartmentListResponse(items=service.list_departments())


@router.get(
    "/meta/coordinator-types",
    response_model=CoordinatorTypeListResponse,
    summary="List all coordinator types (for Coordinator assignment)",
)
def list_coordinator_types(
    service: ServiceDep,
    current_user: User = ViewersOnly,
):
    return CoordinatorTypeListResponse(items=service.list_coordinator_types())

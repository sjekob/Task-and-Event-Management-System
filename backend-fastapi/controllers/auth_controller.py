"""
TaskNet - Auth Controller
File: controllers/auth_controller.py

Provides the /token login endpoint consumed by the Flutter app.
Uses FastAPI's OAuth2PasswordRequestForm (email sent as 'username' field).
"""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

import bcrypt as _bcrypt

from core.database import get_db
from core.security import create_access_token
from models.user_model import User, UserStatus

router = APIRouter()

def _verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


# ── Response schema ───────────────────────────────────────────────────────────
class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user_id:      int
    role:         str
    full_name:    str


# ── Login ─────────────────────────────────────────────────────────────────────
@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Login — returns a JWT access token",
)
def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db:   Session = Depends(get_db),
):
    """
    Flutter sends:  POST /api/v1/auth/token
                    Content-Type: application/x-www-form-urlencoded
                    username=<username>&password=<password>
    """
    user: User | None = db.query(User).filter(User.username == form.username).first()

    if not user or not _verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status == UserStatus.DEACTIVATED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact your administrator.",
        )

    token = create_access_token(user.id)

    return TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role.value,
        full_name=user.full_name,
    )

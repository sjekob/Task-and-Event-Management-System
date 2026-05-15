"""
TaskNet - FastAPI Entry Point
File: main.py

Run with:  uvicorn main:app --reload
           uvicorn main:app --host 0.0.0.0 --port 8000
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import settings
from controllers.auth_controller import router as auth_router
from controllers.user_controller import router as user_router

# ── App instance ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="TaskNet API",
    description="School Management & Task Delegation System — Naga Central School II",
    version="1.0.0",
    docs_url="/docs",       # Swagger UI  → http://localhost:8000/docs
    redoc_url="/redoc",     # ReDoc UI    → http://localhost:8000/redoc
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,        # Set in .env → ALLOWED_ORIGINS
    allow_origin_regex=r"http://localhost:.*",   # Allow any localhost port (Flutter dev)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static file serving (uploaded avatars, etc.) ─────────────────────────────
os.makedirs("/app/uploads/avatars", exist_ok=True)
app.mount("/static", StaticFiles(directory="/app/uploads"), name="static")

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "app": "TaskNet API"}


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/v1/auth",  tags=["Auth"])
app.include_router(user_router, prefix="/api/v1/users", tags=["User Management"])

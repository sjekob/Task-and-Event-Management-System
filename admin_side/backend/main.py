import os
import sys
from typing import List, Optional
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

# Dynamically add the workspace root to sys.path to import core models
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.append(ROOT_DIR)

from backend.app.models import (
    User,
    SpecialTask,
    SpecialTaskEvaluation,
    Event,
    EventEvaluation,
    ReportSubmission,
    AppraisalRecord,
    PerformanceSummary,
)
from admin_side.backend.database import get_db

app = FastAPI(
    title="Personnel Appraisal — Admin API",
    description="Administrative console backend for Naga Central School II",
    version="1.0.0",
)

# Enable CORS for development and cross-port communications
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function for server time
def _now_str() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

# ─────────────────────────────────────────────────────────────────────────────
# Pydantic Input Schemas
# ─────────────────────────────────────────────────────────────────────────────

class UserIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    role: str = Field(..., description="Teacher|Student|Dean|Coordinator|Principal|Admin")
    department: Optional[str] = Field(None, max_length=100)

class SpecialTaskIn(BaseModel):
    id: Optional[str] = Field(None, description="Task ID (e.g., ST007). Auto-generated if omitted.")
    personnel: str = Field(..., min_length=1, max_length=120)
    department: str = Field(..., min_length=1, max_length=100)
    task: str = Field(..., min_length=1, max_length=255)
    assigned_by: str = Field(..., min_length=1, max_length=120)
    due_date: str = Field(..., description="YYYY-MM-DD")

class EventIn(BaseModel):
    id: str = Field(..., description="Event ID (e.g., EV005)")
    name: str = Field(..., min_length=1, max_length=255)
    date: str = Field(..., description="YYYY-MM-DD")
    organizer: str = Field(..., min_length=1, max_length=120)
    department: str = Field(..., min_length=1, max_length=100)
    attendees: int = Field(0, ge=0)

# ─────────────────────────────────────────────────────────────────────────────
# Admin Endpoints — System Statistics
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/admin/stats", tags=["Admin System"])
def get_admin_stats(db: Session = Depends(get_db)):
    """
    Get aggregated system statistics for the Admin Dashboard.
    """
    try:
        user_count = db.query(User).count()
        task_count = db.query(SpecialTask).count()
        event_count = db.query(Event).count()
        
        appraisals_q = db.query(AppraisalRecord)
        total_appraisals = appraisals_q.count()
        flagged_appraisals = appraisals_q.filter(AppraisalRecord.appraisal_status == "Flagged").count()
        locked_appraisals = appraisals_q.filter(AppraisalRecord.is_locked == True).count()
        archived_appraisals = appraisals_q.filter(AppraisalRecord.is_archived == True).count()
        
        # Get count of submissions by status
        pending_tasks = db.query(SpecialTask).filter(SpecialTask.status == "pending").count()
        awaiting_events = db.query(Event).filter(Event.status == "awaitingRatings").count()
        
        return {
            "total_users": user_count,
            "total_tasks": task_count,
            "total_events": event_count,
            "total_appraisals": total_appraisals,
            "flagged_appraisals": flagged_appraisals,
            "locked_appraisals": locked_appraisals,
            "archived_appraisals": archived_appraisals,
            "pending_tasks": pending_tasks,
            "awaiting_events": awaiting_events,
            "server_time": _now_str()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database aggregation failed: {str(e)}")

# ─────────────────────────────────────────────────────────────────────────────
# Admin Endpoints — User Management
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/admin/users", tags=["Admin Users"])
def list_users(
    role: Optional[str] = None, 
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List users with search and role filtering.
    """
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    if search:
        q = q.filter(User.name.like(f"%{search}%") | User.department.like(f"%{search}%"))
    return q.all()

@app.post("/api/admin/users", status_code=201, tags=["Admin Users"])
def create_user(payload: UserIn, db: Session = Depends(get_db)):
    """
    Create a new user.
    """
    allowed_roles = {"Teacher", "Student", "Dean", "Coordinator", "Principal", "Admin"}
    if payload.role not in allowed_roles:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid role '{payload.role}'. Must be one of: {', '.join(allowed_roles)}"
        )
        
    db_user = User(
        name=payload.name,
        role=payload.role,
        department=payload.department
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.put("/api/admin/users/{user_id}", tags=["Admin Users"])
def update_user(user_id: int, payload: UserIn, db: Session = Depends(get_db)):
    """
    Update details of an existing user.
    """
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    allowed_roles = {"Teacher", "Student", "Dean", "Coordinator", "Principal", "Admin"}
    if payload.role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Invalid role specified")
        
    db_user.name = payload.name
    db_user.role = payload.role
    db_user.department = payload.department
    
    db.commit()
    db.refresh(db_user)
    return db_user

@app.delete("/api/admin/users/{user_id}", tags=["Admin Users"])
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """
    Delete a user.
    """
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted successfully", "user_id": user_id}

# ─────────────────────────────────────────────────────────────────────────────
# Admin Endpoints — Special Tasks
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/admin/tasks", tags=["Admin Tasks"])
def list_tasks(db: Session = Depends(get_db)):
    """
    List all special tasks.
    """
    return db.query(SpecialTask).all()

@app.post("/api/admin/tasks", status_code=201, tags=["Admin Tasks"])
def create_task(payload: SpecialTaskIn, db: Session = Depends(get_db)):
    """
    Create a new special task.
    """
    # Auto-generate task ID if omitted
    task_id = payload.id
    if not task_id:
        # Determine next ID
        count = db.query(SpecialTask).count()
        task_id = f"ST{count + 1:03d}"
        # Ensure uniqueness
        while db.query(SpecialTask).filter(SpecialTask.id == task_id).first() is not None:
            count += 1
            task_id = f"ST{count + 1:03d}"

    existing = db.query(SpecialTask).filter(SpecialTask.id == task_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Task with ID {task_id} already exists")

    db_task = SpecialTask(
        id=task_id,
        personnel=payload.personnel,
        department=payload.department,
        task=payload.task,
        assigned_by=payload.assigned_by,
        due_date=payload.due_date,
        status="pending",
        score=None
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@app.delete("/api/admin/tasks/{task_id}", tags=["Admin Tasks"])
def delete_task(task_id: str, db: Session = Depends(get_db)):
    """
    Delete a special task and its associated evaluations/appraisals.
    """
    db_task = db.query(SpecialTask).filter(SpecialTask.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Special task not found")
    
    # Clean up associated evaluations
    db.query(SpecialTaskEvaluation).filter(SpecialTaskEvaluation.task_id == task_id).delete()
    
    db.delete(db_task)
    db.commit()
    return {"message": "Special task deleted successfully", "task_id": task_id}

# ─────────────────────────────────────────────────────────────────────────────
# Admin Endpoints — Events
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/admin/events", tags=["Admin Events"])
def list_events(db: Session = Depends(get_db)):
    """
    List all events.
    """
    return db.query(Event).all()

@app.post("/api/admin/events", status_code=201, tags=["Admin Events"])
def create_event(payload: EventIn, db: Session = Depends(get_db)):
    """
    Create a new event.
    """
    existing = db.query(Event).filter(Event.id == payload.id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Event with ID {payload.id} already exists")

    db_event = Event(
        id=payload.id,
        name=payload.name,
        date=payload.date,
        organizer=payload.organizer,
        department=payload.department,
        attendees=payload.attendees,
        status="awaitingRatings"
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

@app.delete("/api/admin/events/{event_id}", tags=["Admin Events"])
def delete_event(event_id: str, db: Session = Depends(get_db)):
    """
    Delete an event and its associated evaluations.
    """
    db_event = db.query(Event).filter(Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    db.query(EventEvaluation).filter(EventEvaluation.event_id == event_id).delete()
    db.delete(db_event)
    db.commit()
    return {"message": "Event deleted successfully", "event_id": event_id}

# ─────────────────────────────────────────────────────────────────────────────
# Admin Endpoints — Appraisals & Performance
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/admin/appraisals", tags=["Admin Appraisals"])
def list_appraisals(
    personnel_id: Optional[int] = None,
    appraisal_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List all appraisal records, optionally filtering by personnel or type.
    """
    q = db.query(AppraisalRecord)
    if personnel_id:
        q = q.filter(AppraisalRecord.personnel_id == personnel_id)
    if appraisal_type:
        q = q.filter(AppraisalRecord.appraisal_type == appraisal_type)
    return q.all()

@app.patch("/api/admin/appraisals/{appraisal_id}/lock", tags=["Admin Appraisals"])
def toggle_appraisal_lock(appraisal_id: int, db: Session = Depends(get_db)):
    """
    Toggle lock state of an appraisal record.
    """
    rec = db.query(AppraisalRecord).filter(AppraisalRecord.appraisal_id == appraisal_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Appraisal record not found")
    
    rec.is_locked = not rec.is_locked
    db.commit()
    db.refresh(rec)
    return {"appraisal_id": appraisal_id, "is_locked": rec.is_locked}

@app.patch("/api/admin/appraisals/{appraisal_id}/archive", tags=["Admin Appraisals"])
def toggle_appraisal_archive(appraisal_id: int, db: Session = Depends(get_db)):
    """
    Toggle archive state of an appraisal record.
    """
    rec = db.query(AppraisalRecord).filter(AppraisalRecord.appraisal_id == appraisal_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Appraisal record not found")
        
    rec.is_archived = not rec.is_archived
    db.commit()
    db.refresh(rec)
    return {"appraisal_id": appraisal_id, "is_archived": rec.is_archived}

@app.get("/api/admin/summaries", tags=["Admin Summaries"])
def list_performance_summaries(db: Session = Depends(get_db)):
    """
    List all monthly performance summaries.
    """
    return db.query(PerformanceSummary).all()

# ─────────────────────────────────────────────────────────────────────────────
# Static Frontend Serving
# ─────────────────────────────────────────────────────────────────────────────

# Resolve path to the admin frontend assets
FRONTEND_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
    "frontend"
)

# Ensure the frontend folder exists, otherwise we'll serve a temporary error
if not os.path.exists(FRONTEND_DIR):
    os.makedirs(FRONTEND_DIR, exist_ok=True)

# Mount frontend asset directory (js, css, images)
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/")
def serve_index():
    """
    Serve index.html at root url.
    """
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "status": "online",
        "message": "Admin API is running. Frontend static assets are missing or being built.",
        "admin_api_docs": "/docs"
    }

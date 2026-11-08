import datetime
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
import audit
import store
from pydantic import BaseModel, model_validator
from typing import Optional
from database import connect_db
from auth import get_current_user, require_admin_or_principal, require_permission
from files import save_upload
import task_scanner
import calendar_plan
import calendar_tasks

router = APIRouter(tags=["Templates"])


class TemplateCreate(BaseModel):
    title: str
    instructions: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    due_time: Optional[str] = None
    points_early: int = 100
    points_ontime: int = 100
    points_late24: int = 50
    points_after24: int = 0


@router.post("/api/templates")
def create_template(req: TemplateCreate, request: Request, user=Depends(require_admin_or_principal)):
    db = connect_db()
    uid = int(user["sub"])
    template_id = store.create_template(db, {
        "title": req.title, "instructions": req.instructions, "start_date": req.start_date, "end_date": req.end_date,
        "due_time": req.due_time, "points_early": req.points_early, "points_ontime": req.points_ontime,
        "points_late24": req.points_late24, "points_after24": req.points_after24, "created_by": uid})
    audit.record(db, user, "template.create", "template", template_id,
                 f"Created task template {req.title}", request=request)
    db.commit()
    db.close()
    return {"id": template_id, "message": "Template created"}


@router.post("/api/templates/scan")
async def scan_task_file(file: UploadFile, user=Depends(get_current_user)):
    """Read an uploaded document (PDF, Word, text or photo) and return the task
    fields found in it, to pre-fill the task/template form. Nothing is stored."""
    data = await file.read(task_scanner.MAX_BYTES + 1)
    try:
        # OCR can take a few seconds; keep it off the event loop.
        return await run_in_threadpool(task_scanner.scan, data, file.filename or "")
    except ValueError as e:
        raise HTTPException(400, str(e))


require_calendar_manager = require_permission(
    "post_school_calendar", "Only the Principal, Registrar or Admin can post the school calendar as tasks")


@router.post("/api/tasks/scan-calendar")
async def scan_school_calendar(file: UploadFile, user=Depends(require_calendar_manager)):
    """Read a school calendar (PDF, Word, text or photo) and propose the tasks
    it implies, one per dated row plus suggested follow-ups. Nothing is
    created here; the principal reviews the list and posts the ones they want."""
    data = await file.read(task_scanner.MAX_BYTES + 1)
    try:
        result = await run_in_threadpool(task_scanner.scan, data, file.filename or "")
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not result["items"]:
        raise HTTPException(400, "No dated schedule was found in that file. Upload a school calendar "
                                 "that lists dates with what happens on each.")
    return {"title": result["title"], "tasks": calendar_plan.plan_calendar_tasks(result["items"])}


class CalendarTaskRow(BaseModel):
    title: str
    start_date: str
    end_date: str
    instructions: Optional[str] = None
    route: str = "later"

    # The principal may change the dates, so check them here rather than trust the scan.
    @model_validator(mode="after")
    def _dates(self):
        try:
            start, end = datetime.date.fromisoformat(self.start_date), datetime.date.fromisoformat(self.end_date)
        except ValueError:
            raise ValueError(f"'{self.title}' needs a valid start and due date")
        if end < start:
            raise ValueError(f"'{self.title}' is due before it starts")
        return self


class CalendarTasksPost(BaseModel):
    file_name: str = "school calendar"
    rows: list[CalendarTaskRow]


@router.post("/api/tasks/from-calendar")
def post_calendar_tasks(req: CalendarTasksPost, request: Request, user=Depends(require_calendar_manager)):
    """Create the calendar tasks the principal kept and assign each along its
    route; grade submissions go to every teacher, reviewed by their grade's dean."""
    if not req.rows:
        raise HTTPException(400, "Choose at least one task to post")
    db = connect_db()
    try:
        result = calendar_tasks.post_calendar_tasks(
            db, user, [r.model_dump() for r in req.rows], req.file_name[:120], request)
        db.commit()
    finally:
        db.close()
    return result


@router.get("/api/templates")
def get_templates(user=Depends(get_current_user)):
    db = connect_db()
    rows = db.execute(
        """SELECT t.*, u.full_name as created_by_name
           FROM task_templates t
           LEFT JOIN users u ON u.id = t.created_by
           ORDER BY t.created_at DESC"""
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


@router.delete("/api/templates/{template_id}")
def delete_template(template_id: int, request: Request, user=Depends(require_admin_or_principal)):
    db = connect_db()
    tpl = db.execute("SELECT title FROM task_templates WHERE id=?", (template_id,)).fetchone()
    db.execute("DELETE FROM task_template WHERE id=?", (template_id,))
    if tpl:
        audit.record(db, user, "template.delete", "template", template_id,
                     f"Deleted task template {tpl['title']}", request=request)
    db.commit()
    db.close()
    return {"message": "Template deleted"}


@router.post("/api/upload")
async def upload_file(file: UploadFile, user=Depends(get_current_user)):
    return await save_upload(file)

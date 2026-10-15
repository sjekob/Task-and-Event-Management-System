import datetime
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
import audit
from pydantic import BaseModel
from typing import Optional
from database import connect_db
from auth import get_current_user, require_admin_or_principal, require_permission
from files import save_upload
import task_scanner

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
    db.execute(
        """INSERT INTO task_templates
           (title, instructions, start_date, end_date, due_time,
            points_early, points_ontime, points_late24, points_after24, created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (req.title, req.instructions, req.start_date, req.end_date, req.due_time,
         req.points_early, req.points_ontime, req.points_late24, req.points_after24, uid)
    )
    template_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
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
    "manage_school_years", "Only the Principal or Admin can scan the school calendar into tasks")


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
    return {"title": result["title"], "tasks": task_scanner.plan_calendar_tasks(result["items"])}


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
    db.execute("DELETE FROM task_templates WHERE id=?", (template_id,))
    if tpl:
        audit.record(db, user, "template.delete", "template", template_id,
                     f"Deleted task template {tpl['title']}", request=request)
    db.commit()
    db.close()
    return {"message": "Template deleted"}


@router.post("/api/upload")
async def upload_file(file: UploadFile, user=Depends(get_current_user)):
    return await save_upload(file)

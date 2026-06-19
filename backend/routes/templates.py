import datetime
from fastapi import APIRouter, HTTPException, Depends, UploadFile
from pydantic import BaseModel
from typing import Optional
from database import connect_db
from auth import get_current_user, require_admin_or_principal

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
def create_template(req: TemplateCreate, user=Depends(require_admin_or_principal)):
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
    db.commit()
    db.close()
    return {"id": template_id, "message": "Template created"}


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
def delete_template(template_id: int, user=Depends(require_admin_or_principal)):
    db = connect_db()
    db.execute("DELETE FROM task_templates WHERE id=?", (template_id,))
    db.commit()
    db.close()
    return {"message": "Template deleted"}


@router.post("/api/upload")
async def upload_file(file: UploadFile, user=Depends(get_current_user)):
    fname = f"{int(datetime.datetime.now().timestamp())}_{file.filename}"
    with open(f"uploads/{fname}", "wb") as out:
        out.write(await file.read())
    return {"url": f"/uploads/{fname}", "name": file.filename}

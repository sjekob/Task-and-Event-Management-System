import datetime
from fastapi import APIRouter, HTTPException, Depends, UploadFile
from pydantic import BaseModel
from typing import Optional
from database import get_db
from auth import get_current_user, TASK_CREATORS

router = APIRouter(tags=["Reports"])


# ── Reports ───────────────────────────────────────────────────────────────────

class SubmitReportRequest(BaseModel):
    report_title: str
    report_description: Optional[str] = None
    report_type: Optional[str] = None
    report_link_url: Optional[str] = None


@router.post("/api/tasks/{task_id}/reports")
def submit_report(task_id: int, req: SubmitReportRequest, user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])

    assigned = db.execute(
        "SELECT assigned_by FROM task_assignments WHERE task_id=? AND user_id=?",
        (task_id, uid)
    ).fetchone()
    if not assigned:
        db.close()
        raise HTTPException(403, "Not assigned to this task")

    db.execute(
        """INSERT INTO reports
           (task_id, personnel_id, report_title, report_description,
            report_type, report_link_url, report_date, report_status)
           VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP,'Pending')
           ON CONFLICT(task_id, personnel_id) DO UPDATE SET
               report_title=excluded.report_title,
               report_description=excluded.report_description,
               report_type=excluded.report_type,
               report_link_url=excluded.report_link_url,
               report_date=CURRENT_TIMESTAMP,
               report_status='Pending'""",
        (task_id, uid, req.report_title, req.report_description,
         req.report_type, req.report_link_url)
    )
    report_id = db.execute(
        "SELECT id FROM reports WHERE task_id=? AND personnel_id=?", (task_id, uid)
    ).fetchone()["id"]

    db.execute(
        """INSERT INTO task_log (submission_date, personnel_id, task_id)
           VALUES (CURRENT_TIMESTAMP, ?, ?)
           ON CONFLICT(task_id, personnel_id) DO UPDATE SET
               submission_date=CURRENT_TIMESTAMP""",
        (uid, task_id)
    )

    receiver_id = assigned["assigned_by"]
    db.execute(
        """INSERT INTO submission_log
           (status, date_of_submission, sender_personnel_id, report_id, receiver_personnel_id)
           VALUES ('Pending', CURRENT_TIMESTAMP, ?, ?, ?)
           ON CONFLICT(report_id) DO UPDATE SET
               status='Pending',
               date_of_submission=CURRENT_TIMESTAMP,
               receiver_personnel_id=excluded.receiver_personnel_id""",
        (uid, report_id, receiver_id)
    )

    db.commit()
    db.close()
    return {"message": "Report submitted", "report_id": report_id, "receiver_id": receiver_id}


@router.post("/api/tasks/{task_id}/reports/upload")
async def submit_report_file(task_id: int, file: UploadFile, user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])
    report = db.execute(
        "SELECT id FROM reports WHERE task_id=? AND personnel_id=?", (task_id, uid)
    ).fetchone()
    if not report:
        db.close()
        raise HTTPException(404, "Submit a report first before uploading a file")

    fname = f"{task_id}_{uid}_{int(datetime.datetime.now().timestamp())}_{file.filename}"
    with open(f"uploads/{fname}", "wb") as out:
        out.write(await file.read())

    db.execute(
        "UPDATE reports SET report_file_path=?, report_filename=? WHERE id=?",
        (f"/uploads/{fname}", file.filename, report["id"])
    )
    db.commit()
    db.close()
    return {"message": "File uploaded", "url": f"/uploads/{fname}"}


@router.delete("/api/reports/{report_id}")
def delete_report(report_id: int, user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])
    row = db.execute("SELECT personnel_id FROM reports WHERE id=?", (report_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(404, "Report not found")
    if row["personnel_id"] != uid:
        db.close()
        raise HTTPException(403, "Cannot delete another user's report")
    db.execute("DELETE FROM reports WHERE id=?", (report_id,))
    db.commit()
    db.close()
    return {"message": "Report deleted"}


@router.get("/api/reports")
def list_reports(user=Depends(get_current_user),
                 task_id: Optional[int] = None,
                 status: Optional[str] = None):
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    q = """SELECT r.*, u.full_name, u.avatar_url, u.role AS submitter_role,
                  gl.grade_level, t.title AS task_title, t.end_date, t.due_time
           FROM reports r
           JOIN users u ON u.id=r.personnel_id
           LEFT JOIN grade_levels gl ON gl.id=u.grade_level_id
           JOIN tasks t ON t.id=r.task_id
           WHERE 1=1"""
    params = []

    if role in TASK_CREATORS or role == "admin":
        pass
    elif role in ("coordinator", "dean"):
        q += """ AND r.personnel_id IN (
                   SELECT user_id FROM task_assignments
                   WHERE assigned_by=?
                   AND (? IS NULL OR task_id=?)
                 )"""
        params.extend([uid, task_id, task_id])
    else:
        q += " AND r.personnel_id=?"
        params.append(uid)

    if task_id and role not in ("coordinator", "dean"):
        q += " AND r.task_id=?"
        params.append(task_id)
    if status:
        q += " AND r.report_status=?"
        params.append(status)

    q += " ORDER BY r.report_date DESC"
    rows = db.execute(q, params).fetchall()
    db.close()
    return [dict(r) for r in rows]


class UpdateReportStatusRequest(BaseModel):
    report_status: str


@router.put("/api/reports/{report_id}/status")
def update_report_status(report_id: int, req: UpdateReportStatusRequest,
                         user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    if role in TASK_CREATORS or role == "admin":
        pass
    elif role in ("coordinator", "dean"):
        sl = db.execute(
            "SELECT 1 FROM submission_log WHERE report_id=? AND receiver_personnel_id=?",
            (report_id, uid)
        ).fetchone()
        if not sl:
            db.close()
            raise HTTPException(403, "Not authorized to update this report")
    else:
        db.close()
        raise HTTPException(403, "Cannot update report status")

    db.execute("UPDATE reports SET report_status=? WHERE id=?", (req.report_status, report_id))
    db.execute("UPDATE submission_log SET status=? WHERE report_id=?", (req.report_status, report_id))
    db.commit()
    db.close()
    return {"message": "Status updated"}


# ── Task Log ──────────────────────────────────────────────────────────────────

@router.get("/api/task-log")
def get_task_log(user=Depends(get_current_user), task_id: Optional[int] = None):
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    q = """SELECT tl.id, tl.submission_date, tl.task_id, tl.personnel_id,
                  u.full_name AS teacher_name, u.avatar_url, u.role AS submitter_role,
                  gl.grade_level,
                  t.title AS task_title, t.end_date, t.due_time,
                  r.report_status, r.report_title,
                  sl.receiver_personnel_id,
                  recv.full_name AS receiver_name
           FROM task_log tl
           JOIN users u ON u.id=tl.personnel_id
           LEFT JOIN grade_levels gl ON gl.id=u.grade_level_id
           JOIN tasks t ON t.id=tl.task_id
           LEFT JOIN reports r ON r.task_id=tl.task_id AND r.personnel_id=tl.personnel_id
           LEFT JOIN submission_log sl ON sl.report_id=r.id
           LEFT JOIN users recv ON recv.id=sl.receiver_personnel_id
           WHERE 1=1"""
    params = []

    if role in TASK_CREATORS or role == "admin":
        pass
    elif role in ("coordinator", "dean"):
        q += """ AND tl.personnel_id IN (
                   SELECT user_id FROM task_assignments WHERE assigned_by=?
                 )"""
        params.append(uid)
    else:
        q += " AND tl.personnel_id=?"
        params.append(uid)

    if task_id:
        q += " AND tl.task_id=?"
        params.append(task_id)

    q += " ORDER BY tl.submission_date DESC"
    rows = db.execute(q, params).fetchall()
    db.close()
    return [dict(r) for r in rows]


# ── Submission Log ────────────────────────────────────────────────────────────

@router.get("/api/submission-log")
def get_submission_log(user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    q = """SELECT sl.*, r.report_title, r.report_status, r.task_id, r.report_description,
                  r.report_link_url, r.report_file_path, r.report_filename, r.report_type,
                  t.title AS task_title, t.end_date,
                  sender.full_name AS sender_name, sender.avatar_url AS sender_avatar,
                  sender.role AS sender_role,
                  gl.grade_level,
                  recv.full_name AS receiver_name
           FROM submission_log sl
           JOIN reports r ON r.id=sl.report_id
           JOIN tasks t ON t.id=r.task_id
           JOIN users sender ON sender.id=sl.sender_personnel_id
           LEFT JOIN grade_levels gl ON gl.id=sender.grade_level_id
           LEFT JOIN users recv ON recv.id=sl.receiver_personnel_id
           WHERE 1=1"""
    params = []

    if role in TASK_CREATORS or role == "admin":
        pass
    elif role in ("coordinator", "dean"):
        q += " AND sl.receiver_personnel_id=?"
        params.append(uid)
    else:
        q += " AND sl.sender_personnel_id=?"
        params.append(uid)

    q += " ORDER BY sl.date_of_submission DESC"
    rows = db.execute(q, params).fetchall()
    db.close()
    return [dict(r) for r in rows]

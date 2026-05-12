from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
import os, datetime

from database import get_db, init_db
from auth import (verify_password, create_token, get_current_user,
                  require_admin, require_task_creator, require_can_assign,
                  require_admin_or_principal, hash_password,
                  TASK_CREATORS, can_assign)

app = FastAPI(title="TaskNet API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.on_event("startup")
def startup():
    init_db()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _task_row(row, db, current_user_id: int, current_role: str):
    d = dict(row)

    # Who is currently assigned to this task
    d["assigned_users"] = [dict(r) for r in db.execute(
        """SELECT u.id, u.full_name, u.role, gl.grade_level, ta.assigned_by
           FROM task_assignments ta
           JOIN users u ON u.id = ta.user_id
           LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
           WHERE ta.task_id=?
           ORDER BY u.role, u.full_name""",
        (d["id"],)
    ).fetchall()]

    d["submission_count"] = db.execute(
        "SELECT COUNT(*) as c FROM task_log WHERE task_id=?", (d["id"],)
    ).fetchone()["c"]

    d["attachments"] = [dict(a) for a in db.execute(
        "SELECT * FROM task_attachments WHERE task_id=?", (d["id"],)
    ).fetchall()]

    # For the current user: their own assignment info and report
    my_assignment = db.execute(
        "SELECT assigned_by FROM task_assignments WHERE task_id=? AND user_id=?",
        (d["id"], current_user_id)
    ).fetchone()
    d["my_assigned_by"] = my_assignment["assigned_by"] if my_assignment else None

    if current_role not in TASK_CREATORS and current_role != "admin":
        rep = db.execute(
            "SELECT * FROM reports WHERE task_id=? AND personnel_id=?",
            (d["id"], current_user_id)
        ).fetchone()
        d["my_report"] = dict(rep) if rep else None

        log = db.execute(
            "SELECT * FROM task_log WHERE task_id=? AND personnel_id=?",
            (d["id"], current_user_id)
        ).fetchone()
        d["submission_status"] = "submitted" if log else "pending"

    # Team progress: how many of the users I assigned have submitted
    if current_role in ("principal", "coordinator", "dean", "admin"):
        total = db.execute(
            "SELECT COUNT(*) as c FROM task_assignments WHERE task_id=? AND assigned_by=?",
            (d["id"], current_user_id)
        ).fetchone()["c"]
        submitted = db.execute(
            """SELECT COUNT(*) as c FROM task_log tl
               JOIN task_assignments ta ON ta.task_id=tl.task_id AND ta.user_id=tl.personnel_id
               WHERE tl.task_id=? AND ta.assigned_by=?""",
            (d["id"], current_user_id)
        ).fetchone()["c"]
        d["team_total"] = total
        d["team_submitted"] = submitted

    return d


def _resolve_receiver(task_id: int, submitter_id: int, db) -> Optional[int]:
    """The receiver of a report is whoever assigned this task to the submitter."""
    row = db.execute(
        "SELECT assigned_by FROM task_assignments WHERE task_id=? AND user_id=?",
        (task_id, submitter_id)
    ).fetchone()
    return row["assigned_by"] if row else None


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/auth/login")
def login(req: LoginRequest):
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE username=?", (req.username,)).fetchone()
    db.close()
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(user["id"], user["role"])
    return {"token": token, "user": {
        "id": user["id"], "username": user["username"],
        "full_name": user["full_name"], "role": user["role"],
        "avatar_url": user["avatar_url"],
        "grade_level_id": user["grade_level_id"],
    }}


@app.get("/api/auth/me")
def me(user=Depends(get_current_user)):
    db = get_db()
    u = db.execute(
        """SELECT u.id, u.username, u.full_name, u.role, u.avatar_url,
                  u.grade_level_id, gl.grade_level
           FROM users u LEFT JOIN grade_levels gl ON gl.id=u.grade_level_id
           WHERE u.id=?""",
        (user["sub"],)
    ).fetchone()
    db.close()
    if not u:
        raise HTTPException(404, "User not found")
    return dict(u)


# ── Users ─────────────────────────────────────────────────────────────────────

@app.get("/api/users")
def list_users(user=Depends(get_current_user)):
    db = get_db()
    rows = db.execute(
        """SELECT u.id, u.username, u.full_name, u.role, u.avatar_url,
                  u.grade_level_id, gl.grade_level
           FROM users u LEFT JOIN grade_levels gl ON gl.id=u.grade_level_id
           ORDER BY u.role, u.full_name"""
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


@app.get("/api/users/assignable")
def list_assignable_users(user=Depends(require_can_assign)):
    """
    Returns users this role can assign tasks to.
    Dean only gets teachers in their own grade level.
    """
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    from auth import ASSIGNABLE_TO
    allowed_roles = ASSIGNABLE_TO.get(role, set())
    if not allowed_roles:
        db.close()
        return []

    placeholders = ",".join(f"'{r}'" for r in allowed_roles)
    q = f"""SELECT u.id, u.username, u.full_name, u.role, u.grade_level_id, gl.grade_level
            FROM users u LEFT JOIN grade_levels gl ON gl.id=u.grade_level_id
            WHERE u.role IN ({placeholders})"""
    params = []

    if role == "dean":
        # Dean can only assign teachers in their own grade level
        dean = db.execute("SELECT grade_level_id FROM users WHERE id=?", (uid,)).fetchone()
        if dean and dean["grade_level_id"]:
            q += " AND u.grade_level_id=?"
            params.append(dean["grade_level_id"])
        else:
            db.close()
            return []

    q += " ORDER BY u.role, u.full_name"
    rows = db.execute(q, params).fetchall()
    db.close()
    return [dict(r) for r in rows]


class CreateUserRequest(BaseModel):
    username: str
    password: str
    full_name: str
    role: str
    grade_level_id: Optional[int] = None


@app.post("/api/users")
def create_user(req: CreateUserRequest, user=Depends(require_admin_or_principal)):
    valid_roles = {"admin", "principal", "coordinator", "dean", "teacher", "registrar"}
    if req.role not in valid_roles:
        raise HTTPException(400, f"Invalid role. Must be one of: {valid_roles}")
    db = get_db()
    try:
        db.execute(
            "INSERT INTO users (username,password_hash,full_name,role,grade_level_id) VALUES (?,?,?,?,?)",
            (req.username, hash_password(req.password), req.full_name, req.role, req.grade_level_id)
        )
        db.commit()
        new_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        db.close()
        return {"id": new_id, "message": "User created"}
    except Exception as e:
        db.close()
        raise HTTPException(400, str(e))


# ── User Profile ──────────────────────────────────────────────────────────────

@app.get("/api/users/me/profile")
def get_my_profile(user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])
    u = db.execute(
        """SELECT u.*, gl.grade_level FROM users u
           LEFT JOIN grade_levels gl ON gl.id=u.grade_level_id
           WHERE u.id=?""",
        (uid,)
    ).fetchone()
    if not u:
        db.close()
        raise HTTPException(404, "User not found")
    d = dict(u)
    d.pop("password_hash", None)
    subjects = db.execute(
        """SELECT us.subject, gl.grade_level FROM user_subjects us
           LEFT JOIN grade_levels gl ON gl.id=us.grade_level_id
           WHERE us.user_id=? ORDER BY us.subject""",
        (uid,)
    ).fetchall()
    d["subjects"] = [dict(s) for s in subjects]
    db.close()
    return d


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    middle_name: Optional[str] = None
    last_name: Optional[str] = None
    suffix: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    tin: Optional[str] = None
    qsis: Optional[str] = None
    hdmf: Optional[str] = None
    phic: Optional[str] = None
    date_of_appointment: Optional[str] = None
    address: Optional[str] = None


@app.put("/api/users/me/profile")
def update_my_profile(req: UpdateProfileRequest, user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if updates:
        set_clause = ", ".join(f"{k}=?" for k in updates)
        db.execute(f"UPDATE users SET {set_clause} WHERE id=?",
                   list(updates.values()) + [uid])
        db.commit()
    db.close()
    return {"message": "Profile updated"}


# ── Subjects ──────────────────────────────────────────────────────────────────

@app.get("/api/subjects")
def list_subjects(user=Depends(get_current_user)):
    subjects = [
        "Mathematics", "Science", "English", "Filipino", "MAPEH",
        "Araling Panlipunan", "Edukasyon sa Pagpapakatao", "TLE",
    ]
    return subjects


# ── Grade Levels ──────────────────────────────────────────────────────────────

@app.get("/api/grade-levels")
def list_grade_levels(user=Depends(get_current_user)):
    db = get_db()
    rows = db.execute("SELECT * FROM grade_levels ORDER BY id").fetchall()
    db.close()
    return [dict(r) for r in rows]


class GradeLevelRequest(BaseModel):
    grade_level: str


@app.post("/api/grade-levels")
def create_grade_level(req: GradeLevelRequest, user=Depends(require_admin)):
    db = get_db()
    try:
        db.execute("INSERT INTO grade_levels (grade_level) VALUES (?)", (req.grade_level,))
        db.commit()
        new_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        db.close()
        return {"id": new_id}
    except Exception as e:
        db.close()
        raise HTTPException(400, str(e))


# ── Task Types ────────────────────────────────────────────────────────────────

@app.get("/api/task-types")
def list_task_types(user=Depends(get_current_user)):
    db = get_db()
    rows = db.execute("SELECT * FROM task_types ORDER BY id").fetchall()
    db.close()
    return [dict(r) for r in rows]


# ── Tasks ─────────────────────────────────────────────────────────────────────

@app.get("/api/tasks")
def list_tasks(user=Depends(get_current_user), search: str = "", assigned: int = 0):
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    if assigned:
        # My Tasks view: tasks explicitly assigned to the calling user
        q = """SELECT DISTINCT t.* FROM tasks t
               JOIN task_assignments ta ON ta.task_id=t.id
               WHERE ta.user_id=? AND t.status='active'"""
        params = [uid]
    elif role == "admin":
        # Admin Task Manager: all tasks
        q = "SELECT * FROM tasks WHERE 1=1"
        params = []
    elif role == "principal":
        # Principal Task Manager: tasks they created
        q = "SELECT * FROM tasks WHERE created_by=?"
        params = [uid]
    elif role in ("coordinator", "dean"):
        # Task Manager: tasks assigned to them + tasks they created (active AND disabled)
        q = """SELECT DISTINCT t.* FROM tasks t
               LEFT JOIN task_assignments ta ON ta.task_id=t.id
               WHERE (ta.user_id=? OR t.created_by=?)"""
        params = [uid, uid]
    else:
        # teacher / registrar: only their assigned tasks
        q = """SELECT DISTINCT t.* FROM tasks t
               JOIN task_assignments ta ON ta.task_id=t.id
               WHERE ta.user_id=? AND t.status='active'"""
        params = [uid]

    if search:
        if "JOIN task_assignments" in q or "LEFT JOIN task_assignments" in q:
            q += " AND t.title LIKE ?"
        else:
            q += " AND title LIKE ?"
        params.append(f"%{search}%")

    rows = db.execute(q, params).fetchall()
    result = [_task_row(row, db, uid, role) for row in rows]
    db.close()
    return result


@app.get("/api/tasks/{task_id}")
def get_task(task_id: int, user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    row = db.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(404, "Task not found")

    # Access check: principal/admin can see any task they created;
    # everyone else must be assigned
    if role not in TASK_CREATORS and role != "admin":
        assigned = db.execute(
            "SELECT 1 FROM task_assignments WHERE task_id=? AND user_id=?",
            (task_id, uid)
        ).fetchone()
        if not assigned:
            db.close()
            raise HTTPException(403, "Not assigned to this task")

    d = _task_row(row, db, uid, role)

    # Reports visible to this user:
    # - principal/admin: all reports for this task
    # - coordinator/dean: reports from users they assigned (assigned_by = me)
    if role in TASK_CREATORS or role == "admin":
        reports = db.execute(
            """SELECT r.*, u.full_name, u.avatar_url, u.role, gl.grade_level
               FROM reports r
               JOIN users u ON u.id=r.personnel_id
               LEFT JOIN grade_levels gl ON gl.id=u.grade_level_id
               WHERE r.task_id=? ORDER BY r.report_date DESC""",
            (task_id,)
        ).fetchall()
    elif role in ("coordinator", "dean"):
        # See reports from users they directly assigned
        reports = db.execute(
            """SELECT r.*, u.full_name, u.avatar_url, u.role, gl.grade_level
               FROM reports r
               JOIN users u ON u.id=r.personnel_id
               LEFT JOIN grade_levels gl ON gl.id=u.grade_level_id
               JOIN task_assignments ta ON ta.task_id=r.task_id AND ta.user_id=r.personnel_id
               WHERE r.task_id=? AND ta.assigned_by=?
               ORDER BY r.report_date DESC""",
            (task_id, uid)
        ).fetchall()
    else:
        reports = []

    d["reports"] = [dict(r) for r in reports]

    d["public_comments"] = [dict(c) for c in db.execute(
        """SELECT c.*, u.full_name, u.avatar_url FROM comments c
           JOIN users u ON u.id=c.user_id
           WHERE c.task_id=? AND c.comment_type='public'
           ORDER BY c.created_at""",
        (task_id,)
    ).fetchall()]

    d["private_comments"] = [dict(c) for c in db.execute(
        """SELECT c.*, u.full_name FROM comments c
           JOIN users u ON u.id=c.user_id
           WHERE c.task_id=? AND c.comment_type='private'
             AND (
               c.user_id=?
               OR ? IN (SELECT id FROM users WHERE role IN ('admin','principal','coordinator'))
               OR c.user_id IN (
                 SELECT assigned_by FROM task_assignments
                 WHERE task_id=? AND user_id=? AND assigned_by IS NOT NULL
               )
               OR c.user_id IN (
                 SELECT personnel_id FROM reports WHERE task_id=?
               )
             )
           ORDER BY c.created_at""",
        (task_id, uid, uid, task_id, uid, task_id)
    ).fetchall()]

    db.close()
    return d


class CreateTaskRequest(BaseModel):
    title: str
    subject: Optional[str] = None
    task_type_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    due_time: Optional[str] = None
    instructions: Optional[str] = None
    assigned_user_ids: Optional[List[int]] = []
    points_early: Optional[int] = 100
    points_ontime: Optional[int] = 100
    points_late24: Optional[int] = 50
    points_after24: Optional[int] = 0
    attachments: Optional[List[dict]] = []


@app.post("/api/tasks")
def create_task(req: CreateTaskRequest, user=Depends(require_task_creator)):
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    db.execute(
        """INSERT INTO tasks
           (title, subject, task_type_id, start_date, end_date, due_time, instructions,
            created_by, points_early, points_ontime, points_late24, points_after24)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (req.title, req.subject, req.task_type_id, req.start_date, req.end_date,
         req.due_time, req.instructions, uid,
         req.points_early, req.points_ontime, req.points_late24, req.points_after24)
    )
    task_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]

    for assign_uid in (req.assigned_user_ids or []):
        assignee = db.execute("SELECT role FROM users WHERE id=?", (assign_uid,)).fetchone()
        if not assignee:
            continue
        if can_assign(role, assignee["role"]):
            try:
                db.execute(
                    "INSERT INTO task_assignments (task_id, user_id, assigned_by) VALUES (?,?,?)",
                    (task_id, assign_uid, uid)
                )
            except Exception:
                pass

    for att in (req.attachments or []):
        db.execute(
            "INSERT INTO task_attachments (task_id, attachment_type, name, url) VALUES (?,?,?,?)",
            (task_id, att.get("type"), att.get("name"), att.get("url"))
        )

    db.commit()
    db.close()
    return {"id": task_id, "message": "Task created"}


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    subject: Optional[str] = None
    task_type_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    due_time: Optional[str] = None
    instructions: Optional[str] = None
    status: Optional[str] = None


@app.put("/api/tasks/{task_id}")
def update_task(task_id: int, req: UpdateTaskRequest,
                user=Depends(require_task_creator)):
    db = get_db()
    fields, vals = [], []
    for f, v in [("title", req.title), ("subject", req.subject),
                 ("task_type_id", req.task_type_id), ("start_date", req.start_date),
                 ("end_date", req.end_date), ("due_time", req.due_time),
                 ("instructions", req.instructions), ("status", req.status)]:
        if v is not None:
            fields.append(f"{f}=?")
            vals.append(v)
    if fields:
        vals.append(task_id)
        db.execute(f"UPDATE tasks SET {','.join(fields)} WHERE id=?", vals)
    db.commit()
    db.close()
    return {"message": "Updated"}


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, user=Depends(require_task_creator)):
    db = get_db()
    db.execute("DELETE FROM tasks WHERE id=?", (task_id,))
    db.commit()
    db.close()
    return {"message": "Deleted"}


# ── Task Assignments (delegating a task to specific users) ────────────────────

class AssignRequest(BaseModel):
    user_ids: List[int]


@app.post("/api/tasks/{task_id}/assign")
def assign_task(task_id: int, req: AssignRequest, user=Depends(require_can_assign)):
    """
    Assign (or re-assign) a task to specific users.
    The caller must either be the task creator OR be assigned to this task themselves.
    Assignment rules are role-based:
      - principal: any role
      - coordinator: coordinator, dean, teacher (not principal/registrar)
      - dean: teacher only, same grade level
    """
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    # Verify caller has access to this task
    is_creator = db.execute(
        "SELECT 1 FROM tasks WHERE id=? AND created_by=?", (task_id, uid)
    ).fetchone()
    is_assigned = db.execute(
        "SELECT 1 FROM task_assignments WHERE task_id=? AND user_id=?", (task_id, uid)
    ).fetchone()
    if not is_creator and not is_assigned:
        db.close()
        raise HTTPException(403, "You are not assigned to this task")

    # Get assigner's grade level (for dean restriction)
    assigner = db.execute("SELECT grade_level_id FROM users WHERE id=?", (uid,)).fetchone()
    assigner_grade = assigner["grade_level_id"] if assigner else None

    added, skipped = [], []
    for assign_uid in req.user_ids:
        assignee = db.execute(
            "SELECT role, grade_level_id, full_name FROM users WHERE id=?", (assign_uid,)
        ).fetchone()
        if not assignee:
            skipped.append(assign_uid)
            continue

        if not can_assign(role, assignee["role"]):
            skipped.append(assign_uid)
            continue

        # Dean: same grade level only
        if role == "dean" and assignee["grade_level_id"] != assigner_grade:
            skipped.append(assign_uid)
            continue

        try:
            db.execute(
                "INSERT INTO task_assignments (task_id, user_id, assigned_by) VALUES (?,?,?)",
                (task_id, assign_uid, uid)
            )
            added.append(assign_uid)
        except Exception:
            skipped.append(assign_uid)

    db.commit()
    db.close()
    return {"assigned": added, "skipped": skipped}


@app.delete("/api/tasks/{task_id}/assign/{user_id}")
def unassign_task(task_id: int, user_id: int, user=Depends(require_can_assign)):
    """Remove a user from a task assignment (only the person who assigned them can remove)."""
    db = get_db()
    uid = int(user["sub"])
    db.execute(
        "DELETE FROM task_assignments WHERE task_id=? AND user_id=? AND assigned_by=?",
        (task_id, user_id, uid)
    )
    db.commit()
    db.close()
    return {"message": "Unassigned"}


# ── Reports (any assigned user submits a report) ──────────────────────────────

class SubmitReportRequest(BaseModel):
    report_title: str
    report_description: Optional[str] = None
    report_type: Optional[str] = None
    report_link_url: Optional[str] = None


@app.post("/api/tasks/{task_id}/reports")
def submit_report(task_id: int, req: SubmitReportRequest,
                  user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])

    # Must be assigned to this task
    assigned = db.execute(
        "SELECT assigned_by FROM task_assignments WHERE task_id=? AND user_id=?",
        (task_id, uid)
    ).fetchone()
    if not assigned:
        db.close()
        raise HTTPException(403, "Not assigned to this task")

    # Upsert report
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

    # Upsert task_log
    db.execute(
        """INSERT INTO task_log (submission_date, personnel_id, task_id)
           VALUES (CURRENT_TIMESTAMP, ?, ?)
           ON CONFLICT(task_id, personnel_id) DO UPDATE SET
               submission_date=CURRENT_TIMESTAMP""",
        (uid, task_id)
    )

    # Receiver = whoever assigned this task to me
    receiver_id = assigned["assigned_by"]

    # Upsert submission_log
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
    return {"message": "Report submitted", "report_id": report_id,
            "receiver_id": receiver_id}


@app.delete("/api/reports/{report_id}")
def delete_report(report_id: int, user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])
    row = db.execute("SELECT personnel_id FROM reports WHERE id=?", (report_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="Report not found")
    if row["personnel_id"] != uid:
        db.close()
        raise HTTPException(status_code=403, detail="Cannot delete another user's report")
    db.execute("DELETE FROM reports WHERE id=?", (report_id,))
    db.commit()
    db.close()
    return {"message": "Report deleted"}


@app.post("/api/tasks/{task_id}/reports/upload")
async def submit_report_file(task_id: int, file: UploadFile,
                              user=Depends(get_current_user)):
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


@app.get("/api/reports")
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
        pass  # see all reports
    elif role in ("coordinator", "dean"):
        # See reports from users they directly assigned (assigned_by = me)
        q += """ AND r.personnel_id IN (
                   SELECT user_id FROM task_assignments
                   WHERE assigned_by=?
                   AND (? IS NULL OR task_id=?)
                 )"""
        params.extend([uid, task_id, task_id])
    else:
        # teacher/registrar: only own reports
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


@app.put("/api/reports/{report_id}/status")
def update_report_status(report_id: int, req: UpdateReportStatusRequest,
                          user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    if role in TASK_CREATORS or role == "admin":
        pass  # full access
    elif role in ("coordinator", "dean"):
        # Can only update reports they are the receiver of
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

    db.execute("UPDATE reports SET report_status=? WHERE id=?",
               (req.report_status, report_id))
    db.execute("UPDATE submission_log SET status=? WHERE report_id=?",
               (req.report_status, report_id))
    db.commit()
    db.close()
    return {"message": "Status updated"}


# ── Task Log ──────────────────────────────────────────────────────────────────

@app.get("/api/task-log")
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
        pass  # see all
    elif role in ("coordinator", "dean"):
        # See log entries for users they assigned
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

@app.get("/api/submission-log")
def get_submission_log(user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    q = """SELECT sl.*, r.report_title, r.report_status, r.task_id, r.report_description,
                  r.report_link_url,
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
        pass  # see all
    elif role in ("coordinator", "dean"):
        # See submissions directed to them
        q += " AND sl.receiver_personnel_id=?"
        params.append(uid)
    else:
        q += " AND sl.sender_personnel_id=?"
        params.append(uid)

    q += " ORDER BY sl.date_of_submission DESC"
    rows = db.execute(q, params).fetchall()
    db.close()
    return [dict(r) for r in rows]


# ── Comments ──────────────────────────────────────────────────────────────────

class CommentRequest(BaseModel):
    content: str
    comment_type: str = "public"
    report_id: Optional[int] = None


@app.post("/api/tasks/{task_id}/comments")
def add_comment(task_id: int, req: CommentRequest, user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])
    db.execute(
        "INSERT INTO comments (task_id, user_id, report_id, comment_type, content) VALUES (?,?,?,?,?)",
        (task_id, uid, req.report_id, req.comment_type, req.content)
    )
    db.commit()
    db.close()
    return {"message": "Comment added"}


class CommentUpdateRequest(BaseModel):
    content: str


@app.put("/api/comments/{comment_id}")
def edit_comment(comment_id: int, req: CommentUpdateRequest, user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])
    row = db.execute("SELECT user_id FROM comments WHERE id=?", (comment_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="Comment not found")
    if row["user_id"] != uid:
        db.close()
        raise HTTPException(status_code=403, detail="Cannot edit another user's comment")
    db.execute("UPDATE comments SET content=? WHERE id=?", (req.content, comment_id))
    db.commit()
    db.close()
    return {"message": "Comment updated"}


@app.delete("/api/comments/{comment_id}")
def delete_comment(comment_id: int, user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])
    row = db.execute("SELECT user_id FROM comments WHERE id=?", (comment_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(status_code=404, detail="Comment not found")
    if row["user_id"] != uid:
        db.close()
        raise HTTPException(status_code=403, detail="Cannot delete another user's comment")
    db.execute("DELETE FROM comments WHERE id=?", (comment_id,))
    db.commit()
    db.close()
    return {"message": "Comment deleted"}


# ── Dashboard ─────────────────────────────────────────────────────────────────

@app.get("/api/dashboard")
def dashboard(user=Depends(get_current_user)):
    db = get_db()
    uid = int(user["sub"])
    role = user["role"]

    if role in TASK_CREATORS or role == "admin":
        # Tasks created by this user
        total_tasks = db.execute(
            "SELECT COUNT(*) as c FROM tasks WHERE created_by=?", (uid,)
        ).fetchone()["c"]
        # All submissions on their tasks
        submitted = db.execute(
            """SELECT COUNT(*) as c FROM task_log tl
               JOIN tasks t ON t.id=tl.task_id WHERE t.created_by=?""",
            (uid,)
        ).fetchone()["c"]
        pending = db.execute(
            """SELECT COUNT(*) as c FROM submission_log sl
               JOIN submission_log sl2 ON sl2.id=sl.id
               WHERE sl.receiver_personnel_id=? AND sl.status='Pending'""",
            (uid,)
        ).fetchone()["c"]
        missing = db.execute(
            """SELECT COUNT(*) as c FROM reports r
               JOIN tasks t ON t.id=r.task_id
               WHERE t.created_by=? AND r.report_status='Missing'""",
            (uid,)
        ).fetchone()["c"]
        recent_tasks = db.execute(
            "SELECT * FROM tasks WHERE created_by=? ORDER BY created_at DESC LIMIT 5", (uid,)
        ).fetchall()
        events = db.execute(
            "SELECT * FROM activity_events ORDER BY event_date DESC LIMIT 5"
        ).fetchall()
        db.close()
        return {
            "total_tasks": total_tasks, "submitted": submitted,
            "pending": pending, "missing": missing,
            "task_manager_tasks": [dict(t) for t in recent_tasks],
            "my_tasks": [], "events": [dict(e) for e in events],
        }

    elif role in ("coordinator", "dean"):
        # Tasks assigned to them
        total_tasks = db.execute(
            "SELECT COUNT(*) as c FROM task_assignments WHERE user_id=?", (uid,)
        ).fetchone()["c"]
        # Their team's submissions (users they assigned)
        submitted = db.execute(
            """SELECT COUNT(*) as c FROM task_log tl
               JOIN task_assignments ta ON ta.task_id=tl.task_id AND ta.user_id=tl.personnel_id
               WHERE ta.assigned_by=?""",
            (uid,)
        ).fetchone()["c"]
        pending = db.execute(
            "SELECT COUNT(*) as c FROM submission_log WHERE receiver_personnel_id=? AND status='Pending'",
            (uid,)
        ).fetchone()["c"]
        missing = db.execute(
            """SELECT COUNT(*) as c FROM reports r
               JOIN task_assignments ta ON ta.task_id=r.task_id AND ta.user_id=r.personnel_id
               WHERE ta.assigned_by=? AND r.report_status='Missing'""",
            (uid,)
        ).fetchone()["c"]
        my_tasks = db.execute(
            """SELECT t.* FROM tasks t
               JOIN task_assignments ta ON ta.task_id=t.id
               WHERE ta.user_id=? AND t.status='active'
               ORDER BY t.end_date LIMIT 5""",
            (uid,)
        ).fetchall()
        events = db.execute(
            "SELECT * FROM activity_events ORDER BY event_date DESC LIMIT 5"
        ).fetchall()
        db.close()
        return {
            "total_tasks": total_tasks, "submitted": submitted,
            "pending": pending, "missing": missing,
            "task_manager_tasks": [],
            "my_tasks": [dict(t) for t in my_tasks],
            "events": [dict(e) for e in events],
        }

    else:
        # teacher / registrar
        my_tasks = db.execute(
            """SELECT t.* FROM tasks t
               JOIN task_assignments ta ON ta.task_id=t.id
               WHERE ta.user_id=? AND t.status='active'
               ORDER BY t.end_date LIMIT 5""",
            (uid,)
        ).fetchall()
        submitted = db.execute(
            "SELECT COUNT(*) as c FROM task_log WHERE personnel_id=?", (uid,)
        ).fetchone()["c"]
        pending = db.execute(
            """SELECT COUNT(*) as c FROM task_assignments ta
               WHERE ta.user_id=?
               AND NOT EXISTS (
                   SELECT 1 FROM task_log tl
                   WHERE tl.task_id=ta.task_id AND tl.personnel_id=?
               )""",
            (uid, uid)
        ).fetchone()["c"]
        missing = db.execute(
            "SELECT COUNT(*) as c FROM reports WHERE personnel_id=? AND report_status='Missing'",
            (uid,)
        ).fetchone()["c"]
        events = db.execute(
            "SELECT * FROM activity_events ORDER BY event_date DESC LIMIT 5"
        ).fetchall()
        db.close()
        return {
            "total_tasks": submitted + pending, "submitted": submitted,
            "pending": pending, "missing": missing,
            "task_manager_tasks": [],
            "my_tasks": [dict(t) for t in my_tasks],
            "events": [dict(e) for e in events],
        }


# ── Subjects ──────────────────────────────────────────────────────────────────

@app.get("/api/subjects")
def get_subjects(user=Depends(get_current_user)):
    db = get_db()
    rows = db.execute(
        "SELECT DISTINCT subject FROM tasks WHERE subject IS NOT NULL"
    ).fetchall()
    db.close()
    return [r["subject"] for r in rows]


# ── Templates ────────────────────────────────────────────────────────────────

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


@app.post("/api/templates")
def create_template(req: TemplateCreate, user=Depends(require_admin_or_principal)):
    db = get_db()
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


@app.get("/api/templates")
def get_templates(user=Depends(get_current_user)):
    db = get_db()
    rows = db.execute(
        """SELECT t.*, u.full_name as created_by_name
           FROM task_templates t
           LEFT JOIN users u ON u.id = t.created_by
           ORDER BY t.created_at DESC"""
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]


@app.delete("/api/templates/{template_id}")
def delete_template(template_id: int, user=Depends(require_admin_or_principal)):
    db = get_db()
    db.execute("DELETE FROM task_templates WHERE id=?", (template_id,))
    db.commit()
    db.close()
    return {"message": "Template deleted"}


# ── File Upload ───────────────────────────────────────────────────────────────

@app.post("/api/upload")
async def upload_file(file: UploadFile, user=Depends(get_current_user)):
    fname = f"{int(datetime.datetime.now().timestamp())}_{file.filename}"
    with open(f"uploads/{fname}", "wb") as out:
        out.write(await file.read())
    return {"url": f"/uploads/{fname}", "name": file.filename}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

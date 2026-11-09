import os
from fastapi import APIRouter, HTTPException, Depends, File, Form, Request, UploadFile
import audit
import store
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from database import get_db
from auth import require_appraisal_access, require_appraisal_view, has_permission
from school_calendar import current_school_year, resolve_window, in_window, task_in_window


def _window(db, school_year: str, term_id: Optional[int]):
    """Appraisal covers one school year (default: current) or one of its terms."""
    try:
        return resolve_window(db, school_year, term_id)
    except ValueError as e:
        raise HTTPException(400, str(e))


def _visible_personnel_ids(db, user):
    """Which personnel's appraisal records this user may see.
    Returns None = everyone (principal/coordinator/admin); otherwise a set of
    user ids: the user themselves, plus — for a dean — the teachers in the grade
    level they handle (dean_assignment.grade_level_id, falling back to own)."""
    role = user["role"]
    uid = int(user["sub"])
    if has_permission(user, "view_all_appraisals"):
        return None
    ids = {uid}
    if role == "dean":
        gl = db.execute(
            """SELECT COALESCE(da.grade_level_id, u.grade_level_id) AS gl
               FROM users u LEFT JOIN dean_assignment da ON da.user_id = u.id
               WHERE u.id=?""", (uid,)
        ).fetchone()
        if gl and gl["gl"] is not None:
            for r in db.execute(
                "SELECT id FROM users WHERE role='teacher' AND grade_level_id=?",
                (gl["gl"],)
            ).fetchall():
                ids.add(r["id"])
    return ids

router = APIRouter(prefix="/api/appraisal", tags=["Appraisal"])


# ── Timing Points (report submission compliance) ──────────────────────────────
# All timing scoring is computed here in Python from the server-recorded
# submission time vs the task deadline — the frontend only renders the result.
TIMING_ON_TIME = 100
TIMING_LATE_24H = 50
TIMING_LATE_OVER = 0


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    """Parse the assorted date/time string shapes stored across the schema."""
    if not value or not str(value).strip():
        return None
    s = str(value).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d", "%I:%M %p", "%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _deadline_dt(end_date: Optional[str], due_time: Optional[str]) -> Optional[datetime]:
    d = _parse_dt(end_date)
    if d is None:
        return None
    t = _parse_dt(due_time)
    if t is not None:
        d = d.replace(hour=t.hour, minute=t.minute, second=t.second)
    else:
        d = d.replace(hour=23, minute=59, second=59)
    return d


def _compute_timing(submitted_at: Optional[str], end_date: Optional[str],
                    due_time: Optional[str]) -> tuple[str, int]:
    """(status, points): On Time=100, Late <=24h=50, Late >24h / Missing=0."""
    sub = _parse_dt(submitted_at)
    dl = _deadline_dt(end_date, due_time)
    if sub is None:
        return "Missing", TIMING_LATE_OVER
    if dl is None:
        return "On Time", TIMING_ON_TIME
    if sub <= dl:
        return "On Time", TIMING_ON_TIME
    if sub <= dl + timedelta(hours=24):
        return "Late within 24 hours", TIMING_LATE_24H
    return "Late after 24 hours", TIMING_LATE_OVER


@router.get("/report-submissions")
def list_report_submissions(db=Depends(get_db), user=Depends(require_appraisal_view),
                            limit: int = 0, offset: int = 0,
                            school_year: str = "current", term_id: Optional[int] = None):
    """Report submissions with server-computed timing status/points, for the
    Timing Points tab. Timing is derived from the submission time vs the task
    deadline (end_date + due_time). Rows are scoped to who the caller may see,
    and the visibility filter is pushed into SQL so pagination stays correct."""
    select = """SELECT sl.id, sl.report_id, sl.date_of_submission, sl.sender_personnel_id,
                  r.report_title, r.task_id,
                  t.title AS task_title, t.end_date, t.due_time,
                  u.full_name AS personnel_name, u.role AS personnel_role,
                  gl.grade_level AS personnel_department """
    base = """FROM submission_log sl
              JOIN reports r ON r.id = sl.report_id
              JOIN tasks t ON t.id = r.task_id
              JOIN users u ON u.id = sl.sender_personnel_id
              LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
              WHERE 1=1"""
    params = []
    window = _window(db, school_year, term_id)
    visible = _visible_personnel_ids(db, user)
    if visible is not None:
        if not visible:
            return {"items": [], "total": 0, "limit": limit, "offset": offset,
                    "has_more": False} if limit else []
        ph = ",".join("?" for _ in visible)
        base += f" AND sl.sender_personnel_id IN ({ph})"
        params += list(visible)
    order = " ORDER BY sl.date_of_submission DESC"

    def shape(rows):
        out = []
        for r in rows:
            d = dict(r)
            status, points = _compute_timing(d["date_of_submission"], d["end_date"], d["due_time"])
            dl = _deadline_dt(d["end_date"], d["due_time"])
            out.append({
                "id": d["id"], "report_id": d["report_id"], "task_id": d["task_id"],
                "task_name": d["task_title"] or d["report_title"],
                "personnel_name": d["personnel_name"] or "Unknown",
                "personnel_department": d["personnel_department"],
                "deadline": dl.strftime("%Y-%m-%d %H:%M:%S") if dl else None,
                "submitted_at": d["date_of_submission"],
                "timing_status": status, "timing_points": points,
                "content_quality_score": None, "format_compliance_score": None,
                "completeness_score": None,
            })
        return out

    # School-year scope is applied in Python (a submission is anchored on its
    # task's deadline), then the page is cut.
    rows = [r for r in db.execute(f"{select}{base}{order}", params).fetchall()
            if in_window(window, r["end_date"], r["date_of_submission"])]
    if limit and limit > 0:
        items = shape(rows[offset:offset + limit])
        return {"items": items, "total": len(rows), "limit": limit, "offset": offset,
                "has_more": offset + len(items) < len(rows)}
    return shape(rows)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _special_task_row(row, db):
    """Shape a `tasks` row (tagged task_category='special') into the special-task
    payload the appraisal UI expects. Assignee = first task_assignment; assigner =
    tasks.created_by; status derived from whether an evaluation exists."""
    d = dict(row)
    assignee = db.execute(
        """SELECT u.id, u.full_name, u.role, gl.grade_level
           FROM task_assignments ta
           JOIN users u ON u.id = ta.user_id
           LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
           WHERE ta.task_id=? ORDER BY ta.id LIMIT 1""", (d["id"],)
    ).fetchone()
    assigner = db.execute(
        "SELECT id, full_name FROM users WHERE id=?", (d.get("created_by"),)
    ).fetchone()
    ev = db.execute(
        "SELECT * FROM special_task_evaluations WHERE task_id=?", (d["id"],)
    ).fetchone()
    # MOVs (means of verification) are the assignee's actual report submission,
    # never the reference attachments supplied by the person who created the task.
    report = db.execute(
        """SELECT r.id, r.report_title, r.report_link_url, r.report_file_path,
                  r.report_filename, sl.date_of_submission
           FROM reports r
           LEFT JOIN submission_log sl ON sl.report_id = r.id
           WHERE r.task_id=? AND r.personnel_id=?
           ORDER BY sl.date_of_submission DESC LIMIT 1""",
        (d["id"], assignee["id"] if assignee else -1)
    ).fetchone()
    movs = []
    if report:
        if report["report_file_path"]:
            movs.append({"id": f"report-{report['id']}-file", "attachment_type": "file",
                         "name": report["report_filename"] or report["report_title"] or "Submitted file",
                         "url": report["report_file_path"]})
        if report["report_link_url"]:
            movs.append({"id": f"report-{report['id']}-link", "attachment_type": "link",
                         "name": report["report_title"] or report["report_link_url"],
                         "url": report["report_link_url"]})
    return {
        "id": d["id"],
        "movs": movs,
        "submitted_at": report["date_of_submission"] if report else None,
        "title": d["title"],
        "description": d.get("instructions"),
        "due_date": d.get("end_date"),
        "created_at": d.get("created_at"),
        "status": "evaluated" if ev else "pending",
        "assignee": dict(assignee) if assignee else None,
        "assigner": dict(assigner) if assigner else None,
        "evaluation": dict(ev) if ev else None,
    }


def _committee_credits(db, window) -> list:
    """Top-score credits for committee members whose task wasn't automated,
    within the window (by the event's target date)."""
    rows = db.execute(
        """SELECT c.*, e.title AS event_title, e.target_date, e.created_at AS event_created_at
           FROM event_committee_credits c JOIN events e ON e.id = c.event_id
           ORDER BY c.created_at DESC""").fetchall()
    return [dict(r) for r in rows if in_window(window, r["target_date"], r["event_created_at"])]


def _credit_row(c: dict, db):
    """A committee credit shaped like an evaluated special task (flagged
    auto_credit) so the appraisal tables, averages and charts include it."""
    assignee = db.execute(
        """SELECT u.id, u.full_name, u.role, gl.grade_level FROM users u
           LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id WHERE u.id=?""",
        (c["user_id"],)).fetchone()
    assigner = db.execute("SELECT id, full_name FROM users WHERE id=?",
                          (c.get("created_by"),)).fetchone()
    committee = c.get("committee") or "Working Committee"
    about = [f"Event: {c['event_title']}", f"Committee: {committee}"]
    for label, key in (("Designation", "designation"), ("Expected output", "output")):
        if c.get(key):
            about.append(f"{label}: {c[key]}")
    lines = ([f"Terms of Reference:\n{c['tor']}", ""] if c.get("tor") else []) + about
    return {
        "id": c["id"],
        "auto_credit": True,
        "event_id": c["event_id"],
        "title": f"{committee} — {c['event_title']}",
        "description": "\n".join(lines),
        "due_date": c.get("target_date"),
        "created_at": c.get("created_at"),
        "status": "evaluated",
        "assignee": dict(assignee) if assignee else None,
        "assigner": dict(assigner) if assigner else None,
        "evaluation": {
            "completion_quality_score": 5, "timeliness_score": 5,
            "initiative_score": 5, "coordination_score": 5,
            "weighted_average": c["score"],
            "remarks": "Automatic top score: this committee task was not automated in the approved proposal.",
            "evaluated_at": c.get("created_at"),
        },
    }


def _special_ratings(db, uid: int, window) -> list:
    """This person's special-task ratings (0-5) in the window, including
    top-score committee credits."""
    ratings = [r["weighted_average"] for r in db.execute(
        """SELECT ste.weighted_average, t.end_date, t.start_date, t.created_at
           FROM special_task_evaluations ste
           JOIN tasks t ON t.id = ste.task_id
           JOIN task_assignments ta ON ta.task_id = t.id
           WHERE ta.user_id=? AND ste.weighted_average IS NOT NULL""", (uid,)).fetchall()
        if task_in_window(window, r)]
    ratings += [r["score"] for r in db.execute(
        """SELECT c.score, e.target_date, e.created_at FROM event_committee_credits c
           JOIN events e ON e.id = c.event_id WHERE c.user_id=?""", (uid,)).fetchall()
        if in_window(window, r["target_date"], r["created_at"])]
    return ratings


def _event_evaluation_row(event_row, db):
    """Format an event with its evaluations for appraisal view."""
    d = dict(event_row)
    organizer = db.execute(
        "SELECT id, full_name FROM users WHERE id=?", (d.get("created_by"),)
    ).fetchone()
    d["organizer"] = dict(organizer) if organizer else None
    d["evaluations"] = [dict(r) for r in db.execute(
        "SELECT * FROM event_evaluations WHERE event_id=? ORDER BY date_submitted DESC",
        (d["id"],)
    ).fetchall()]
    d["demographics"] = _demographics(d["evaluations"])
    return d


def _demographics(evaluations: list) -> dict:
    """Evaluator breakdown for an event: counts by role, sex and age group
    (most common first). Evaluations from before demographics were collected
    count as "Not specified"."""
    def tally(key):
        counts = {}
        for e in evaluations:
            v = (e.get(key) or "").strip() or "Not specified"
            counts[v] = counts.get(v, 0) + 1
        return dict(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])))
    return {
        "total": len(evaluations),
        "by_role": tally("evaluator_role"),
        "by_sex": tally("evaluator_sex"),
        "by_age_group": tally("evaluator_age_group"),
    }


# ── Special Tasks ─────────────────────────────────────────────────────────────

class SpecialTaskBody(BaseModel):
    title: str
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    due_date: Optional[str] = None


class SpecialTaskEvalBody(BaseModel):
    completion_quality_score: int
    timeliness_score: int
    initiative_score: int
    # No longer rated (kept so older clients still validate).
    coordination_score: int = 0
    remarks: Optional[str] = None


def _special_task_or_404(db, task_id: int):
    row = db.execute(
        "SELECT * FROM tasks WHERE id=? AND task_category='special'", (task_id,)
    ).fetchone()
    if not row:
        raise HTTPException(404, "Special task not found")
    return row


@router.get("/special-tasks")
def list_special_tasks(db=Depends(get_db), user=Depends(require_appraisal_view),
                       school_year: str = "current", term_id: Optional[int] = None):
    """Special tasks scoped to who the caller may see (by assignee). Teachers see
    tasks assigned to them; deans see their grade-level teachers' + their own."""
    window = _window(db, school_year, term_id)
    rows = [r for r in db.execute(
        "SELECT * FROM tasks WHERE task_category='special' ORDER BY created_at DESC"
    ).fetchall() if task_in_window(window, r)]
    visible = _visible_personnel_ids(db, user)
    out = []
    shaped_rows = [_special_task_row(r, db) for r in rows]
    shaped_rows += [_credit_row(c, db) for c in _committee_credits(db, window)]
    shaped_rows.sort(key=lambda s: str(s.get("created_at") or ""), reverse=True)
    for shaped in shaped_rows:
        if visible is not None:
            assignee = shaped.get("assignee")
            if not assignee or assignee["id"] not in visible:
                continue
        out.append(shaped)
    return out


@router.post("/special-tasks", status_code=201)
def create_special_task(body: SpecialTaskBody, request: Request, db=Depends(get_db),
                        user=Depends(require_appraisal_access)):
    """Create a special task = a `tasks` row tagged 'special' + an assignment."""
    uid = int(user["sub"])
    task_id = store.create_task(db, {"title": body.title, "instructions": body.description, "task_category": "special",
                                     "end_date": body.due_date, "created_by": uid})
    if body.assignee_id:
        role = db.execute("SELECT role FROM personnel WHERE id=?", (body.assignee_id,)).fetchone()
        store.assign(db, task_id, body.assignee_id, uid, role["role"] if role else "teacher")
    audit.record(db, user, "task.create", "task", task_id,
                 f"Created special task {body.title}"
                 + (f" for {audit.user_label(db, body.assignee_id)}" if body.assignee_id else ""),
                 changes={"due": [None, body.due_date]}, request=request)
    db.commit()
    return _special_task_row(_special_task_or_404(db, task_id), db)


@router.post("/special-tasks/{task_id}/evaluate")
def evaluate_special_task(task_id: int, body: SpecialTaskEvalBody, request: Request,
                          db=Depends(get_db), user=Depends(require_appraisal_access)):
    task = _special_task_or_404(db, task_id)
    scores = [body.completion_quality_score, body.timeliness_score,
              body.initiative_score, body.coordination_score]
    # Final IPCRF score (1-5) = average of Quality (completion), Efficiency
    # (initiative) and Timeliness; coordination is no longer rated.
    if not all(1 <= x <= 5 for x in scores[:3]):
        raise HTTPException(400, "Ratings must be between 1 and 5")
    weighted_avg = round(sum(scores[:3]) / 3, 2)
    uid = int(user["sub"])
    # The weighted average is derived when read (see the special_task_evaluations view).
    ev_id = db.execute(
        """INSERT INTO special_task_evaluation (task_id, evaluator_id, completion_quality_score, timeliness_score,
                                               initiative_score, coordination_score, remarks)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(task_id) DO UPDATE SET evaluator_id=excluded.evaluator_id,
             completion_quality_score=excluded.completion_quality_score, timeliness_score=excluded.timeliness_score,
             initiative_score=excluded.initiative_score, coordination_score=excluded.coordination_score,
             remarks=excluded.remarks, evaluated_at=CURRENT_TIMESTAMP""",
        (task_id, uid, body.completion_quality_score, body.timeliness_score,
         body.initiative_score, body.coordination_score, (body.remarks or "").strip() or None))
    audit.record(db, user, "task.evaluate", "task", task_id,
                 f"Evaluated special task {task['title']}",
                 changes={"weighted_average": [None, round(weighted_avg, 2)]}, request=request)
    db.commit()
    return _special_task_row(_special_task_or_404(db, task_id), db)


# ── Event Evaluation (appraisal rubric on EVENTS) ──────────────────────────────

class EventEvalBody(BaseModel):
    evaluator_name: str
    evaluator_role: Optional[str] = None
    planning_score: int
    objectives_score: int
    personnel_score: int
    time_mgmt_score: int
    engagement_score: int
    resource_score: int
    feedback_comments: Optional[str] = None


@router.get("/events")
def list_events_for_evaluation(db=Depends(get_db), user=Depends(require_appraisal_view),
                               school_year: str = "current", term_id: Optional[int] = None):
    """List events available for evaluation, scoped to the caller. Teachers see
    events they organized; deans see their grade-level teachers' + their own."""
    window = _window(db, school_year, term_id)
    rows = [r for r in db.execute(
        "SELECT * FROM events WHERE status != 'draft' ORDER BY target_date DESC"
    ).fetchall() if in_window(window, r["target_date"], r["created_at"])]
    visible = _visible_personnel_ids(db, user)
    if visible is not None:
        rows = [r for r in rows if r["created_by"] in visible]
    return [_event_evaluation_row(r, db) for r in rows]


@router.get("/events/{event_id}")
def get_event_for_evaluation(event_id: int, db=Depends(get_db),
                             user=Depends(require_appraisal_access)):
    """Get single event with all evaluations."""
    row = db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    return _event_evaluation_row(row, db)


@router.post("/events/{event_id}/evaluate", status_code=201)
def evaluate_event(event_id: int, body: EventEvalBody, request: Request, db=Depends(get_db),
                   user=Depends(require_appraisal_access)):
    """Submit a supervisor evaluation rubric for an event."""
    row = db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")

    # Validate scores are in range [0,5]
    scores = [body.planning_score, body.objectives_score, body.personnel_score,
              body.time_mgmt_score, body.engagement_score, body.resource_score]
    if not all(0 <= s <= 5 for s in scores):
        raise HTTPException(400, "All scores must be between 0 and 5")

    uid = int(user["sub"])
    # Same rule as the public form: one evaluation per person per event.
    # (Per-activity attendee evaluations carry an activity_index and don't count.)
    if db.execute("SELECT 1 FROM event_evaluations WHERE event_id=? AND evaluator_id=? "
                  "AND activity_index IS NULL", (event_id, uid)).fetchone():
        raise HTTPException(409, "You have already evaluated this event.")
    store.add_evaluation(db, event_id, name=body.evaluator_name.strip(), role=body.evaluator_role or user["role"],
                         scores=[body.planning_score, body.objectives_score, body.personnel_score,
                                 body.time_mgmt_score, body.engagement_score, body.resource_score],
                         account_id=uid, feedback=body.feedback_comments)
    audit.record(db, user, "event.evaluate", "event", event_id,
                 f"Evaluated event {row['title']}", request=request)
    db.commit()
    return _event_evaluation_row(
        db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone(), db
    )


# ── Paper evaluations ─────────────────────────────────────────────────────────
# An attendee filled in the printed evaluation form; staff record its ratings
# here with a photo or scan of the form as proof (from Lok's appraisal update).

@router.post("/events/{event_id}/paper-evaluation", status_code=201)
async def submit_paper_evaluation(
        event_id: int, request: Request,
        image: UploadFile = File(...),
        planning_score: int = Form(...), objectives_score: int = Form(...), personnel_score: int = Form(...),
        time_mgmt_score: int = Form(...), engagement_score: int = Form(...), resource_score: int = Form(...),
        evaluator_name: str = Form(""), evaluator_role: str = Form(""), evaluator_sex: str = Form(""),
        evaluator_age_group: str = Form(""), evaluator_affiliation: str = Form(""), feedback_comments: str = Form(""),
        db=Depends(get_db), user=Depends(require_appraisal_access)):
    """Records a paper evaluation (six 1-5 ratings, who filled it in) with the
    photo or scan of the form, which approvers can open from the results."""
    from files import save_upload
    from routes.public_evaluation import AGE_GROUPS, SEX_OPTIONS
    row = db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    scores = [planning_score, objectives_score, personnel_score, time_mgmt_score, engagement_score, resource_score]
    if not all(1 <= s <= 5 for s in scores):
        raise HTTPException(400, "Every rating must be from 1 to 5.")
    sex, age = evaluator_sex.strip() or None, evaluator_age_group.strip() or None
    if sex and sex not in SEX_OPTIONS:
        raise HTTPException(400, "Choose the evaluator's sex from the list.")
    if age and age not in AGE_GROUPS:
        raise HTTPException(400, "Choose the evaluator's age group from the list.")
    if not (image.filename or "").lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".pdf")):
        raise HTTPException(400, "Attach a photo (JPG, PNG) or a scanned PDF of the paper form.")
    saved = await save_upload(image, prefix=f"paper_eval_{event_id}_")
    store.add_evaluation(db, event_id, name=evaluator_name.strip()[:120] or "Paper evaluation",
                         role=evaluator_role.strip()[:60] or "attendee", scores=scores, sex=sex, age_group=age,
                         affiliation=evaluator_affiliation.strip()[:200] or None,
                         feedback=feedback_comments.strip()[:2000] or None, is_paper=True, image_url=saved["url"])
    audit.record(db, user, "event.paper_evaluation", "event", event_id,
                 f"Recorded a paper evaluation for {row['title']}", request=request)
    db.commit()
    return _event_evaluation_row(db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone(), db)


# ── Annual Faculty Performance Summary (feeds the PDF export) ─────────────────
# One row per personnel, aggregated from the same records the appraisal tabs
# use. The grade follows the DepEd RPMS rating scale on a 1-5 rating derived
# from the total appraisal points; it supports IPCRF preparation and does not
# replace the official RPMS rating.

SCHOOL_NAME = os.environ.get("SCHOOL_NAME", "Naga Central School II")
SCHOOL_STATION_ID = os.environ.get("SCHOOL_STATION_ID", "")
SCHOOL_DIVISION = os.environ.get("SCHOOL_DIVISION", "Schools Division Office (SDO Naga City, Region V)")


def _rpms_grade(points: float) -> str:
    rating = points / 100 * 4 + 1
    if rating >= 4.5:
        return "Outstanding"
    if rating >= 3.5:
        return "Very Satisfactory"
    if rating >= 2.5:
        return "Satisfactory"
    return "Unsatisfactory"


def _school_year_name(db, school_year: str) -> Optional[str]:
    if str(school_year).isdigit():
        row = db.execute("SELECT name FROM school_years WHERE id=?", (int(school_year),)).fetchone()
        return row["name"] if row else None
    if school_year == "current":
        cur = current_school_year(db)
        return cur["name"] if cur else None
    return None


def _summary_timing(db, uid: int, window) -> list:
    """Timing points of the person's first submission per task in the window."""
    out = []
    for r in db.execute(
            """SELECT r.task_id, MIN(sl.date_of_submission) AS submitted_at,
                      MIN(t.end_date) AS end_date, MIN(t.due_time) AS due_time
               FROM submission_log sl
               JOIN reports r ON r.id = sl.report_id
               JOIN tasks t ON t.id = r.task_id
               WHERE sl.sender_personnel_id=?
               GROUP BY r.task_id""", (uid,)).fetchall():
        if in_window(window, r["end_date"], r["submitted_at"]):
            out.append(_compute_timing(r["submitted_at"], r["end_date"], r["due_time"])[1])
    return out


@router.get("/performance-summary")
def performance_summary(school_year: str = "current", term_id: Optional[int] = None,
                        db=Depends(get_db), user=Depends(require_appraisal_view)):
    """Rows for the Annual Faculty Performance Summary: special-task ratings,
    event evaluation rate, report timing points, total, RPMS grade and remarks."""
    window = _window(db, school_year, term_id)
    visible = _visible_personnel_ids(db, user)
    people = db.execute(
        """SELECT u.id, u.full_name, u.role,
                  COALESCE((SELECT STRING_AGG(DISTINCT s.subject_name, ', ')
                            FROM user_subjects us JOIN subjects s ON s.id = us.subject_id
                            WHERE us.user_id = u.id), gl.grade_level) AS department
           FROM users u
           LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
           WHERE u.is_active=1 AND u.role NOT IN ('admin','principal')
           ORDER BY u.full_name""").fetchall()

    rows = []
    for p in people:
        pid = p["id"]
        if visible is not None and pid not in visible:
            continue
        # Special tasks assigned to this person that were evaluated (1-5).
        st = [r["weighted_average"] for r in db.execute(
            """SELECT ste.weighted_average, t.end_date, t.start_date, t.created_at
               FROM special_task_evaluations ste
               JOIN tasks t ON t.id = ste.task_id
               JOIN task_assignments ta ON ta.task_id = t.id
               WHERE ta.user_id=? AND ste.weighted_average IS NOT NULL""", (pid,)).fetchall()
              if task_in_window(window, r)]
        # Events organized by this person: attendee evaluation rate (0-100).
        ev_rates, ev_flags = [], 0
        for e in db.execute("SELECT id, target_date, created_at FROM events WHERE created_by=?", (pid,)).fetchall():
            if not in_window(window, e["target_date"], e["created_at"]):
                continue
            scores = [r["s"] for r in db.execute(
                """SELECT (planning_score + objectives_score + personnel_score + time_mgmt_score
                           + engagement_score + resource_score) / 6.0 AS s
                   FROM event_evaluations WHERE event_id=?""", (e["id"],)).fetchall()]
            if scores:
                avg = sum(scores) / len(scores)
                ev_rates.append(avg / 5 * 100)
                ev_flags += 1 if avg < 3.0 else 0
        timing = _summary_timing(db, pid, window)
        late_over = sum(1 for pts in timing if pts == TIMING_LATE_OVER)

        parts = []
        if st:
            parts.append(sum(st) / len(st) / 5 * 100)
        if ev_rates:
            parts.append(sum(ev_rates) / len(ev_rates))
        if timing:
            parts.append(sum(timing) / len(timing))  # 0-100 per report
        total = round(sum(parts) / len(parts), 2) if parts else None
        grade = _rpms_grade(total) if total is not None else None
        escalations = sum(1 for w in st if w < 3.0) + ev_flags + late_over
        if total is None:
            remarks = "For Review"
        elif grade == "Unsatisfactory":
            remarks = "Flagged"
        elif escalations > 0:
            remarks = "For Review"
        else:
            remarks = "Cleared"
        rows.append({
            "id": pid, "name": p["full_name"], "position": (p["role"] or "").title(),
            "department": p["department"],
            "special_task_score": round(sum(st) / len(st), 2) if st else None,
            "event_score": round(sum(ev_rates) / len(ev_rates), 1) if ev_rates else None,
            "timing_points": sum(timing),
            "total_points": total, "overall_grade": grade,
            "escalation_count": escalations, "remarks": remarks,
        })
    return {"school_name": SCHOOL_NAME, "station_id": SCHOOL_STATION_ID,
            "division": SCHOOL_DIVISION, "school_year": _school_year_name(db, school_year), "rows": rows}


# ── Badges ────────────────────────────────────────────────────────────────────
# Achievement badges, computed live from the same records the appraisal tabs
# use (submission timing, special-task ratings, event evaluations), scoped to a
# school year / term. Nothing is stored, so badges always match the data.

_TIERS = [("gold", 30), ("silver", 15), ("bronze", 5)]


def _person_submissions(db, uid: int, window) -> list:
    """The person's first submission per task in the window, oldest first, with
    its timing status and whether it came at least a day early."""
    rows = db.execute(
        """SELECT r.task_id, MIN(sl.date_of_submission) AS submitted_at,
                  t.end_date, t.due_time
           FROM submission_log sl
           JOIN reports r ON r.id = sl.report_id
           JOIN tasks t ON t.id = r.task_id
           WHERE sl.sender_personnel_id=?
           GROUP BY r.task_id, t.end_date, t.due_time""", (uid,)).fetchall()
    out = []
    for r in rows:
        if not in_window(window, r["end_date"], r["submitted_at"]):
            continue
        status, _ = _compute_timing(r["submitted_at"], r["end_date"], r["due_time"])
        dl, sub = _deadline_dt(r["end_date"], r["due_time"]), _parse_dt(r["submitted_at"])
        out.append({"status": status, "submitted": sub,
                    "early": bool(dl and sub and dl - sub >= timedelta(hours=24))})
    return sorted(out, key=lambda s: s["submitted"] or datetime.min)


def _deadlines_passed(db, uid: int, window) -> tuple:
    """(deadlines passed, of which never submitted) for the person's
    assignments in the window."""
    now = datetime.now()
    passed = missing = 0
    for r in db.execute(
            """SELECT t.*, (EXISTS (SELECT 1 FROM task_log tl WHERE tl.task_id=t.id
                                    AND tl.personnel_id=ta.user_id)
                         OR EXISTS (SELECT 1 FROM reports rp WHERE rp.task_id=t.id
                                    AND rp.personnel_id=ta.user_id)) AS done
               FROM task_assignments ta JOIN tasks t ON t.id = ta.task_id
               WHERE ta.user_id=? AND t.status='active'""", (uid,)).fetchall():
        if not task_in_window(window, r):
            continue
        dl = _deadline_dt(r["end_date"], r["due_time"])
        if dl and dl < now:
            passed += 1
            missing += 0 if r["done"] else 1
    return passed, missing


def _badge(code, name, description, icon, progress, target, tier=None):
    return {"code": code, "name": name, "description": description, "icon": icon,
            "tier": tier, "earned": progress >= target,
            "progress": min(progress, target), "target": target}


def compute_badges(db, uid: int, window) -> list:
    subs = _person_submissions(db, uid, window)
    on_time = sum(1 for s in subs if s["status"] == "On Time")
    early = sum(1 for s in subs if s["early"])
    streak = best = 0
    for s in subs:
        streak = streak + 1 if s["status"] == "On Time" else 0
        best = max(best, streak)
    passed, missing = _deadlines_passed(db, uid, window)

    # Punctual: highest tier reached; otherwise progress toward bronze.
    tier, target = next(((t, n) for t, n in _TIERS if on_time >= n), (None, _TIERS[-1][1]))
    punctual = _badge("punctual", f"Punctual · {tier.title()}" if tier else "Punctual",
                      "Submit reports on time (5 / 15 / 30).", "schedule",
                      on_time, target, tier)

    # Special-task ratings (0-5) for tasks assigned to this person.
    ratings = _special_ratings(db, uid, window)
    avg_rating = sum(ratings) / len(ratings) if ratings else 0

    # Events this person organized and how evaluators rated them.
    best_event_avg, most_evals = 0.0, 0
    for e in db.execute("SELECT id, target_date, created_at FROM events WHERE created_by=?",
                        (uid,)).fetchall():
        if not in_window(window, e["target_date"], e["created_at"]):
            continue
        evs = db.execute(
            """SELECT (planning_score + objectives_score + personnel_score + time_mgmt_score
                       + engagement_score + resource_score) / 6.0 AS s
               FROM event_evaluations WHERE event_id=?""", (e["id"],)).fetchall()
        most_evals = max(most_evals, len(evs))
        if len(evs) >= 5:
            best_event_avg = max(best_event_avg, sum(r["s"] for r in evs) / len(evs))

    perfect = passed if (missing == 0 and on_time >= passed) else 0
    return [
        punctual,
        _badge("early_bird", "Early Bird",
               "Submit 5 reports at least a day before the deadline.",
               "wb_sunny", early, 5),
        _badge("hot_streak", "Hot Streak", "Submit 5 reports on time in a row.",
               "local_fire_department", best, 5),
        _badge("perfect_record", "Perfect Record",
               "Meet every deadline: at least 5 due, none late or missing.",
               "verified", perfect, 5),
        _badge("special_star", "Special Task Star",
               "Average special-task rating of 4.5 or higher.",
               "star", 1 if ratings and avg_rating >= 4.5 else 0, 1),
        _badge("event_excellence", "Event Excellence",
               "Organize an event rated 4.5+ by at least 5 evaluators.",
               "emoji_events", 1 if best_event_avg >= 4.5 else 0, 1),
        _badge("crowd_favorite", "Crowd Favorite",
               "Organize an event that receives 20 or more evaluations.",
               "groups", most_evals, 20),
    ]


@router.get("/badges")
def get_badges(user_id: Optional[int] = None, school_year: str = "current",
               term_id: Optional[int] = None, db=Depends(get_db),
               user=Depends(require_appraisal_view)):
    """Badges for one person (default: the caller), if the caller may view them."""
    uid = user_id or int(user["sub"])
    visible = _visible_personnel_ids(db, user)
    if visible is not None and uid not in visible:
        raise HTTPException(403, "You cannot view this person's badges")
    badges = compute_badges(db, uid, _window(db, school_year, term_id))
    return {"user_id": uid, "earned": sum(1 for b in badges if b["earned"]),
            "total": len(badges), "badges": badges}


@router.get("/badges/leaderboard")
def badge_leaderboard(school_year: str = "current", term_id: Optional[int] = None,
                      db=Depends(get_db), user=Depends(require_appraisal_view)):
    """Earned badges per visible personnel member, most badges first."""
    window = _window(db, school_year, term_id)
    visible = _visible_personnel_ids(db, user)
    rows = db.execute(
        """SELECT u.id, u.full_name, u.role, gl.grade_level FROM users u
           LEFT JOIN grade_levels gl ON gl.id = u.grade_level_id
           WHERE u.is_active=1 AND u.role NOT IN ('admin','principal')""").fetchall()
    out = []
    for r in rows:
        if visible is not None and r["id"] not in visible:
            continue
        earned = [b for b in compute_badges(db, r["id"], window) if b["earned"]]
        out.append({**dict(r), "earned_count": len(earned), "badges": earned})
    out.sort(key=lambda p: (-p["earned_count"], p["full_name"]))
    return out

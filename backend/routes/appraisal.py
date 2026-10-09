from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from database import get_db
from auth import require_appraisal_access, require_appraisal_view, has_permission
from school_calendar import resolve_window, in_window, task_in_window


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
    return {
        "id": d["id"],
        "title": d["title"],
        "description": d.get("instructions"),
        "due_date": d.get("end_date"),
        "created_at": d.get("created_at"),
        "status": "evaluated" if ev else "pending",
        "assignee": dict(assignee) if assignee else None,
        "assigner": dict(assigner) if assigner else None,
        "evaluation": dict(ev) if ev else None,
    }


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
    coordination_score: int
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
    for r in rows:
        shaped = _special_task_row(r, db)
        if visible is not None:
            assignee = shaped.get("assignee")
            if not assignee or assignee["id"] not in visible:
                continue
        out.append(shaped)
    return out


@router.post("/special-tasks", status_code=201)
def create_special_task(body: SpecialTaskBody, db=Depends(get_db),
                        user=Depends(require_appraisal_access)):
    """Create a special task = a `tasks` row tagged 'special' + an assignment."""
    uid = int(user["sub"])
    db.execute(
        """INSERT INTO tasks (title, instructions, task_category, end_date, created_by)
           VALUES (?,?, 'special', ?, ?)""",
        (body.title, body.description, body.due_date, uid)
    )
    task_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    if body.assignee_id:
        db.execute(
            "INSERT OR IGNORE INTO task_assignments (task_id, user_id, assigned_by) VALUES (?,?,?)",
            (task_id, body.assignee_id, uid)
        )
    db.commit()
    return _special_task_row(_special_task_or_404(db, task_id), db)


@router.post("/special-tasks/{task_id}/evaluate")
def evaluate_special_task(task_id: int, body: SpecialTaskEvalBody,
                          db=Depends(get_db), user=Depends(require_appraisal_access)):
    _special_task_or_404(db, task_id)
    scores = [body.completion_quality_score, body.timeliness_score,
              body.initiative_score, body.coordination_score]
    weights = [0.40, 0.30, 0.30, 0.00]
    weighted_avg = sum(s * w for s, w in zip(scores, weights))
    uid = int(user["sub"])
    db.execute(
        """INSERT INTO special_task_evaluations
           (task_id, evaluator_id, completion_quality_score, timeliness_score,
            initiative_score, coordination_score, weighted_average, remarks)
           VALUES (?,?,?,?,?,?,?,?)
           ON CONFLICT(task_id) DO UPDATE SET
             evaluator_id=excluded.evaluator_id,
             completion_quality_score=excluded.completion_quality_score,
             timeliness_score=excluded.timeliness_score,
             initiative_score=excluded.initiative_score,
             coordination_score=excluded.coordination_score,
             weighted_average=excluded.weighted_average,
             remarks=excluded.remarks,
             evaluated_at=CURRENT_TIMESTAMP""",
        (task_id, uid, body.completion_quality_score, body.timeliness_score,
         body.initiative_score, body.coordination_score, weighted_avg, body.remarks)
    )
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
def evaluate_event(event_id: int, body: EventEvalBody, db=Depends(get_db),
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
    if db.execute("SELECT 1 FROM event_evaluations WHERE event_id=? AND evaluator_id=?",
                  (event_id, uid)).fetchone():
        raise HTTPException(409, "You have already evaluated this event.")
    db.execute(
        """INSERT INTO event_evaluations
           (event_id, evaluator_id, evaluator_name, evaluator_role,
            planning_score, objectives_score, personnel_score,
            time_mgmt_score, engagement_score, resource_score, feedback_comments)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (event_id, uid, body.evaluator_name.strip(), body.evaluator_role,
         body.planning_score, body.objectives_score, body.personnel_score,
         body.time_mgmt_score, body.engagement_score, body.resource_score,
         body.feedback_comments.strip() if body.feedback_comments else None)
    )
    db.commit()
    return _event_evaluation_row(
        db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone(), db
    )


# ── Badges ────────────────────────────────────────────────────────────────────
# Achievement badges, computed live from the same records the appraisal tabs
# use (submission timing, special-task ratings, event evaluations), scoped to a
# school year / term. Nothing is stored, so badges always match the data.

_TIERS = [("gold", 30), ("silver", 15), ("bronze", 5)]


def _person_submissions(db, uid: int, window) -> list:
    """The person's first submission per task in the window, oldest first, with
    its timing status and how early it was."""
    rows = db.execute(
        """SELECT r.task_id, MIN(sl.date_of_submission) AS submitted_at,
                  t.end_date, t.due_time
           FROM submission_log sl
           JOIN reports r ON r.id = sl.report_id
           JOIN tasks t ON t.id = r.task_id
           WHERE sl.sender_personnel_id=?
           GROUP BY r.task_id""", (uid,)).fetchall()
    out = []
    for r in rows:
        if not in_window(window, r["end_date"], r["submitted_at"]):
            continue
        status, _ = _compute_timing(r["submitted_at"], r["end_date"], r["due_time"])
        dl, sub = _deadline_dt(r["end_date"], r["due_time"]), _parse_dt(r["submitted_at"])
        out.append({"status": status, "submitted": sub,
                    "early": bool(dl and sub and dl - sub >= timedelta(hours=24))})
    return sorted(out, key=lambda s: s["submitted"] or datetime.min)


def _missing_count(db, uid: int, window) -> tuple:
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
    passed, missing = _missing_count(db, uid, window)

    # Punctual: highest tier reached, else progress toward bronze.
    tier, target = next(((t, n) for t, n in _TIERS if on_time >= n), (None, _TIERS[-1][1]))
    if tier is None:
        punctual = _badge("punctual", "Punctual", "Submit reports on time (5 / 15 / 30).",
                          "schedule", on_time, target)
    else:
        punctual = _badge("punctual", f"Punctual · {tier.title()}",
                          "Submit reports on time (5 / 15 / 30).", "schedule",
                          on_time, target, tier)

    # Special task ratings for tasks assigned to this person.
    ratings = [r["weighted_average"] for r in db.execute(
        """SELECT ste.weighted_average, t.end_date, t.start_date, t.created_at
           FROM special_task_evaluations ste
           JOIN tasks t ON t.id = ste.task_id
           JOIN task_assignments ta ON ta.task_id = t.id
           WHERE ta.user_id=? AND ste.weighted_average IS NOT NULL""", (uid,)).fetchall()
        if task_in_window(window, r)]
    avg_rating = sum(ratings) / len(ratings) if ratings else 0

    # Events this person organized and how attendees rated them.
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

    return [
        punctual,
        _badge("early_bird", "Early Bird", "Submit 5 reports at least a day before the deadline.",
               "wb_sunny", early, 5),
        _badge("hot_streak", "Hot Streak", "Submit 5 reports on time in a row.",
               "local_fire_department", best, 5),
        _badge("perfect_record", "Perfect Record",
               "Meet every deadline — at least 5 due, none late or missing.",
               "verified", passed if (missing == 0 and on_time >= passed) else 0, 5),
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
           GROUP BY r.task_id""", (uid,)).fetchall()
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
    ratings = [r["weighted_average"] for r in db.execute(
        """SELECT ste.weighted_average, t.end_date, t.start_date, t.created_at
           FROM special_task_evaluations ste
           JOIN tasks t ON t.id = ste.task_id
           JOIN task_assignments ta ON ta.task_id = t.id
           WHERE ta.user_id=? AND ste.weighted_average IS NOT NULL""", (uid,)).fetchall()
        if task_in_window(window, r)]
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

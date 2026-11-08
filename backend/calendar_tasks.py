"""
calendar_tasks.py — Post the tasks a scanned school calendar implies, routed to
the right people.

A route says who does a task and who it is submitted to (calendar_plan.ROUTES):
"subject>adviser" posts one task per section, given to the section's subject
teachers with its adviser as the one who assigned it, so the adviser tracks and
reviews those submissions (their Advisory tab). "adviser>dean" and
"teacher>dean" assign each person on behalf of the dean of their grade level.
Anyone no adviser or dean covers submits to whoever posted the calendar; every
other route is assigned by the poster, who reviews it.
"""
from typing import Optional

import audit
import store
from database import create_notification
from calendar_plan import ROUTES

DUE_TIME = "5:00 PM"


def _active(db, role: str) -> list:
    """Active accounts holding [role] (primary or additional), with their grade levels."""
    return db.execute(
        """SELECT DISTINCT u.id, u.full_name, u.grade_level_id FROM users u
           LEFT JOIN user_held_roles h ON h.user_id = u.id
           WHERE u.is_active=1 AND (u.role=? OR h.role=?)""", (role, role)).fetchall()


def _dean_by_grade(db) -> dict:
    """{grade_level_id: dean} — the grade a dean handles (dean_assignment, else their own)."""
    out = {}
    for d in db.execute(
            """SELECT u.id, u.full_name, COALESCE(da.grade_level_id, u.grade_level_id) AS gl
               FROM users u LEFT JOIN dean_assignment da ON da.user_id = u.id
               WHERE u.role='dean' AND u.is_active=1 ORDER BY u.id""").fetchall():
        if d["gl"] is not None:
            out.setdefault(d["gl"], {"id": d["id"], "name": d["full_name"]})
    return out


def _teacher_grade(db, teacher) -> Optional[int]:
    """A teacher's grade level: their own, else the first grade of their subject load."""
    if teacher["grade_level_id"] is not None:
        return teacher["grade_level_id"]
    r = db.execute("""SELECT grade_level_id FROM user_subjects
                      WHERE user_id=? AND grade_level_id IS NOT NULL ORDER BY id LIMIT 1""",
                   (teacher["id"],)).fetchone()
    return r["grade_level_id"] if r else None


def _sections(db) -> list:
    """Sections with an active adviser or subject teachers: id, label, grade, adviser, teachers."""
    out = []
    for sec in db.execute(
            """SELECT s.id, s.name, s.grade_level_id, gl.grade_level,
                      CASE WHEN u.is_active=1 THEN s.adviser_id END AS adviser_id
               FROM sections s JOIN grade_levels gl ON gl.id = s.grade_level_id
               LEFT JOIN users u ON u.id = s.adviser_id ORDER BY gl.id, s.name""").fetchall():
        teachers = [r["user_id"] for r in db.execute(
            """SELECT DISTINCT st.user_id FROM section_teachers st JOIN users u ON u.id = st.user_id
               WHERE st.section_id=? AND u.is_active=1""", (sec["id"],)).fetchall()]
        out.append({**dict(sec), "label": f"{sec['grade_level']} - {sec['name']}", "teachers": teachers})
    return out


def _units(db, route: str, poster: int) -> list:
    """How a row is posted: [(title suffix, [(assignee, assigned_by, target_role)])].
    One unit (no suffix) for most routes; one per section for "subject>adviser"."""
    if route == "later":
        return [("", [])]
    who, reviewer = route.split(">")
    deans = _dean_by_grade(db)
    dean_ids = {d["id"] for d in deans.values()}

    def dean_for(grade, person):   # a dean never reviews their own work: theirs goes to the poster
        dean = deans.get(grade)
        return dean["id"] if dean and person not in dean_ids else poster

    if route == "subject>adviser":
        sections = _sections(db)
        if not any(s["teachers"] for s in sections):
            # No teaching loads recorded yet: every teacher submits to their dean instead.
            return _units(db, "teacher>dean", poster)
        # A section without an adviser submits to the poster; an adviser's own subject in their class is theirs already.
        return [(f" – {s['label']}", [(t, s["adviser_id"] or poster, "teacher") for t in s["teachers"] if t != s["adviser_id"]])
                for s in sections if s["teachers"]]
    if route == "adviser>dean":
        return [("", [(s["adviser_id"], dean_for(s["grade_level_id"], s["adviser_id"]), "teacher")
                      for s in _sections(db) if s["adviser_id"]])]
    people = _active(db, who)
    if reviewer == "registrar":
        reg = db.execute("SELECT id FROM users WHERE role='registrar' AND is_active=1 ORDER BY id LIMIT 1").fetchone()
        return [("", [(p["id"], reg["id"] if reg else poster, who) for p in people if not reg or p["id"] != reg["id"]])]
    if reviewer != "dean":
        return [("", [(p["id"], poster, who) for p in people])]
    return [("", [(p["id"], dean_for(_teacher_grade(db, p), p["id"]), who) for p in people])]


def post_calendar_tasks(db, user: dict, rows: list, file_name: str, request=None) -> dict:
    """Create the tasks for each row and assign them along its route. Returns a
    summary: {posted, assigned, by_reviewer: {name: n}, to_poster}. Caller commits."""
    poster = int(user["sub"])
    posted, assigned, to_poster, by_reviewer = 0, 0, 0, {}
    names = {}

    def name_of(uid):
        if uid not in names:
            r = db.execute("SELECT full_name FROM users WHERE id=?", (uid,)).fetchone()
            names[uid] = r["full_name"] if r else "Reviewer"
        return names[uid]

    for row in rows:
        route = row.get("route") if row.get("route") in ROUTES else "later"
        base = (row.get("title") or "").strip()[:160]
        if not base:
            continue
        # Scanned tasks already name their calendar entry ("Basis: ..."); ones the principal added do not.
        instructions = (row.get("instructions") or "").strip() or (
            f"Complete and submit the {base} on or before {row.get('end_date')}.\n\n"
            f"Added with the school calendar tasks ({file_name}).")
        for suffix, people in _units(db, route, poster):
            title = f"{base}{suffix}"[:200]
            task_id = store.create_task(db, {
                "title": title, "task_category": "common", "start_date": row.get("start_date"), "end_date": row.get("end_date"),
                "due_time": DUE_TIME, "instructions": instructions, "created_by": poster})
            reviewers = {}
            for uid, by, role in people:
                store.assign(db, task_id, uid, by, role)
                create_notification(db, uid, "task", f"New task: {title}", f"From the school calendar · due {row.get('end_date')}", task_id)
                reviewers[by] = reviewers.get(by, 0) + 1
                assigned += 1
            for by, n in reviewers.items():
                if by == poster:
                    to_poster += n
                    continue
                by_reviewer[name_of(by)] = by_reviewer.get(name_of(by), 0) + n
                create_notification(db, by, "task", f"{n} {'people' if n != 1 else 'person'} will submit to you: {title}",
                                    f"Assigned from the school calendar · due {row.get('end_date')}", task_id)
            audit.record(db, user, "task.create", "task", task_id, f"Created task {title} from the school calendar",
                         changes={"assigned": [None, sum(reviewers.values())], "due": [None, row.get("end_date")],
                                  "route": [None, route]}, request=request)
            posted += 1
    return {"posted": posted, "assigned": assigned, "by_reviewer": by_reviewer, "to_poster": to_poster}

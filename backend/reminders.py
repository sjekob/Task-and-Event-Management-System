"""
reminders.py: the day-before reminders, as in-app notifications (and email
copies, through create_notification, when mail is set up).

  - a task opens for reports tomorrow   -> everyone assigned
  - tomorrow is a task's last day       -> everyone assigned who hasn't submitted
  - an approved event is tomorrow       -> its proponent and committee members

A background thread checks every few minutes and sends each reminder once,
from REMINDER_HOUR (school-local time, default 7 AM) on the day before. What
was sent is kept in reminder_sent, keyed by the date it is about, so a moved
deadline or event date gets a fresh reminder and a restart never repeats one.
Several services can run this at once: the insert decides who sends.

Set REMINDERS=off to turn it off.
"""
import logging
import os
import threading
import time
from datetime import date, timedelta
from typing import Iterable, Optional

from date_utils import parse_event_date, school_now

log = logging.getLogger("tasknet.reminders")

CHECK_EVERY_S = 600
_started = False


def _hour() -> int:
    try:
        return min(23, max(0, int(os.getenv("REMINDER_HOUR", "7"))))
    except ValueError:
        return 7


def _fmt(d: date) -> str:
    return f"{d:%A}, {d:%B} {d.day}"


def _send(db, kind: str, ref_id: int, people: Iterable[int], on: date, ntype: str, title: str, body: str) -> int:
    """Claims the reminder for everyone in [people] in one insert, notifies those
    not reminded before, and commits both together; returns how many were new."""
    from database import create_notification
    people = sorted(set(people))
    if not people:
        return 0
    rows = ",".join("(?,?,?,?)" for _ in people)
    args = [x for uid in people for x in (kind, ref_id, uid, on.isoformat())]
    claimed = [r["personnel_id"] for r in db.execute(
        f"""INSERT INTO reminder_sent (kind, ref_id, personnel_id, on_date) VALUES {rows}
            ON CONFLICT DO NOTHING RETURNING personnel_id""", args).fetchall()]
    for uid in claimed:
        create_notification(db, uid, ntype, title, body, ref_id)
    db.commit()
    return len(claimed)


# ── Tasks ─────────────────────────────────────────────────────────────────────

def _due_text(end: Optional[str], due_time: Optional[str]) -> str:
    d = parse_event_date(end)
    if not d:
        return ""
    return f"Due {_fmt(d)}" + (f" at {due_time.strip()}" if due_time and due_time.strip() else "") + "."


def task_reminders(db, tomorrow: date) -> int:
    """Tasks opening or on their last day tomorrow, with each active assignee
    and whether they've submitted, in one query."""
    day = tomorrow.isoformat()
    rows = db.execute("""
        SELECT t.id, t.title, t.start_date, t.end_date, t.due_time, a.user_id,
               EXISTS (SELECT 1 FROM report r WHERE r.task_id = t.id AND r.personnel_id = a.user_id) AS submitted
        FROM task t
        JOIN task_assignments a ON a.task_id = t.id
        JOIN users u ON u.id = a.user_id AND u.is_active = 1
        WHERE t.status = 'active' AND (LEFT(t.start_date, 10) = ? OR LEFT(t.end_date, 10) = ?)
        ORDER BY t.id""", (day, day)).fetchall()
    tasks: dict = {}
    for r in rows:
        tasks.setdefault(r["id"], (r, []))[1].append(r)

    sent = 0
    for t, people in tasks.values():
        everyone = [p["user_id"] for p in people]
        due_at = f" at {t['due_time'].strip()}" if t["due_time"] and t["due_time"].strip() else ""
        opens = (t["start_date"] or "")[:10] == day
        last = (t["end_date"] or "")[:10] == day
        if opens and last:
            sent += _send(db, "task_opens", t["id"], everyone, tomorrow, "task", f"Opens tomorrow: {t['title']}",
                          f"Reports open {_fmt(tomorrow)} and it's due the same day{due_at}.")
            continue
        if opens:
            sent += _send(db, "task_opens", t["id"], everyone, tomorrow, "task", f"Opens tomorrow: {t['title']}",
                          f"You can submit your report starting {_fmt(tomorrow)}. {_due_text(t['end_date'], t['due_time'])}".strip())
        if last:
            sent += _send(db, "task_last_day", t["id"], [p["user_id"] for p in people if not p["submitted"]], tomorrow,
                          "task", f"Last day tomorrow: {t['title']}",
                          f"{_due_text(t['end_date'], t['due_time'])} You haven't submitted your report yet.")
    return sent


# ── Events ────────────────────────────────────────────────────────────────────

def event_start(ev) -> tuple:
    """(first day, its first session time or None): the earliest Activity Matrix
    session, else the target date with no time."""
    from routes.attendance import _activity_rows, _schedule
    starts = [s[0] for s in (_schedule(ev, r) for r in _activity_rows(ev)) if s]
    if starts:
        first = min(starts)
        return first.date(), first
    return parse_event_date(ev["target_date"]), None


def event_reminders(db, tomorrow: date) -> int:
    sent = 0
    # Only what the date needs; target dates are free text, so they're read here, not in SQL.
    for ev in db.execute("""SELECT id, title, venue, target_date, start_time, end_time, activity_matrix, created_by
                            FROM events WHERE status='approved'""").fetchall():
        day, first = event_start(ev)
        if day != tomorrow:
            continue
        people = [r["id"] for r in db.execute(
            """SELECT u.id FROM users u WHERE u.is_active = 1 AND (u.id = ? OR u.id IN (
                   SELECT m.personnel_id FROM event_committee_member m
                   JOIN event_committee c ON c.id = m.committee_id WHERE c.event_id = ?))""",
            (ev["created_by"], ev["id"])).fetchall()]
        start = f"{first:%I:%M %p}".lstrip("0") if first else ""
        where = (ev["venue"] or "").strip()
        body = f"{_fmt(tomorrow)}" + (f", starting {start}" if start else "") + (f" at {where}" if where else "") + "."
        sent += _send(db, "event_tomorrow", ev["id"], people, tomorrow, "event", f"Event tomorrow: {ev['title']}", body)
    return sent


# ── Runner ────────────────────────────────────────────────────────────────────

def run_once(now=None) -> int:
    """Sends whatever is due now (nothing before REMINDER_HOUR); returns how many."""
    from database import _connect
    now = now or school_now()
    if now.hour < _hour():
        return 0
    tomorrow = now.date() + timedelta(days=1)
    db = _connect()
    try:
        return task_reminders(db, tomorrow) + event_reminders(db, tomorrow)
    finally:
        db.close()


def _loop():
    delay = 30  # first check shortly after startup, then every CHECK_EVERY_S
    while True:
        time.sleep(delay)
        delay = CHECK_EVERY_S
        try:
            n = run_once()
            if n:
                log.info("Sent %d reminder(s)", n)
        except Exception as e:  # keep the service up; try again next round
            log.warning("Reminders failed: %s", e)


def start():
    """Starts the reminder thread once per process (no-op with REMINDERS=off)."""
    global _started
    if _started or os.getenv("REMINDERS", "on").strip().lower() in ("off", "0", "false", "no"):
        return
    _started = True
    threading.Thread(target=_loop, name="reminders", daemon=True).start()

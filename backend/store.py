"""
store.py — Writing to the stored tables (see schema.py).

Reads use the views with the familiar names (users, tasks, events, ...);
writes come here. Each entity's columns are listed, so an update is one call
with only the fields that changed:
    update_user(db, uid, {"email": "a@b.c", "middle_name": ""})
An empty string stores NULL ("not given").
"""
from typing import Iterable, Optional


def _value(v):
    return None if isinstance(v, str) and not v.strip() else v


def insert(db, table: str, fields: dict) -> int:
    """Inserts a row (empty strings stored as NULL); returns its id."""
    cols = [k for k, v in fields.items() if v is not None]
    return db.execute(f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
                      tuple(_value(fields[k]) for k in cols)).lastrowid


def update(db, table: str, row_id: int, fields: dict, allowed: set):
    """Sets [fields] (only [allowed] columns) on one row; empty strings become NULL."""
    unknown = set(fields) - allowed
    if unknown:
        raise KeyError(f"Unknown {table} field(s): {', '.join(sorted(unknown))}")
    if fields:
        db.execute(f"UPDATE {table} SET {', '.join(f'{k}=?' for k in fields)} WHERE id=?",
                   (*(_value(v) for v in fields.values()), row_id))


def replace_list(db, table: str, owner_col: str, owner: int, rows: Iterable[dict]):
    """Replaces an owner's ordered list (positions 0, 1, 2, ...)."""
    db.execute(f"DELETE FROM {table} WHERE {owner_col}=?", (owner,))
    for i, row in enumerate(rows):
        cols = list(row)
        db.execute(f"INSERT INTO {table} ({owner_col}, position, {', '.join(cols)}) VALUES ({', '.join('?' * (len(cols) + 2))}) "
                   f"RETURNING {owner_col}", (owner, i, *row.values()))


# ── Personnel ─────────────────────────────────────────────────────────────────

USER_COLUMNS = {
    "username", "password_hash", "role", "is_active", "first_name", "middle_name", "last_name", "suffix",
    "grade_level_id", "avatar_url", "email", "phone_number", "date_of_appointment", "birthdate", "address",
    "highest_attainment", "undergraduate_degree", "specialization", "postgraduate_focus",
}


def create_user(db, fields: dict) -> int:
    return insert(db, "personnel", {k: v for k, v in fields.items() if k in USER_COLUMNS})


def update_user(db, uid: int, fields: dict):
    update(db, "personnel", uid, fields, USER_COLUMNS)


def set_education(db, uid: int, fields: dict):
    update_user(db, uid, fields)


# ── Tasks ────────────────────────────────────────────────────────────────────

TASK_COLUMNS = {
    "title", "instructions", "subject", "task_type_id", "task_category", "start_date", "end_date", "due_time", "status",
    "points_early", "points_ontime", "points_late24", "points_after24", "source_event_id", "source_deped_id", "created_by",
}
TEMPLATE_COLUMNS = {"title", "instructions", "start_date", "end_date", "due_time",
                    "points_early", "points_ontime", "points_late24", "points_after24", "created_by"}


def create_task(db, fields: dict) -> int:
    return insert(db, "task", {k: v for k, v in fields.items() if k in TASK_COLUMNS})


def update_task(db, tid: int, fields: dict):
    update(db, "task", tid, fields, TASK_COLUMNS)


def create_template(db, fields: dict) -> int:
    return insert(db, "task_template", {k: v for k, v in fields.items() if k in TEMPLATE_COLUMNS})


def assign(db, task_id: int, user_id: int, assigned_by: int, target_role: str) -> bool:
    """Assigns [task_id] to [user_id] once; False when they already had it."""
    return db.execute("""INSERT INTO task_assignments (task_id, user_id, assigned_by, target_role) VALUES (?,?,?,?)
                         ON CONFLICT (task_id, user_id) DO NOTHING""",
                      (task_id, user_id, assigned_by, target_role)).lastrowid is not None


# ── Reports (submissions) ────────────────────────────────────────────────────

def save_report(db, task_id: int, personnel_id: int, title: str, *, description: Optional[str] = None,
                link_url: Optional[str] = None, status: str = "Pending", receiver_id: Optional[int] = None,
                date: Optional[str] = None, kind: Optional[str] = None) -> int:
    """Creates or replaces [personnel_id]'s submission for [task_id]; returns its id."""
    fields = {"report_title": title, "description": _value(description), "link_url": _value(link_url),
              "report_type": kind, "report_status": status, "receiver_id": receiver_id}
    row = db.execute("SELECT id FROM report WHERE task_id=? AND personnel_id=?", (task_id, personnel_id)).fetchone()
    if row:
        db.execute(f"UPDATE report SET {', '.join(f'{k}=?' for k in fields)}, report_date={'?' if date else 'CURRENT_TIMESTAMP'} WHERE id=?",
                   (*fields.values(), *((date,) if date else ()), row["id"]))
        return row["id"]
    return insert(db, "report", {"task_id": task_id, "personnel_id": personnel_id, **fields,
                                 **({"report_date": date} if date else {})})


# ── Notifications ────────────────────────────────────────────────────────────

def notify(db, user_id: int, kind: str, title: str, body: str = "", ref_id: Optional[int] = None) -> int:
    return insert(db, "notification", {"user_id": user_id, "type": kind, "title": title, "body": _value(body), "ref_id": ref_id})


# ── Attendance and evaluations ───────────────────────────────────────────────

GUEST_KEYS = ("guest_name", "guest_email", "guest_role", "guest_sex", "guest_age_group")


def time_in(db, event_id: int, index: int, stamp: str, who: dict, latitude=None, longitude=None, distance=None) -> int:
    """Records a Time In for personnel ({"user_id": ...}) or a guest (guest_* keys); returns the attendance id."""
    aid = insert(db, "attendance", {"event_id": event_id, "activity_index": index, "time_in_at": stamp,
                                    "time_in_latitude": latitude, "time_in_longitude": longitude, "time_in_distance_m": distance})
    if who.get("user_id") is not None:
        db.execute("""INSERT INTO attendance_personnel (attendance_id, event_id, activity_index, personnel_id)
                      VALUES (?,?,?,?) RETURNING attendance_id""", (aid, event_id, index, who["user_id"]))
    else:
        db.execute(f"""INSERT INTO attendance_guest (attendance_id, event_id, activity_index, {', '.join(GUEST_KEYS)},
                       guest_affiliation, consent_at) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING attendance_id""",
                   (aid, event_id, index, *(who[k] for k in GUEST_KEYS), _value(who.get("guest_affiliation")),
                    who["guest_consent_at"]))
    return aid


def time_out(db, attendance_id: int, stamp: str, latitude=None, longitude=None, distance=None):
    db.execute("""UPDATE attendance SET time_out_at=?, time_out_latitude=?, time_out_longitude=?, time_out_distance_m=?
                  WHERE id=?""", (stamp, latitude, longitude, distance, attendance_id))


def claim_evaluation(db, attendance_id: int, stamp: str) -> bool:
    """Marks the attendance evaluated, once (False when it already was). The
    evaluation is the Time Out, so it records that too."""
    return db.execute("""UPDATE attendance SET evaluated_at=?, time_out_at=COALESCE(time_out_at, ?)
                         WHERE id=? AND evaluated_at IS NULL""", (stamp, stamp, attendance_id)).rowcount > 0


def add_evaluation(db, event_id: int, *, name: str, role: str, scores: list, sex: Optional[str] = None,
                   age_group: Optional[str] = None, account_id: Optional[int] = None, email: Optional[str] = None,
                   feedback: Optional[str] = None, affiliation: Optional[str] = None, session: Optional[int] = None,
                   is_paper: bool = False, image_url: Optional[str] = None) -> int:
    """One event evaluation; [scores] = planning, objectives, personnel, time management, engagement, resources."""
    keys = ("planning_score", "objectives_score", "personnel_score", "time_mgmt_score", "engagement_score", "resource_score")
    return insert(db, "evaluation", {
        "event_id": event_id, "evaluator_id": account_id, "evaluator_name": name, "evaluator_role": role,
        "evaluator_email": _value(email), "evaluator_sex": _value(sex), "evaluator_age_group": _value(age_group),
        "evaluator_affiliation": _value(affiliation), "activity_index": session, "feedback_comments": _value(feedback),
        "is_paper": 1 if is_paper else 0, "image_url": _value(image_url),
        **dict(zip(keys, scores))})

"""PostgreSQL data layer.

Routes talk to the database through a small DB-API wrapper that keeps the
interface the code base was written against (sqlite3 style):

    db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()["username"]

so the SQL in routes/ stays readable. The wrapper:
  * turns `?` placeholders into psycopg2's `%s`;
  * returns rows that work both by column name and by position;
  * sets `cursor.lastrowid` for INSERTs (via RETURNING id);
  * returns timestamps/dates as 'YYYY-MM-DD HH:MM:SS' / 'YYYY-MM-DD' strings
    and NUMERIC as int/float, so values serialize as they always have;
  * runs each statement under a savepoint, so a failed statement (e.g. a
    duplicate the caller catches and skips) doesn't abort the whole request's
    transaction.

Configuration (env):
  DATABASE_URL   postgresql://tasknet:tasknet@localhost:5432/tasknet (default)
"""
import os
import re
from contextlib import contextmanager
from datetime import date, datetime
from decimal import Decimal
from functools import lru_cache

import psycopg2
from psycopg2 import IntegrityError, OperationalError, DatabaseError  # noqa: F401  (re-exported)

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://tasknet:tasknet@localhost:5432/tasknet"
).replace("postgresql+psycopg2://", "postgresql://")

# Every service runs init_db() at startup; this lock makes exactly one of them
# create/seed the schema at a time.
_INIT_LOCK_KEY = 7_274_101


# ── DB-API wrapper ────────────────────────────────────────────────────────────

_INSERT_RE = re.compile(r"^\s*INSERT\s", re.I)
_RETURNING_RE = re.compile(r"\bRETURNING\b", re.I)


@lru_cache(maxsize=4096)
def _prepare(sql: str):
    """(psycopg2 SQL, whether RETURNING id was added). `?` outside string
    literals and comments becomes %s; a literal % becomes %%."""
    out, i, n = [], 0, len(sql)
    while i < n:
        ch = sql[i]
        if ch == "'":
            j = i + 1
            while j < n:
                if sql[j] == "'":
                    if j + 1 < n and sql[j + 1] == "'":
                        j += 2
                        continue
                    break
                j += 1
            out.append(sql[i:j + 1].replace("%", "%%"))
            i = j + 1
            continue
        if ch == "-" and sql.startswith("--", i):
            j = sql.find("\n", i)
            j = n if j == -1 else j
            out.append(sql[i:j].replace("%", "%%").replace("?", ""))
            i = j
            continue
        out.append("%s" if ch == "?" else "%%" if ch == "%" else ch)
        i += 1
    text = "".join(out)
    returning = bool(_INSERT_RE.match(text)) and not _RETURNING_RE.search(text)
    if returning:
        text = text.rstrip().rstrip(";") + " RETURNING id"
    return text, returning


def _param(v):
    # sqlite3 stored bools as 0/1 and dates as ISO text; the schema keeps those
    # shapes (INTEGER flags, TEXT dates), so bind them the same way.
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, datetime):
        return v.isoformat(" ")
    if isinstance(v, date):
        return v.isoformat()
    return v


def _value(v):
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() and v.as_tuple().exponent >= 0 else float(v)
    return v


class Row:
    """A result row addressable by column name or position (like sqlite3.Row)."""
    __slots__ = ("_values", "_index")

    def __init__(self, values, index):
        self._values = values
        self._index = index

    def __getitem__(self, key):
        if isinstance(key, str):
            return self._values[self._index[key]]
        return self._values[key]

    def keys(self):
        return list(self._index)

    def __iter__(self):
        return iter(self._values)

    def __len__(self):
        return len(self._values)

    def __eq__(self, other):
        if isinstance(other, Row):
            return self._values == other._values and self._index == other._index
        return NotImplemented

    def __hash__(self):
        return hash(self._values)

    def __repr__(self):
        return f"Row({dict(zip(self._index, self._values))!r})"


class Cursor:
    def __init__(self, conn: "Connection"):
        self.connection = conn
        self._cur = conn._raw.cursor()
        self._index = None
        self._pending = None  # rows already fetched (RETURNING id of an INSERT)
        self.lastrowid = None
        self.rowcount = -1

    @property
    def description(self):
        return self._cur.description

    def execute(self, sql: str, params=()):
        text, returning = _prepare(sql)
        args = tuple(_param(p) for p in (params or ()))
        self.connection._execute(self._cur, text, args)
        self.rowcount = self._cur.rowcount
        self._index = ({d.name: i for i, d in enumerate(self._cur.description)}
                       if self._cur.description else None)
        self._pending = None
        if returning:
            ids = self._cur.fetchall()
            self.lastrowid = ids[-1][0] if ids else None
            self._pending = []
            self._index = None
        return self

    def executemany(self, sql: str, seq):
        total = 0
        for params in seq:
            self.execute(sql, params)
            total += max(self.rowcount, 0)
        self.rowcount = total
        return self

    def _row(self, raw):
        return Row(tuple(_value(v) for v in raw), self._index)

    def fetchone(self):
        if self._pending is not None or self._index is None:
            return None
        raw = self._cur.fetchone()
        return self._row(raw) if raw is not None else None

    def fetchall(self):
        if self._pending is not None or self._index is None:
            return []
        return [self._row(r) for r in self._cur.fetchall()]

    def fetchmany(self, size: int = 1):
        if self._pending is not None or self._index is None:
            return []
        return [self._row(r) for r in self._cur.fetchmany(size)]

    def __iter__(self):
        return iter(self.fetchall())

    def close(self):
        self._cur.close()


class Connection:
    def __init__(self):
        self._raw = psycopg2.connect(DATABASE_URL, options="-c timezone=UTC")
        self._savepoint = False

    def _execute(self, cur, text: str, args: tuple):
        # One round trip: (release the previous statement's savepoint and) set
        # a new one, then run the statement. On failure only this statement is
        # undone and the transaction stays usable, as with sqlite.
        prefix = ("RELEASE SAVEPOINT _stmt; SAVEPOINT _stmt; " if self._savepoint
                  else "SAVEPOINT _stmt; ")
        try:
            cur.execute(prefix + text, args)
            self._savepoint = True
        except psycopg2.Error:
            if self._savepoint or self._raw.status == psycopg2.extensions.STATUS_IN_TRANSACTION:
                try:
                    self._raw.cursor().execute("ROLLBACK TO SAVEPOINT _stmt")
                    self._savepoint = True
                except psycopg2.Error:
                    self._raw.rollback()
                    self._savepoint = False
            raise

    def cursor(self) -> Cursor:
        return Cursor(self)

    def execute(self, sql: str, params=()) -> Cursor:
        return Cursor(self).execute(sql, params)

    def executemany(self, sql: str, seq) -> Cursor:
        return Cursor(self).executemany(sql, seq)

    def commit(self):
        self._raw.commit()
        self._savepoint = False

    def rollback(self):
        self._raw.rollback()
        self._savepoint = False

    def close(self):
        if not self._raw.closed:
            self._raw.close()

    def __del__(self):
        # Endpoints that forget close() don't leak server connections.
        try:
            self.close()
        except Exception:
            pass


def _connect() -> Connection:
    return Connection()


def get_db():
    """FastAPI dependency. As a generator, FastAPI guarantees the connection is
    closed after the request completes (even on error) — preventing leaks."""
    conn = _connect()
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def db_session():
    """Context manager for manual (non-dependency) use:

        with db_session() as db:
            db.execute(...)

    Closes the connection on exit, including on exceptions."""
    conn = _connect()
    try:
        yield conn
    finally:
        conn.close()


def connect_db() -> Connection:
    """Plain connection for callers that manage their own close()/commit().
    Prefer `db_session()` (exception-safe) for new code."""
    return _connect()


# ── Schema ────────────────────────────────────────────────────────────────────

FULL_NAME_EXPR = "COALESCE(NULLIF(TRIM(COALESCE(first_name,'') || CASE WHEN COALESCE(middle_name,'')<>'' THEN ' '||middle_name ELSE '' END || CASE WHEN COALESCE(last_name,'')<>'' THEN ' '||last_name ELSE '' END || CASE WHEN COALESCE(suffix,'')<>'' THEN ' '||suffix ELSE '' END), ''), username)"

DEPED_CATEGORIES = ("Mandatory Examination", "Quarter Compliance", "Holiday",
                    "Administrative Period")

# Conventions: ids are identity columns; flags are INTEGER 0/1; calendar dates
# entered by users are TEXT (YYYY-MM-DD or free text such as "June 10, 2026");
# case-insensitive names use CITEXT; machine timestamps are TIMESTAMP (UTC).
_PK = "INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY"

SCHEMA = f"""
CREATE EXTENSION IF NOT EXISTS citext;

-- sqlite's ROUND(real, n) has no PostgreSQL double-precision overload.
CREATE OR REPLACE FUNCTION round(double precision, integer) RETURNS numeric
    LANGUAGE sql IMMUTABLE AS 'SELECT round($1::numeric, $2)';

CREATE TABLE IF NOT EXISTS roles (
    id    {_PK},
    roles TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS grade_levels (
    id          {_PK},
    grade_level TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS departments (
    id              {_PK},
    department_name TEXT NOT NULL UNIQUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id                  {_PK},
    username            TEXT UNIQUE NOT NULL,
    password_hash       TEXT NOT NULL,
    first_name          TEXT,
    middle_name         TEXT,
    last_name           TEXT,
    suffix              TEXT,
    role                TEXT NOT NULL REFERENCES roles(roles),  -- primary role
    grade_level_id      INTEGER REFERENCES grade_levels(id) ON DELETE SET NULL,
    avatar_url          TEXT,
    email               TEXT,
    phone_number        TEXT,
    number_of_children  INTEGER NOT NULL DEFAULT 0 CHECK(number_of_children >= 0),
    date_of_appointment DATE,
    birthdate           DATE,
    address             TEXT,
    is_active           INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    has_elderly_or_infant_care INTEGER NOT NULL DEFAULT 0
        CHECK(has_elderly_or_infant_care IN (0,1)),
    overtime_opt_in     INTEGER NOT NULL DEFAULT 0 CHECK(overtime_opt_in IN (0,1)),
    -- Derived from the name parts and never written directly (3NF).
    full_name           TEXT GENERATED ALWAYS AS ({FULL_NAME_EXPR}) STORED
);

CREATE TABLE IF NOT EXISTS subjects (
    id           {_PK},
    subject_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS user_subjects (
    id             {_PK},
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id     INTEGER NOT NULL REFERENCES subjects(id),
    grade_level_id INTEGER REFERENCES grade_levels(id),
    UNIQUE(user_id, subject_id, grade_level_id)
);

-- School calendar set by the principal (see school_calendar.py): records
-- dated outside the current school year are archived.
CREATE TABLE IF NOT EXISTS school_years (
    id         {_PK},
    name       CITEXT NOT NULL UNIQUE,
    start_date TEXT NOT NULL,
    end_date   TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS school_terms (
    id             {_PK},
    school_year_id INTEGER NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    start_date     TEXT NOT NULL,
    end_date       TEXT NOT NULL,
    UNIQUE(school_year_id, name)
);

-- DepEd-aligned personnel profile used to suggest assignees for a task
-- (see qualifications.py; reference data in deped_profile.py).
CREATE TABLE IF NOT EXISTS education_background (
    id                   {_PK},
    user_id              INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    highest_attainment   TEXT,
    undergraduate_degree TEXT,
    specialization       TEXT,
    postgraduate_focus   TEXT,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Skill / certification taxonomy; each category's task keywords (used for
-- automated matching) are rows in *_category_keywords, one per keyword.
CREATE TABLE IF NOT EXISTS skill_categories (
    id            {_PK},
    category_name CITEXT NOT NULL UNIQUE,
    description   TEXT
);

CREATE TABLE IF NOT EXISTS skill_category_keywords (
    id          {_PK},
    category_id INTEGER NOT NULL REFERENCES skill_categories(id) ON DELETE CASCADE,
    keyword     CITEXT NOT NULL,
    UNIQUE(category_id, keyword)
);

CREATE TABLE IF NOT EXISTS skills (
    id          {_PK},
    skill_name  CITEXT NOT NULL UNIQUE,
    category_id INTEGER REFERENCES skill_categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS skill_keywords (
    id       {_PK},
    skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    keyword  CITEXT NOT NULL,
    UNIQUE(skill_id, keyword)
);

CREATE TABLE IF NOT EXISTS certification_categories (
    id            {_PK},
    category_name CITEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS certification_category_keywords (
    id          {_PK},
    category_id INTEGER NOT NULL REFERENCES certification_categories(id) ON DELETE CASCADE,
    keyword     CITEXT NOT NULL,
    UNIQUE(category_id, keyword)
);

CREATE TABLE IF NOT EXISTS certification_issuers (
    id          {_PK},
    issuer_name CITEXT NOT NULL UNIQUE,
    acronym     TEXT
);

CREATE TABLE IF NOT EXISTS certifications (
    id          {_PK},
    cert_name   CITEXT NOT NULL UNIQUE,
    category_id INTEGER REFERENCES certification_categories(id) ON DELETE SET NULL,
    issuer_id   INTEGER REFERENCES certification_issuers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS certification_keywords (
    id               {_PK},
    certification_id INTEGER NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
    keyword          CITEXT NOT NULL,
    UNIQUE(certification_id, keyword)
);

-- Uploaded certificate files (certificate_reader.py). 'pending' until the
-- owner confirms what it is, then 'submitted' for review, then 'verified' or
-- 'rejected' by the principal/registrar.
CREATE TABLE IF NOT EXISTS certificate_files (
    id                {_PK},
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    certification_id  INTEGER REFERENCES certifications(id) ON DELETE SET NULL,
    file_path         TEXT NOT NULL,
    original_name     TEXT,
    mime              TEXT NOT NULL,
    sha256            TEXT NOT NULL,
    extracted_text    TEXT,
    detected_title    TEXT,
    match_confidence  DOUBLE PRECISION,
    certificate_no    TEXT,
    date_issued       TEXT,
    expiry_date       TEXT,
    status            TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','submitted','verified','rejected')),
    review_note       TEXT,
    reviewed_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at       TIMESTAMP,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- One row per automated pre-validation check run on an uploaded certificate.
CREATE TABLE IF NOT EXISTS certificate_checks (
    id                  {_PK},
    certificate_file_id INTEGER NOT NULL REFERENCES certificate_files(id) ON DELETE CASCADE,
    check_key           TEXT NOT NULL,
    status              TEXT NOT NULL CHECK(status IN ('pass','warn','fail','info')),
    label               TEXT NOT NULL,
    detail              TEXT,
    UNIQUE(certificate_file_id, check_key)
);

-- Audit trail of administrative changes, one row per action plus one
-- audit_log_changes row per changed field. Append-only (see triggers below).
CREATE TABLE IF NOT EXISTS audit_log (
    id           {_PK},
    created_at   TEXT NOT NULL
        DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    actor_id     INTEGER REFERENCES users(id),
    actor_role   TEXT,
    action       TEXT NOT NULL,
    entity_type  TEXT NOT NULL,
    entity_id    INTEGER,
    summary      TEXT NOT NULL,
    ip_address   TEXT
);
CREATE TABLE IF NOT EXISTS audit_log_changes (
    id          {_PK},
    audit_id    INTEGER NOT NULL REFERENCES audit_log(id),
    field_name  TEXT NOT NULL,
    old_value   TEXT,                -- JSON-encoded scalar
    new_value   TEXT,
    UNIQUE(audit_id, field_name)
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_log(actor_id);

CREATE OR REPLACE FUNCTION audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'audit_log is append-only'; END $$;
CREATE OR REPLACE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_append_only();
CREATE OR REPLACE TRIGGER audit_log_changes_append_only BEFORE UPDATE OR DELETE ON audit_log_changes
    FOR EACH ROW EXECUTE FUNCTION audit_append_only();

CREATE TABLE IF NOT EXISTS user_skills (
    id       {_PK},
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    UNIQUE(user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS coordinator_assignments (
    id              {_PK},
    coordinator_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    grade_level_id  INTEGER NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
    UNIQUE(coordinator_id, grade_level_id)
);

CREATE TABLE IF NOT EXISTS coordinator_type (
    id               {_PK},
    user_id          INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    coordinator_type TEXT NOT NULL
);

-- Additional roles a person holds; users.role stays the primary one.
CREATE TABLE IF NOT EXISTS user_roles (
    id      {_PK},
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    UNIQUE(user_id, role_id)
);

-- Every role a person holds: the primary one plus any additional ones.
CREATE OR REPLACE VIEW user_held_roles (user_id, role) AS
    SELECT id, role FROM users
    UNION
    SELECT ur.user_id, r.roles FROM user_roles ur JOIN roles r ON r.id = ur.role_id;

CREATE TABLE IF NOT EXISTS dean_assignment (
    id             {_PK},
    user_id        INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    grade_level_id INTEGER NOT NULL REFERENCES grade_levels(id)
);

CREATE TABLE IF NOT EXISTS task_types (
    id        {_PK},
    task_type TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS events (
    id                  {_PK},
    title               TEXT NOT NULL,
    nature              TEXT DEFAULT 'Co-curricular',
    target_date         TEXT,
    venue               TEXT,
    proposed_budget     TEXT,
    fund_source         TEXT,
    focal_name          TEXT,
    focal_role          TEXT,
    focal_contact       TEXT,
    expected_outputs    TEXT,
    participants        TEXT,
    rationale           TEXT,
    objectives          TEXT,
    phase1              TEXT,
    phase2              TEXT,
    phase3              TEXT,
    activity_matrix     TEXT,
    training_materials  TEXT,
    snacks              TEXT,
    exec_committee      TEXT,
    twg_groups          TEXT,
    monitoring_criteria TEXT,
    indicators          TEXT,
    comments            TEXT,
    status              TEXT NOT NULL DEFAULT 'pending_approval'
        CHECK(status IN ('pending_approval','approved','disabled','draft')),
    created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    department          TEXT,
    expected_attendees  INTEGER
);

-- DepEd school-calendar reference layer (seeded once on a fresh database;
-- later edits/deletions by the principal stick).
CREATE TABLE IF NOT EXISTS deped_calendar_events (
    id           {_PK},
    title        TEXT NOT NULL,
    description  TEXT,
    start_date   TEXT NOT NULL,
    end_date     TEXT NOT NULL,
    category     TEXT NOT NULL CHECK(category IN ({",".join(f"'{x}'" for x in DEPED_CATEGORIES)})),
    is_mandatory INTEGER NOT NULL DEFAULT 1 CHECK(is_mandatory IN (0,1)),
    created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK(end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS tasks (
    id              {_PK},
    title           TEXT NOT NULL,
    instructions    TEXT,
    subject         TEXT,
    task_type_id    INTEGER REFERENCES task_types(id) ON DELETE SET NULL,
    start_date      TEXT,
    end_date        TEXT,
    due_time        TEXT,
    status          TEXT DEFAULT 'active' CHECK(status IN ('active','disabled')),
    created_by      INTEGER REFERENCES users(id),
    points_early    INTEGER DEFAULT 100,
    points_ontime   INTEGER DEFAULT 100,
    points_late24   INTEGER DEFAULT 50,
    points_after24  INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- 'common' or 'special' (special tasks are appraised separately).
    task_category   TEXT DEFAULT 'common',
    -- Special task auto-created from attending an event activity.
    source_event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
    -- Compliance task generated from a DepEd calendar entry.
    source_deped_id INTEGER REFERENCES deped_calendar_events(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS task_assignments (
    id          {_PK},
    task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    -- Which role-identity the assignment targets; NULL = any.
    target_role TEXT,
    UNIQUE(task_id, user_id)
);

CREATE TABLE IF NOT EXISTS task_templates (
    id              {_PK},
    title           TEXT NOT NULL,
    instructions    TEXT,
    start_date      TEXT,
    end_date        TEXT,
    due_time        TEXT,
    points_early    INTEGER DEFAULT 100,
    points_ontime   INTEGER DEFAULT 100,
    points_late24   INTEGER DEFAULT 50,
    points_after24  INTEGER DEFAULT 0,
    created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_attachments (
    id              {_PK},
    task_id         INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    attachment_type TEXT CHECK(attachment_type IN ('file','link','gdrive','youtube')),
    name            TEXT,
    url             TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_log (
    id               {_PK},
    submission_date  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    personnel_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id          INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(task_id, personnel_id)
);

CREATE TABLE IF NOT EXISTS reports (
    id                  {_PK},
    task_id             INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    personnel_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_title        TEXT NOT NULL,
    report_description  TEXT,
    report_type         TEXT,
    report_file_path    TEXT,
    report_filename     TEXT,
    report_link_url     TEXT,
    report_date         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    report_status       TEXT DEFAULT 'Pending'
        CHECK(report_status IN ('Completed','Pending','Missing')),
    UNIQUE(task_id, personnel_id)
);

CREATE TABLE IF NOT EXISTS submission_log (
    id                    {_PK},
    status                TEXT DEFAULT 'Pending'
        CHECK(status IN ('Completed','Pending','Missing')),
    date_of_submission    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sender_personnel_id   INTEGER NOT NULL REFERENCES users(id),
    report_id             INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    receiver_personnel_id INTEGER REFERENCES users(id),
    UNIQUE(report_id)
);

CREATE TABLE IF NOT EXISTS comments (
    id            {_PK},
    task_id       INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    report_id     INTEGER REFERENCES reports(id) ON DELETE CASCADE,
    comment_type  TEXT DEFAULT 'public' CHECK(comment_type IN ('public','private')),
    content       TEXT NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_events (
    id          {_PK},
    title       TEXT NOT NULL,
    description TEXT,
    event_date  TEXT,
    status      TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
    created_by  INTEGER REFERENCES users(id),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Special tasks are ordinary `tasks` rows tagged task_category='special'.
-- This table only holds their supervisor evaluation, keyed by tasks.id.
CREATE TABLE IF NOT EXISTS special_task_evaluations (
    id                       {_PK},
    task_id                  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    evaluator_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
    completion_quality_score INTEGER NOT NULL DEFAULT 0 CHECK(completion_quality_score BETWEEN 0 AND 5),
    timeliness_score         INTEGER NOT NULL DEFAULT 0 CHECK(timeliness_score BETWEEN 0 AND 5),
    initiative_score         INTEGER NOT NULL DEFAULT 0 CHECK(initiative_score BETWEEN 0 AND 5),
    coordination_score       INTEGER NOT NULL DEFAULT 0 CHECK(coordination_score BETWEEN 0 AND 5),
    weighted_average         DOUBLE PRECISION,
    remarks                  TEXT,
    evaluated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id)
);

-- Per-user in-app notifications triggered by task assignments and event posts.
CREATE TABLE IF NOT EXISTS notifications (
    id         {_PK},
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       TEXT NOT NULL CHECK(type IN ('task','event','comment','general')),
    title      TEXT NOT NULL,
    body       TEXT,
    ref_id     INTEGER,
    is_read    INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0,1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_evaluations (
    id                    {_PK},
    event_id              INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    evaluator_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    evaluator_name        TEXT NOT NULL,
    evaluator_role        TEXT,
    planning_score        INTEGER NOT NULL DEFAULT 0 CHECK(planning_score BETWEEN 0 AND 5),
    objectives_score      INTEGER NOT NULL DEFAULT 0 CHECK(objectives_score BETWEEN 0 AND 5),
    personnel_score       INTEGER NOT NULL DEFAULT 0 CHECK(personnel_score BETWEEN 0 AND 5),
    time_mgmt_score       INTEGER NOT NULL DEFAULT 0 CHECK(time_mgmt_score BETWEEN 0 AND 5),
    engagement_score      INTEGER NOT NULL DEFAULT 0 CHECK(engagement_score BETWEEN 0 AND 5),
    resource_score        INTEGER NOT NULL DEFAULT 0 CHECK(resource_score BETWEEN 0 AND 5),
    feedback_comments     TEXT,
    date_submitted        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    evaluator_email       TEXT,
    evaluator_sex         TEXT,
    evaluator_age_group   TEXT,
    evaluator_affiliation TEXT,
    -- Attendee evaluations are per activity; NULL = whole-event.
    activity_index        INTEGER
);

-- Anti-abuse log for the unauthenticated QR public-evaluation endpoint:
-- one evaluation per (event, email).
CREATE TABLE IF NOT EXISTS public_submission_log (
    id           {_PK},
    event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    email        TEXT NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, email)
);

-- Attendance per Activity Matrix row (activity_index = position in
-- events.activity_matrix).
CREATE TABLE IF NOT EXISTS event_attendance (
    id                 {_PK},
    event_id           INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    activity_index     INTEGER NOT NULL,
    user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    time_in_at         TIMESTAMP,
    time_in_latitude   DOUBLE PRECISION,
    time_in_longitude  DOUBLE PRECISION,
    time_out_at        TIMESTAMP,
    time_out_latitude  DOUBLE PRECISION,
    time_out_longitude DOUBLE PRECISION,
    evaluated_at       TIMESTAMP,
    special_task_id    INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    UNIQUE(event_id, activity_index, user_id)
);
"""


def sync_sequences(db):
    """Move every identity sequence past the table's highest id (after rows
    were inserted with explicit ids: seed data, an import)."""
    for (table,) in db.execute(
            "SELECT table_name FROM information_schema.columns "
            "WHERE table_schema = current_schema() AND column_name = 'id' "
            "AND is_identity = 'YES'").fetchall():
        db.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                   f"COALESCE((SELECT MAX(id) FROM {table}), 0) + 1, false)")


def init_db():
    """Create the schema if missing and seed a fresh database. Idempotent and
    safe to run from every service at once (serialized by an advisory lock)."""
    db = _connect()
    try:
        db.execute("SELECT pg_advisory_lock(?)", (_INIT_LOCK_KEY,))
        db._raw.cursor().execute(SCHEMA)
        for role in ("admin", "principal", "coordinator", "dean", "teacher", "registrar"):
            db.execute("INSERT INTO roles (roles) VALUES (?) ON CONFLICT DO NOTHING", (role,))
        db.commit()

        from qualifications import seed_taxonomy
        seed_taxonomy(db)  # upsert: picks up taxonomy changes in deped_profile.py
        db.commit()

        if db.execute("SELECT 1 FROM users LIMIT 1").fetchone() is None:
            _seed(db)
        sync_sequences(db)
        db.commit()
    finally:
        try:
            db.rollback()
            db.execute("SELECT pg_advisory_unlock(?)", (_INIT_LOCK_KEY,))
            db.commit()
        finally:
            db.close()


def create_notification(db, user_id: int, notif_type: str, title: str, body: str = "", ref_id: int = None):
    """Insert one in-app notification for a user. Caller owns the commit."""
    db.execute(
        "INSERT INTO notifications (user_id, type, title, body, ref_id) VALUES (?,?,?,?,?)",
        (user_id, notif_type, title, body, ref_id),
    )


# ── Seed data (fresh database only) ───────────────────────────────────────────

_DEPED_NOTE = ("Baseline entry for S.Y. 2026-2027 — confirm the dates against the official "
               "DepEd Order / Memorandum on the school calendar and edit if they differ.")

# Baseline DepEd school-calendar entries (title, start, end, category, mandatory).
# Fixed national holidays are exact; school-activity dates are placeholders
# aligned to this school's S.Y. 2026-2027 terms for the principal to confirm.
_DEPED_SEED = [
    ("Brigada Eskwela", "2026-06-01", "2026-06-05", "Administrative Period", 1),
    ("Opening of Classes", "2026-06-08", "2026-06-08", "Administrative Period", 1),
    ("National Heroes Day", "2026-08-31", "2026-08-31", "Holiday", 1),
    ("First Quarter Examinations", "2026-09-10", "2026-09-11", "Mandatory Examination", 1),
    ("Submission of Quarter 1 Grades", "2026-09-21", "2026-09-25", "Quarter Compliance", 1),
    ("Division Schools Press Conference (DSPC)", "2026-10-19", "2026-10-23",
     "Administrative Period", 0),
    ("All Saints' Day", "2026-11-01", "2026-11-01", "Holiday", 1),
    ("Bonifacio Day", "2026-11-30", "2026-11-30", "Holiday", 1),
    ("Feast of the Immaculate Conception", "2026-12-08", "2026-12-08", "Holiday", 1),
    ("Second Quarter Examinations", "2026-12-16", "2026-12-17", "Mandatory Examination", 1),
    ("Christmas Break", "2026-12-19", "2027-01-03", "Holiday", 1),
    ("Submission of Quarter 2 Grades", "2027-01-04", "2027-01-08", "Quarter Compliance", 1),
    ("Mid-Year Performance Review and INSET", "2027-01-25", "2027-01-29",
     "Administrative Period", 1),
    ("Third Quarter Examinations", "2027-02-11", "2027-02-12", "Mandatory Examination", 1),
    ("Fourth Quarter Examinations", "2027-03-17", "2027-03-18", "Mandatory Examination", 1),
    ("End-of-School-Year Rites", "2027-03-22", "2027-03-24", "Administrative Period", 1),
    ("Maundy Thursday and Good Friday", "2027-03-25", "2027-03-26", "Holiday", 1),
]


def _seed(db):
    import bcrypt
    import json as _json
    from date_utils import to_iso_date
    from qualifications import set_skills, set_education
    c = db.cursor()

    for gl in ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6']:
        c.execute("INSERT INTO grade_levels (grade_level) VALUES (?) ON CONFLICT DO NOTHING", (gl,))
    for tt in ['Administrative', 'Curriculum', 'Documentation', 'Assessment', 'Research']:
        c.execute("INSERT INTO task_types (task_type) VALUES (?) ON CONFLICT DO NOTHING", (tt,))
    for dept in ['Academic Affairs', 'Student Affairs', 'Administration', 'Research & Development']:
        c.execute("INSERT INTO departments (department_name) VALUES (?) ON CONFLICT DO NOTHING",
                  (dept,))
    for subj in ['Araling Panlipunan', 'ESP', 'English', 'Filipino', 'ICT',
                 'MAPEH', 'Mathematics', 'Research', 'Science', 'TLE']:
        c.execute("INSERT INTO subjects (subject_name) VALUES (?) ON CONFLICT DO NOTHING", (subj,))
    c.executemany(
        "INSERT INTO deped_calendar_events (title, description, start_date, end_date, "
        "category, is_mandatory) VALUES (?,?,?,?,?,?)",
        [(t, _DEPED_NOTE, s, e, cat, m) for t, s, e, cat, m in _DEPED_SEED])

    gl = {r['grade_level']: r['id'] for r in
          c.execute("SELECT id, grade_level FROM grade_levels").fetchall()}

    users = [
        # username, password, first, middle, last, suffix, role, gl_id, email, phone, children, date_appt, birthdate, address
        ('admin',        'admin123', 'System',  None, 'Admin',      None, 'admin',       None,          None,                        None,               0, None,         None,         None),
        ('principal',    'prin123',  'Liza',    None, 'Ramos',      None, 'principal',   None,          'lizaramos@school.edu.ph',   '+63 912 000 0001', 2, None,         None,         'School Campus, Main St.'),
        ('coordinator1', 'coord123', 'Grace',   None, 'Tan',        None, 'coordinator', None,          'gracetan@school.edu.ph',    '+63 912 000 0002', 1, None,         None,         None),
        ('coordinator2', 'coord456', 'Mark',    None, 'Bautista',   None, 'coordinator', None,          'markb@school.edu.ph',       '+63 912 000 0003', 0, None,         None,         None),
        ('registrar',    'reg123',   'Ana',     None, 'Cruz',       None, 'registrar',   None,          'anacruz@school.edu.ph',     '+63 912 000 0004', 3, None,         None,         None),
        ('dean1',        'dean123',  'Maria',   None, 'Santos',     None, 'dean',        gl['Grade 1'], 'mariasantos@school.edu.ph', '+63 912 000 0005', 2, None,         None,         None),
        ('dean2',        'dean456',  'Jose',    None, 'Reyes',      None, 'dean',        gl['Grade 2'], 'josereyes@school.edu.ph',   '+63 912 000 0006', 0, None,         None,         None),
        ('teacher1',     'teach123', 'Sheila',  'P.', 'Chevallier', None, 'teacher',     gl['Grade 1'], 'sheila.c@school.edu.ph',    '+63 992 812 5954', 2, '07-22-2022', '1990-15-03', 'Bonifacio Avenue, Barangay II'),
        ('teacher2',     'teach456', 'Juan',    'D.', 'Santos',     None, 'teacher',     gl['Grade 1'], 'juan.s@school.edu.ph',      '+63 912 000 0008', 0, None,         None,         None),
        ('teacher3',     'teach789', 'Maria',   'C.', 'Reyes',      None, 'teacher',     gl['Grade 2'], 'maria.r@school.edu.ph',     '+63 912 000 0009', 4, None,         None,         None),
    ]
    for (username, password, first, middle, last, suffix, role, gl_id, email, phone,
         children, date_appt, birthdate, address) in users:
        pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        c.execute("""INSERT INTO users
                     (username, password_hash, first_name, middle_name,
                      last_name, suffix, role, grade_level_id, email, phone_number,
                      number_of_children, date_of_appointment, birthdate, address)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING""",
                  (username, pw, first, middle, last, suffix, role, gl_id, email, phone,
                   children, to_iso_date(date_appt), to_iso_date(birthdate), address))

    uid = {r['username']: r['id'] for r in
           c.execute("SELECT id, username FROM users").fetchall()}

    # Sample profiles so assignee suggestions have something to match on.
    # Certifications are only added by uploading a certificate.
    skills = {
        'teacher1':     ['Master of Ceremonies', 'Stage Decoration', 'Graphic Design & Layout'],
        'teacher2':     ['Sound System & A/V', 'SDRRM Coordination', 'Network Troubleshooting'],
        'teacher3':     ['Reading Remediation', 'Phil-IRI Reading Assessment', 'Exam Authoring'],
        'coordinator1': ['Learning Module Development', 'Action Research', 'DepEd e-RPMS Portal'],
        'coordinator2': ['DepEd LIS Management', 'e-BEIS Encoding', 'Live Stream Audio/Video'],
        'dean1':        ['Minutes & Memo Drafting', 'Committee Documentation'],
        'dean2':        ['DepEd Liquidation', 'Property Custodianship'],
    }
    # (highest attainment, undergraduate degree, specialization, postgraduate focus)
    education = {
        'teacher1':     ("Bachelor's Degree", 'BEEd – Generalist', 'MAPEH', None),
        'teacher2':     ("With Master's Units", 'BSEd', 'Science', None),
        'teacher3':     ("Master's Degree (CAR/Full)", 'BEEd – Generalist', 'English',
                         'Curriculum and Instruction'),
        'coordinator1': ("Master's Degree (CAR/Full)", 'BSEd', 'Mathematics',
                         'Curriculum and Instruction'),
        'coordinator2': ("With Master's Units", 'Bachelor\'s Degree + TCP/DPE (18 Professional Ed Units)',
                         'TLE/EPP', None),
        'dean1':        ('Doctoral Degree (EdD/PhD)', 'BEEd – Generalist', 'Filipino',
                         'Educational Management'),
        'dean2':        ('With Doctoral Units', 'BSEd', 'Araling Panlipunan',
                         'Educational Management'),
    }
    for uname, names in skills.items():
        set_skills(c, uid[uname], names)
    for uname, edu in education.items():
        set_education(c, uid[uname], dict(zip(
            ('highest_attainment', 'undergraduate_degree', 'specialization',
             'postgraduate_focus'), edu)))

    for cid, glid in [(uid['coordinator1'], gl['Grade 1']),
                      (uid['coordinator2'], gl['Grade 2'])]:
        c.execute("INSERT INTO coordinator_assignments (coordinator_id, grade_level_id) VALUES (?,?)",
                  (cid, glid))

    tt = {r['task_type']: r['id'] for r in
          c.execute("SELECT id, task_type FROM task_types").fetchall()}

    tasks = [
        (1, 'Market Research',            tt['Research'],        '2025-03-28', '2025-04-15', '02:30 PM',
         'Conduct a market survey using the provided questionnaire. Collect at least 20 respondents.', uid['principal']),
        (2, 'Student Assessment',         tt['Assessment'],      '2025-05-22', '2025-05-22', '11:59 PM',
         'Administer tests, quizzes, and other assessments and record results.', uid['principal']),
        (3, 'Grading and Record-Keeping', tt['Administrative'],  '2025-05-22', '2025-05-22', '11:59 PM',
         'Record grades, calculate averages, and maintain accurate student records.', uid['principal']),
        (4, 'Report Card Preparation',    tt['Administrative'],  '2025-05-22', '2025-05-22', '11:59 PM',
         "Complete and submit students' report cards.", uid['principal']),
        (5, 'Attendance Monitoring',      tt['Administrative'],  '2025-05-22', '2025-05-22', '11:59 PM',
         'Track and record daily student attendance.', uid['principal']),
        (6, 'Weekly Lesson Plan',         tt['Curriculum'],      '2025-01-14', '2025-01-14', '11:59 PM',
         'Submit weekly lesson plan for Q1 Week 1.', uid['principal']),
        (7, 'Class Activity Photos',      tt['Documentation'],   '2025-01-14', '2025-01-14', '11:59 PM',
         'Upload photos from the science experiment.', uid['principal']),
    ]
    c.executemany("""INSERT INTO tasks
                     (id, title, task_type_id, start_date, end_date, due_time, instructions, created_by)
                     VALUES (?,?,?,?,?,?,?,?)""", tasks)

    assignments = [
        (1, 'coordinator1', 'principal'), (2, 'coordinator1', 'principal'),
        (3, 'coordinator1', 'principal'), (4, 'coordinator1', 'principal'),
        (5, 'coordinator1', 'principal'), (6, 'coordinator2', 'principal'),
        (7, 'coordinator2', 'principal'),
        (1, 'dean1', 'coordinator1'), (2, 'dean1', 'coordinator1'), (3, 'dean1', 'coordinator1'),
        (4, 'dean1', 'coordinator1'), (5, 'dean1', 'coordinator1'),
        (6, 'dean2', 'coordinator2'), (7, 'dean2', 'coordinator2'),
        (1, 'teacher1', 'dean1'), (1, 'teacher2', 'dean1'), (2, 'teacher1', 'dean1'),
        (2, 'teacher2', 'dean1'), (3, 'teacher1', 'dean1'), (3, 'teacher2', 'dean1'),
        (4, 'teacher1', 'dean1'), (4, 'teacher2', 'dean1'), (5, 'teacher1', 'dean1'),
        (5, 'teacher2', 'dean1'), (6, 'teacher3', 'dean2'), (7, 'teacher3', 'dean2'),
        (1, 'registrar', 'principal'),
    ]
    c.executemany("INSERT INTO task_assignments (task_id, user_id, assigned_by) VALUES (?,?,?)",
                  [(t, uid[u], uid[by]) for t, u, by in assignments])

    c.execute("""INSERT INTO reports
                 (id, task_id, personnel_id, report_title, report_description,
                  report_type, report_link_url, report_date, report_status)
                 VALUES (1, 1, ?, 'Market Research Report',
                         'Conducted survey with 25 respondents from local market.',
                         'link', 'https://example.com/market-research',
                         '2025-03-27 14:30:00', 'Completed')""",
              (uid['teacher1'],))
    c.execute("""INSERT INTO task_log (id, submission_date, personnel_id, task_id)
                 VALUES (1, '2025-03-27 14:30:00', ?, 1)""", (uid['teacher1'],))
    c.execute("""INSERT INTO submission_log
                 (id, status, date_of_submission, sender_personnel_id, report_id, receiver_personnel_id)
                 VALUES (1, 'Completed', '2025-03-27 14:30:00', ?, 1, ?)""",
              (uid['teacher1'], uid['dean1']))

    for user_id, subject, gl_id in [
        (uid['teacher1'], 'Mathematics', gl['Grade 1']),
        (uid['teacher1'], 'Science',     gl['Grade 1']),
        (uid['teacher2'], 'English',     gl['Grade 1']),
        (uid['teacher2'], 'Filipino',    gl['Grade 1']),
        (uid['teacher3'], 'Mathematics', gl['Grade 2']),
        (uid['teacher3'], 'Science',     gl['Grade 2']),
    ]:
        c.execute("""INSERT INTO user_subjects (user_id, subject_id, grade_level_id)
                     SELECT ?, id, ? FROM subjects WHERE subject_name=?""",
                  (user_id, gl_id, subject))

    c.executemany("""INSERT INTO activity_events (id, title, description, event_date, status, created_by)
                     VALUES (?,?,?,?,?,?)""", [
        (1, 'Intramurals',           'Annual intramural sports',     '2024-03-25', 'pending', uid['admin']),
        (2, 'Science and Math Fair', 'Annual science and math fair', '2024-03-25', 'pending', uid['admin']),
    ])

    seed_events = [
        (1, 'Foundation Day Celebration', 'Co-curricular',
         'June 10, 2026', 'NCS II Pavilion', '15,000.00', 'SPTA Fund',
         'Principal Liza Ramos', 'Principal', '+63 912 000 0001',
         _json.dumps(['Program booklets', 'Photo documentation']),
         _json.dumps({'teachers': {'male': 5, 'female': 20}, 'students': {'male': 100, 'female': 100}}),
         'Annual celebration of the school\'s founding anniversary.',
         _json.dumps(['Celebrate the school founding', 'Build school community spirit']),
         'Planning\nVenue preparation', 'Program proper\nEntertainment', 'Clean-up\nEvaluation',
         _json.dumps([{'day': 'June 10', 'time': '8:00 AM', 'event': 'Opening Ceremony', 'speaker': 'Principal'}]),
         _json.dumps([]), _json.dumps([]),
         _json.dumps([{'name': 'Principal Liza Ramos', 'position': 'Chairperson'}]),
         _json.dumps([]),
         'Evaluate participation and overall conduct of the event.',
         _json.dumps([]), '', 'approved', uid['principal']),
        (2, 'Science and Technology Fair', 'Curricular',
         'July 15, 2026', 'NCS II Covered Court', '8,000.00', 'School Paper Fund',
         'Coordinator Grace Tan', 'Coordinator', '+63 912 000 0002',
         _json.dumps(['Project exhibits', 'Research papers']),
         _json.dumps({'teachers': {'male': 3, 'female': 10}, 'students': {'male': 60, 'female': 60}}),
         'Annual science and technology fair showcasing student research projects.',
         _json.dumps(['Promote scientific inquiry', 'Recognize student innovations']),
         'Project submission\nJudging criteria', 'Exhibit proper\nPresentation', 'Awarding\nEvaluation',
         _json.dumps([]), _json.dumps([]), _json.dumps([]), _json.dumps([]), _json.dumps([]),
         '', _json.dumps([]), '', 'pending_approval', uid['coordinator1']),
    ]
    c.executemany("""INSERT INTO events
                     (id, title, nature, target_date, venue, proposed_budget, fund_source,
                      focal_name, focal_role, focal_contact, expected_outputs, participants,
                      rationale, objectives, phase1, phase2, phase3, activity_matrix,
                      training_materials, snacks, exec_committee, twg_groups,
                      monitoring_criteria, indicators, comments, status, created_by)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                  seed_events)

    # Special tasks are ordinary `tasks` rows tagged task_category='special';
    # fixed high ids avoid colliding with the common-task seed above.
    special_tasks = [
        (101, 'Prepare Q3 Report',        'Submit quarterly performance report', 'teacher1', 'coordinator1', '2026-05-30'),
        (102, 'Grade Level Coordination', 'Coordinate with grade level teachers', 'dean1',    'coordinator1', '2026-06-15'),
        (103, 'Curriculum Review',        'Review and update lesson plans',       'teacher2', 'dean1',        '2026-06-01'),
    ]
    for sid, title, desc, assignee, assigner, due in special_tasks:
        c.execute("""INSERT INTO tasks (id, title, instructions, task_category, end_date, created_by)
                     VALUES (?,?,?, 'special', ?, ?)""", (sid, title, desc, due, uid[assigner]))
        c.execute("INSERT INTO task_assignments (task_id, user_id, assigned_by) VALUES (?,?,?)",
                  (sid, uid[assignee], uid[assigner]))

    c.execute("""INSERT INTO special_task_evaluations
                 (task_id, evaluator_id, completion_quality_score, timeliness_score,
                  initiative_score, coordination_score, weighted_average, remarks)
                 VALUES (103, ?, 4, 5, 3, 4, 4.05, 'Good effort on curriculum alignment.')""",
              (uid['coordinator1'],))
    c.execute("""INSERT INTO event_evaluations
                 (event_id, evaluator_id, evaluator_name, evaluator_role,
                  planning_score, objectives_score, personnel_score,
                  time_mgmt_score, engagement_score, resource_score, feedback_comments)
                 VALUES (1, ?, 'Coordinator Grace Tan', 'Coordinator', 5, 4, 5, 4, 5, 4,
                         'Ceremony was well organized and on time.')""",
              (uid['coordinator1'],))
    db.commit()

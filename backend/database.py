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

# The schema lives in schema.py: stored tables in third normal form with no
# NULLs, plus read views with the familiar names (users, tasks, events, ...).
from schema import BASE_SCHEMA, DEPED_CATEGORIES, READ_VIEWS, UPGRADES  # noqa: E402

SCHEMA = UPGRADES + BASE_SCHEMA + READ_VIEWS


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
    from store import notify
    notify(db, user_id, notif_type, title, body, ref_id)


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
    from date_utils import to_iso_date
    from qualifications import set_skills, set_education
    c = db.cursor()

    for gl in ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6']:
        c.execute("INSERT INTO grade_levels (grade_level) VALUES (?) ON CONFLICT DO NOTHING", (gl,))
    for tt in ['Administrative', 'Curriculum', 'Documentation', 'Assessment', 'Research']:
        c.execute("INSERT INTO task_types (task_type) VALUES (?) ON CONFLICT DO NOTHING", (tt,))
    for subj in ['Araling Panlipunan', 'ESP', 'English', 'Filipino', 'ICT',
                 'MAPEH', 'Mathematics', 'Research', 'Science', 'TLE']:
        c.execute("INSERT INTO subjects (subject_name) VALUES (?) ON CONFLICT DO NOTHING", (subj,))
    from store import create_user
    for t, s_, e, cat, m in _DEPED_SEED:
        c.execute("INSERT INTO deped_entry (title, description, start_date, end_date, category, is_mandatory) VALUES (?,?,?,?,?,?)",
                  (t, _DEPED_NOTE, s_, e, cat, m))

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
        create_user(c, {"username": username, "password_hash": pw, "role": role,
                        "first_name": first, "middle_name": middle, "last_name": last, "suffix": suffix,
                        "grade_level_id": gl_id, "email": email, "phone_number": phone,
                        "date_of_appointment": to_iso_date(date_appt), "birthdate": to_iso_date(birthdate),
                        "address": address})

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

    # Sample tasks, events and submissions: tools/seed_demo.py.
    db.commit()

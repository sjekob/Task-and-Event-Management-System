import sqlite3
import os
from contextlib import contextmanager

DB_PATH = "tasknet.db"
SCHEMA_VERSION = 10  # bump when schema changes (10: 0/1 CHECK on is_active/is_read)


def _connect() -> sqlite3.Connection:
    # FastAPI may open a request's connection (get_db) on one worker thread and
    # run the sync endpoint on another. Each connection still serves a single
    # request at a time, so cross-thread use is safe and must be allowed.
    conn = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


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


def connect_db() -> sqlite3.Connection:
    """Plain connection for callers that manage their own close()/commit().
    Prefer `db_session()` (exception-safe) for new code."""
    return _connect()


def _stored_version():
    try:
        with open(".schema_version") as f:
            return int(f.read().strip())
    except Exception:
        return 0


def _save_version(v: int):
    with open(".schema_version", "w") as f:
        f.write(str(v))


def _build_and_seed():
    """Create the schema (CREATE TABLE IF NOT EXISTS) and seed defaults
    (INSERT OR IGNORE). Idempotent and non-destructive — never deletes data."""
    conn = connect_db()
    c = conn.cursor()
    backfill_education = c.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").fetchone() is not None \
        and c.execute("SELECT 1 FROM sqlite_master WHERE type='table' "
                      "AND name='education_background'").fetchone() is None
    c.executescript("""
    CREATE TABLE IF NOT EXISTS grade_levels (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        grade_level TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS departments (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        department_name TEXT NOT NULL UNIQUE,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        username            TEXT UNIQUE NOT NULL,
        password_hash       TEXT NOT NULL,
        full_name           TEXT NOT NULL,
        first_name          TEXT,
        middle_name         TEXT,
        last_name           TEXT,
        suffix              TEXT,
        role                TEXT NOT NULL
            CHECK(role IN ('admin','principal','coordinator','dean','teacher','registrar')),
        grade_level_id      INTEGER REFERENCES grade_levels(id) ON DELETE SET NULL,
        avatar_url          TEXT,
        email               TEXT,
        phone_number        TEXT,
        number_of_children  INTEGER NOT NULL DEFAULT 0 CHECK(number_of_children >= 0),
        date_of_appointment TEXT,
        birthdate           TEXT,
        address             TEXT,
        is_active           INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
        created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_subjects (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject        TEXT NOT NULL,
        grade_level_id INTEGER REFERENCES grade_levels(id),
        UNIQUE(user_id, subject, grade_level_id)
    );

    -- School calendar set by the principal (see school_calendar.py): records
    -- dated outside the current school year are archived.
    CREATE TABLE IF NOT EXISTS school_years (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
        start_date TEXT NOT NULL,
        end_date   TEXT NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS school_terms (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        school_year_id INTEGER NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
        name           TEXT NOT NULL,
        start_date     TEXT NOT NULL,
        end_date       TEXT NOT NULL,
        UNIQUE(school_year_id, name)
    );

    -- DepEd-aligned personnel profile used to suggest assignees for a task
    -- (see qualifications.py; reference data in deped_profile.py).
    -- ERD: EDUCATION_BACKGROUND (one per personnel).
    CREATE TABLE IF NOT EXISTS education_background (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id              INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        highest_attainment   TEXT,
        undergraduate_degree TEXT,
        specialization       TEXT,
        postgraduate_focus   TEXT,
        updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- ERD: SKILL_CATEGORY → SKILL, CERTIFICATION_CATEGORY / CERTIFICATION_ISSUER
    -- → CERTIFICATION, plus personnel junctions (PERSONNEL_SKILL,
    -- PERSONNEL_CERTIFICATION). task_keywords: comma-separated task phrases a
    -- category maps to for automated matching.
    CREATE TABLE IF NOT EXISTS skill_categories (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        category_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        description   TEXT,
        task_keywords TEXT
    );

    CREATE TABLE IF NOT EXISTS skills (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        skill_name  TEXT NOT NULL UNIQUE COLLATE NOCASE,
        category_id INTEGER REFERENCES skill_categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS certification_categories (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        category_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        task_keywords TEXT
    );

    CREATE TABLE IF NOT EXISTS certification_issuers (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        issuer_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        acronym     TEXT
    );

    CREATE TABLE IF NOT EXISTS certifications (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        cert_name   TEXT NOT NULL UNIQUE COLLATE NOCASE,
        category_id INTEGER REFERENCES certification_categories(id) ON DELETE SET NULL,
        issuer_id   INTEGER REFERENCES certification_issuers(id) ON DELETE SET NULL
    );

    -- Uploaded certificate files (certificate_reader.py). A file is 'pending'
    -- until its owner confirms what it is, then 'submitted' for review, then
    -- 'verified' or 'rejected' by the principal/registrar. Files live outside
    -- the public uploads folder and are served only to authorized users.
    CREATE TABLE IF NOT EXISTS certificate_files (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        certification_id  INTEGER REFERENCES certifications(id) ON DELETE SET NULL,
        file_path         TEXT NOT NULL,
        original_name     TEXT,
        mime              TEXT NOT NULL,
        sha256            TEXT NOT NULL,
        extracted_text    TEXT,
        detected_title    TEXT,
        match_confidence  REAL,
        checks            TEXT,          -- JSON list of automated checks
        authenticity      TEXT,          -- high | medium | low (automated)
        status            TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending','submitted','verified','rejected')),
        review_note       TEXT,
        reviewed_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at       TIMESTAMP,
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Audit trail of administrative changes (roles, delegations, account
    -- status, certificate reviews, approvals ...). Append-only: the triggers
    -- below reject any UPDATE or DELETE, so history can't be rewritten.
    -- Names are copied in so entries stay readable if an account is removed.
    CREATE TABLE IF NOT EXISTS audit_log (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),  -- UTC
        actor_id     INTEGER,
        actor_name   TEXT,
        actor_role   TEXT,
        action       TEXT NOT NULL,      -- e.g. personnel.update, account.deactivate
        entity_type  TEXT NOT NULL,      -- user | certificate | school_year | event | task
        entity_id    INTEGER,
        entity_label TEXT,
        summary      TEXT NOT NULL,
        changes      TEXT,               -- JSON {field: [before, after]}
        ip_address   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_log(actor_id);
    CREATE TRIGGER IF NOT EXISTS audit_log_no_update BEFORE UPDATE ON audit_log
    BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS audit_log_no_delete BEFORE DELETE ON audit_log
    BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;

    CREATE TABLE IF NOT EXISTS user_skills (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
        UNIQUE(user_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS user_certifications (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        certification_id INTEGER NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
        UNIQUE(user_id, certification_id)
    );

    CREATE TABLE IF NOT EXISTS coordinator_assignments (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        coordinator_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        grade_level_id  INTEGER NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
        UNIQUE(coordinator_id, grade_level_id)
    );

    CREATE TABLE IF NOT EXISTS coordinator_type (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id          INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        coordinator_type TEXT NOT NULL
    );

    -- Role catalog + the personnel↔roles junction (ERD: ROLES + PERSONNEL_ROLE).
    -- A person may hold several roles; `users.role` stays the primary one, and
    -- the login "log in as" picker chooses which active role the token carries.
    CREATE TABLE IF NOT EXISTS roles (
        id    INTEGER PRIMARY KEY AUTOINCREMENT,
        roles TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS user_roles (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        UNIQUE(user_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS dean_assignment (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        grade_level_id INTEGER NOT NULL REFERENCES grade_levels(id)
    );

    CREATE TABLE IF NOT EXISTS task_types (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        task_type TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
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
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_assignments (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(task_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS task_templates (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
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
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id         INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        attachment_type TEXT CHECK(attachment_type IN ('file','link','gdrive','youtube')),
        name            TEXT,
        url             TEXT,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_log (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_date  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        personnel_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task_id          INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        UNIQUE(task_id, personnel_id)
    );

    CREATE TABLE IF NOT EXISTS reports (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
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
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        status                TEXT DEFAULT 'Pending'
            CHECK(status IN ('Completed','Pending','Missing')),
        date_of_submission    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sender_personnel_id   INTEGER NOT NULL REFERENCES users(id),
        report_id             INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        receiver_personnel_id INTEGER REFERENCES users(id),
        UNIQUE(report_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id       INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
        report_id     INTEGER REFERENCES reports(id) ON DELETE CASCADE,
        comment_type  TEXT DEFAULT 'public' CHECK(comment_type IN ('public','private')),
        content       TEXT NOT NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT NOT NULL,
        description TEXT,
        event_date  TEXT,
        status      TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
        created_by  INTEGER REFERENCES users(id),
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- ── Event Management ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS events (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
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
        created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- ── Personnel Management ──────────────────────────────────────────────────
    -- Reference table for subjects (Academic Delegation)
    CREATE TABLE IF NOT EXISTS subjects (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_name TEXT NOT NULL UNIQUE
    );

    -- ── Appraisal Management ──────────────────────────────────────────────────
    -- Special tasks are ordinary `tasks` rows tagged task_category='special'.
    -- This table only holds their supervisor evaluation, keyed by tasks.id.
    CREATE TABLE IF NOT EXISTS special_task_evaluations (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id                 INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        evaluator_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
        completion_quality_score INTEGER NOT NULL DEFAULT 0 CHECK(completion_quality_score BETWEEN 0 AND 5),
        timeliness_score        INTEGER NOT NULL DEFAULT 0 CHECK(timeliness_score BETWEEN 0 AND 5),
        initiative_score        INTEGER NOT NULL DEFAULT 0 CHECK(initiative_score BETWEEN 0 AND 5),
        coordination_score      INTEGER NOT NULL DEFAULT 0 CHECK(coordination_score BETWEEN 0 AND 5),
        weighted_average        REAL,
        remarks                 TEXT,
        evaluated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(task_id)
    );

    -- ── Notifications ─────────────────────────────────────────────────────────
    -- Per-user in-app notifications triggered by task assignments and event posts.
    CREATE TABLE IF NOT EXISTS notifications (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type       TEXT NOT NULL CHECK(type IN ('task','event','comment','general')),
        title      TEXT NOT NULL,
        body       TEXT,
        ref_id     INTEGER,
        is_read    INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0,1)),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_evaluations (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id         INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        evaluator_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        evaluator_name   TEXT NOT NULL,
        evaluator_role   TEXT,
        planning_score   INTEGER NOT NULL DEFAULT 0 CHECK(planning_score BETWEEN 0 AND 5),
        objectives_score INTEGER NOT NULL DEFAULT 0 CHECK(objectives_score BETWEEN 0 AND 5),
        personnel_score  INTEGER NOT NULL DEFAULT 0 CHECK(personnel_score BETWEEN 0 AND 5),
        time_mgmt_score  INTEGER NOT NULL DEFAULT 0 CHECK(time_mgmt_score BETWEEN 0 AND 5),
        engagement_score INTEGER NOT NULL DEFAULT 0 CHECK(engagement_score BETWEEN 0 AND 5),
        resource_score   INTEGER NOT NULL DEFAULT 0 CHECK(resource_score BETWEEN 0 AND 5),
        feedback_comments TEXT,
        date_submitted   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        evaluator_email       TEXT,
        evaluator_sex         TEXT,
        evaluator_age_group   TEXT,
        evaluator_affiliation TEXT
    );

    -- Anti-abuse log for the unauthenticated QR public-evaluation endpoint:
    -- one row per (event, submitter) so we can cap submissions per device.
    CREATE TABLE IF NOT EXISTS public_submission_log (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        email        TEXT NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, email)
    );
    """)

    conn.commit()

    # Non-destructive migrations: add columns introduced after a table was first
    # created, so existing databases gain them via ALTER (no wipe needed).
    _ensure_column(c, "events", "department", "TEXT")
    _ensure_column(c, "events", "expected_attendees", "INTEGER")
    # Dean assignments no longer carry a department — drop it if an old DB has it.
    if "department_id" in [r[1] for r in c.execute("PRAGMA table_info(dean_assignment)").fetchall()]:
        try:
            c.execute("ALTER TABLE dean_assignment DROP COLUMN department_id")
        except Exception:
            pass

    # Public evaluation throttle moved from per-device (ip_hash) to per-email so
    # an attendee can only evaluate an event once. Rebuild old ip-based logs.
    _psl_cols = [r[1] for r in c.execute("PRAGMA table_info(public_submission_log)").fetchall()]
    if "ip_hash" in _psl_cols and "email" not in _psl_cols:
        c.executescript("""
            DROP TABLE public_submission_log;
            CREATE TABLE public_submission_log (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                email        TEXT NOT NULL,
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(event_id, email)
            );
        """)
        conn.commit()
    # Government ID numbers (TIN/GSIS/Pag-IBIG/PhilHealth) were replaced by
    # qualifications used for assignment suggestions: skills, certifications
    # (their own tables) and number of children.
    # Early builds stored skill/certification names directly on the junction
    # rows; move them into the SKILL / CERTIFICATION catalogs (ERD shape).
    for _jt, _old_col, _cat, _name_col, _fk in (
            ("user_skills", "skill", "skills", "skill_name", "skill_id"),
            ("user_certifications", "certification", "certifications", "cert_name",
             "certification_id")):
        if _old_col not in [r[1] for r in c.execute(f"PRAGMA table_info({_jt})").fetchall()]:
            continue
        try:
            # One transaction; if another service already migrated it, the
            # SELECT of the old column fails and we just roll back.
            c.executescript(f"""
                BEGIN IMMEDIATE;
                INSERT OR IGNORE INTO {_cat} ({_name_col}) SELECT DISTINCT {_old_col} FROM {_jt};
                ALTER TABLE {_jt} RENAME TO _{_jt}_old;
                CREATE TABLE {_jt} (
                    id      INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    {_fk}   INTEGER NOT NULL REFERENCES {_cat}(id) ON DELETE CASCADE,
                    UNIQUE(user_id, {_fk})
                );
                INSERT OR IGNORE INTO {_jt} (user_id, {_fk})
                    SELECT o.user_id, k.id FROM _{_jt}_old o
                    JOIN {_cat} k ON k.{_name_col} = o.{_old_col} ORDER BY o.id;
                DROP TABLE _{_jt}_old;
                COMMIT;
            """)
        except sqlite3.OperationalError:
            conn.rollback()

    # Free-text skills.category / certifications.issuing_body from earlier builds
    # → SKILL_CATEGORY / CERTIFICATION_ISSUER tables.
    _ensure_column(c, "skills", "category_id",
                   "INTEGER REFERENCES skill_categories(id) ON DELETE SET NULL")
    _ensure_column(c, "certifications", "category_id",
                   "INTEGER REFERENCES certification_categories(id) ON DELETE SET NULL")
    _ensure_column(c, "certifications", "issuer_id",
                   "INTEGER REFERENCES certification_issuers(id) ON DELETE SET NULL")
    conn.commit()
    from qualifications import migrate_legacy_catalog
    try:
        migrate_legacy_catalog(c)
        conn.commit()
    except sqlite3.OperationalError:
        conn.rollback()  # another service migrated it concurrently

    _user_cols = [r[1] for r in c.execute("PRAGMA table_info(users)").fetchall()]
    backfill_qualifications ="number_of_children" not in _user_cols
    _ensure_column(c, "users", "number_of_children",
                   "INTEGER NOT NULL DEFAULT 0 CHECK(number_of_children >= 0)")
    for _old in ("tin", "qsis", "hdmf", "phic"):
        if _old in _user_cols:
            try:
                c.execute(f"ALTER TABLE users DROP COLUMN {_old}")
            except Exception:
                pass
    conn.commit()
    # Record the evaluator's email on the evaluation itself.
    _ensure_column(c, "event_evaluations", "evaluator_email", "TEXT")
    # Evaluator demographics collected on the public evaluation form.
    _ensure_column(c, "event_evaluations", "evaluator_sex", "TEXT")
    _ensure_column(c, "event_evaluations", "evaluator_age_group", "TEXT")
    _ensure_column(c, "event_evaluations", "evaluator_affiliation", "TEXT")
    conn.commit()
    # Tag a task as 'common' or 'special' — used by the appraisal module to tell
    # the two kinds apart.
    _ensure_column(c, "tasks", "task_category", "TEXT DEFAULT 'common'")
    # Which role-identity an assignment targets (a person may hold several roles).
    # NULL = legacy/any, shown regardless of the assignee's active role.
    _ensure_column(c, "task_assignments", "target_role", "TEXT")
    conn.commit()

    # Seed the role catalog (ERD: ROLES).
    for _rn in ("admin", "principal", "coordinator", "dean", "teacher", "registrar"):
        c.execute("INSERT OR IGNORE INTO roles (roles) VALUES (?)", (_rn,))
    conn.commit()

    # Migrate an older user_roles(role TEXT) shape to user_roles(role_id FK→roles).
    _ur_cols = [r[1] for r in c.execute("PRAGMA table_info(user_roles)").fetchall()]
    if "role" in _ur_cols and "role_id" not in _ur_cols:
        c.executescript("""
            ALTER TABLE user_roles RENAME TO _ur_old;
            CREATE TABLE user_roles (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                UNIQUE(user_id, role_id)
            );
            INSERT OR IGNORE INTO user_roles (user_id, role_id)
                SELECT o.user_id, r.id FROM _ur_old o JOIN roles r ON r.roles = o.role;
            DROP TABLE _ur_old;
        """)
        conn.commit()

    # Baseline each user's primary role into the junction (idempotent). Extra
    # roles are added via the personnel "also teaching" toggle.
    c.execute("""INSERT OR IGNORE INTO user_roles (user_id, role_id)
                 SELECT u.id, r.id FROM users u JOIN roles r ON r.roles = u.role
                 WHERE u.role IS NOT NULL AND u.role != ''""")
    conn.commit()

    # Special tasks were once their own `special_tasks` table; they are now just
    # `tasks` rows tagged 'special'. Repoint special_task_evaluations from the old
    # table to tasks(id), then drop the legacy table. (Old eval rows keyed to the
    # dropped special_tasks ids are discarded — they no longer have a referent.)
    try:
        row = c.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='special_task_evaluations'"
        ).fetchone()
        if row and row[0] and "special_tasks" in row[0]:
            c.executescript("""
                ALTER TABLE special_task_evaluations RENAME TO _ste_old;
                CREATE TABLE special_task_evaluations (
                    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id                 INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                    evaluator_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    completion_quality_score INTEGER NOT NULL DEFAULT 0 CHECK(completion_quality_score BETWEEN 0 AND 5),
                    timeliness_score        INTEGER NOT NULL DEFAULT 0 CHECK(timeliness_score BETWEEN 0 AND 5),
                    initiative_score        INTEGER NOT NULL DEFAULT 0 CHECK(initiative_score BETWEEN 0 AND 5),
                    coordination_score      INTEGER NOT NULL DEFAULT 0 CHECK(coordination_score BETWEEN 0 AND 5),
                    weighted_average        REAL,
                    remarks                 TEXT,
                    evaluated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(task_id)
                );
                INSERT INTO special_task_evaluations
                    SELECT * FROM _ste_old
                    WHERE task_id IN (SELECT id FROM tasks WHERE task_category='special');
                DROP TABLE _ste_old;
            """)
            conn.commit()
        c.execute("DROP TABLE IF EXISTS special_tasks")
        conn.commit()
    except Exception:
        pass  # Already migrated; ignore

    # event_evaluations may have been created (on existing DBs) back when its FK
    # pointed at school_events; rebuild it pointed at events before dropping that table.
    try:
        row = c.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='event_evaluations'"
        ).fetchone()
        if row and row[0] and "school_events" in row[0]:
            c.executescript("""
                ALTER TABLE event_evaluations RENAME TO event_evaluations_old;
                CREATE TABLE event_evaluations (
                    id               INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id         INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                    evaluator_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    evaluator_name   TEXT NOT NULL,
                    evaluator_role   TEXT,
                    planning_score   INTEGER NOT NULL DEFAULT 0 CHECK(planning_score BETWEEN 0 AND 5),
                    objectives_score INTEGER NOT NULL DEFAULT 0 CHECK(objectives_score BETWEEN 0 AND 5),
                    personnel_score  INTEGER NOT NULL DEFAULT 0 CHECK(personnel_score BETWEEN 0 AND 5),
                    time_mgmt_score  INTEGER NOT NULL DEFAULT 0 CHECK(time_mgmt_score BETWEEN 0 AND 5),
                    engagement_score INTEGER NOT NULL DEFAULT 0 CHECK(engagement_score BETWEEN 0 AND 5),
                    resource_score   INTEGER NOT NULL DEFAULT 0 CHECK(resource_score BETWEEN 0 AND 5),
                    feedback_comments TEXT,
                    date_submitted   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                INSERT INTO event_evaluations
                    SELECT * FROM event_evaluations_old WHERE event_id IN (SELECT id FROM events);
                DROP TABLE event_evaluations_old;
            """)
            conn.commit()
    except Exception:
        pass  # Already migrated; ignore

    # Drop redundant school_events table; event_evaluations now references events directly
    try:
        c.execute("DROP TABLE IF EXISTS school_events")
        conn.commit()
    except Exception:
        pass  # Already dropped or constrained; ignore

    _seed(conn, backfill_qualifications, backfill_education)
    conn.close()


def _ensure_column(cur, table: str, column: str, decl: str):
    cols = [r[1] for r in cur.execute(f"PRAGMA table_info({table})").fetchall()]
    if column not in cols:
        try:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")
        except sqlite3.OperationalError:
            pass  # another service added it concurrently — fine


def init_db():
    """Ensure the DB exists at the current schema version.

    Concurrency-safe: a schema bump requires recreating the DB, but the six
    services share one sqlite file. An exclusive lock guarantees exactly ONE
    process performs the destructive recreate+seed while the others wait — so
    no process can delete the file out from under another and corrupt it.
    """
    import time

    # Already current → just ensure schema/seed exist (idempotent, no delete).
    if _stored_version() >= SCHEMA_VERSION:
        _build_and_seed()
        return

    lock_path = DB_PATH + ".init.lock"
    try:
        fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.close(fd)
    except FileExistsError:
        # Another process owns the recreate — wait for it to publish the version.
        for _ in range(120):
            if _stored_version() >= SCHEMA_VERSION and not os.path.exists(lock_path):
                break
            time.sleep(0.5)
        _build_and_seed()
        return

    # We own the recreate.
    try:
        if os.path.exists(DB_PATH):
            os.remove(DB_PATH)
        _build_and_seed()
        _save_version(SCHEMA_VERSION)
    finally:
        try:
            os.remove(lock_path)
        except OSError:
            pass


def create_notification(db, user_id: int, notif_type: str, title: str, body: str = "", ref_id: int = None):
    """Insert one in-app notification for a user. Caller owns the commit."""
    db.execute(
        "INSERT INTO notifications (user_id, type, title, body, ref_id) VALUES (?,?,?,?,?)",
        (user_id, notif_type, title, body, ref_id),
    )


def _seed(conn, backfill_qualifications: bool = False, backfill_education: bool = False):
    import bcrypt
    c = conn.cursor()

    for gl in ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6']:
        c.execute("INSERT OR IGNORE INTO grade_levels (grade_level) VALUES (?)", (gl,))

    for tt in ['Administrative', 'Curriculum', 'Documentation', 'Assessment', 'Research']:
        c.execute("INSERT OR IGNORE INTO task_types (task_type) VALUES (?)", (tt,))

    for dept in ['Academic Affairs', 'Student Affairs', 'Administration', 'Research & Development']:
        c.execute("INSERT OR IGNORE INTO departments (department_name) VALUES (?)", (dept,))

    conn.commit()

    gl = {r['grade_level']: r['id'] for r in
          c.execute("SELECT id, grade_level FROM grade_levels").fetchall()}

    users = [
        # username, password, full_name, first, middle, last, suffix, role, gl_id, email, phone, children, date_appt, birthdate, address
        ('admin',        'admin123', 'System Admin',              'System',    None,  'Admin',      None,   'admin',       None,            None,                      None,               0, None,         None,         None),
        ('principal',    'prin123',  'Principal Liza Ramos',      'Liza',      None,  'Ramos',      None,   'principal',   None,            'lizaramos@school.edu.ph', '+63 912 000 0001', 2, None,         None,         'School Campus, Main St.'),
        ('coordinator1', 'coord123', 'Coordinator Grace Tan',     'Grace',     None,  'Tan',        None,   'coordinator', None,            'gracetan@school.edu.ph',  '+63 912 000 0002', 1, None,         None,         None),
        ('coordinator2', 'coord456', 'Coordinator Mark Bautista', 'Mark',      None,  'Bautista',   None,   'coordinator', None,            'markb@school.edu.ph',     '+63 912 000 0003', 0, None,         None,         None),
        ('registrar',    'reg123',   'Registrar Ana Cruz',        'Ana',       None,  'Cruz',       None,   'registrar',   None,            'anacruz@school.edu.ph',   '+63 912 000 0004', 3, None,         None,         None),
        ('dean1',        'dean123',  'Dean Maria Santos',         'Maria',     None,  'Santos',     None,   'dean',        gl['Grade 1'],   'mariasantos@school.edu.ph','+63 912 000 0005', 2, None,         None,         None),
        ('dean2',        'dean456',  'Dean Jose Reyes',           'Jose',      None,  'Reyes',      None,   'dean',        gl['Grade 2'],   'josereyes@school.edu.ph',  '+63 912 000 0006', 0, None,         None,         None),
        ('teacher1',     'teach123', 'Sheila P. Chevallier',      'Sheila',    'P.',  'Chevallier', None,   'teacher',     gl['Grade 1'],   'sheila.c@school.edu.ph',   '+63 992 812 5954', 2, '07-22-2022', '1990-15-03', 'Bonifacio Avenue, Barangay II'),
        ('teacher2',     'teach456', 'Juan D. Santos',            'Juan',      'D.',  'Santos',     None,   'teacher',     gl['Grade 1'],   'juan.s@school.edu.ph',     '+63 912 000 0008', 0, None,         None,         None),
        ('teacher3',     'teach789', 'Maria C. Reyes',            'Maria',     'C.',  'Reyes',      None,   'teacher',     gl['Grade 2'],   'maria.r@school.edu.ph',    '+63 912 000 0009', 4, None,         None,         None),
    ]
    new_users = set()
    for (username, password, full_name, first, middle, last, suffix,
         role, gl_id, email, phone, children, date_appt, birthdate, address) in users:
        pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        c.execute("""INSERT OR IGNORE INTO users
                     (username, password_hash, full_name, first_name, middle_name,
                      last_name, suffix, role, grade_level_id, email, phone_number,
                      number_of_children, date_of_appointment, birthdate, address)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                  (username, pw, full_name, first, middle, last, suffix,
                   role, gl_id, email, phone, children, date_appt, birthdate, address))
        if c.rowcount:
            new_users.add(username)
        elif backfill_qualifications:
            # Existing DB just migrated off the government-ID columns.
            c.execute("UPDATE users SET number_of_children=? WHERE username=?",
                      (children, username))
            new_users.add(username)

    conn.commit()

    # DepEd skill / certification taxonomy (deped_profile.py).
    from qualifications import seed_taxonomy, set_skills, set_certifications, set_education
    seed_taxonomy(c)
    conn.commit()

    # Sample profiles so assignee suggestions have something to match on.
    # Only for demo users created (or migrated) in this run, so data a user
    # later removes is not re-added on every startup.
    qualifications = {
        'teacher1':     (['Master of Ceremonies', 'Stage Decoration', 'Graphic Design & Layout'],
                         ['National Certificate II in Events Management',
                          'Licensure Examination for Teachers (LET)']),
        'teacher2':     (['Sound System & A/V', 'SDRRM Coordination', 'Network Troubleshooting'],
                         ['Standard First Aid', 'Basic Life Support',
                          'NC II in Computer Systems Servicing']),
        'teacher3':     (['Reading Remediation', 'Phil-IRI Reading Assessment', 'Exam Authoring'],
                         ['Licensure Examination for Teachers (LET)',
                          'Early Language, Literacy, and Numeracy (ELLN)']),
        'coordinator1': (['Learning Module Development', 'Action Research', 'DepEd e-RPMS Portal'],
                         ['Licensure Examination for Teachers (LET)',
                          'Higher-Order Thinking Skills (HOTS) Facilitator']),
        'coordinator2': (['DepEd LIS Management', 'e-BEIS Encoding', 'Live Stream Audio/Video'],
                         ['Trainers Methodology Level I (TM I)']),
        'dean1':        (['Minutes & Memo Drafting', 'Committee Documentation'],
                         ['Civil Service Professional Eligibility']),
        'dean2':        (['DepEd Liquidation', 'Property Custodianship'],
                         ['School Disaster Risk Reduction & Management (SDRRM) Officer']),
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
    for uname in qualifications.keys() | education.keys():
        row = c.execute("SELECT id FROM users WHERE username=?", (uname,)).fetchone()
        if not row:
            continue
        if uname in new_users and uname in qualifications:
            set_skills(c, row['id'], qualifications[uname][0])
            set_certifications(c, row['id'], qualifications[uname][1])
        if (uname in new_users or backfill_education) and uname in education:
            set_education(c, row['id'], dict(zip(
                ('highest_attainment', 'undergraduate_degree', 'specialization',
                 'postgraduate_focus'), education[uname])))

    conn.commit()

    uid = {r['username']: r['id'] for r in
           c.execute("SELECT id, username FROM users").fetchall()}

    for cid, glid in [(uid['coordinator1'], gl['Grade 1']),
                      (uid['coordinator2'], gl['Grade 2'])]:
        c.execute("INSERT OR IGNORE INTO coordinator_assignments (coordinator_id, grade_level_id) VALUES (?,?)",
                  (cid, glid))

    conn.commit()

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
    for row in tasks:
        c.execute("""INSERT OR IGNORE INTO tasks
                     (id, title, task_type_id, start_date, end_date, due_time, instructions, created_by)
                     VALUES (?,?,?,?,?,?,?,?)""", row)

    assignments = [
        (1, uid['coordinator1'], uid['principal']),
        (2, uid['coordinator1'], uid['principal']),
        (3, uid['coordinator1'], uid['principal']),
        (4, uid['coordinator1'], uid['principal']),
        (5, uid['coordinator1'], uid['principal']),
        (6, uid['coordinator2'], uid['principal']),
        (7, uid['coordinator2'], uid['principal']),
        (1, uid['dean1'], uid['coordinator1']),
        (2, uid['dean1'], uid['coordinator1']),
        (3, uid['dean1'], uid['coordinator1']),
        (4, uid['dean1'], uid['coordinator1']),
        (5, uid['dean1'], uid['coordinator1']),
        (6, uid['dean2'], uid['coordinator2']),
        (7, uid['dean2'], uid['coordinator2']),
        (1, uid['teacher1'], uid['dean1']),
        (1, uid['teacher2'], uid['dean1']),
        (2, uid['teacher1'], uid['dean1']),
        (2, uid['teacher2'], uid['dean1']),
        (3, uid['teacher1'], uid['dean1']),
        (3, uid['teacher2'], uid['dean1']),
        (4, uid['teacher1'], uid['dean1']),
        (4, uid['teacher2'], uid['dean1']),
        (5, uid['teacher1'], uid['dean1']),
        (5, uid['teacher2'], uid['dean1']),
        (6, uid['teacher3'], uid['dean2']),
        (7, uid['teacher3'], uid['dean2']),
        (1, uid['registrar'], uid['principal']),
    ]
    for task_id, user_id, assigned_by in assignments:
        c.execute("""INSERT OR IGNORE INTO task_assignments
                     (task_id, user_id, assigned_by) VALUES (?,?,?)""",
                  (task_id, user_id, assigned_by))

    c.execute("""INSERT OR IGNORE INTO reports
                 (id, task_id, personnel_id, report_title, report_description,
                  report_type, report_link_url, report_date, report_status)
                 VALUES (1, 1, ?, 'Market Research Report',
                         'Conducted survey with 25 respondents from local market.',
                         'link', 'https://example.com/market-research',
                         '2025-03-27 14:30:00', 'Completed')""",
              (uid['teacher1'],))

    c.execute("""INSERT OR IGNORE INTO task_log
                 (id, submission_date, personnel_id, task_id)
                 VALUES (1, '2025-03-27 14:30:00', ?, 1)""",
              (uid['teacher1'],))

    c.execute("""INSERT OR IGNORE INTO submission_log
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
        c.execute("""INSERT OR IGNORE INTO user_subjects (user_id, subject, grade_level_id)
                     VALUES (?,?,?)""", (user_id, subject, gl_id))

    for ev in [
        (1, 'Intramurals',           'Annual intramural sports',     '2024-03-25', 'pending', uid['admin']),
        (2, 'Science and Math Fair', 'Annual science and math fair', '2024-03-25', 'pending', uid['admin']),
    ]:
        c.execute("""INSERT OR IGNORE INTO activity_events
                     (id, title, description, event_date, status, created_by)
                     VALUES (?,?,?,?,?,?)""", ev)

    # ── Event Management seed data ────────────────────────────────────────────
    import json as _json
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
    for (eid, title, nature, target_date, venue, budget, fund,
         focal_name, focal_role, focal_contact, expected_outputs,
         participants, rationale, objectives, phase1, phase2, phase3,
         activity_matrix, training_materials, snacks, exec_committee,
         twg_groups, monitoring_criteria, indicators, comments,
         status, created_by) in seed_events:
        c.execute("""INSERT OR IGNORE INTO events
                     (id, title, nature, target_date, venue, proposed_budget, fund_source,
                      focal_name, focal_role, focal_contact, expected_outputs, participants,
                      rationale, objectives, phase1, phase2, phase3, activity_matrix,
                      training_materials, snacks, exec_committee, twg_groups,
                      monitoring_criteria, indicators, comments, status, created_by)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                  (eid, title, nature, target_date, venue, budget, fund,
                   focal_name, focal_role, focal_contact, expected_outputs,
                   participants, rationale, objectives, phase1, phase2, phase3,
                   activity_matrix, training_materials, snacks, exec_committee,
                   twg_groups, monitoring_criteria, indicators, comments,
                   status, created_by))

    # ── Subjects reference data ────────────────────────────────────────────────
    for subj in ['Araling Panlipunan', 'ESP', 'English', 'Filipino', 'ICT',
                 'MAPEH', 'Mathematics', 'Research', 'Science', 'TLE']:
        c.execute("INSERT OR IGNORE INTO subjects (subject_name) VALUES (?)", (subj,))
    c.execute("DELETE FROM subjects WHERE subject_name='Mother Tongue'")

    # ── Special Tasks sample data ──────────────────────────────────────────────
    # Special tasks are ordinary `tasks` rows tagged task_category='special'; the
    # assignee lives in task_assignments. Fixed high ids avoid colliding with the
    # common-task seed above.
    special_tasks = [
        (101, 'Prepare Q3 Report',        'Submit quarterly performance report', uid['teacher1'], uid['coordinator1'], '2026-05-30'),
        (102, 'Grade Level Coordination', 'Coordinate with grade level teachers', uid['dean1'],    uid['coordinator1'], '2026-06-15'),
        (103, 'Curriculum Review',        'Review and update lesson plans',       uid['teacher2'], uid['dean1'],        '2026-06-01'),
    ]
    for (sid, title, desc, assignee, assigner, due) in special_tasks:
        c.execute("""INSERT OR IGNORE INTO tasks
                     (id, title, instructions, task_category, end_date, created_by)
                     VALUES (?,?,?, 'special', ?, ?)""", (sid, title, desc, due, assigner))
        c.execute("""INSERT OR IGNORE INTO task_assignments (task_id, user_id, assigned_by)
                     VALUES (?,?,?)""", (sid, assignee, assigner))

    c.execute("""INSERT OR IGNORE INTO special_task_evaluations
                 (task_id, evaluator_id, completion_quality_score, timeliness_score,
                  initiative_score, coordination_score, weighted_average, remarks)
                 VALUES (103, ?, 4, 5, 3, 4, 4.05, 'Good effort on curriculum alignment.')""",
              (uid['coordinator1'],))

    # ── Event Evaluation sample data (evaluates the approved EVENTS row) ───────
    c.execute("""INSERT OR IGNORE INTO event_evaluations
                 (event_id, evaluator_id, evaluator_name, evaluator_role,
                  planning_score, objectives_score, personnel_score,
                  time_mgmt_score, engagement_score, resource_score, feedback_comments)
                 VALUES (1, ?, 'Coordinator Grace Tan', 'Coordinator', 5, 4, 5, 4, 5, 4,
                         'Ceremony was well organized and on time.')""",
              (uid['coordinator1'],))

    conn.commit()

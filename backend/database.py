import sqlite3
import os

DB_PATH = "tasknet.db"
SCHEMA_VERSION = 5  # bump when schema changes


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _stored_version():
    try:
        with open(".schema_version") as f:
            return int(f.read().strip())
    except Exception:
        return 0


def _save_version(v: int):
    with open(".schema_version", "w") as f:
        f.write(str(v))


def init_db():
    if _stored_version() < SCHEMA_VERSION:
        if os.path.exists(DB_PATH):
            os.remove(DB_PATH)
        _save_version(SCHEMA_VERSION)

    conn = get_db()
    c = conn.cursor()
    c.executescript("""
    -- ── Grade levels ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS grade_levels (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        grade_level TEXT NOT NULL UNIQUE
    );

    -- ── Core personnel ────────────────────────────────────────────────────────
    -- Roles:
    --   admin       — system admin, full access
    --   principal   — school principal, creates tasks, assigns anyone
    --   coordinator — receives tasks, re-assigns to coordinator/dean/teacher
    --   dean        — receives tasks, re-assigns to teachers in own grade level
    --   teacher     — receives tasks, submits reports
    --   registrar   — receives tasks, submits reports (cannot re-assign)
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
        tin                 TEXT,
        qsis                TEXT,
        hdmf                TEXT,
        phic                TEXT,
        date_of_appointment TEXT,
        address             TEXT,
        created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- ── User subject-grade assignments ────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS user_subjects (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject        TEXT NOT NULL,
        grade_level_id INTEGER REFERENCES grade_levels(id),
        UNIQUE(user_id, subject, grade_level_id)
    );

    -- ── Coordinator → grade-level mapping ────────────────────────────────────
    CREATE TABLE IF NOT EXISTS coordinator_assignments (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        coordinator_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        grade_level_id  INTEGER NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
        UNIQUE(coordinator_id, grade_level_id)
    );

    -- ── Task types ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS task_types (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        task_type TEXT NOT NULL UNIQUE
    );

    -- ── Tasks — only principal and admin can create ────────────────────────────
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

    -- ── Task assignments — every level of delegation uses this table ──────────
    -- user_id    = who receives/sees the task
    -- assigned_by = who delegated it to them (NULL if principal/admin created directly)
    -- A user ONLY sees a task if they appear in this table as user_id.
    CREATE TABLE IF NOT EXISTS task_assignments (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(task_id, user_id)
    );

    -- ── Task templates — reusable task blueprints ────────────────────────────
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

    -- ── Task attachments ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS task_attachments (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id         INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        attachment_type TEXT CHECK(attachment_type IN ('file','link','gdrive','youtube')),
        name            TEXT,
        url             TEXT,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- ── Task log — every report submission event ──────────────────────────────
    CREATE TABLE IF NOT EXISTS task_log (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_date  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        personnel_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task_id          INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        UNIQUE(task_id, personnel_id)
    );

    -- ── Reports — submitted by any assigned user for a task ───────────────────
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

    -- ── Submission log — tracks report handoff to the reviewer ───────────────
    -- receiver_personnel_id is auto-resolved from task_assignments.assigned_by
    -- (whoever delegated the task to the submitter reviews their report)
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

    -- ── Comments ──────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS comments (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id       INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
        report_id     INTEGER REFERENCES reports(id) ON DELETE CASCADE,
        comment_type  TEXT DEFAULT 'public' CHECK(comment_type IN ('public','private')),
        content       TEXT NOT NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- ── Activity events ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS activity_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT NOT NULL,
        description TEXT,
        event_date  TEXT,
        status      TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
        created_by  INTEGER REFERENCES users(id),
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()
    _seed(conn)
    conn.close()


def _seed(conn):
    import bcrypt
    c = conn.cursor()

    for gl in ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6']:
        c.execute("INSERT OR IGNORE INTO grade_levels (grade_level) VALUES (?)", (gl,))

    for tt in ['Administrative', 'Curriculum', 'Documentation', 'Assessment', 'Research']:
        c.execute("INSERT OR IGNORE INTO task_types (task_type) VALUES (?)", (tt,))

    conn.commit()

    gl = {r['grade_level']: r['id'] for r in
          c.execute("SELECT id, grade_level FROM grade_levels").fetchall()}

    # (username, password, full_name, first, middle, last, suffix, role, gl_id,
    #  email, phone, tin, qsis, hdmf, phic, date_appt, address)
    users = [
        ('admin',        'admin123', 'System Admin',              'System',    None,  'Admin',      None,   'admin',       None,            None,                     None,         None,          None,         None,    None,    None,         None),
        ('principal',    'prin123',  'Principal Liza Ramos',      'Liza',      None,  'Ramos',      None,   'principal',   None,            'lizaramos@school.edu.ph', '+63 912 000 0001', None, None, None, None, None, 'School Campus, Main St.'),
        ('coordinator1', 'coord123', 'Coordinator Grace Tan',     'Grace',     None,  'Tan',        None,   'coordinator', None,            'gracetan@school.edu.ph',  '+63 912 000 0002', None, None, None, None, None, None),
        ('coordinator2', 'coord456', 'Coordinator Mark Bautista', 'Mark',      None,  'Bautista',   None,   'coordinator', None,            'markb@school.edu.ph',     '+63 912 000 0003', None, None, None, None, None, None),
        ('registrar',    'reg123',   'Registrar Ana Cruz',        'Ana',       None,  'Cruz',       None,   'registrar',   None,            'anacruz@school.edu.ph',   '+63 912 000 0004', None, None, None, None, None, None),
        ('dean1',        'dean123',  'Dean Maria Santos',         'Maria',     None,  'Santos',     None,   'dean',        gl['Grade 1'],   'mariasantos@school.edu.ph','+63 912 000 0005', None, None, None, None, None, None),
        ('dean2',        'dean456',  'Dean Jose Reyes',           'Jose',      None,  'Reyes',      None,   'dean',        gl['Grade 2'],   'josereyes@school.edu.ph',  '+63 912 000 0006', None, None, None, None, None, None),
        ('teacher1',     'teach123', 'Sheila P. Chevallier',      'Sheila',    'P.',  'Chevallier', None,   'teacher',     gl['Grade 1'],   'sheila.c@school.edu.ph',   '+63 992 812 5954', '987-654-321', '56473829104', '7385216', '7385216', '07-22-2022', 'Bonifacio Avenue, Barangay II'),
        ('teacher2',     'teach456', 'Juan D. Santos',            'Juan',      'D.',  'Santos',     None,   'teacher',     gl['Grade 1'],   'juan.s@school.edu.ph',     '+63 912 000 0008', None, None, None, None, None, None),
        ('teacher3',     'teach789', 'Maria C. Reyes',            'Maria',     'C.',  'Reyes',      None,   'teacher',     gl['Grade 2'],   'maria.r@school.edu.ph',    '+63 912 000 0009', None, None, None, None, None, None),
    ]
    for (username, password, full_name, first, middle, last, suffix,
         role, gl_id, email, phone, tin, qsis, hdmf, phic, date_appt, address) in users:
        pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        c.execute("""INSERT OR IGNORE INTO users
                     (username, password_hash, full_name, first_name, middle_name,
                      last_name, suffix, role, grade_level_id, email, phone_number,
                      tin, qsis, hdmf, phic, date_of_appointment, address)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                  (username, pw, full_name, first, middle, last, suffix,
                   role, gl_id, email, phone, tin, qsis, hdmf, phic, date_appt, address))

    conn.commit()

    uid = {r['username']: r['id'] for r in
           c.execute("SELECT id, username FROM users").fetchall()}

    # Coordinator → grade level mappings
    for cid, glid in [(uid['coordinator1'], gl['Grade 1']),
                      (uid['coordinator2'], gl['Grade 2'])]:
        c.execute("INSERT OR IGNORE INTO coordinator_assignments (coordinator_id, grade_level_id) VALUES (?,?)",
                  (cid, glid))

    conn.commit()

    tt = {r['task_type']: r['id'] for r in
          c.execute("SELECT id, task_type FROM task_types").fetchall()}

    # Sample tasks created by principal
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

    # ── Assignment chain (demonstrating all levels) ────────────────────────────
    # Principal assigns tasks 1-5 to coordinator1, tasks 6-7 to coordinator2
    assignments = [
        # (task_id, user_id, assigned_by)
        (1, uid['coordinator1'], uid['principal']),
        (2, uid['coordinator1'], uid['principal']),
        (3, uid['coordinator1'], uid['principal']),
        (4, uid['coordinator1'], uid['principal']),
        (5, uid['coordinator1'], uid['principal']),
        (6, uid['coordinator2'], uid['principal']),
        (7, uid['coordinator2'], uid['principal']),
        # coordinator1 re-assigns tasks 1-5 to dean1 (Grade 1)
        (1, uid['dean1'], uid['coordinator1']),
        (2, uid['dean1'], uid['coordinator1']),
        (3, uid['dean1'], uid['coordinator1']),
        (4, uid['dean1'], uid['coordinator1']),
        (5, uid['dean1'], uid['coordinator1']),
        # coordinator2 re-assigns tasks 6-7 to dean2 (Grade 2)
        (6, uid['dean2'], uid['coordinator2']),
        (7, uid['dean2'], uid['coordinator2']),
        # dean1 assigns tasks 1-5 to teacher1 and teacher2 (Grade 1)
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
        # dean2 assigns tasks 6-7 to teacher3 (Grade 2)
        (6, uid['teacher3'], uid['dean2']),
        (7, uid['teacher3'], uid['dean2']),
        # principal also directly assigns task 1 to registrar
        (1, uid['registrar'], uid['principal']),
    ]
    for task_id, user_id, assigned_by in assignments:
        c.execute("""INSERT OR IGNORE INTO task_assignments
                     (task_id, user_id, assigned_by) VALUES (?,?,?)""",
                  (task_id, user_id, assigned_by))

    # Sample report + log for teacher1 on task 1
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

    # receiver = dean1 (who assigned task 1 to teacher1)
    c.execute("""INSERT OR IGNORE INTO submission_log
                 (id, status, date_of_submission, sender_personnel_id, report_id, receiver_personnel_id)
                 VALUES (1, 'Completed', '2025-03-27 14:30:00', ?, 1, ?)""",
              (uid['teacher1'], uid['dean1']))

    # User subject-grade assignments
    teacher_subjects = [
        (uid['teacher1'], 'Mathematics', gl['Grade 1']),
        (uid['teacher1'], 'Science',     gl['Grade 1']),
        (uid['teacher2'], 'English',     gl['Grade 1']),
        (uid['teacher2'], 'Filipino',    gl['Grade 1']),
        (uid['teacher3'], 'Mathematics', gl['Grade 2']),
        (uid['teacher3'], 'Science',     gl['Grade 2']),
    ]
    for user_id, subject, gl_id in teacher_subjects:
        c.execute("""INSERT OR IGNORE INTO user_subjects (user_id, subject, grade_level_id)
                     VALUES (?,?,?)""", (user_id, subject, gl_id))

    # Activity events
    for ev in [
        (1, 'Intramurals',           'Annual intramural sports',     '2024-03-25', 'pending', uid['admin']),
        (2, 'Science and Math Fair', 'Annual science and math fair', '2024-03-25', 'pending', uid['admin']),
    ]:
        c.execute("""INSERT OR IGNORE INTO activity_events
                     (id, title, description, event_date, status, created_by)
                     VALUES (?,?,?,?,?,?)""", ev)

    conn.commit()

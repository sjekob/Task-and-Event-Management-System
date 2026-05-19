import sqlite3
import os

DB_PATH = "tasknet.db"
SCHEMA_VERSION = 7  # bump when schema changes


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
    CREATE TABLE IF NOT EXISTS grade_levels (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        grade_level TEXT NOT NULL UNIQUE
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
        tin                 TEXT,
        qsis                TEXT,
        hdmf                TEXT,
        phic                TEXT,
        date_of_appointment TEXT,
        birthdate           TEXT,
        address             TEXT,
        is_active           INTEGER NOT NULL DEFAULT 1,
        created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_subjects (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject        TEXT NOT NULL,
        grade_level_id INTEGER REFERENCES grade_levels(id),
        UNIQUE(user_id, subject, grade_level_id)
    );

    CREATE TABLE IF NOT EXISTS coordinator_assignments (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        coordinator_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        grade_level_id  INTEGER NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
        UNIQUE(coordinator_id, grade_level_id)
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
            CHECK(status IN ('pending_approval','approved','disabled')),
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
    CREATE TABLE IF NOT EXISTS special_tasks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT NOT NULL,
        description TEXT,
        assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        due_date    TEXT,
        status      TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending','submitted','evaluated','flagged')),
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS special_task_evaluations (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id                 INTEGER NOT NULL REFERENCES special_tasks(id) ON DELETE CASCADE,
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

    CREATE TABLE IF NOT EXISTS school_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT NOT NULL,
        description TEXT,
        event_date  TEXT,
        status      TEXT NOT NULL DEFAULT 'upcoming'
            CHECK(status IN ('upcoming','ongoing','completed','cancelled')),
        created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_evaluations (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id         INTEGER NOT NULL REFERENCES school_events(id) ON DELETE CASCADE,
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

    users = [
        # username, password, full_name, first, middle, last, suffix, role, gl_id, email, phone, tin, qsis, hdmf, phic, date_appt, birthdate, address
        ('admin',        'admin123', 'System Admin',              'System',    None,  'Admin',      None,   'admin',       None,            None,                      None,               None,          None,         None,    None,    None,         None,         None),
        ('principal',    'prin123',  'Principal Liza Ramos',      'Liza',      None,  'Ramos',      None,   'principal',   None,            'lizaramos@school.edu.ph', '+63 912 000 0001', None,          None,         None,    None,    None,         None,         'School Campus, Main St.'),
        ('coordinator1', 'coord123', 'Coordinator Grace Tan',     'Grace',     None,  'Tan',        None,   'coordinator', None,            'gracetan@school.edu.ph',  '+63 912 000 0002', None,          None,         None,    None,    None,         None,         None),
        ('coordinator2', 'coord456', 'Coordinator Mark Bautista', 'Mark',      None,  'Bautista',   None,   'coordinator', None,            'markb@school.edu.ph',     '+63 912 000 0003', None,          None,         None,    None,    None,         None,         None),
        ('registrar',    'reg123',   'Registrar Ana Cruz',        'Ana',       None,  'Cruz',       None,   'registrar',   None,            'anacruz@school.edu.ph',   '+63 912 000 0004', None,          None,         None,    None,    None,         None,         None),
        ('dean1',        'dean123',  'Dean Maria Santos',         'Maria',     None,  'Santos',     None,   'dean',        gl['Grade 1'],   'mariasantos@school.edu.ph','+63 912 000 0005', None,          None,         None,    None,    None,         None,         None),
        ('dean2',        'dean456',  'Dean Jose Reyes',           'Jose',      None,  'Reyes',      None,   'dean',        gl['Grade 2'],   'josereyes@school.edu.ph',  '+63 912 000 0006', None,          None,         None,    None,    None,         None,         None),
        ('teacher1',     'teach123', 'Sheila P. Chevallier',      'Sheila',    'P.',  'Chevallier', None,   'teacher',     gl['Grade 1'],   'sheila.c@school.edu.ph',   '+63 992 812 5954', '987-654-321', '56473829104','7385216','7385216','07-22-2022','1990-15-03', 'Bonifacio Avenue, Barangay II'),
        ('teacher2',     'teach456', 'Juan D. Santos',            'Juan',      'D.',  'Santos',     None,   'teacher',     gl['Grade 1'],   'juan.s@school.edu.ph',     '+63 912 000 0008', None,          None,         None,    None,    None,         None,         None),
        ('teacher3',     'teach789', 'Maria C. Reyes',            'Maria',     'C.',  'Reyes',      None,   'teacher',     gl['Grade 2'],   'maria.r@school.edu.ph',    '+63 912 000 0009', None,          None,         None,    None,    None,         None,         None),
    ]
    for (username, password, full_name, first, middle, last, suffix,
         role, gl_id, email, phone, tin, qsis, hdmf, phic, date_appt, birthdate, address) in users:
        pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        c.execute("""INSERT OR IGNORE INTO users
                     (username, password_hash, full_name, first_name, middle_name,
                      last_name, suffix, role, grade_level_id, email, phone_number,
                      tin, qsis, hdmf, phic, date_of_appointment, birthdate, address)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                  (username, pw, full_name, first, middle, last, suffix,
                   role, gl_id, email, phone, tin, qsis, hdmf, phic, date_appt, birthdate, address))

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
    for subj in ['Mathematics', 'Science', 'English', 'Filipino', 'Araling Panlipunan',
                 'MAPEH', 'ESP', 'TLE', 'Mother Tongue']:
        c.execute("INSERT OR IGNORE INTO subjects (subject_name) VALUES (?)", (subj,))

    # ── Special Tasks sample data ──────────────────────────────────────────────
    special_tasks = [
        (1, 'Prepare Q3 Report',       'Submit quarterly performance report', uid['teacher1'], uid['coordinator1'], '2026-05-30', 'submitted'),
        (2, 'Grade Level Coordination', 'Coordinate with grade level teachers', uid['dean1'],   uid['coordinator1'], '2026-06-15', 'pending'),
        (3, 'Curriculum Review',        'Review and update lesson plans',       uid['teacher2'], uid['dean1'],       '2026-06-01', 'evaluated'),
    ]
    for (sid, title, desc, assignee, assigner, due, status) in special_tasks:
        c.execute("""INSERT OR IGNORE INTO special_tasks
                     (id, title, description, assignee_id, assigned_by, due_date, status)
                     VALUES (?,?,?,?,?,?,?)""", (sid, title, desc, assignee, assigner, due, status))

    c.execute("""INSERT OR IGNORE INTO special_task_evaluations
                 (task_id, evaluator_id, completion_quality_score, timeliness_score,
                  initiative_score, coordination_score, weighted_average, remarks)
                 VALUES (3, ?, 4, 5, 3, 4, 4.05, 'Good effort on curriculum alignment.')""",
              (uid['coordinator1'],))

    # ── School Events sample data ──────────────────────────────────────────────
    school_events = [
        (1, 'Foundation Day',  'School anniversary celebration', '2026-06-10', 'upcoming',  uid['principal']),
        (2, 'Science Fair',    'Annual science exhibit',         '2026-07-05', 'upcoming',  uid['coordinator1']),
        (3, 'Graduation 2026', 'Grade 6 graduation ceremony',   '2026-05-28', 'completed', uid['principal']),
    ]
    for ev in school_events:
        c.execute("""INSERT OR IGNORE INTO school_events
                     (id, title, description, event_date, status, created_by)
                     VALUES (?,?,?,?,?,?)""", ev)

    c.execute("""INSERT OR IGNORE INTO event_evaluations
                 (event_id, evaluator_id, evaluator_name, evaluator_role,
                  planning_score, objectives_score, personnel_score,
                  time_mgmt_score, engagement_score, resource_score, feedback_comments)
                 VALUES (3, ?, 'Coordinator Grace Tan', 'Coordinator', 5, 4, 5, 4, 5, 4,
                         'Ceremony was well organized and on time.')""",
              (uid['coordinator1'],))

    conn.commit()

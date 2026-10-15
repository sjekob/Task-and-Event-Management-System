-- TaskNet Database Backup
-- Generated: 2026-05-20 22:47:14
-- Schema Version: 7
-- Purpose: Testing seed data
-- 
-- Test Credentials:
--   admin        / admin123
--   principal    / prin123
--   coordinator1 / coord123
--   coordinator2 / coord456
--   registrar    / reg123
--   dean1        / dean123
--   dean2        / dean456
--   teacher1     / teach123
--   teacher2     / teach456
--   teacher3     / teach789

PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

CREATE TABLE activity_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT NOT NULL,
        description TEXT,
        event_date  TEXT,
        status      TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
        created_by  INTEGER REFERENCES users(id),
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
INSERT INTO "activity_events" VALUES(1,'Intramurals','Annual intramural sports','2024-03-25','pending',1,'2026-05-19 16:57:55');
INSERT INTO "activity_events" VALUES(2,'Science and Math Fair','Annual science and math fair','2024-03-25','pending',1,'2026-05-19 16:57:55');
CREATE TABLE comments (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id       INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
        report_id     INTEGER REFERENCES reports(id) ON DELETE CASCADE,
        comment_type  TEXT DEFAULT 'public' CHECK(comment_type IN ('public','private')),
        content       TEXT NOT NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE coordinator_assignments (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        coordinator_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        grade_level_id  INTEGER NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
        UNIQUE(coordinator_id, grade_level_id)
    );
INSERT INTO "coordinator_assignments" VALUES(1,3,1);
INSERT INTO "coordinator_assignments" VALUES(2,4,2);
CREATE TABLE event_evaluations (
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
INSERT INTO "event_evaluations" VALUES(1,3,3,'Coordinator Grace Tan','Coordinator',5,4,5,4,5,4,'Ceremony was well organized and on time.','2026-05-19 16:57:55');
INSERT INTO "event_evaluations" VALUES(2,3,3,'Coordinator Grace Tan','Coordinator',5,4,5,4,5,4,'Ceremony was well organized and on time.','2026-05-20 03:20:42');
INSERT INTO "event_evaluations" VALUES(3,3,3,'Coordinator Grace Tan','Coordinator',5,4,5,4,5,4,'Ceremony was well organized and on time.','2026-05-20 05:24:40');
CREATE TABLE events (
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
INSERT INTO "events" VALUES(1,'Foundation Day Celebration','Co-curricular','June 10, 2026','NCS II Pavilion','15,000.00','SPTA Fund','Principal Liza Ramos','Principal','+63 912 000 0001','["Program booklets", "Photo documentation"]','{"teachers": {"male": 5, "female": 20}, "students": {"male": 100, "female": 100}}','Annual celebration of the school''s founding anniversary.','["Celebrate the school founding", "Build school community spirit"]','Planning
Venue preparation','Program proper
Entertainment','Clean-up
Evaluation','[{"day": "June 10", "time": "8:00 AM", "event": "Opening Ceremony", "speaker": "Principal"}]','[]','[]','[{"name": "Principal Liza Ramos", "position": "Chairperson"}]','[]','Evaluate participation and overall conduct of the event.','[]','','approved',2,'2026-05-19 16:57:55');
INSERT INTO "events" VALUES(2,'Science and Technology Fair','Curricular','July 15, 2026','NCS II Covered Court','8,000.00','School Paper Fund','Coordinator Grace Tan','Coordinator','+63 912 000 0002','["Project exhibits", "Research papers"]','{"teachers": {"male": 3, "female": 10}, "students": {"male": 60, "female": 60}}','Annual science and technology fair showcasing student research projects.','["Promote scientific inquiry", "Recognize student innovations"]','Project submission
Judging criteria','Exhibit proper
Presentation','Awarding
Evaluation','[]','[]','[]','[]','[]','','[]','','pending_approval',3,'2026-05-19 16:57:55');
CREATE TABLE grade_levels (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        grade_level TEXT NOT NULL UNIQUE
    );
INSERT INTO "grade_levels" VALUES(1,'Grade 1');
INSERT INTO "grade_levels" VALUES(2,'Grade 2');
INSERT INTO "grade_levels" VALUES(3,'Grade 3');
INSERT INTO "grade_levels" VALUES(4,'Grade 4');
INSERT INTO "grade_levels" VALUES(5,'Grade 5');
INSERT INTO "grade_levels" VALUES(6,'Grade 6');
CREATE TABLE reports (
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
INSERT INTO "reports" VALUES(1,1,8,'Market Research Report','Conducted survey with 25 respondents from local market.','link',NULL,NULL,'https://example.com/market-research','2025-03-27 14:30:00','Completed');
INSERT INTO "reports" VALUES(2,8,6,'SIA Lab Assessment.docx.pdf',NULL,'file','/uploads/8_6_1779215283_SIA Lab Assessment.docx.pdf','SIA Lab Assessment.docx.pdf',NULL,'2026-05-19 18:28:03','Completed');
INSERT INTO "reports" VALUES(9,9,9,'CertificateOfCompletion_Software Testing Foundations Test Planning.pdf',NULL,'file','/uploads/9_9_1779215990_CertificateOfCompletion_Software Testing Foundations Test Planning.pdf','CertificateOfCompletion_Software Testing Foundations Test Planning.pdf',NULL,'2026-05-19 18:39:50','Pending');
CREATE TABLE school_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT NOT NULL,
        description TEXT,
        event_date  TEXT,
        status      TEXT NOT NULL DEFAULT 'upcoming'
            CHECK(status IN ('upcoming','ongoing','completed','cancelled')),
        created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
INSERT INTO "school_events" VALUES(1,'Foundation Day','School anniversary celebration','2026-06-10','upcoming',2,'2026-05-19 16:57:55');
INSERT INTO "school_events" VALUES(2,'Science Fair','Annual science exhibit','2026-07-05','upcoming',3,'2026-05-19 16:57:55');
INSERT INTO "school_events" VALUES(3,'Graduation 2026','Grade 6 graduation ceremony','2026-05-28','completed',2,'2026-05-19 16:57:55');
CREATE TABLE special_task_evaluations (
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
INSERT INTO "special_task_evaluations" VALUES(1,3,3,4,5,3,4,4.05,'Good effort on curriculum alignment.','2026-05-19 16:57:55');
INSERT INTO "special_task_evaluations" VALUES(3,1,3,5,5,5,5,5.0,'','2026-05-20 04:42:13');
CREATE TABLE special_tasks (
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
INSERT INTO "special_tasks" VALUES(1,'Prepare Q3 Report','Submit quarterly performance report',8,3,'2026-05-30','evaluated','2026-05-19 16:57:55');
INSERT INTO "special_tasks" VALUES(2,'Grade Level Coordination','Coordinate with grade level teachers',6,3,'2026-06-15','pending','2026-05-19 16:57:55');
INSERT INTO "special_tasks" VALUES(3,'Curriculum Review','Review and update lesson plans',9,6,'2026-06-01','evaluated','2026-05-19 16:57:55');
CREATE TABLE subjects (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_name TEXT NOT NULL UNIQUE
    );
INSERT INTO "subjects" VALUES(1,'Mathematics');
INSERT INTO "subjects" VALUES(2,'Science');
INSERT INTO "subjects" VALUES(3,'English');
INSERT INTO "subjects" VALUES(4,'Filipino');
INSERT INTO "subjects" VALUES(5,'Araling Panlipunan');
INSERT INTO "subjects" VALUES(6,'MAPEH');
INSERT INTO "subjects" VALUES(7,'ESP');
INSERT INTO "subjects" VALUES(8,'TLE');
INSERT INTO "subjects" VALUES(9,'Mother Tongue');
CREATE TABLE submission_log (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        status                TEXT DEFAULT 'Pending'
            CHECK(status IN ('Completed','Pending','Missing')),
        date_of_submission    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sender_personnel_id   INTEGER NOT NULL REFERENCES users(id),
        report_id             INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        receiver_personnel_id INTEGER REFERENCES users(id),
        UNIQUE(report_id)
    );
INSERT INTO "submission_log" VALUES(1,'Completed','2025-03-27 14:30:00',8,1,6);
INSERT INTO "submission_log" VALUES(2,'Completed','2026-05-19 18:28:03',6,2,3);
INSERT INTO "submission_log" VALUES(9,'Pending','2026-05-19 18:39:50',9,9,4);
CREATE TABLE task_assignments (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(task_id, user_id)
    );
INSERT INTO "task_assignments" VALUES(1,1,3,2);
INSERT INTO "task_assignments" VALUES(2,2,3,2);
INSERT INTO "task_assignments" VALUES(3,3,3,2);
INSERT INTO "task_assignments" VALUES(4,4,3,2);
INSERT INTO "task_assignments" VALUES(5,5,3,2);
INSERT INTO "task_assignments" VALUES(6,6,4,2);
INSERT INTO "task_assignments" VALUES(7,7,4,2);
INSERT INTO "task_assignments" VALUES(9,2,6,3);
INSERT INTO "task_assignments" VALUES(10,3,6,3);
INSERT INTO "task_assignments" VALUES(11,4,6,3);
INSERT INTO "task_assignments" VALUES(12,5,6,3);
INSERT INTO "task_assignments" VALUES(13,6,7,4);
INSERT INTO "task_assignments" VALUES(14,7,7,4);
INSERT INTO "task_assignments" VALUES(15,1,8,6);
INSERT INTO "task_assignments" VALUES(16,1,9,6);
INSERT INTO "task_assignments" VALUES(17,2,8,6);
INSERT INTO "task_assignments" VALUES(18,2,9,6);
INSERT INTO "task_assignments" VALUES(19,3,8,6);
INSERT INTO "task_assignments" VALUES(20,3,9,6);
INSERT INTO "task_assignments" VALUES(21,4,8,6);
INSERT INTO "task_assignments" VALUES(22,4,9,6);
INSERT INTO "task_assignments" VALUES(23,5,8,6);
INSERT INTO "task_assignments" VALUES(24,5,9,6);
INSERT INTO "task_assignments" VALUES(25,6,10,7);
INSERT INTO "task_assignments" VALUES(26,7,10,7);
INSERT INTO "task_assignments" VALUES(27,1,5,2);
INSERT INTO "task_assignments" VALUES(28,1,4,3);
INSERT INTO "task_assignments" VALUES(29,8,6,3);
INSERT INTO "task_assignments" VALUES(30,9,9,4);
INSERT INTO "task_assignments" VALUES(38,1,6,3);
CREATE TABLE task_attachments (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id         INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        attachment_type TEXT CHECK(attachment_type IN ('file','link','gdrive','youtube')),
        name            TEXT,
        url             TEXT,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
INSERT INTO "task_attachments" VALUES(1,8,NULL,'','https:/try','2026-05-19 18:27:11');
CREATE TABLE task_log (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_date  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        personnel_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task_id          INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        UNIQUE(task_id, personnel_id)
    );
INSERT INTO "task_log" VALUES(1,'2025-03-27 14:30:00',8,1);
INSERT INTO "task_log" VALUES(2,'2026-05-19 18:28:03',6,8);
INSERT INTO "task_log" VALUES(9,'2026-05-19 18:39:50',9,9);
CREATE TABLE task_templates (
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
INSERT INTO "task_templates" VALUES(1,'Test1','Try','2026-05-22','2026-05-23','1:02 AM',100,100,50,0,2,'2026-05-19 17:02:13');
CREATE TABLE task_types (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        task_type TEXT NOT NULL UNIQUE
    );
INSERT INTO "task_types" VALUES(1,'Administrative');
INSERT INTO "task_types" VALUES(2,'Curriculum');
INSERT INTO "task_types" VALUES(3,'Documentation');
INSERT INTO "task_types" VALUES(4,'Assessment');
INSERT INTO "task_types" VALUES(5,'Research');
CREATE TABLE tasks (
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
INSERT INTO "tasks" VALUES(1,'Market Research','Conduct a market survey using the provided questionnaire. Collect at least 20 respondents.',NULL,5,'2025-03-28','2025-04-15','02:30 PM','active',2,100,100,50,0,'2026-05-19 16:57:55');
INSERT INTO "tasks" VALUES(2,'Student Assessment','Administer tests, quizzes, and other assessments and record results.',NULL,4,'2025-05-22','2025-05-22','11:59 PM','active',2,100,100,50,0,'2026-05-19 16:57:55');
INSERT INTO "tasks" VALUES(3,'Grading and Record-Keeping','Record grades, calculate averages, and maintain accurate student records.',NULL,1,'2025-05-22','2025-05-22','11:59 PM','active',2,100,100,50,0,'2026-05-19 16:57:55');
INSERT INTO "tasks" VALUES(4,'Report Card Preparation','Complete and submit students'' report cards.',NULL,1,'2025-05-22','2025-05-22','11:59 PM','active',2,100,100,50,0,'2026-05-19 16:57:55');
INSERT INTO "tasks" VALUES(5,'Attendance Monitoring','Track and record daily student attendance.',NULL,1,'2025-05-22','2025-05-22','11:59 PM','active',2,100,100,50,0,'2026-05-19 16:57:55');
INSERT INTO "tasks" VALUES(6,'Weekly Lesson Plan','Submit weekly lesson plan for Q1 Week 1.',NULL,2,'2025-01-14','2025-01-14','11:59 PM','active',2,100,100,50,0,'2026-05-19 16:57:55');
INSERT INTO "tasks" VALUES(7,'Class Activity Photos','Upload photos from the science experiment.',NULL,3,'2025-01-14','2025-01-14','11:59 PM','active',2,100,100,50,0,'2026-05-19 16:57:55');
INSERT INTO "tasks" VALUES(8,'Test1','Test1',NULL,NULL,'2026-05-22','2026-05-23','11:55 AM','active',3,100,100,50,0,'2026-05-19 18:27:11');
INSERT INTO "tasks" VALUES(9,'Test1','Try',NULL,NULL,'2026-05-22','2026-05-23','1:02 AM','active',4,100,100,50,0,'2026-05-19 18:39:14');
CREATE TABLE user_subjects (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject        TEXT NOT NULL,
        grade_level_id INTEGER REFERENCES grade_levels(id),
        UNIQUE(user_id, subject, grade_level_id)
    );
INSERT INTO "user_subjects" VALUES(1,8,'Mathematics',1);
INSERT INTO "user_subjects" VALUES(2,8,'Science',1);
INSERT INTO "user_subjects" VALUES(3,9,'English',1);
INSERT INTO "user_subjects" VALUES(4,9,'Filipino',1);
INSERT INTO "user_subjects" VALUES(5,10,'Mathematics',2);
INSERT INTO "user_subjects" VALUES(6,10,'Science',2);
CREATE TABLE users (
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
INSERT INTO "users" VALUES(1,'admin','$2b$12$rryPbErP1qGzCLqVk58EP.fPCZXhBL80RwcqdDWdVtfHOfwpC4x1y','System Admin','System',NULL,'Admin',NULL,'admin',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-05-19 16:57:53');
INSERT INTO "users" VALUES(2,'principal','$2b$12$8SZfl7jEtXd0.ihTjOaXNuPvPblyVScWp.Hk0x.Bws4vCid9lncpO','Principal Liza Ramos','Liza',NULL,'Ramos',NULL,'principal',NULL,NULL,'lizaramos@school.edu.ph','+63 912 000 0001',NULL,NULL,NULL,NULL,NULL,NULL,'School Campus, Main St.',1,'2026-05-19 16:57:53');
INSERT INTO "users" VALUES(3,'coordinator1','$2b$12$iDp3dXUDyILnoRW3QIQJ8e5wGcTGFO7NqKsg8xDZn6Ec8giHA88L2','Coordinator Grace Tan','Grace',NULL,'Tan',NULL,'coordinator',NULL,NULL,'gracetan@school.edu.ph','+63 912 000 0002',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'2026-05-19 16:57:54');
INSERT INTO "users" VALUES(4,'coordinator2','$2b$12$jo0Q8ia3fmilZ14wyu7YsOb0gI0OO2rLHtdfIuYXyE745VZKS3P0q','Coordinator Mark Bautista','Mark',NULL,'Bautista',NULL,'coordinator',NULL,NULL,'markb@school.edu.ph','+63 912 000 0003',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-05-19 16:57:54');
INSERT INTO "users" VALUES(5,'registrar','$2b$12$rgBN.FplRjTceqxsrCAMx.KES8a26Ei7Dh.Fa/hwCQ95dCbM/XEOa','Registrar Ana Cruz','Ana',NULL,'Cruz',NULL,'registrar',NULL,NULL,'anacruz@school.edu.ph','+63 912 000 0004',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-05-19 16:57:54');
INSERT INTO "users" VALUES(6,'dean1','$2b$12$.iPQ6.sCsAXCdjCYUqHQoe0kqMD33.n25tRleuHTAC5F/K3wRAkU.','Dean Maria Santos','Maria',NULL,'Santos',NULL,'dean',1,NULL,'mariasantos@school.edu.ph','+63 912 000 0005',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-05-19 16:57:54');
INSERT INTO "users" VALUES(7,'dean2','$2b$12$SGGcf8GIgwguSeXh/5y/QeSp1eq8GviddLYQJYviMH1Sl.YZLP2KG','Dean Jose Reyes','Jose',NULL,'Reyes',NULL,'dean',2,NULL,'josereyes@school.edu.ph','+63 912 000 0006',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-05-19 16:57:55');
INSERT INTO "users" VALUES(8,'teacher1','$2b$12$83LY2nKO/qFwgx.k3paK1u6Loek1z0exsevGkQbnQVvIi7hZhHH8e','Sheila P. Chevallier','Sheila','P.','Chevallier',NULL,'teacher',1,NULL,'sheila.c@school.edu.ph','+63 992 812 5954','987-654-321','56473829104','7385216','7385216','07-22-2022','1990-15-03','Bonifacio Avenue, Barangay II',1,'2026-05-19 16:57:55');
INSERT INTO "users" VALUES(9,'teacher2','$2b$12$tugvp3uPWZJ.gZEaDFE.xexEW1kdDS7eNImfJETTRXRz7Q0dQCdlC','Juan D. Santos','Juan','D.','Santos',NULL,'teacher',1,NULL,'juan.s@school.edu.ph','+63 912 000 0008',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-05-19 16:57:55');
INSERT INTO "users" VALUES(10,'teacher3','$2b$12$MS/nKH7f9RPPk3eC.mNRQugfq9Pd6EqoIxD4Jb9x/S3/4aX.k0NzK','Maria C. Reyes','Maria','C.','Reyes',NULL,'teacher',2,NULL,'maria.r@school.edu.ph','+63 912 000 0009',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'2026-05-19 16:57:55');
INSERT INTO "users" VALUES(11,'dean3','$2b$12$a1wfkR.TtIjWEpY6G7Hgoe5TPsKbMn0B5zBK7t6uCnYaUc8BLMniK','John Michael M Mamiit II','John Michael','M','Mamiit','II','teacher',NULL,NULL,'mamiitjm@gmail.com',NULL,'Try','try',NULL,NULL,NULL,NULL,NULL,1,'2026-05-19 18:31:12');
DELETE FROM "sqlite_sequence";
INSERT INTO "sqlite_sequence" VALUES('grade_levels',18);
INSERT INTO "sqlite_sequence" VALUES('task_types',15);
INSERT INTO "sqlite_sequence" VALUES('users',31);
INSERT INTO "sqlite_sequence" VALUES('coordinator_assignments',6);
INSERT INTO "sqlite_sequence" VALUES('tasks',9);
INSERT INTO "sqlite_sequence" VALUES('task_assignments',84);
INSERT INTO "sqlite_sequence" VALUES('reports',9);
INSERT INTO "sqlite_sequence" VALUES('task_log',9);
INSERT INTO "sqlite_sequence" VALUES('submission_log',9);
INSERT INTO "sqlite_sequence" VALUES('user_subjects',18);
INSERT INTO "sqlite_sequence" VALUES('activity_events',2);
INSERT INTO "sqlite_sequence" VALUES('events',2);
INSERT INTO "sqlite_sequence" VALUES('subjects',27);
INSERT INTO "sqlite_sequence" VALUES('special_tasks',3);
INSERT INTO "sqlite_sequence" VALUES('special_task_evaluations',4);
INSERT INTO "sqlite_sequence" VALUES('school_events',3);
INSERT INTO "sqlite_sequence" VALUES('event_evaluations',3);
INSERT INTO "sqlite_sequence" VALUES('task_templates',1);
INSERT INTO "sqlite_sequence" VALUES('task_attachments',1);
PRAGMA foreign_keys = ON;

-- End of TaskNet backup
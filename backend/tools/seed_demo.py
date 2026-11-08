"""
seed_demo.py — Fill a fresh TaskNet database with a realistic demo school.

Run once against an EMPTY database (it creates the schema, the base accounts,
subjects, grade levels and the DepEd calendar first):

    DATABASE_URL=postgresql://tasknet:tasknet@postgres:5432/tasknet_demo \
        python -m tools.seed_demo

Adds, for School Year 2026-2027 (and a little of 2025-2026):
  - deans for every grade, 36 teachers, 30 sections with advisers and
    subject-teacher loads, profiles (education, skills);
  - common tasks with on-time / late / missing / pending submissions, and the
    tasks the school calendar implies (grades: subject teachers -> adviser ->
    dean -> registrar), posted the same way the app posts them;
  - special tasks, some evaluated;
  - events in every state (completed with attendance and evaluations,
    approved with a pinned venue, pending, revisions requested, rejected,
    draft) with their review history;
  - notifications.
Writes go through store.py / event_store.py, so the data is in the normalized
tables exactly as the app stores it. Every demo account's password is
DEMO_PASSWORD. Deterministic: the same data on every run.
"""
import json
import random
from datetime import date, datetime, timedelta

import bcrypt

import store
from database import connect_db, init_db
from event_store import save_event

DEMO_PASSWORD = "demo123"
TODAY = date(2026, 11, 8)
rnd = random.Random(7)

FIRST = ["Andrea", "Bea", "Carlo", "Dina", "Elmer", "Fe", "Gilbert", "Hazel", "Ivy", "Jerome", "Karen", "Leo",
         "Mylene", "Noel", "Olive", "Paolo", "Queenie", "Ramon", "Susan", "Tristan", "Ursula", "Vince", "Wilma",
         "Xavier", "Yolanda", "Zaldy", "Analyn", "Benjie", "Cherry", "Dennis", "Emy", "Ferdie", "Gina", "Hector",
         "Irene", "Jun", "Kristine", "Lito", "Marites", "Nestor"]
LAST = ["Dela Cruz", "Garcia", "Mendoza", "Villanueva", "Castillo", "Aquino", "Navarro", "Pascual", "Domingo",
        "Fernandez", "Gonzales", "Lopez", "Morales", "Ramos", "Salvador", "Torres", "Valdez", "Bautista", "Cortez",
        "Esguerra", "Francisco", "Hernandez", "Ignacio", "Jimenez", "Lim", "Manalo", "Ocampo", "Perez", "Quiambao",
        "Rivera", "Santiago", "Tolentino", "Umali", "Velasco", "Yap", "Zamora", "Abad", "Buenaventura", "Cabrera", "Dizon"]
MIDDLE = list("ABCDEFGLMNPRST")

SECTIONS = {
    1: ["Matapat (Honest)", "Masipag (Diligent)", "Magalang (Respectful)", "Mabait (Kind)", "Malikhain (Creative)"],
    2: ["Sampaguita", "Rosal", "Camia", "Ilang-Ilang", "Cattleya"],
    3: ["Mangga", "Lanzones", "Rambutan", "Marang", "Anonas"],
    4: ["Narra", "Yakal", "Molave", "Apitong", "Kamagong"],
    5: ["Rizal", "Bonifacio", "Mabini", "Del Pilar", "Silang"],
    6: ["Quezon", "Magsaysay", "Osmeña", "Roxas", "Laurel"],
}
# Five advisers per grade, each teaching two subjects in all five sections; a sixth teacher takes MAPEH.
SUBJECT_PAIRS = [("Mathematics", "Science"), ("English", "Filipino"), ("Araling Panlipunan", "ESP"),
                 ("ICT", "Research"), ("TLE", "Mathematics")]
VENUE = (13.6240, 123.1850)


def ts(d: date, hh=8, mm=0) -> str:
    return datetime(d.year, d.month, d.day, hh, mm).strftime("%Y-%m-%d %H:%M:%S")


def long(d: date) -> str:
    return f"{d.strftime('%B')} {d.day}, {d.year}"


class Seeder:
    def __init__(self, db):
        self.db = db
        self.pw = bcrypt.hashpw(DEMO_PASSWORD.encode(), bcrypt.gensalt()).decode()
        self.gl = {int(r["grade_level"].split()[-1]): r["id"] for r in db.execute("SELECT id, grade_level FROM grade_levels")}
        self.subj = {r["subject_name"]: r["id"] for r in db.execute("SELECT id, subject_name FROM subjects")}
        self.uid = {r["username"]: r["id"] for r in db.execute("SELECT id, username FROM personnel")}
        self.skills = [r["skill_name"] for r in db.execute("SELECT skill_name FROM skill")]  # catalog
        self.names = iter(rnd.sample([(f, l) for f in FIRST for l in LAST], 200))

    def x(self, sql, params=()):
        return self.db.execute(sql, params)

    # ── People ────────────────────────────────────────────────────────────────
    def person(self, username, role, grade=None):
        if username in self.uid:
            return self.uid[username]
        first, last = next(self.names)
        uid = store.create_user(self.db, {
            "username": username, "password_hash": self.pw, "role": role,
            "first_name": first, "middle_name": f"{rnd.choice(MIDDLE)}.", "last_name": last, "grade_level_id": self.gl.get(grade),
            "email": f"{first.lower()}.{last.lower().replace(' ', '')}@school.edu.ph",
            "phone_number": f"+63 9{rnd.randint(10, 99)} {rnd.randint(100, 999)} {rnd.randint(1000, 9999)}",
            "date_of_appointment": date(rnd.randint(2008, 2023), rnd.randint(1, 12), rnd.randint(1, 28)).isoformat(),
            "birthdate": date(rnd.randint(1970, 1998), rnd.randint(1, 12), rnd.randint(1, 28)).isoformat(),
            "address": f"{rnd.choice(['Purok 1', 'Purok 3', 'Zone 5', 'Blk 2 Lot 7'])}, Naga City"})
        self.uid[username] = uid
        from qualifications import set_skills
        set_skills(self.db, uid, rnd.sample(self.skills, min(3, len(self.skills))))
        store.set_education(self.db, uid, {"highest_attainment": rnd.choice(["Bachelor's Degree", "With Master's Units"]),
                                           "undergraduate_degree": rnd.choice(["BEEd – Generalist", "BSEd"])})
        return uid

    def staff(self):
        # The base seed made dean1/dean2 (Grades 1-2); add a dean for each other grade.
        for g in range(1, 7):
            d = self.person(f"dean{g}", "dean", g)
            self.x("INSERT INTO dean_assignment (user_id, grade_level_id) VALUES (?,?) ON CONFLICT (user_id) DO NOTHING", (d, self.gl[g]))
        self.sections = {}
        for g, names in SECTIONS.items():
            advisers = [self.person(f"g{g}t{i + 1}", "teacher", g) for i in range(5)]
            mapeh = self.person(f"g{g}t6", "teacher", g)
            for name, adviser in zip(names, advisers):
                sid = self.x("INSERT INTO section (name, grade_level_id, adviser_id) VALUES (?,?,?)",
                             (name, self.gl[g], adviser)).lastrowid
                self.sections[(g, name)] = sid
            for adviser, pair in zip(advisers, SUBJECT_PAIRS):
                self.load(adviser, g, pair, names)
            self.load(mapeh, g, ("MAPEH",), names)
        # The base seed's teachers join Grade 1-2 sections as extra subject teachers.
        self.load(self.uid["teacher1"], 1, ("Science",), SECTIONS[1][:2])
        self.load(self.uid["teacher2"], 1, ("English",), SECTIONS[1][2:4])
        self.load(self.uid["teacher3"], 2, ("Mathematics",), SECTIONS[2][:3])

    def load(self, uid, g, subjects, section_names):
        for s in subjects:
            self.x("INSERT INTO user_subjects (user_id, subject_id, grade_level_id) VALUES (?,?,?) ON CONFLICT DO NOTHING",
                   (uid, self.subj[s], self.gl[g]))
            for n in section_names:
                self.x("INSERT INTO section_teachers (section_id, user_id, subject_id) VALUES (?,?,?) ON CONFLICT DO NOTHING",
                       (self.sections[(g, n)], uid, self.subj[s]))

    # ── School years ──────────────────────────────────────────────────────────
    def school_years(self):
        p = self.uid["principal"]
        for name, s, e, terms in [
            ("2025-2026", "2025-06-16", "2026-04-10", [("Term 1", "2025-06-16", "2025-09-12"), ("Term 2", "2025-09-15", "2025-12-19"), ("Term 3", "2026-01-05", "2026-04-10")]),
            ("2026-2027", "2026-06-16", "2027-04-09", [("Term 1", "2026-06-16", "2026-09-15"), ("Term 2", "2026-09-16", "2026-12-18"), ("Term 3", "2027-01-04", "2027-04-09")]),
        ]:
            sy = self.x("INSERT INTO school_years (name, start_date, end_date, created_by) VALUES (?,?,?,?)", (name, s, e, p)).lastrowid
            for tn, ts_, te in terms:
                self.x("INSERT INTO school_terms (school_year_id, name, start_date, end_date) VALUES (?,?,?,?)", (sy, tn, ts_, te))

    # ── Tasks and submissions ─────────────────────────────────────────────────
    def teachers(self):
        return [r["id"] for r in self.x("SELECT id FROM personnel WHERE role='teacher' AND is_active=1 ORDER BY id")]

    def submit(self, task_id, uid, due: date, reviewer, kind):
        """kind: early | ontime | late | missing | pending (not yet due)."""
        if kind in ("missing", "pending"):
            return
        when = {"early": due - timedelta(days=rnd.randint(1, 4)), "ontime": due, "late": due + timedelta(days=rnd.randint(1, 3))}[kind]
        at = ts(when, rnd.randint(7, 16), rnd.choice([5, 20, 35, 50]))
        store.save_report(self.db, task_id, uid, "Submission", description="Attached as requested.",
                          link_url=f"https://drive.google.com/demo/{task_id}-{uid}",
                          status=rnd.choice(["Completed", "Completed", "Pending"]), receiver_id=reviewer, date=at)
        self.x("INSERT INTO task_log (submission_date, personnel_id, task_id) VALUES (?,?,?)", (at, uid, task_id))

    def outcome(self, due: date):
        if due > TODAY:
            return rnd.choice(["early", "pending", "pending", "pending"])
        return rnd.choices(["early", "ontime", "late", "missing"], weights=[3, 5, 2, 1])[0]

    def new_task(self, title, instructions, category, start: date, due: date) -> int:
        return store.create_task(self.db, {"title": title, "instructions": instructions, "task_category": category,
                                           "start_date": start.isoformat(), "end_date": due.isoformat(),
                                           "due_time": "5:00 PM", "created_by": self.uid["principal"]})

    def common_tasks(self):
        p = self.uid["principal"]
        for title, due, instr in [
            ("Weekly Lesson Plans (DLL) – Week 10", date(2026, 8, 21), "Submit your Daily Lesson Logs for Week 10."),
            ("Updated Class Record – Term 1", date(2026, 9, 18), "Submit your updated class records for Term 1."),
            ("Brigada Eskwela Accomplishment Photos", date(2026, 6, 12), "Upload photos of your classroom after Brigada Eskwela."),
            ("School Form 2 (Daily Attendance) – October", date(2026, 11, 5), "Submit SF2 for October."),
            ("Reading Remediation Progress Report", date(2026, 11, 13), "Report your learners' Phil-IRI progress."),
            ("Classroom Inventory", date(2026, 11, 20), "Submit the inventory of your classroom furniture and equipment."),
            ("Weekly Lesson Plans (DLL) – Week 22", date(2026, 11, 27), "Submit your Daily Lesson Logs for Week 22."),
        ]:
            tid = self.new_task(title, instr, "common", due - timedelta(days=7), due)
            for t in self.teachers():
                store.assign(self.db, tid, t, p, "teacher")
                self.submit(tid, t, due, p, self.outcome(due))

    def calendar_tasks(self):
        """The school calendar's tasks, planned and posted exactly as the app does it."""
        import calendar_plan
        import calendar_tasks
        entries = [
            {"title": "Opening of Classes", "start_date": "2026-06-16", "end_date": "2026-06-16"},
            {"title": "PTA Meeting & Distribution of Report Cards", "start_date": "2026-09-09", "end_date": "2026-09-09"},
            {"title": "End of Term 1", "start_date": "2026-09-15", "end_date": "2026-09-15"},
            {"title": "Term 2: First Teacher-made Summative Test", "start_date": "2026-10-07", "end_date": "2026-10-07"},
            {"title": "End of Testing Window for MOSY Assessments (CRLA, RMA, Phil-IRI, etc.)", "start_date": "2026-10-19", "end_date": "2026-10-23"},
            {"title": "Term 2: Second Teacher-made Summative Test", "start_date": "2026-10-29", "end_date": "2026-10-29"},
            {"title": "Second Quarter Examination", "start_date": "2026-12-14", "end_date": "2026-12-15"},
            {"title": "End of Term 2", "start_date": "2026-12-18", "end_date": "2026-12-18"},
            {"title": "Bonifacio Day", "start_date": "2026-11-30", "end_date": "2026-11-30"},
        ]
        rows = [p for p in calendar_plan.plan_calendar_tasks(entries) if p["kind"] == "report"]
        first = self.x("SELECT COALESCE(MAX(id), 0) AS m FROM task").fetchone()["m"]
        calendar_tasks.post_calendar_tasks(self.db, {"sub": str(self.uid["principal"]), "role": "principal"}, rows,
                                           "DepEd School Calendar SY 2026-2027")
        for a in self.x("""SELECT ta.task_id, ta.user_id, ta.assigned_by, t.end_date FROM task_assignments ta
                           JOIN task t ON t.id = ta.task_id WHERE ta.task_id > ?""", (first,)).fetchall():
            due = date.fromisoformat(a["end_date"])
            self.submit(a["task_id"], a["user_id"], due, a["assigned_by"], self.outcome(due))

    def special_tasks(self):
        p = self.uid["principal"]
        teachers = self.teachers()
        for title, due in [("Prepare the school's Reading Month program", date(2026, 8, 28)), ("Document the Science Fair", date(2026, 9, 25)),
                           ("Lead the Teachers' Day committee", date(2026, 10, 5)), ("Draft the Christmas program script", date(2026, 12, 11)),
                           ("Update the school website news", date(2026, 10, 30)), ("Coordinate the Nutrition Month contest", date(2026, 7, 24))]:
            for who in rnd.sample(teachers, 3):
                tid = self.new_task(title, f"{title}. Attach your output.", "special", due - timedelta(days=14), due)
                store.assign(self.db, tid, who, p, "teacher")
                kind = self.outcome(due)
                self.submit(tid, who, due, p, kind)
                if due < TODAY and kind != "missing" and rnd.random() < 0.7:
                    self.x("""INSERT INTO special_task_evaluation (task_id, evaluator_id, completion_quality_score, timeliness_score,
                              initiative_score, remarks, evaluated_at) VALUES (?,?,?,?,?,?,?)""",
                           (tid, p, rnd.randint(3, 5), rnd.randint(3, 5), rnd.randint(3, 5),
                            rnd.choice(["Well done.", "Good work, submitted complete.", "Needs more photos next time."]),
                            ts(due + timedelta(days=3))))

    # ── Events ────────────────────────────────────────────────────────────────
    def event(self, title, day: date, status, by, venue, pin=None, twg=None, nature="Co-curricular"):
        matrix = [{"day": long(day), "time": "8:00-10:00 AM", "event": "Opening Program", "speaker": "School Principal"},
                  {"day": long(day), "time": "10:00 AM-12:00 PM", "event": "Main Activity", "speaker": "Focal Person"}]
        payload = {
            "title": title, "nature": nature, "target_date": long(day), "venue": venue, "proposed_budget": "PHP 15,000.00",
            "fund_source": "MOOE", "focal_name": "Grace Tan", "focal_role": "School Coordinator", "focal_contact": "+63 912 000 0002",
            "expected_outputs": json.dumps(["Program documentation", "Attendance and evaluation results"]),
            "participants": json.dumps({"rows": [{"category": "Teachers", "male": 8, "female": 22},
                                                 {"category": "Learners", "male": 120, "female": 135}]}),
            "rationale": f"{title} supports the school's learning goals and community involvement.",
            "objectives": "Engage learners and parents\nShowcase learner outputs\nStrengthen school-community ties",
            "phase1": json.dumps([{"stage": "Pre-Implementation Stage", "activities": "Planning\nPreparation of materials"},
                                  {"stage": "Implementation", "activities": "Conduct of the activity"},
                                  {"stage": "Post-Implementation", "activities": "Evaluation and reporting"}]),
            "activity_matrix": json.dumps(matrix),
            "training_materials": json.dumps([{"item": "Certificates", "qty": "50", "cost": "20", "total": "1000"}]),
            "snacks": json.dumps([{"item": "Snacks", "pax": "60", "cost": "50", "total": "3000"}]),
            "exec_committee": json.dumps([{"name": "Liza Ramos", "position": "Chairperson"}]),
            "twg_groups": json.dumps(twg or []),
            "monitoring_criteria": "Observe participation and the quality of outputs.",
            "indicators": json.dumps([{"label": "Learners actively participated"}, {"label": "The program started on time"},
                                      {"label": "Outputs met the objectives"}]),
            "comments": json.dumps({"signatories": [{"role": "Noted", "name": "Liza Ramos", "title": "School Principal"}]}),
            "venue_latitude": pin[0] if pin else None, "venue_longitude": pin[1] if pin else None,
            "venue_radius_m": pin[2] if pin else None,
        }
        ev = save_event(self.db, payload, status=status, created_by=by)
        self.x("UPDATE event SET created_at=? WHERE id=?", (ts(day - timedelta(days=30)), ev))
        return ev

    def review(self, ev, decision, comment, when: date):
        self.x("INSERT INTO event_review (event_id, reviewer_id, decision, comment, created_at) VALUES (?,?,?,?,?)",
               (ev, self.uid["principal"], decision, comment, ts(when, 9)))

    def events(self):
        coord, coord2 = self.uid["coordinator1"], self.uid["coordinator2"]
        teachers = self.teachers()
        twg = [{"title": "Program Committee", "members": [
            {"name": "Teacher A", "designation": "Chair", "tor": "Leads the program", "output": "Program flow",
             "user_id": teachers[0], "automate_special_task": True},
            {"name": "Teacher B", "designation": "Member", "tor": "Documentation", "output": "Photo documentation",
             "user_id": teachers[1], "automate_special_task": False}]}]
        # Completed, with attendance (personnel and guests) and evaluations.
        for title, day in [("Nutrition Month Culminating Program", date(2026, 7, 31)), ("Buwan ng Wika Celebration", date(2026, 8, 28)),
                           ("World Teachers' Day Celebration", date(2026, 10, 5))]:
            ev = self.event(title, day, "completed", coord, "School Covered Court", (*VENUE, 100), twg=twg)
            self.review(ev, "approved", None, day - timedelta(days=20))
            member = self.x("""SELECT m.id FROM event_committee_member m JOIN event_committee c ON c.id = m.committee_id
                               WHERE c.event_id=? AND m.automate=0""", (ev,)).fetchone()["id"]
            self.x("INSERT INTO committee_credit (member_id, score, created_by) VALUES (?, 5.0, ?)", (member, self.uid["principal"]))
            for t in rnd.sample(teachers, 12):
                aid = store.time_in(self.db, ev, 0, ts(day, 7, rnd.randint(45, 59)), {"user_id": t}, *VENUE, rnd.randint(5, 80))
                store.time_out(self.db, aid, ts(day, 10, rnd.randint(0, 10)), *VENUE, rnd.randint(5, 80))
                store.claim_evaluation(self.db, aid, ts(day, 10, rnd.randint(11, 30)))
            for i in range(6):
                f, l = next(self.names)
                aid = store.time_in(self.db, ev, 0, ts(day, 7, 52), {
                    "guest_name": f"{f} {l}", "guest_email": f"{f.lower()}{i}@gmail.com",
                    "guest_role": rnd.choice(["parent", "student", "visitor"]), "guest_sex": rnd.choice(["Male", "Female"]),
                    "guest_age_group": rnd.choice(["25-34", "35-44", "17 and below"]), "guest_consent_at": ts(day, 7, 50)})
                store.time_out(self.db, aid, ts(day, 10, 5))
            for i in range(rnd.randint(8, 15)):
                f, l = next(self.names)
                eid = store.add_evaluation(self.db, ev, name=f"{f} {l}", role=rnd.choice(["parent", "student", "teacher"]),
                                           scores=[rnd.randint(3, 5) for _ in range(6)], sex=rnd.choice(["Male", "Female"]),
                                           age_group=rnd.choice(["25-34", "35-44"]), email=f"{f.lower()}.{i}@gmail.com",
                                           feedback=rnd.choice(["Very organized!", "Enjoyed it.", "Start on time next year."]))
                self.x("UPDATE evaluation SET date_submitted=? WHERE id=?", (ts(day, 11, i), eid))
        # Upcoming and approved, with a pinned venue.
        for title, day in [("Science and Math Fair", date(2026, 11, 20)), ("Christmas Program", date(2026, 12, 17))]:
            ev = self.event(title, day, "approved", coord2, "School Gymnasium", (13.6245, 123.1858, 150), twg=twg)
            self.review(ev, "approved", None, TODAY - timedelta(days=rnd.randint(3, 10)))
        # Waiting for the principal.
        for title, day in [("Reading Month Storytelling Contest", date(2026, 11, 26)), ("Parenting Seminar", date(2027, 1, 22))]:
            self.event(title, day, "pending_approval", coord, "Library")
        # Sent back.
        ev = self.event("Intramurals 2026", date(2026, 12, 3), "revisions_requested", coord2, "Covered Court")
        self.review(ev, "revisions_requested", "Add the referees to the Activity Matrix and itemize the medal budget.", TODAY - timedelta(days=2))
        ev = self.event("Overnight Camping (Grade 6)", date(2026, 12, 5), "rejected", coord, "School Grounds")
        self.review(ev, "rejected", "Overnight activities need a Division memo and parent consent forms first.", TODAY - timedelta(days=4))
        self.event("Arts Month Exhibit", date(2027, 2, 12), "draft", coord, "Room 101")

    # ── Notifications ─────────────────────────────────────────────────────────
    def notifications(self):
        for uname in ["principal", "coordinator1", "dean1", "g1t1", "g2t1"]:
            for title, kind in [("New task: Classroom Inventory", "task"), ("Event approved: Science and Math Fair", "event"),
                                ("Reminder: SF2 for October is due", "general")]:
                nid = store.notify(self.db, self.uid[uname], kind, title)
                self.x("UPDATE notification SET is_read=? WHERE id=?", (rnd.choice([0, 1]), nid))

    def run(self):
        self.school_years()
        self.staff()
        self.common_tasks()
        self.calendar_tasks()
        self.special_tasks()
        self.events()
        self.notifications()


def main():
    init_db()
    db = connect_db()
    try:
        if db.execute("SELECT 1 FROM section LIMIT 1").fetchone():
            raise SystemExit("This database already has demo data (sections exist). Seed only a fresh database.")
        Seeder(db).run()
        db.commit()
        counts = {t: db.execute(f"SELECT COUNT(*) AS c FROM {t}").fetchone()["c"] for t in
                  ("personnel", "section", "section_teachers", "task", "task_assignments", "report", "event", "attendance", "evaluation")}
        print("Demo data created:", counts)
    finally:
        db.close()


if __name__ == "__main__":
    main()

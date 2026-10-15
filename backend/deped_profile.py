"""DepEd-aligned personnel profiling reference data.

Grounded in the DepEd Qualification Standards (QS), the Philippine Professional
Standards for Teachers (PPST) and the Results-Based Performance Management
System (RPMS). These lists drive three things:

  * the dropdown options for a person's educational background,
  * the seeded SKILL / SKILL_CATEGORY and CERTIFICATION / CERTIFICATION_ISSUER
    catalogs, and
  * the task keywords each category maps to when assignees are suggested
    (see qualifications.score_candidates).

`task_keywords` are plain words/phrases; a category "fits" a task when any one
of its phrases appears in the task's title, subject or instructions.
"""

# ── 1. Educational qualifications (EDUCATION_BACKGROUND) ──────────────────────

# Ordered lowest → highest; the index is the attainment rank used for scoring.
HIGHEST_ATTAINMENT = [
    "Bachelor's Degree",
    "With Master's Units",
    "Master's Degree (CAR/Full)",
    "With Doctoral Units",
    "Doctoral Degree (EdD/PhD)",
]

UNDERGRADUATE_DEGREES = [
    "BEEd – Generalist",
    "BEEd – Early Childhood Education",
    "BEEd – Special Needs Education",
    "BSEd",
    "Bachelor's Degree + TCP/DPE (18 Professional Ed Units)",
]
# Degrees giving foundational training for elementary curriculum work.
ELEMENTARY_DEGREES = {d for d in UNDERGRADUATE_DEGREES if d.startswith("BEEd")}

# Area of specialization → task phrases it is the lead teacher for.
SPECIALIZATIONS = {
    "General Curriculum": [],
    "Early Childhood Education": ["kindergarten", "kinder", "early childhood", "preschool", "ecce"],
    "Special Needs Education (SNEd)": ["sped", "special needs", "special education", "inclusive",
                                       "inclusion", "disability", "sned"],
    "English": ["english", "spelling bee", "oratorical", "declamation", "storytelling"],
    "Filipino": ["filipino", "wika", "pagbasa", "sabayang pagbigkas", "talumpati"],
    "Mathematics": ["math", "mathematics", "numeracy", "mtap"],
    "Science": ["science", "stem", "investigatory", "experiment", "science fair"],
    "MAPEH": ["mapeh", "music", "arts", "physical education", "health", "sports",
              "intramurals", "dance"],
    "Araling Panlipunan": ["araling panlipunan", "social studies", "history", "civics"],
    "TLE/EPP": ["tle", "epp", "livelihood", "home economics", "agriculture", "gulayan",
                "cooking", "entrepreneurship"],
    "Values Education": ["values", "esp", "edukasyon sa pagpapakatao", "character education"],
}

# Tasks where higher attainment matters: lead evaluators, research chairs,
# academic committee heads.
LEADERSHIP_KEYWORDS = ["evaluator", "evaluation", "judge", "judging", "research", "chair",
                       "chairperson", "head", "lead", "committee", "panel", "validator",
                       "validation"]
ATTAINMENT_BONUS = [0.0, 2.0, 4.0, 5.0, 6.0]   # by HIGHEST_ATTAINMENT index

# Tasks where a postgraduate program focus matters: governance committees,
# strategic planning, administrative report drafting.
GOVERNANCE_KEYWORDS = ["committee", "governance", "planning", "strategic", "school improvement",
                       "sip", "aip", "report", "management", "policy", "budget"]

# Tasks where elementary curriculum training matters.
CURRICULUM_KEYWORDS = ["curriculum", "lesson", "instruction", "learning material", "module",
                       "class", "teaching"]

# ── 2. Professional eligibility & certifications (CERTIFICATION) ──────────────

# (name, acronym)
CERTIFICATION_ISSUERS = [
    ("Professional Regulation Commission", "PRC"),
    ("Civil Service Commission", "CSC"),
    ("National Educators Academy of the Philippines", "NEAP"),
    ("Technical Education and Skills Development Authority", "TESDA"),
    ("Philippine Red Cross", None),
    ("Municipal Disaster Risk Reduction and Management Office", "MDRRMO"),
    ("DepEd Disaster Risk Reduction and Management Service", "DepEd DRRMS"),
]

# name → task phrases certified personnel are auto-matched to.
CERTIFICATION_CATEGORIES = {
    # Prerequisite for role-based permissions, not task matching.
    "Professional Eligibility": [],
    "NEAP-Accredited Training": ["inset", "in-service training", "training", "workshop",
                                 "seminar", "facilitator", "trainer", "webinar",
                                 "learning action cell", "lac session", "orientation"],
    "Technical & Vocational": ["computer", "ict", "laptop", "printer", "network", "repair",
                               "troubleshoot", "technical support", "graphic", "poster",
                               "tarpaulin", "layout", "stage", "sound system", "audio",
                               "logistics", "setup"],
    "Health, Safety & Disaster Risk": ["safety", "emergency", "first aid", "clinic", "medical",
                                       "triage", "health", "drill", "earthquake", "fire",
                                       "evacuation", "disaster", "intramurals", "sports fest",
                                       "field trip", "campus-wide", "event"],
}

# (name, category, issuer name)
CERTIFICATIONS = [
    ("Licensure Examination for Teachers (LET)", "Professional Eligibility",
     "Professional Regulation Commission"),
    ("Professional Board Examination for Teachers (PBET)", "Professional Eligibility",
     "Professional Regulation Commission"),
    ("Licensed Professional Teacher", "Professional Eligibility",
     "Professional Regulation Commission"),
    ("Civil Service Professional Eligibility", "Professional Eligibility",
     "Civil Service Commission"),
    ("Higher-Order Thinking Skills (HOTS) Facilitator", "NEAP-Accredited Training",
     "National Educators Academy of the Philippines"),
    ("Early Language, Literacy, and Numeracy (ELLN)", "NEAP-Accredited Training",
     "National Educators Academy of the Philippines"),
    ("Comprehensive Sexuality Education (CSE) Core Trainer", "NEAP-Accredited Training",
     "National Educators Academy of the Philippines"),
    ("Trainers Methodology Level I (TM I)", "Technical & Vocational",
     "Technical Education and Skills Development Authority"),
    ("NC II in Computer Systems Servicing", "Technical & Vocational",
     "Technical Education and Skills Development Authority"),
    ("NC II in Visual Graphic Design", "Technical & Vocational",
     "Technical Education and Skills Development Authority"),
    ("National Certificate II in Events Management", "Technical & Vocational",
     "Technical Education and Skills Development Authority"),
    ("Standard First Aid", "Health, Safety & Disaster Risk", "Philippine Red Cross"),
    ("Basic Life Support", "Health, Safety & Disaster Risk", "Philippine Red Cross"),
    ("School Disaster Risk Reduction & Management (SDRRM) Officer",
     "Health, Safety & Disaster Risk", "DepEd Disaster Risk Reduction and Management Service"),
]

# Certificate reader (certificate_reader.py): what each certification is, and
# other wordings it appears under on actual certificates.
CERTIFICATION_INFO = {
    "Licensure Examination for Teachers (LET)": (
        "Professional license for teachers in the Philippines, granted after passing the "
        "Licensure Examination for Teachers administered by the PRC.",
        ["licensure examination for teachers", "professional teacher", "board of professional teachers"]),
    "Professional Board Examination for Teachers (PBET)": (
        "The board examination for teachers that preceded the LET; holders are recognized "
        "as licensed professional teachers.",
        ["professional board examination for teachers", "pbet"]),
    "Licensed Professional Teacher": (
        "PRC registration as a professional teacher (license / professional ID).",
        ["professional teacher", "certificate of registration"]),
    "Civil Service Professional Eligibility": (
        "Civil Service Commission eligibility for second-level (professional) government "
        "positions, earned by passing the Career Service Professional examination.",
        ["career service professional", "civil service eligibility", "professional eligibility"]),
    "Higher-Order Thinking Skills (HOTS) Facilitator": (
        "NEAP-accredited training qualifying the teacher to facilitate Higher-Order Thinking "
        "Skills professional development sessions.",
        ["higher-order thinking skills", "higher order thinking skills", "hots"]),
    "Early Language, Literacy, and Numeracy (ELLN)": (
        "DepEd/NEAP training program on teaching early language, literacy and numeracy in "
        "Kindergarten to Grade 3.",
        ["early language, literacy and numeracy", "early language literacy and numeracy", "elln"]),
    "Comprehensive Sexuality Education (CSE) Core Trainer": (
        "NEAP-accredited core trainer for DepEd's Comprehensive Sexuality Education program.",
        ["comprehensive sexuality education"]),
    "Trainers Methodology Level I (TM I)": (
        "TESDA qualification certifying the holder to conduct competency-based technical-"
        "vocational training and assessment.",
        ["trainers methodology", "tm i", "tm1"]),
    "NC II in Computer Systems Servicing": (
        "TESDA National Certificate II for installing, configuring and maintaining computer "
        "systems and networks.",
        ["computer systems servicing", "css nc ii"]),
    "NC II in Visual Graphic Design": (
        "TESDA National Certificate II for producing graphic layouts, posters and digital "
        "visual materials.",
        ["visual graphic design"]),
    "National Certificate II in Events Management": (
        "TESDA National Certificate II for planning, coordinating and running events.",
        ["events management services", "events management"]),
    "Standard First Aid": (
        "Philippine Red Cross training in giving first aid for injuries and emergencies.",
        ["standard first aid", "first aid training"]),
    "Basic Life Support": (
        "Training in CPR and life support for cardiac and breathing emergencies.",
        ["basic life support", "cardiopulmonary resuscitation", "bls"]),
    "School Disaster Risk Reduction & Management (SDRRM) Officer": (
        "DepEd designation/training for leading the school's disaster preparedness, drills "
        "and emergency response.",
        ["disaster risk reduction", "drrm", "sdrrm"]),
    "Google Certified Educator": (
        "Google for Education certification in using Google tools for teaching.",
        ["google certified educator"]),
    "Basic Scouting Leadership": (
        "Boy Scouts of the Philippines leadership training for scout leaders.",
        ["basic training course", "scout leaders", "basic scouting"]),
}

# Other names issuers appear under on certificates.
ISSUER_ALIASES = {
    "Professional Regulation Commission": ["professional regulation commission"],
    "Civil Service Commission": ["civil service commission"],
    "National Educators Academy of the Philippines": ["national educators academy", "neap"],
    "Technical Education and Skills Development Authority": [
        "technical education and skills development authority", "tesda"],
    "Philippine Red Cross": ["philippine red cross", "red cross"],
    "Municipal Disaster Risk Reduction and Management Office": [
        "disaster risk reduction and management office", "mdrrmo"],
    "DepEd Disaster Risk Reduction and Management Service": [
        "disaster risk reduction and management service", "drrms"],
    "Google for Education": ["google for education", "google"],
    "Boy Scouts of the Philippines": ["boy scouts of the philippines", "bsp"],
}

# ── 3. Skills taxonomy (SKILL & SKILL_CATEGORY), aligned with PPST domains ─────

# name → (description, task phrases, skills)
SKILL_CATEGORIES = {
    "Instructional & Curriculum Design": (
        "Writing supplementary learning materials, reading assessment tools (Phil-IRI), "
        "test construction, and classroom action research.",
        ["lesson", "learning module", "learning material", "curriculum", "instruction",
         "reading", "remediation", "remedial", "phil-iri", "assessment", "exam", "test",
         "quiz", "action research", "academic exhibit", "worksheet"],
        ["Learning Module Development", "Exam Authoring", "Test Construction",
         "Reading Remediation", "Phil-IRI Reading Assessment", "Action Research"],
    ),
    "ICT & Digital Operations": (
        "Managing DepEd digital portals (LIS, e-BEIS, e-RPMS), Canva/Photoshop poster "
        "design, livestream broadcasting, and network troubleshooting.",
        ["lis", "beis", "rpms", "portal", "encode", "encoding", "online", "digital",
         "computer", "network", "internet", "poster", "tarpaulin", "layout", "canva",
         "livestream", "live stream", "video", "photo", "upload"],
        ["DepEd LIS Management", "e-BEIS Encoding", "DepEd e-RPMS Portal",
         "Graphic Design & Layout", "Live Stream Audio/Video", "Network Troubleshooting"],
    ),
    "Event Operations & Logistics": (
        "Emceeing/program hosting, stage and venue setup, audio/visual mixing, program "
        "flow coordination, and ceremonial protocol.",
        ["event", "program", "ceremony", "celebration", "graduation", "recognition",
         "moving up", "intramurals", "fest", "festival", "contest", "competition", "stage",
         "venue", "sound system", "audio", "emcee", "host", "usher", "protocol",
         "decoration"],
        ["Sound System & A/V", "Stage Decoration", "Master of Ceremonies",
         "Protocol & Ushering", "Venue Setup", "Program Flow Coordination"],
    ),
    "Administrative Governance & Compliance": (
        "Annual Procurement Plan (APP) drafting, school fund liquidation, property "
        "inventory tracking, and committee documentation.",
        ["liquidation", "fund", "mooe", "procurement", "budget", "property", "inventory",
         "custodian", "minutes", "memo", "memorandum", "documentation", "committee",
         "compliance", "sdrrm", "drrm", "drill"],
        ["DepEd Liquidation", "Property Custodianship", "Minutes & Memo Drafting",
         "SDRRM Coordination", "Annual Procurement Plan Drafting", "Committee Documentation"],
    ),
}

# Skills from earlier builds, mapped onto the taxonomy above.
LEGACY_SKILL_CATEGORY = {
    "Events": "Event Operations & Logistics",
    "Sports": "Event Operations & Logistics",
    "Student Activities": "Event Operations & Logistics",
    "Media": "ICT & Digital Operations",
    "Technology": "ICT & Digital Operations",
    "Communication": "Instructional & Curriculum Design",
    "Academic": "Instructional & Curriculum Design",
    "Safety": "Administrative Governance & Compliance",
}
LEGACY_ISSUER_ALIASES = {"TESDA": "Technical Education and Skills Development Authority"}


# ── Per-item task keywords ────────────────────────────────────────────────────
# What kind of task each skill / certification equips a person for. A task
# "uses" the item when its text contains one of these phrases (all words of
# the phrase, stemmed). Stored one row per keyword (skill_keywords,
# certification_keywords) and used by qualifications.score_candidates.

SKILL_KEYWORDS = {
    "Event Hosting": ["event", "program", "host", "emcee", "ceremony", "celebration",
                      "recognition", "graduation", "moving up"],
    "Photography": ["photo", "photography", "pictorial", "camera", "photo documentation",
                    "event coverage"],
    "Layout Design": ["layout", "poster", "tarpaulin", "banner", "brochure", "newsletter",
                      "certificate design", "program design"],
    "Sports Coaching": ["sports", "intramurals", "athletics", "sports fest", "palaro",
                        "tournament", "varsity", "coach", "physical fitness", "sportsfest"],
    "Disaster Preparedness": ["drill", "earthquake drill", "fire drill", "evacuation",
                              "disaster", "emergency", "typhoon", "safety"],
    "ICT Troubleshooting": ["computer", "laptop", "printer", "projector", "internet",
                            "network", "technical support", "repair", "troubleshoot"],
    "Journalism": ["school paper", "newsletter", "press conference", "campus journalism",
                   "article", "news", "feature writing", "schools press"],
    "Editing": ["editing", "proofread", "editorial", "publication", "newsletter"],
    "Reading Remediation": ["reading", "remediation", "remedial", "struggling readers",
                            "literacy", "reading program"],
    "Curriculum Planning": ["curriculum", "lesson plan", "budget of work", "syllabus",
                            "learning competencies", "instructional plan"],
    "Data Analysis": ["data", "statistics", "analysis", "survey", "item analysis",
                      "enrollment data", "assessment results"],
    "Video Editing": ["video", "documentary", "audio visual presentation", "avp", "montage",
                      "video editing"],
    "Mentoring": ["mentor", "mentoring", "new teacher", "induction", "peer coaching",
                  "coaching"],
    "Assessment Design": ["assessment", "test", "exam", "quiz", "rubric",
                          "table of specifications", "periodical"],
    "Scouting": ["scouting", "boy scouts", "girl scouts", "camping", "jamboree", "campout",
                 "investiture"],
    "Learning Module Development": ["module", "learning material", "worksheet",
                                    "activity sheet", "self learning module"],
    "Exam Authoring": ["exam", "periodical test", "quarterly exam", "test questions"],
    "Test Construction": ["test", "table of specifications", "item analysis", "quiz"],
    "Phil-IRI Reading Assessment": ["phil iri", "reading assessment", "reading test",
                                    "reading level"],
    "Action Research": ["action research", "research", "research proposal", "innovation"],
    "DepEd LIS Management": ["lis", "learner information system", "enrollment",
                             "learner records", "school forms"],
    "e-BEIS Encoding": ["beis", "ebeis", "school data", "encoding", "enrollment data"],
    "DepEd e-RPMS Portal": ["rpms", "ipcrf", "performance rating", "portfolio"],
    "Graphic Design & Layout": ["graphic", "poster", "tarpaulin", "layout", "canva", "banner",
                                "infographic", "certificate design"],
    "Live Stream Audio/Video": ["livestream", "live stream", "streaming", "facebook live",
                                "online broadcast", "video coverage", "zoom"],
    "Network Troubleshooting": ["network", "internet", "wifi", "router", "connectivity"],
    "Sound System & A/V": ["sound system", "audio", "microphone", "speaker", "projector",
                           "lights", "lighting"],
    "Stage Decoration": ["stage", "decoration", "backdrop", "venue design", "decor"],
    "Master of Ceremonies": ["emcee", "host", "master of ceremonies", "program"],
    "Protocol & Ushering": ["usher", "protocol", "guests", "reception", "registration",
                            "seating"],
    "Venue Setup": ["venue", "setup", "chairs", "tents", "logistics", "room arrangement"],
    "Program Flow Coordination": ["program flow", "program", "schedule", "rundown",
                                  "coordination", "run of show"],
    "DepEd Liquidation": ["liquidation", "mooe", "fund", "cash advance", "disbursement",
                          "financial report"],
    "Property Custodianship": ["property", "inventory", "equipment", "supplies", "custodian"],
    "Minutes & Memo Drafting": ["minutes", "memo", "memorandum", "letter", "communication"],
    "SDRRM Coordination": ["drrm", "sdrrm", "drill", "disaster", "evacuation", "earthquake",
                           "emergency"],
    "Annual Procurement Plan Drafting": ["procurement", "annual procurement plan", "purchase",
                                         "canvass", "supplies", "budget"],
    "Committee Documentation": ["documentation", "committee", "minutes",
                                "accomplishment report", "narrative report"],
}

_TEACHING_TASKS = ["demonstration teaching", "demo teaching", "class observation",
                   "classroom observation", "substitute teaching", "lesson plan"]

CERTIFICATION_KEYWORDS = {
    "National Certificate II in Events Management": [
        "event", "program", "celebration", "ceremony", "graduation", "intramurals", "fest",
        "venue", "logistics", "event management"],
    "Standard First Aid": [
        "first aid", "first aider", "clinic", "injury", "emergency", "medical", "health",
        "sports fest", "intramurals", "field trip", "athletics"],
    "Basic Life Support": [
        "cpr", "first aid", "emergency", "medical", "life support", "swimming", "health"],
    "Licensed Professional Teacher": _TEACHING_TASKS,
    "Licensure Examination for Teachers (LET)": _TEACHING_TASKS,
    "Professional Board Examination for Teachers (PBET)": _TEACHING_TASKS,
    "Google Certified Educator": [
        "google classroom", "online class", "blended learning", "ict integration",
        "google", "digital learning"],
    "Basic Scouting Leadership": [
        "scouting", "scouts", "camping", "jamboree", "campout", "investiture"],
    "Civil Service Professional Eligibility": [
        "administrative", "records", "office", "government", "documentation"],
    "Higher-Order Thinking Skills (HOTS) Facilitator": [
        "hots", "higher order thinking", "critical thinking", "training", "workshop", "inset",
        "facilitator", "lac session"],
    "Early Language, Literacy, and Numeracy (ELLN)": [
        "literacy", "numeracy", "reading", "early grades", "kinder", "beginning reading"],
    "Comprehensive Sexuality Education (CSE) Core Trainer": [
        "sexuality education", "cse", "adolescent", "health education", "gender",
        "values education", "orientation"],
    "Trainers Methodology Level I (TM I)": [
        "training", "trainer", "workshop", "inset", "facilitator", "seminar", "session"],
    "NC II in Computer Systems Servicing": [
        "computer", "laptop", "printer", "repair", "troubleshoot", "network", "ict",
        "technical support"],
    "NC II in Visual Graphic Design": [
        "poster", "tarpaulin", "layout", "graphic", "banner", "infographic",
        "certificate design"],
    "School Disaster Risk Reduction & Management (SDRRM) Officer": [
        "drrm", "sdrrm", "drill", "disaster", "evacuation", "earthquake", "fire", "emergency",
        "safety"],
}

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

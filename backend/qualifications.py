"""Personnel profiling (education, skills, certifications, number of children)
and the assignee-suggestion scoring that uses it.

Reference data (dropdown options, taxonomy, task keyword mappings) lives in
deped_profile.py. Skills and certifications are catalogs (skills →
skill_categories; certifications → certification_categories +
certification_issuers). Skills are linked through user_skills and picked from
the catalog; a person holds a certification when they have a submitted or
verified certificate file for it (certificate_files).

When a task is being assigned each candidate gets a FIT SCORE out of 100:

  Competency match   0-60  profile signals below, scaled (COMPETENCY_FULL raw
                           points = 60)
  Active workload    0-30  minus WORKLOAD_STEP per open task and per upcoming
                           approved event the person is running
  Life-context guard 0-10  minus points when the task is off-hours (weekend,
                           before 7 AM / after 5 PM, or multi-day) and the
                           person has children or elderly/infant
                           care at home, unless they opted in to overtime

A person is flagged with a burden level (low / moderate / high) from their
workload and any life-context conflict, so the assigner sees it before
choosing them.

Competency signals, scored against the task text (title + subject +
instructions). Strong signals (they make a person a "match"):

  + SPECIALIZATION_WEIGHT     area of specialization fits the task (primary key)
  + CERT_WEIGHT  * match      a certification named in the task, or (x0.8)
                              a task its keywords say it suits (Standard First
                              Aid -> "clinic", "sports fest"); scaled by credibility
  + SKILL_WEIGHT * match      a skill named in the task, or (x0.8) a task its
                              keywords say it suits (Sports Coaching -> "intramurals")

Supporting signals:

  + CERT_CATEGORY_WEIGHT      a held certification's category maps to the task
                              (e.g. Health & Safety → events, drills, clinic)
  + SKILL_CATEGORY_WEIGHT     a held skill's category maps to the task
  + attainment bonus          evaluator / research chair / committee-head tasks
  + POSTGRAD_*                governance, planning and report-drafting tasks
  + ELEMENTARY_DEGREE_WEIGHT  BEEd holders on curriculum tasks

`match` is the fraction of a name's keywords found in the task text, so
"Standard First Aid" partly matches a task mentioning "first aid training".
"""
import re
from datetime import date, datetime
from typing import Iterable, List, Optional

from pydantic import BaseModel

import deped_profile as dp

SPECIALIZATION_WEIGHT = 12.0
CERT_WEIGHT = 15.0
SKILL_WEIGHT = 10.0
CERT_CATEGORY_WEIGHT = 6.0
SKILL_CATEGORY_WEIGHT = 4.0
POSTGRAD_FOCUS_WEIGHT = 8.0       # postgraduate focus named in the task
POSTGRAD_GOVERNANCE_WEIGHT = 5.0  # any postgraduate focus on a governance task
ELEMENTARY_DEGREE_WEIGHT = 3.0
MIN_MATCH = 0.5            # a name counts once half its keywords appear
KEYWORD_MATCH = 0.8        # task fits one of the item's keywords (vs. naming it)

# How much a certification counts, by how credible it is: verified by the
# principal/registrar counts fully; an uploaded certificate awaiting review
# counts by how well it passed the automated pre-validation checks.
CREDIBILITY_WEIGHT = {
    "verified": 1.0,
    "submitted:high": 0.7, "submitted:medium": 0.5, "submitted:low": 0.25,
}
CREDIBILITY_LABEL = {
    "verified": "verified",
    "submitted": "pending review",
}

COMPETENCY_MAX = 60
COMPETENCY_FULL = 20.0     # raw competency points that earn the full 60
WORKLOAD_MAX = 30
WORKLOAD_STEP = 6          # per open task / upcoming event
LIFE_MAX = 10
CHILDREN_GUARD = 5         # off-hours task, has children
CARE_GUARD = 5             # off-hours task, elderly/infant care at home
DAY_START, DAY_END = 7, 17  # regular school hours (24h clock)
HIGH_BURDEN_ITEMS = 4      # open tasks + events that make the burden "high"

_STOPWORDS = {
    "the", "and", "for", "with", "from", "into", "this", "that", "are", "was",
    "will", "shall", "all", "any", "our", "your", "their", "its", "per", "via",
    "task", "tasks", "please", "submit", "submission", "school", "grade",
}
_SUFFIXES = ("ations", "ation", "ings", "ing", "ies", "ers", "er", "ed", "es", "s")


def _stem(word: str) -> str:
    for suf in _SUFFIXES:
        if word.endswith(suf) and len(word) - len(suf) >= 4:
            return word[: -len(suf)]
    return word


def keywords(text: Optional[str]) -> set:
    words = re.findall(r"[a-z0-9]+", (text or "").lower())
    return {_stem(w) for w in words if len(w) >= 3 and w not in _STOPWORDS}


def _same_word(a: str, b: str) -> bool:
    """Word forms of the same word: equal, or (for words of 5+ letters) one
    starts with the other or they share a long common start, so "photo",
    "photography" and "photographic" all match. Short words must be equal."""
    if a == b:
        return True
    short, long_ = sorted((a, b), key=len)
    if len(short) < 5:
        return False
    if long_.startswith(short):
        return True
    common = 0
    for x, y in zip(a, b):
        if x != y:
            break
        common += 1
    return common >= 6 and common >= 0.8 * len(short)


def _match(name: str, task_words: set) -> float:
    q = keywords(name)
    if not q:
        return 0.0
    hits = sum(1 for w in q if w in task_words or any(_same_word(w, t) for t in task_words))
    return hits / len(q)


def _fits(phrases: Iterable[str], task_words: set) -> bool:
    """True when any whole phrase (all of its keywords) appears in the task."""
    return any(_match(p, task_words) == 1.0 for p in phrases)


def clean_list(items: Optional[Iterable[str]]) -> List[str]:
    """Trim, drop blanks, and de-duplicate case-insensitively (first spelling wins)."""
    seen, out = set(), []
    for item in items or []:
        s = (item or "").strip()
        if s and s.lower() not in seen:
            seen.add(s.lower())
            out.append(s)
    return out


# ── Catalog seed / legacy migration ───────────────────────────────────────────

def _id(db, table: str, column: str, name: str) -> Optional[int]:
    row = db.execute(f"SELECT id FROM {table} WHERE {column}=?", (name,)).fetchone()
    return row[0] if row else None


def _get_or_create(db, table: str, column: str, name: str) -> int:
    # Name columns are COLLATE NOCASE, so "first aid" reuses "First Aid".
    db.execute(f"INSERT OR IGNORE INTO {table} ({column}) VALUES (?)", (name,))
    return _id(db, table, column, name)


def _set_keywords(db, table: str, owner_id: int, keywords,
                  owner_col: str = "category_id") -> None:
    """Make an item's keyword rows match the taxonomy (one row per keyword)."""
    wanted = {k.strip() for k in keywords if k.strip()}
    have = {r[0] for r in db.execute(f"SELECT keyword FROM {table} WHERE {owner_col}=?",
                                     (owner_id,))}
    for kw in have - wanted:
        db.execute(f"DELETE FROM {table} WHERE {owner_col}=? AND keyword=?", (owner_id, kw))
    for kw in wanted - have:
        db.execute(f"INSERT OR IGNORE INTO {table} ({owner_col}, keyword) VALUES (?,?)",
                   (owner_id, kw))


def seed_taxonomy(db):
    """Upsert the DepEd taxonomy. Existing catalog items only get blanks filled,
    so it is safe to run on every startup. Caller owns the commit."""
    for name, (desc, kws, _skills) in dp.SKILL_CATEGORIES.items():
        db.execute("""INSERT INTO skill_categories (category_name, description) VALUES (?,?)
                      ON CONFLICT(category_name) DO UPDATE SET description=excluded.description""",
                   (name, desc))
        _set_keywords(db, "skill_category_keywords",
                      _id(db, "skill_categories", "category_name", name), kws)
    for name, kws in dp.CERTIFICATION_CATEGORIES.items():
        db.execute("INSERT OR IGNORE INTO certification_categories (category_name) VALUES (?)",
                   (name,))
        _set_keywords(db, "certification_category_keywords",
                      _id(db, "certification_categories", "category_name", name), kws)
    for name, acronym in dp.CERTIFICATION_ISSUERS:
        db.execute("""INSERT INTO certification_issuers (issuer_name, acronym) VALUES (?,?)
                      ON CONFLICT(issuer_name) DO UPDATE
                      SET acronym=COALESCE(acronym, excluded.acronym)""", (name, acronym))

    for cat, (_d, _k, skills) in dp.SKILL_CATEGORIES.items():
        cat_id = _id(db, "skill_categories", "category_name", cat)
        for s in skills:
            db.execute("""INSERT INTO skills (skill_name, category_id) VALUES (?,?)
                          ON CONFLICT(skill_name) DO UPDATE
                          SET category_id=COALESCE(category_id, excluded.category_id)""",
                       (s, cat_id))
    for name, cat, issuer in dp.CERTIFICATIONS:
        db.execute("""INSERT INTO certifications (cert_name, category_id, issuer_id) VALUES (?,?,?)
                      ON CONFLICT(cert_name) DO UPDATE
                      SET category_id=COALESCE(category_id, excluded.category_id),
                          issuer_id=COALESCE(issuer_id, excluded.issuer_id)""",
                   (name, _id(db, "certification_categories", "category_name", cat),
                    _id(db, "certification_issuers", "issuer_name", issuer)))

    # What tasks each catalog skill / certification suits.
    for name, kws in dp.SKILL_KEYWORDS.items():
        sid = _id(db, "skills", "skill_name", name)
        if sid is not None:
            _set_keywords(db, "skill_keywords", sid, kws, owner_col="skill_id")
    for name, kws in dp.CERTIFICATION_KEYWORDS.items():
        cid = _id(db, "certifications", "cert_name", name)
        if cid is not None:
            _set_keywords(db, "certification_keywords", cid, kws, owner_col="certification_id")


def migrate_legacy_catalog(db):
    """Earlier builds kept a free-text skills.category and
    certifications.issuing_body; map them onto the taxonomy tables, then drop
    the old columns. Caller owns the commit."""
    skill_cols = [r[1] for r in db.execute("PRAGMA table_info(skills)")]
    cert_cols = [r[1] for r in db.execute("PRAGMA table_info(certifications)")]
    if "category" not in skill_cols and "issuing_body" not in cert_cols:
        return
    seed_taxonomy(db)
    if "category" in skill_cols:
        for sid, old in db.execute(
                "SELECT id, category FROM skills WHERE category IS NOT NULL").fetchall():
            new = dp.LEGACY_SKILL_CATEGORY.get(old, old)
            db.execute("UPDATE skills SET category_id=COALESCE(category_id, ?) WHERE id=?",
                       (_get_or_create(db, "skill_categories", "category_name", new), sid))
        db.execute("ALTER TABLE skills DROP COLUMN category")
    if "issuing_body" in cert_cols:
        for cid, body in db.execute(
                "SELECT id, issuing_body FROM certifications WHERE issuing_body IS NOT NULL"
        ).fetchall():
            body = dp.LEGACY_ISSUER_ALIASES.get(body, body)
            row = db.execute("SELECT id FROM certification_issuers "
                             "WHERE issuer_name=? OR acronym=?", (body, body)).fetchone()
            iid = row[0] if row else _get_or_create(db, "certification_issuers",
                                                    "issuer_name", body)
            db.execute("UPDATE certifications SET issuer_id=COALESCE(issuer_id, ?) WHERE id=?",
                       (iid, cid))
        db.execute("ALTER TABLE certifications DROP COLUMN issuing_body")


# ── Persistence ───────────────────────────────────────────────────────────────

_EDU_FIELDS = ("highest_attainment", "undergraduate_degree", "specialization",
               "postgraduate_focus")
_EDU_OPTIONS = {
    "highest_attainment": dp.HIGHEST_ATTAINMENT,
    "undergraduate_degree": dp.UNDERGRADUATE_DEGREES,
    "specialization": list(dp.SPECIALIZATIONS),
}


def education_options() -> dict:
    return {k: list(v) for k, v in _EDU_OPTIONS.items()}


def get_qualifications(db, uid: int) -> dict:
    skills = [dict(r) for r in db.execute(
        """SELECT s.skill_name AS name, sc.category_name AS category
           FROM user_skills us JOIN skills s ON s.id = us.skill_id
           LEFT JOIN skill_categories sc ON sc.id = s.category_id
           WHERE us.user_id=? ORDER BY us.id""", (uid,))]
    # A person holds a certification when they have a submitted or verified
    # certificate file for it (rejected / unconfirmed uploads don't count).
    certs = [dict(r) for r in db.execute(
        """SELECT c.id AS certification_id, c.cert_name AS name, cc.category_name AS category,
                  ci.issuer_name AS issuer, ci.acronym AS issuer_acronym
           FROM certifications c
           LEFT JOIN certification_categories cc ON cc.id = c.category_id
           LEFT JOIN certification_issuers ci ON ci.id = c.issuer_id
           WHERE c.id IN (SELECT certification_id FROM certificate_files
                          WHERE user_id=? AND status IN ('submitted','verified'))
           ORDER BY c.cert_name""", (uid,))]
    for c in certs:
        c.update(certification_credibility(db, uid, c["certification_id"]))
    edu = db.execute(
        f"SELECT {', '.join(_EDU_FIELDS)} FROM education_background WHERE user_id=?", (uid,)
    ).fetchone()
    return {
        "skills": [s["name"] for s in skills],
        "certifications": [c["name"] for c in certs],
        "skill_details": skills,
        "certification_details": certs,
        "education": dict(edu) if edu else {f: None for f in _EDU_FIELDS},
    }


def validate_catalog_names(db, skills: Optional[Iterable[str]] = None,
                           certifications: Optional[Iterable[str]] = None):
    """Raise ValueError naming any skill/certification not in the catalog."""
    for label, items, table, col in (("skill", skills, "skills", "skill_name"),
                                     ("certification", certifications,
                                      "certifications", "cert_name")):
        unknown = [n for n in clean_list(items) if _id(db, table, col, n) is None]
        if unknown:
            raise ValueError(f"Unknown {label}(s): {', '.join(unknown)}. "
                             f"Choose from the {label} list.")


def certification_credibility(db, uid: int, certification_id: int) -> dict:
    """{credibility, authenticity, certificate_id} from the person's best
    certificate file for this certification (verified before awaiting review)."""
    rows = db.execute(
        """SELECT id, status FROM certificate_files
           WHERE user_id=? AND certification_id=? AND status IN ('submitted','verified')""",
        (uid, certification_id)).fetchall()
    best = min(rows, key=lambda r: 0 if r["status"] == "verified" else 1)
    from certificate_reader import authenticity_of
    return {"credibility": best["status"], "authenticity": authenticity_of(db, best["id"]),
            "certificate_id": best["id"]}


def credibility_weight(cert: dict) -> float:
    cred = cert.get("credibility")
    key = f"submitted:{cert.get('authenticity') or 'low'}" if cred == "submitted" else cred
    return CREDIBILITY_WEIGHT.get(key, 0.0)


def set_skills(db, uid: int, skills: Iterable[str]):
    """Replace a user's skill list with catalog skills (call
    validate_catalog_names first). Caller owns the commit."""
    db.execute("DELETE FROM user_skills WHERE user_id=?", (uid,))
    for s in clean_list(skills):
        sid = _id(db, "skills", "skill_name", s)
        if sid is not None:
            db.execute("INSERT OR IGNORE INTO user_skills (user_id, skill_id) VALUES (?,?)",
                       (uid, sid))


class EducationBody(BaseModel):
    """Request body for a person's educational background. Omitted fields are
    left unchanged; an empty string clears one."""
    highest_attainment: Optional[str] = None
    undergraduate_degree: Optional[str] = None
    specialization: Optional[str] = None
    postgraduate_focus: Optional[str] = None


def validate_education(education: dict):
    """Raise ValueError for a dropdown value outside the DepEd option lists."""
    for f, options in _EDU_OPTIONS.items():
        v = (education.get(f) or "").strip()
        if v and v not in options:
            raise ValueError(f"Invalid {f.replace('_', ' ')}: {v}")


def set_education(db, uid: int, education: dict):
    """Upsert the fields present in `education` (empty string clears one).
    Call validate_education first. Caller owns the commit."""
    vals = {f: ((education[f] or "").strip() or None)
            for f in _EDU_FIELDS if education.get(f) is not None}
    if not vals:
        return
    # A postgraduate focus only applies from "With Master's Units" up.
    if "highest_attainment" in vals:
        attainment = vals["highest_attainment"]
    else:
        row = db.execute("SELECT highest_attainment FROM education_background WHERE user_id=?",
                         (uid,)).fetchone()
        attainment = row[0] if row else None
    if attainment not in dp.HIGHEST_ATTAINMENT[1:]:
        vals["postgraduate_focus"] = None
    db.execute("INSERT OR IGNORE INTO education_background (user_id) VALUES (?)", (uid,))
    db.execute(
        f"UPDATE education_background SET {', '.join(f'{k}=?' for k in vals)}, "
        "updated_at=CURRENT_TIMESTAMP WHERE user_id=?", list(vals.values()) + [uid])


# ── Suggestion scoring ────────────────────────────────────────────────────────

def _open_task_count(db, uid: int, window=None) -> int:
    """Active tasks assigned to the person that they haven't submitted yet,
    counting only the current school year (archived years are not workload)."""
    from school_calendar import task_in_window
    rows = db.execute(
        """SELECT t.end_date, t.start_date, t.created_at FROM task_assignments ta
           JOIN tasks t ON t.id = ta.task_id
           WHERE ta.user_id=? AND t.status='active'
             AND NOT EXISTS (SELECT 1 FROM reports r
                             WHERE r.task_id=ta.task_id AND r.personnel_id=ta.user_id)""",
        (uid,)).fetchall()
    return sum(1 for r in rows if window is None or task_in_window(window, r))


def _upcoming_event_count(db, uid: int) -> int:
    """Approved events this person proposed/runs that haven't happened yet."""
    from date_utils import parse_event_date
    today = date.today()
    n = 0
    for (target,) in db.execute(
            "SELECT target_date FROM events WHERE created_by=? AND status='approved'", (uid,)):
        d = parse_event_date(target) if target else None
        if d and d >= today:
            n += 1
    return n


def _parse_day(value: Optional[str]) -> Optional[date]:
    try:
        return datetime.strptime((value or "").strip()[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _parse_hour(value: Optional[str]) -> Optional[float]:
    v = (value or "").strip().upper()
    for fmt in ("%I:%M %p", "%H:%M", "%I %p"):
        try:
            t = datetime.strptime(v, fmt)
            return t.hour + t.minute / 60
        except ValueError:
            continue
    return None


def task_timing(start_date: Optional[str], end_date: Optional[str],
                due_time: Optional[str], task_category: str = "common") -> dict:
    """Why a task falls outside regular duties (for the life-context guard):
    {off_hours: [reasons], multi_day, weekend, late}."""
    start, end = _parse_day(start_date), _parse_day(end_date)
    hour = _parse_hour(due_time)
    days = [d for d in (start, end) if d]
    weekend = any(d.weekday() >= 5 for d in days)
    multi_day = bool(start and end and (end - start).days >= 1)
    late = hour is not None and (hour >= DAY_END or hour < DAY_START)
    why = []
    if weekend:
        why.append("on a weekend")
    if late:
        why.append("outside school hours")
    if multi_day:
        why.append("spans several days")
    return {"off_hours": why, "weekend": weekend, "late": late, "multi_day": multi_day}


def _item_keywords(db, table: str, owner_col: str, name_table: str, name_col: str) -> dict:
    """{skill / certification name: [task keywords]}."""
    out = {}
    for name, kw in db.execute(
            f"""SELECT n.{name_col}, k.keyword FROM {table} k
                JOIN {name_table} n ON n.id = k.{owner_col}"""):
        out.setdefault(name, []).append(kw)
    return out


def _fitting_keyword(phrases: Iterable[str], task_words: set) -> Optional[str]:
    """The first keyword phrase found in the task (longest first), or None."""
    for p in sorted(phrases, key=len, reverse=True):
        if _match(p, task_words) == 1.0:
            return p
    return None


def _item_fit(name: str, item_keywords: Iterable[str], task_words: set) -> tuple:
    """(strength 0-1, keyword that fit or None) for one skill/certification:
    the stronger of the task naming it and the task matching one of its
    keywords."""
    m = _match(name, task_words)
    by_name = m if m >= MIN_MATCH else 0.0
    kw = _fitting_keyword(item_keywords, task_words) if by_name < 1.0 else None
    if kw and KEYWORD_MATCH > by_name:
        return KEYWORD_MATCH, kw
    return by_name, None


def _category_keywords(db, table: str) -> dict:
    """{category name: [keywords]} from the category's keyword rows."""
    out = {r[0]: [] for r in db.execute(f"SELECT category_name FROM {table}")}
    for name, kw in db.execute(
            f"""SELECT c.category_name, k.keyword FROM {table} c
                JOIN {table[:-len('ies')]}y_keywords k ON k.category_id = c.id"""):
        out[name].append(kw)
    return out


def score_candidates(db, candidates: List[dict], task_text: str,
                     task_category: str = "common", timing: Optional[dict] = None) -> List[dict]:
    """Return the candidates (dicts with at least `id`) enriched with their
    profile, fit score (0-100) and its three parts, `reasons` (why they fit),
    `load_factors` and a burden level, best fit first."""
    task_words = keywords(task_text)
    timing = timing or task_timing(None, None, None, task_category)
    from school_calendar import resolve_window
    window = resolve_window(db, "current")
    skill_cat_kw = _category_keywords(db, "skill_categories")
    cert_cat_kw = _category_keywords(db, "certification_categories")
    skill_kw = _item_keywords(db, "skill_keywords", "skill_id", "skills", "skill_name")
    cert_kw = _item_keywords(db, "certification_keywords", "certification_id",
                             "certifications", "cert_name")
    leadership_task = _fits(dp.LEADERSHIP_KEYWORDS, task_words)
    governance_task = _fits(dp.GOVERNANCE_KEYWORDS, task_words)
    curriculum_task = _fits(dp.CURRICULUM_KEYWORDS, task_words)

    out = []
    for cand in candidates:
        uid = cand["id"]
        prof = get_qualifications(db, uid)
        edu = prof["education"]
        life = db.execute(
            """SELECT number_of_children, has_elderly_or_infant_care, overtime_opt_in
               FROM users WHERE id=?""", (uid,)).fetchone()
        children = life[0] or 0
        has_care, opt_in = bool(life[1]), bool(life[2])
        open_tasks = _open_task_count(db, uid, window)
        upcoming_events = _upcoming_event_count(db, uid)
        score, reasons, load = 0.0, [], []

        # Strong signals
        spec = edu.get("specialization")
        spec_match = bool(spec) and (
            _fits(dp.SPECIALIZATIONS.get(spec, []), task_words)
            or _match(spec, task_words) == 1.0)
        if spec_match:
            score += SPECIALIZATION_WEIGHT
            reasons.append(f"Specialization: {spec}")

        # Certifications count by credibility (see CREDIBILITY_WEIGHT); the
        # reason says how credible each one is.
        matched_certs, by_cred = [], {}
        for c in prof["certification_details"]:
            weight = credibility_weight(c)
            if weight <= 0:
                continue
            strength, kw = _item_fit(c["name"], cert_kw.get(c["name"], []), task_words)
            if strength:
                score += CERT_WEIGHT * strength * weight
                matched_certs.append(c["name"])
                by_cred.setdefault(c["credibility"], []).append(
                    f"{c['name']} (fits “{kw}”)" if kw else c["name"])
        for cred in ("verified", "submitted"):
            if by_cred.get(cred):
                reasons.append(f"Certified ({CREDIBILITY_LABEL[cred]}): " + ", ".join(by_cred[cred]))

        matched_skills, skill_labels = [], []
        for s in prof["skill_details"]:
            strength, kw = _item_fit(s["name"], skill_kw.get(s["name"], []), task_words)
            if strength:
                score += SKILL_WEIGHT * strength
                matched_skills.append(s["name"])
                skill_labels.append(f"{s['name']} (fits “{kw}”)" if kw else s["name"])
        if matched_skills:
            reasons.append("Skilled in: " + ", ".join(skill_labels))

        # Supporting signals: category → task mapping, counted once per
        # category, for items not already matched by name.
        related_certs = []
        for label, items, matched, kw, weight in (
                ("certification", prof["certification_details"], matched_certs,
                 cert_cat_kw, CERT_CATEGORY_WEIGHT),
                ("skills", prof["skill_details"], matched_skills,
                 skill_cat_kw, SKILL_CATEGORY_WEIGHT)):
            by_cat = {}
            for it in items:
                if it["category"] and it["name"] not in matched:
                    # Certifications only count as credibly as they are held.
                    w = credibility_weight(it) if label == "certification" else 1.0
                    if w > 0:
                        by_cat.setdefault(it["category"], []).append((it["name"], w))
            for cat, entries in by_cat.items():
                if _fits(kw.get(cat, []), task_words):
                    score += weight * max(w for _, w in entries)
                    reasons.append(f"Related {label} ({cat}): {', '.join(n for n, _ in entries)}")
                    if label == "certification":
                        related_certs.extend(n for n, _ in entries)

        attainment = edu.get("highest_attainment")
        if leadership_task and attainment in dp.HIGHEST_ATTAINMENT:
            bonus = dp.ATTAINMENT_BONUS[dp.HIGHEST_ATTAINMENT.index(attainment)]
            if bonus:
                score += bonus
                reasons.append(f"{attainment} — suited to evaluator/committee lead roles")

        focus = edu.get("postgraduate_focus")
        if focus:
            if _match(focus, task_words) >= MIN_MATCH:
                score += POSTGRAD_FOCUS_WEIGHT
                reasons.append(f"Postgraduate focus: {focus}")
            elif governance_task:
                score += POSTGRAD_GOVERNANCE_WEIGHT
                reasons.append(f"Postgraduate focus ({focus}) — governance/planning task")

        if curriculum_task and edu.get("undergraduate_degree") in dp.ELEMENTARY_DEGREES:
            score += ELEMENTARY_DEGREE_WEIGHT
            reasons.append(f"{edu['undergraduate_degree']} — elementary curriculum training")

        # ── Fit score: competency 0-60 + workload 0-30 + life context 0-10 ──
        competency = round(min(COMPETENCY_MAX, max(0.0, score) / COMPETENCY_FULL
                               * COMPETENCY_MAX), 1)

        items = open_tasks + upcoming_events
        workload = max(0, WORKLOAD_MAX - WORKLOAD_STEP * items)
        if open_tasks:
            load.append(f"{open_tasks} open {'task' if open_tasks == 1 else 'tasks'}")
        if upcoming_events:
            load.append(f"runs {upcoming_events} upcoming "
                        f"{'event' if upcoming_events == 1 else 'events'}")

        life_points, conflicts = LIFE_MAX, []
        off = timing["off_hours"]
        if off and not opt_in:
            if children:
                life_points -= CHILDREN_GUARD
                conflicts.append(f"{children} {'child' if children == 1 else 'children'} "
                                 f"(off-hours task)")
            if has_care:
                life_points -= CARE_GUARD
                conflicts.append("family care at home (off-hours task)")
        elif off and opt_in and (children or has_care):
            reasons.append("Opted in to tasks beyond regular hours")
        load.extend(conflicts)

        if items >= HIGH_BURDEN_ITEMS or (conflicts and items >= 2) or len(conflicts) == 2:
            burden = "high"
        elif items >= 2 or conflicts:
            burden = "moderate"
        else:
            burden = "low"

        out.append({
            **cand,
            **prof,
            "number_of_children": children,
            "open_tasks": open_tasks,
            "matched_skills": matched_skills,
            "matched_certifications": matched_certs,
            "related_certifications": related_certs,
            "specialization_match": spec_match,
            "is_match": bool(spec_match or matched_skills or matched_certs),
            "score": round(competency + workload + life_points, 1),
            "fit": {"competency": competency, "workload": workload,
                    "life_context": life_points},
            "upcoming_events": upcoming_events,
            "burden": burden,
            "off_hours": off,
            "reasons": reasons,
            "load_factors": load,
        })
    # People whose profile fits the task come first (ordered by fit score, so
    # workload and life context decide between them); the rest follow.
    out.sort(key=lambda d: (d["fit"]["competency"] <= 0, -d["score"], d.get("full_name") or ""))
    return out

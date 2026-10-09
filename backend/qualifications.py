"""Personnel profiling (education, skills, certifications, number of children)
and the assignee-suggestion scoring that uses it.

Reference data (dropdown options, taxonomy, task keyword mappings) lives in
deped_profile.py. Skills and certifications are catalogs (skills →
skill_categories; certifications → certification_categories +
certification_issuers) linked to personnel through user_skills /
user_certifications. A person's skills and certifications are picked from the
catalogs (dropdowns); names outside the catalog are rejected.

When a task is being assigned each candidate is scored against the task text
(title + subject + instructions). Strong signals (they make a person a "match"):

  + SPECIALIZATION_WEIGHT     area of specialization fits the task (primary key)
  + CERT_WEIGHT  * match      a certification named in the task
  + SKILL_WEIGHT * match      a skill named in the task

Supporting signals:

  + CERT_CATEGORY_WEIGHT      a held certification's category maps to the task
                              (e.g. Health & Safety → events, drills, clinic)
  + SKILL_CATEGORY_WEIGHT     a held skill's category maps to the task
  + attainment bonus          evaluator / research chair / committee-head tasks
  + POSTGRAD_*                governance, planning and report-drafting tasks
  + ELEMENTARY_DEGREE_WEIGHT  BEEd holders on curriculum tasks

Load factors (lower the rank):

  - children penalty          heavier for 'special' tasks (outside regular duties)
  - workload penalty          open (not yet completed) active tasks

`match` is the fraction of a name's keywords found in the task text, so
"Standard First Aid" partly matches a task mentioning "first aid training".
"""
import re
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

CHILD_PENALTY = {"special": 2.0, "common": 1.0}
MAX_CHILDREN_COUNTED = 4
OPEN_TASK_PENALTY = 1.0
MAX_OPEN_TASKS_COUNTED = 5

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


def _match(name: str, task_words: set) -> float:
    q = keywords(name)
    if not q:
        return 0.0
    return len(q & task_words) / len(q)


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


def seed_taxonomy(db):
    """Upsert the DepEd taxonomy. Existing catalog items only get blanks filled,
    so it is safe to run on every startup. Caller owns the commit."""
    for name, (desc, kws, _skills) in dp.SKILL_CATEGORIES.items():
        db.execute("""INSERT INTO skill_categories (category_name, description, task_keywords)
                      VALUES (?,?,?) ON CONFLICT(category_name) DO UPDATE
                      SET description=excluded.description,
                          task_keywords=excluded.task_keywords""",
                   (name, desc, ", ".join(kws)))
    for name, kws in dp.CERTIFICATION_CATEGORIES.items():
        db.execute("""INSERT INTO certification_categories (category_name, task_keywords)
                      VALUES (?,?) ON CONFLICT(category_name) DO UPDATE
                      SET task_keywords=excluded.task_keywords""", (name, ", ".join(kws)))
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
    certs = [dict(r) for r in db.execute(
        """SELECT c.cert_name AS name, cc.category_name AS category,
                  ci.issuer_name AS issuer, ci.acronym AS issuer_acronym
           FROM user_certifications uc JOIN certifications c ON c.id = uc.certification_id
           LEFT JOIN certification_categories cc ON cc.id = c.category_id
           LEFT JOIN certification_issuers ci ON ci.id = c.issuer_id
           WHERE uc.user_id=? ORDER BY uc.id""", (uid,))]
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


def set_skills(db, uid: int, skills: Iterable[str]):
    """Replace a user's skill list with catalog skills (call
    validate_catalog_names first). Caller owns the commit."""
    db.execute("DELETE FROM user_skills WHERE user_id=?", (uid,))
    for s in clean_list(skills):
        sid = _id(db, "skills", "skill_name", s)
        if sid is not None:
            db.execute("INSERT OR IGNORE INTO user_skills (user_id, skill_id) VALUES (?,?)",
                       (uid, sid))


def set_certifications(db, uid: int, certifications: Iterable[str]):
    """Replace a user's certification list with catalog certifications (call
    validate_catalog_names first). Caller owns the commit."""
    db.execute("DELETE FROM user_certifications WHERE user_id=?", (uid,))
    for c in clean_list(certifications):
        cid = _id(db, "certifications", "cert_name", c)
        if cid is not None:
            db.execute("INSERT OR IGNORE INTO user_certifications "
                       "(user_id, certification_id) VALUES (?,?)", (uid, cid))


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
    db.execute("INSERT OR IGNORE INTO education_background (user_id) VALUES (?)", (uid,))
    db.execute(
        f"UPDATE education_background SET {', '.join(f'{k}=?' for k in vals)}, "
        "updated_at=CURRENT_TIMESTAMP WHERE user_id=?", list(vals.values()) + [uid])


# ── Suggestion scoring ────────────────────────────────────────────────────────

def _open_task_count(db, uid: int) -> int:
    return db.execute(
        """SELECT COUNT(*) FROM task_assignments ta
           JOIN tasks t ON t.id = ta.task_id
           WHERE ta.user_id=? AND t.status='active'
             AND NOT EXISTS (SELECT 1 FROM reports r
                             WHERE r.task_id=ta.task_id AND r.personnel_id=ta.user_id
                               AND r.report_status='Completed')""",
        (uid,),
    ).fetchone()[0]


def _category_keywords(db, table: str) -> dict:
    return {r[0]: [k.strip() for k in (r[1] or "").split(",") if k.strip()]
            for r in db.execute(f"SELECT category_name, task_keywords FROM {table}")}


def score_candidates(db, candidates: List[dict], task_text: str,
                     task_category: str = "common") -> List[dict]:
    """Return the candidates (dicts with at least `id`) enriched with their
    profile, score, `reasons` (why they fit) and `load_factors` (what lowers
    them), best match first."""
    task_words = keywords(task_text)
    child_weight = CHILD_PENALTY.get(task_category, CHILD_PENALTY["common"])
    skill_cat_kw = _category_keywords(db, "skill_categories")
    cert_cat_kw = _category_keywords(db, "certification_categories")
    leadership_task = _fits(dp.LEADERSHIP_KEYWORDS, task_words)
    governance_task = _fits(dp.GOVERNANCE_KEYWORDS, task_words)
    curriculum_task = _fits(dp.CURRICULUM_KEYWORDS, task_words)

    out = []
    for cand in candidates:
        uid = cand["id"]
        prof = get_qualifications(db, uid)
        edu = prof["education"]
        children = db.execute(
            "SELECT number_of_children FROM users WHERE id=?", (uid,)
        ).fetchone()[0] or 0
        open_tasks = _open_task_count(db, uid)
        score, reasons, load = 0.0, [], []

        # Strong signals
        spec = edu.get("specialization")
        spec_match = bool(spec) and (
            _fits(dp.SPECIALIZATIONS.get(spec, []), task_words)
            or _match(spec, task_words) == 1.0)
        if spec_match:
            score += SPECIALIZATION_WEIGHT
            reasons.append(f"Specialization: {spec}")

        matched_certs = []
        for c in prof["certification_details"]:
            m = _match(c["name"], task_words)
            if m >= MIN_MATCH:
                score += CERT_WEIGHT * m
                matched_certs.append(c["name"])
        if matched_certs:
            reasons.append("Certified: " + ", ".join(matched_certs))

        matched_skills = []
        for s in prof["skill_details"]:
            m = _match(s["name"], task_words)
            if m >= MIN_MATCH:
                score += SKILL_WEIGHT * m
                matched_skills.append(s["name"])
        if matched_skills:
            reasons.append("Skilled in: " + ", ".join(matched_skills))

        # Supporting signals: category → task mapping, counted once per
        # category, for items not already matched by name.
        for label, items, matched, kw, weight in (
                ("certification", prof["certification_details"], matched_certs,
                 cert_cat_kw, CERT_CATEGORY_WEIGHT),
                ("skills", prof["skill_details"], matched_skills,
                 skill_cat_kw, SKILL_CATEGORY_WEIGHT)):
            by_cat = {}
            for it in items:
                if it["category"] and it["name"] not in matched:
                    by_cat.setdefault(it["category"], []).append(it["name"])
            for cat, names in by_cat.items():
                if _fits(kw.get(cat, []), task_words):
                    score += weight
                    reasons.append(f"Related {label} ({cat}): {', '.join(names)}")

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

        # Load factors
        if children:
            score -= child_weight * min(children, MAX_CHILDREN_COUNTED)
            load.append(f"{children} {'child' if children == 1 else 'children'}")
        if open_tasks:
            score -= OPEN_TASK_PENALTY * min(open_tasks, MAX_OPEN_TASKS_COUNTED)
            load.append(f"{open_tasks} open {'task' if open_tasks == 1 else 'tasks'}")

        out.append({
            **cand,
            **prof,
            "number_of_children": children,
            "open_tasks": open_tasks,
            "matched_skills": matched_skills,
            "matched_certifications": matched_certs,
            "specialization_match": spec_match,
            "is_match": bool(spec_match or matched_skills or matched_certs),
            "score": round(score, 2),
            "reasons": reasons,
            "load_factors": load,
        })
    out.sort(key=lambda d: (-d["score"], not d["is_match"], d.get("full_name") or ""))
    return out

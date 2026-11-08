"""Personnel profiling (education, skills, certifications) and the
assignee-suggestion scoring that uses it.

Reference data (dropdown options, taxonomy, task keyword mappings) lives in
deped_profile.py. Skills and certifications are catalogs (skills →
skill_categories; certifications → certification_categories +
certification_issuers). Skills are linked through user_skills and picked from
the catalog; a person holds a certification when they have a submitted or
verified certificate file for it (certificate_files).

When a task is being assigned each candidate gets a FIT SCORE out of 100,
from three things only — their certificates, their skills, and how many
tasks they already have (the workload heat map):

  Competency   0-70  certificates and skills that match the task (scaled:
                     COMPETENCY_FULL raw points = 70)
  Workload     0-30  minus WORKLOAD_STEP per assigned task not yet submitted
                     in the current school year

A person is flagged with a burden level (low / moderate / high) from that
workload, so the assigner sees it before choosing them. Education is shown
on the profile but does not count toward the score.

Competency signals, scored against the task text (title + subject +
instructions):

  + CERT_WEIGHT  * match      a certification named in the task, or (x0.8)
                              a task its keywords say it suits (Standard First
                              Aid -> "clinic", "sports fest"); scaled by credibility
  + SKILL_WEIGHT * match      a skill named in the task, or (x0.8) a task its
                              keywords say it suits (Sports Coaching -> "intramurals")
  + CERT_CATEGORY_WEIGHT      a held certification's category maps to the task
                              (e.g. Health & Safety → events, drills, clinic)
  + SKILL_CATEGORY_WEIGHT     a held skill's category maps to the task

`match` is the fraction of a name's keywords found in the task text, so
"Standard First Aid" partly matches a task mentioning "first aid training".
"""
import re
from datetime import date, datetime
from typing import Iterable, List, Optional

from pydantic import BaseModel

import deped_profile as dp

CERT_WEIGHT = 15.0
SKILL_WEIGHT = 10.0
CERT_CATEGORY_WEIGHT = 6.0
SKILL_CATEGORY_WEIGHT = 4.0
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

COMPETENCY_MAX = 70
COMPETENCY_FULL = 20.0     # raw competency points that earn the full 70
WORKLOAD_MAX = 30
WORKLOAD_STEP = 6          # per assigned task not yet submitted
HIGH_BURDEN_ITEMS = 4      # open tasks that make the burden "high"

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
    db.execute(f"INSERT INTO {table} ({column}) VALUES (?) ON CONFLICT DO NOTHING", (name,))
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
        db.execute(f"INSERT INTO {table} ({owner_col}, keyword) VALUES (?,?) ON CONFLICT DO NOTHING",
                   (owner_id, kw))


def seed_taxonomy(db):
    """Upsert the DepEd taxonomy. Existing catalog items only get blanks filled,
    so it is safe to run on every startup. Caller owns the commit."""
    for name, (desc, kws, _skills) in dp.SKILL_CATEGORIES.items():
        db.execute("""INSERT INTO skill_category (category_name, description) VALUES (?,?)
                      ON CONFLICT(category_name) DO UPDATE SET description=excluded.description""", (name, desc))
        _set_keywords(db, "skill_category_keywords",
                      _id(db, "skill_categories", "category_name", name), kws)
    for name, kws in dp.CERTIFICATION_CATEGORIES.items():
        db.execute("INSERT INTO certification_categories (category_name) VALUES (?) "
                   "ON CONFLICT DO NOTHING",
                   (name,))
        _set_keywords(db, "certification_category_keywords",
                      _id(db, "certification_categories", "category_name", name), kws)
    for name, acronym in dp.CERTIFICATION_ISSUERS:
        db.execute("""INSERT INTO certification_issuer (issuer_name, acronym) VALUES (?,?)
                      ON CONFLICT(issuer_name) DO UPDATE
                      SET acronym=COALESCE(certification_issuer.acronym, excluded.acronym)""", (name, acronym))

    for cat, (_d, _k, skills) in dp.SKILL_CATEGORIES.items():
        cat_id = _id(db, "skill_categories", "category_name", cat)
        for s in skills:
            db.execute("""INSERT INTO skill (skill_name, category_id) VALUES (?,?)
                          ON CONFLICT(skill_name) DO UPDATE
                          SET category_id=COALESCE(skill.category_id, excluded.category_id)""", (s, cat_id))
    for name, cat, issuer in dp.CERTIFICATIONS:
        db.execute("""INSERT INTO certification (cert_name, category_id, issuer_id) VALUES (?,?,?)
                      ON CONFLICT(cert_name) DO UPDATE
                      SET category_id=COALESCE(certification.category_id, excluded.category_id),
                          issuer_id=COALESCE(certification.issuer_id, excluded.issuer_id)""",
                   (name, _id(db, "certification_categories", "category_name", cat),
                    _id(db, "certification_issuer", "issuer_name", issuer)))

    # What tasks each catalog skill / certification suits.
    for name, kws in dp.SKILL_KEYWORDS.items():
        sid = _id(db, "skills", "skill_name", name)
        if sid is not None:
            _set_keywords(db, "skill_keywords", sid, kws, owner_col="skill_id")
    for name, kws in dp.CERTIFICATION_KEYWORDS.items():
        cid = _id(db, "certifications", "cert_name", name)
        if cid is not None:
            _set_keywords(db, "certification_keywords", cid, kws, owner_col="certification_id")




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
        sid = _id(db, "skill", "skill_name", s)
        if sid is not None:
            db.execute("INSERT INTO user_skills (user_id, skill_id) VALUES (?,?) "
                       "ON CONFLICT DO NOTHING",
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
    from store import set_education as store_education
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
    store_education(db, uid, vals)


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


def score_candidates(db, candidates: List[dict], task_text: str) -> List[dict]:
    """Return the candidates (dicts with at least `id`) enriched with their
    profile, fit score (0-100) and its two parts, `reasons` (why they fit),
    `load_factors` and a burden level, best fit first."""
    task_words = keywords(task_text)
    from school_calendar import resolve_window
    window = resolve_window(db, "current")
    skill_cat_kw = _category_keywords(db, "skill_categories")
    cert_cat_kw = _category_keywords(db, "certification_categories")
    skill_kw = _item_keywords(db, "skill_keywords", "skill_id", "skills", "skill_name")
    cert_kw = _item_keywords(db, "certification_keywords", "certification_id",
                             "certifications", "cert_name")

    out = []
    for cand in candidates:
        uid = cand["id"]
        prof = get_qualifications(db, uid)
        open_tasks = _open_task_count(db, uid, window)
        score, reasons, load = 0.0, [], []

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

        # ── Fit score: competency 0-70 + workload 0-30 ──
        competency = round(min(COMPETENCY_MAX, max(0.0, score) / COMPETENCY_FULL
                               * COMPETENCY_MAX), 1)
        workload = max(0, WORKLOAD_MAX - WORKLOAD_STEP * open_tasks)
        if open_tasks:
            load.append(f"{open_tasks} open {'task' if open_tasks == 1 else 'tasks'}")
        burden = "high" if open_tasks >= HIGH_BURDEN_ITEMS else "moderate" if open_tasks >= 2 else "low"

        out.append({
            **cand,
            **prof,
            "open_tasks": open_tasks,
            "matched_skills": matched_skills,
            "matched_certifications": matched_certs,
            "related_certifications": related_certs,
            "is_match": bool(matched_skills or matched_certs),
            "score": round(competency + workload, 1),
            "fit": {"competency": competency, "workload": workload},
            "burden": burden,
            "reasons": reasons,
            "load_factors": load,
        })
    # People whose certificates or skills fit the task come first (ordered by
    # fit score, so workload decides between them); the rest follow.
    out.sort(key=lambda d: (d["fit"]["competency"] <= 0, -d["score"], d.get("full_name") or ""))
    return out

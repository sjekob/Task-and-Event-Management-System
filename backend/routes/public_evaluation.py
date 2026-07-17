"""Unauthenticated event-evaluation endpoints reached by scanning the QR code
shown in the Appraisal > Events tab. No login is required here by design —
attendees scan, evaluate, done — so every gate that the Dart UI used to compute
(event-open date, status, per-device throttling) is re-checked here as the actual
security boundary.

The evaluation form is a DepEd "Observation Tool": the indicators come from the
last section of the event's own proposal (events.indicators). Each indicator is
marked Evident / Not Evident with optional remarks. All scoring lives here in
Python — the Dart UI only collects evident/not-evident toggles and ships them up.
"""
import json
import re
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import get_db

router = APIRouter(prefix="/api/appraisal/public", tags=["Public Evaluation"])

# Free-text role label; kept permissive since attendees self-identify. We only
# enforce a sane, known set so the stored data stays tidy.
ALLOWED_EVALUATOR_ROLES = {
    "student", "teacher", "parent", "visitor",
    "dean", "coordinator", "principal", "registrar",
}

# Fallback observation indicators (standard DepEd special-program tool) used only
# when a proposal did not list its own indicators.
DEFAULT_INDICATORS = [
    "The special program has an approved proposal.",
    "The training matrix was observed or was completely delivered.",
    "The number of days were maximized as stated in the training design.",
    "The objectives of the special program were met.",
    "The monitoring and evaluation tools were utilized.",
    "Participants were able to submit the required output.",
    "Attendance was systematically monitored.",
    "The venue was conducive.",
    "The session started and ended on time.",
    "The trainers/facilitators used an appropriate resource package "
    "(pre-tests and post-tests, PowerPoint, video presentation, etc.)",
]

_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _parse_event_date(raw: Optional[str]) -> Optional[date]:
    """Best-effort parse of the free-text target_date field. Mirrors the
    frontend's parseEventDate (date_parse.dart) so the server gate agrees
    with what staff see in the UI: ISO first, then 'Month D, YYYY' style."""
    if not raw or not raw.strip():
        return None
    text = raw.strip()
    try:
        return datetime.fromisoformat(text[:10]).date()
    except ValueError:
        pass
    md = re.search(r"([A-Za-z]{3,9})\.?\s+(\d{1,2})", text)
    ym = re.search(r"(19|20)\d{2}", text)
    if md and ym:
        mon = _MONTHS.get(md.group(1).lower()[:3])
        if mon:
            try:
                return date(int(ym.group(0)), mon, int(md.group(2)))
            except ValueError:
                pass
    return None


def _proposal_indicators(row) -> List[str]:
    """Pull the indicator labels from the event proposal's last section. The
    column stores a JSON array of {"label": "..."} objects (see add_event_screen).
    Falls back to the standard DepEd tool when the proposal listed none."""
    raw = None
    try:
        raw = row["indicators"]
    except (KeyError, IndexError):
        raw = None
    labels: List[str] = []
    if raw:
        try:
            decoded = json.loads(raw)
            if isinstance(decoded, list):
                for d in decoded:
                    if isinstance(d, dict):
                        label = (d.get("label") or "").strip()
                    else:
                        label = str(d).strip()
                    if label:
                        labels.append(label)
        except (ValueError, TypeError):
            pass
    return labels or list(DEFAULT_INDICATORS)


def _organizer_name(row, db) -> Optional[str]:
    """Best-effort organizer label for the form header."""
    try:
        focal = (row["focal_name"] or "").strip()
        if focal:
            return focal
    except (KeyError, IndexError):
        pass
    try:
        created_by = row["created_by"]
    except (KeyError, IndexError):
        created_by = None
    if created_by:
        u = db.execute("SELECT full_name FROM users WHERE id=?", (created_by,)).fetchone()
        if u and u["full_name"]:
            return u["full_name"]
    return None


def _lock_reason(row) -> Optional[str]:
    """None if the event is open for public evaluation, else why it's locked."""
    if row["status"] != "approved":
        return "This event is not yet approved for evaluation."
    event_date = _parse_event_date(row["target_date"])
    if event_date is None:
        return "This event's date has not been confirmed yet."
    if event_date > date.today():
        return f"Evaluation opens on {event_date.isoformat()}."
    return None


@router.get("/events/{event_id}")
def get_public_event(event_id: int, db=Depends(get_db)):
    """Unauthenticated event info + the proposal's observation indicators for the
    QR landing page. The frontend renders these as the Evident / Not Evident tool."""
    row = db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    lock_reason = _lock_reason(row)
    monitoring = None
    try:
        monitoring = row["monitoring_criteria"]
    except (KeyError, IndexError):
        monitoring = None
    return {
        "id": row["id"],
        "title": row["title"],
        "venue": row["venue"],
        "target_date": row["target_date"],
        "organizer_name": _organizer_name(row, db),
        "monitoring_criteria": monitoring,
        "indicators": _proposal_indicators(row),
        "is_open": lock_reason is None,
        "lock_reason": lock_reason,
    }


class IndicatorResult(BaseModel):
    label: str = Field(min_length=1, max_length=500)
    evident: bool


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class PublicEvalBody(BaseModel):
    evaluator_name: Optional[str] = Field(default=None, max_length=120)
    evaluator_email: str = Field(min_length=3, max_length=200)
    evaluator_role: str
    indicators: List[IndicatorResult]
    comments: Optional[str] = Field(default=None, max_length=2000)


def _score_from_indicators(results: List[IndicatorResult]) -> int:
    """Map the Evident/Not Evident checklist to the 1-5 rubric score the
    event_evaluations table expects: Evident counts as 5, Not Evident as 1,
    averaged and rounded. Mirrors the appraisal-branch formula."""
    if not results:
        return 3
    evident = sum(1 for r in results if r.evident)
    avg = (evident * 5.0 + (len(results) - evident) * 1.0) / len(results)
    return max(1, min(5, round(avg)))


def _feedback_text(results: List[IndicatorResult], comments: Optional[str]) -> str:
    parts = []
    for r in results:
        status = "Evident" if r.evident else "Not Evident"
        parts.append(f"{r.label}: {status}")
    if comments and comments.strip():
        parts.append(f"Comments: {comments.strip()}")
    return " | ".join(parts)


@router.post("/events/{event_id}/evaluate", status_code=201)
def submit_public_evaluation(event_id: int, body: PublicEvalBody,
                              db=Depends(get_db)):
    row = db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Event not found")
    lock_reason = _lock_reason(row)
    if lock_reason:
        raise HTTPException(403, lock_reason)

    role = body.evaluator_role.strip().lower()
    if role not in ALLOWED_EVALUATOR_ROLES:
        raise HTTPException(400, f"evaluator_role must be one of {sorted(ALLOWED_EVALUATOR_ROLES)}")

    email = body.evaluator_email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(400, "Please enter a valid email address.")

    if not body.indicators:
        raise HTTPException(400, "At least one indicator must be evaluated.")

    # All evaluation scoring happens server-side: the UI only sends the
    # Evident/Not Evident toggles and remarks.
    score = _score_from_indicators(body.indicators)
    feedback = _feedback_text(body.indicators, body.comments)
    name = (body.evaluator_name or "").strip() or "Anonymous"

    # One evaluation per email per event — the email is the identity we throttle
    # on so an attendee can only evaluate a given event once.
    try:
        db.execute(
            "INSERT INTO public_submission_log (event_id, email) VALUES (?,?)",
            (event_id, email),
        )
    except Exception:
        raise HTTPException(409, "This email has already submitted an evaluation for this event.")

    db.execute(
        """INSERT INTO event_evaluations
           (event_id, evaluator_id, evaluator_name, evaluator_email, evaluator_role,
            planning_score, objectives_score, personnel_score,
            time_mgmt_score, engagement_score, resource_score, feedback_comments)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (event_id, None, name, email, role,
         score, score, score, score, score, score, feedback)
    )
    db.commit()
    return {"message": "Thank you for your feedback!"}

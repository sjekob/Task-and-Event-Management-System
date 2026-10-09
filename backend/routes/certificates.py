"""Certificates: people upload a PDF/photo of a certificate; it is read and
checked automatically (certificate_reader.py), the owner confirms what it is,
and the principal/registrar verifies or rejects it. A certification only joins
the person's profile (and task-assignment suggestions) through this flow, and
how much it counts depends on its credibility (see qualifications.py).

Files are stored outside the public uploads folder and served only to their
owner and to people who manage personnel.
"""
import json
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

import certificate_reader as reader
import audit
import deped_profile as dp
from auth import get_current_user, has_permission
from database import get_db

router = APIRouter(prefix="/api/certificates", tags=["Certificates"])

PRIVATE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "private", "certificates")


def _path_for(uid: int, digest: str, ext: str) -> str:
    folder = os.path.realpath(os.path.join(PRIVATE_DIR, str(uid)))
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, f"{digest}{ext}")


def _user(db, uid: int) -> dict:
    row = db.execute("SELECT id, first_name, last_name, full_name FROM users WHERE id=?",
                     (uid,)).fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    return dict(row)


def _shape(db, row) -> dict:
    d = dict(row)
    d.pop("extracted_text", None)
    d.pop("file_path", None)
    d["checks"] = json.loads(d["checks"]) if d.get("checks") else []
    cert = None
    if d.get("certification_id"):
        cert = db.execute(
            """SELECT c.cert_name, cc.category_name, ci.issuer_name, ci.acronym
               FROM certifications c
               LEFT JOIN certification_categories cc ON cc.id = c.category_id
               LEFT JOIN certification_issuers ci ON ci.id = c.issuer_id
               WHERE c.id=?""", (d["certification_id"],)).fetchone()
    d["title"] = cert["cert_name"] if cert else d.get("detected_title")
    d["category"] = cert["category_name"] if cert else None
    d["issuer"] = cert["issuer_name"] if cert else None
    d["issuer_acronym"] = cert["acronym"] if cert else None
    d["description"] = dp.CERTIFICATION_INFO.get(d["title"] or "", ("", []))[0]
    if d.get("reviewed_by"):
        r = db.execute("SELECT full_name FROM users WHERE id=?", (d["reviewed_by"],)).fetchone()
        d["reviewed_by_name"] = r["full_name"] if r else None
    return d


def _file_row(db, file_id: int):
    row = db.execute("SELECT * FROM certificate_files WHERE id=?", (file_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Certificate not found")
    return row


def _can_review(user: dict) -> bool:
    return has_permission(user, "review_certificates")


def _unlink_if_unbacked(db, uid: int, certification_id: Optional[int]):
    """Drop the profile link when no submitted/verified file backs it any more."""
    if certification_id is None:
        return
    backed = db.execute(
        """SELECT 1 FROM certificate_files WHERE user_id=? AND certification_id=?
             AND status IN ('submitted','verified')""", (uid, certification_id)).fetchone()
    if not backed:
        db.execute("DELETE FROM user_certifications WHERE user_id=? AND certification_id=?",
                   (uid, certification_id))


# ── Owner ─────────────────────────────────────────────────────────────────────

@router.get("/catalog")
def certification_catalog(db=Depends(get_db), user=Depends(get_current_user)):
    """Catalog certifications with issuer, category and what each one is."""
    rows = db.execute(
        """SELECT c.id, c.cert_name, cc.category_name, ci.issuer_name, ci.acronym
           FROM certifications c
           LEFT JOIN certification_categories cc ON cc.id = c.category_id
           LEFT JOIN certification_issuers ci ON ci.id = c.issuer_id
           ORDER BY cc.category_name IS NULL, cc.category_name, c.cert_name""").fetchall()
    return [{**dict(r), "description": dp.CERTIFICATION_INFO.get(r["cert_name"], ("", []))[0]}
            for r in rows]


@router.get("/mine")
def my_certifications(db=Depends(get_db), user=Depends(get_current_user)):
    return _profile_certifications(db, int(user["sub"]))


def _profile_certifications(db, uid: int) -> dict:
    """The person's certifications with credibility, plus uploads awaiting confirmation."""
    files = [_shape(db, r) for r in db.execute(
        "SELECT * FROM certificate_files WHERE user_id=? ORDER BY created_at DESC", (uid,)).fetchall()]
    declared = [dict(r) for r in db.execute(
        """SELECT c.id AS certification_id, c.cert_name AS title, cc.category_name AS category,
                  ci.issuer_name AS issuer, ci.acronym AS issuer_acronym
           FROM user_certifications uc JOIN certifications c ON c.id = uc.certification_id
           LEFT JOIN certification_categories cc ON cc.id = c.category_id
           LEFT JOIN certification_issuers ci ON ci.id = c.issuer_id
           WHERE uc.user_id=?""", (uid,)).fetchall()]
    with_files = {f["certification_id"] for f in files if f["status"] != "pending"}
    self_declared = [{**d, "description": dp.CERTIFICATION_INFO.get(d["title"], ("", []))[0],
                      "status": "self_declared"}
                     for d in declared if d["certification_id"] not in with_files]
    return {
        "certificates": [f for f in files if f["status"] != "pending"],
        "self_declared": self_declared,
        "pending": [f for f in files if f["status"] == "pending"],
    }


@router.post("/analyze", status_code=201)
async def analyze_certificate(file: UploadFile, db=Depends(get_db),
                              user=Depends(get_current_user)):
    """Read and check an uploaded certificate. It is kept as 'pending' until
    the owner confirms what it is."""
    uid = int(user["sub"])
    data = await file.read(reader.MAX_BYTES + 1)
    try:
        result = reader.analyze(db, _user(db, uid), data, file.filename or "")
    except ValueError as e:
        raise HTTPException(400, str(e))
    path = _path_for(uid, result["sha256"], result["ext"])
    with open(path, "wb") as f:
        f.write(data)
    cur = db.execute(
        """INSERT INTO certificate_files
           (user_id, certification_id, file_path, original_name, mime, sha256, extracted_text,
            detected_title, match_confidence, checks, authenticity, status)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending')""",
        (uid, result["certification_id"], path, (file.filename or "")[:200], result["mime"],
         result["sha256"], result["extracted_text"], result["detected_title"],
         result["match_confidence"], json.dumps(result["checks"]), result["authenticity"]))
    db.commit()
    return _shape(db, _file_row(db, cur.lastrowid))


class ConfirmBody(BaseModel):
    certification_id: int = Field(gt=0)


@router.post("/{file_id}/confirm")
def confirm_certificate(file_id: int, body: ConfirmBody, request: Request, db=Depends(get_db),
                        user=Depends(get_current_user)):
    """The owner confirms which certification the file is; it joins their
    profile as 'submitted' (awaiting review by the principal/registrar)."""
    uid = int(user["sub"])
    row = _file_row(db, file_id)
    if row["user_id"] != uid:
        raise HTTPException(403, "This isn't your certificate")
    if row["status"] != "pending":
        raise HTTPException(409, "This certificate was already added")
    checks = json.loads(row["checks"] or "[]")
    if any(c["key"] == "duplicate" and c["status"] == "fail" for c in checks):
        raise HTTPException(409, "This exact file is already on another person's profile.")
    if not db.execute("SELECT 1 FROM certifications WHERE id=?", (body.certification_id,)).fetchone():
        raise HTTPException(400, "Unknown certification")
    db.execute("UPDATE certificate_files SET certification_id=?, status='submitted' WHERE id=?",
               (body.certification_id, file_id))
    db.execute("INSERT OR IGNORE INTO user_certifications (user_id, certification_id) VALUES (?,?)",
               (uid, body.certification_id))
    shaped = _shape(db, _file_row(db, file_id))
    audit.record(db, user, "certificate.submit", "certificate", file_id,
                 f"Submitted certificate {shaped['title']} (automated checks: {row['authenticity']})",
                 entity_label=f"{shaped['title']} — {audit.user_label(db, uid)}",
                 changes={"status": ["pending", "submitted"]}, request=request)
    db.commit()
    return shaped


@router.delete("/{file_id}")
def delete_certificate(file_id: int, request: Request, db=Depends(get_db),
                       user=Depends(get_current_user)):
    uid = int(user["sub"])
    row = _file_row(db, file_id)
    if row["user_id"] != uid:
        raise HTTPException(403, "This isn't your certificate")
    if row["status"] != "pending":  # pending uploads were never on the profile
        title = _shape(db, row)["title"]
        audit.record(db, user, "certificate.remove", "certificate", file_id,
                     f"Removed certificate {title}",
                     entity_label=f"{title} — {audit.user_label(db, uid)}",
                     changes={"status": [row["status"], "removed"]}, request=request)
    db.execute("DELETE FROM certificate_files WHERE id=?", (file_id,))
    if row["status"] != "pending":  # a pending upload never touched the profile
        _unlink_if_unbacked(db, uid, row["certification_id"])
    db.commit()
    if not db.execute("SELECT 1 FROM certificate_files WHERE file_path=?", (row["file_path"],)).fetchone():
        try:
            os.remove(row["file_path"])
        except OSError:
            pass
    return {"message": "Certificate removed"}


@router.delete("/declared/{certification_id}")
def remove_self_declared(certification_id: int, db=Depends(get_db),
                         user=Depends(get_current_user)):
    """Remove a certification listed without a certificate file."""
    uid = int(user["sub"])
    db.execute("DELETE FROM user_certifications WHERE user_id=? AND certification_id=?",
               (uid, certification_id))
    db.commit()
    return {"message": "Removed"}


@router.get("/{file_id}/file")
def certificate_file(file_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    """The certificate image/PDF — only for its owner and personnel managers."""
    row = _file_row(db, file_id)
    if row["user_id"] != int(user["sub"]) and not _can_review(user):
        raise HTTPException(403, "You can't view this certificate")
    try:
        with open(row["file_path"], "rb") as f:
            data = f.read()
    except OSError:
        raise HTTPException(404, "The certificate file is missing")
    return Response(content=data, media_type=row["mime"],
                    headers={"Cache-Control": "private, no-store",
                             "Content-Disposition": "inline",
                             "X-Content-Type-Options": "nosniff"})


# ── Review (principal / registrar) ────────────────────────────────────────────

@router.get("/user/{uid}")
def user_certifications(uid: int, db=Depends(get_db), user=Depends(get_current_user)):
    if uid != int(user["sub"]) and not _can_review(user):
        raise HTTPException(403, "You can't view this person's certificates")
    return _profile_certifications(db, uid)


class ReviewBody(BaseModel):
    status: str  # verified | rejected
    note: Optional[str] = Field(default=None, max_length=500)


@router.patch("/{file_id}/review")
def review_certificate(file_id: int, body: ReviewBody, request: Request, db=Depends(get_db),
                       user=Depends(get_current_user)):
    if not _can_review(user):
        raise HTTPException(403, "Only the principal or registrar can verify certificates")
    if body.status not in ("verified", "rejected"):
        raise HTTPException(400, "status must be 'verified' or 'rejected'")
    row = _file_row(db, file_id)
    if row["status"] == "pending":
        raise HTTPException(409, "The owner hasn't added this certificate yet")
    if row["user_id"] == int(user["sub"]):
        raise HTTPException(403, "You can't verify your own certificate")
    db.execute(
        """UPDATE certificate_files SET status=?, review_note=?, reviewed_by=?,
           reviewed_at=CURRENT_TIMESTAMP WHERE id=?""",
        (body.status, (body.note or "").strip() or None, int(user["sub"]), file_id))
    if body.status == "verified":
        db.execute("INSERT OR IGNORE INTO user_certifications (user_id, certification_id) VALUES (?,?)",
                   (row["user_id"], row["certification_id"]))
    else:
        _unlink_if_unbacked(db, row["user_id"], row["certification_id"])
    shaped = _shape(db, _file_row(db, file_id))
    changes = {"status": [row["status"], body.status]}
    if body.note and body.note.strip():
        changes["note"] = [row["review_note"], body.note.strip()]
    audit.record(db, user, f"certificate.{body.status}", "certificate", file_id,
                 f"{'Verified' if body.status == 'verified' else 'Rejected'} certificate {shaped['title']}",
                 entity_label=f"{shaped['title']} — {audit.user_label(db, row['user_id'])}",
                 changes=changes, request=request)
    db.commit()
    return shaped

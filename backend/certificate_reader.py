"""Certificate reader: extracts text from an uploaded certificate (PDF or photo),
identifies which catalog certification it is and who issued it, and runs
automated authenticity checks.

Text extraction
  * PDFs with a text layer are read directly (pypdf).
  * Scanned PDFs and photos are run through OCR (Tesseract via pytesseract);
    PDF pages are rendered with pypdfium2 first. Everything runs on this
    server: certificate images are never sent to an outside service.

Authenticity
  Software cannot prove a certificate is genuine — only the issuing body can.
  These checks catch common problems (not a certificate, unknown issuer, name
  mismatch, impossible dates, a file someone else already uploaded, signs of
  editing) and give the reviewer a summary. Final verification is a person:
  the principal or registrar marks it Verified or Rejected.
"""
import hashlib
import io
import re
from datetime import date
from typing import Optional

import deped_profile as dp
from qualifications import keywords

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None
try:
    import pytesseract
except ImportError:  # pragma: no cover
    pytesseract = None
try:
    import pypdfium2
except ImportError:  # pragma: no cover
    pypdfium2 = None
try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover
    PdfReader = None

MAX_BYTES = 10 * 1024 * 1024
KINDS = {  # extension → (mime, magic-bytes test)
    ".pdf": ("application/pdf", lambda b: b.startswith(b"%PDF")),
    ".png": ("image/png", lambda b: b.startswith(b"\x89PNG\r\n\x1a\n")),
    ".jpg": ("image/jpeg", lambda b: b.startswith(b"\xff\xd8\xff")),
    ".jpeg": ("image/jpeg", lambda b: b.startswith(b"\xff\xd8\xff")),
    ".webp": ("image/webp", lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP"),
}
EDITOR_HINTS = ("photoshop", "gimp", "paint.net", "pixlr", "picsart", "snapseed", "canva",
                "illustrator", "affinity", "fotor")
CERTIFICATE_CUES = ("certificate", "certify", "certifies", "certification", "awarded",
                    "has successfully completed", "has completed", "in recognition",
                    "license", "licence", "registration", "eligibility", "is hereby",
                    "national certificate", "this is to")
_MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def detect_kind(filename: str, data: bytes) -> tuple:
    """(extension, mime) after checking the content really is that type."""
    ext = "." + (filename or "").rsplit(".", 1)[-1].lower() if "." in (filename or "") else ""
    if ext not in KINDS:
        raise ValueError("Upload a PDF or a photo (PNG, JPG or WEBP) of the certificate.")
    mime, ok = KINDS[ext]
    if not ok(data):
        raise ValueError("The file's contents don't match its type. Upload the original PDF or photo.")
    if len(data) > MAX_BYTES:
        raise ValueError("The file is larger than 10 MB.")
    return ext, mime


# ── Text extraction ───────────────────────────────────────────────────────────

def _ocr(img) -> Optional[str]:
    if pytesseract is None or Image is None:
        return None
    try:
        img = img.convert("L")
        if img.width < 1600:  # small photos OCR far better upscaled
            scale = 1600 / img.width
            img = img.resize((int(img.width * scale), int(img.height * scale)))
        return pytesseract.image_to_string(img)
    except Exception:
        return None  # tesseract binary missing or unreadable image


def extract(data: bytes, mime: str) -> dict:
    """{text, method, ocr_available, metadata_software}."""
    out = {"text": "", "method": None, "ocr_available": pytesseract is not None,
           "metadata_software": None}
    if mime == "application/pdf":
        if PdfReader is not None:
            try:
                reader = PdfReader(io.BytesIO(data))
                meta = reader.metadata or {}
                out["metadata_software"] = " ".join(
                    str(meta.get(k) or "") for k in ("/Producer", "/Creator")).strip() or None
                out["text"] = "\n".join((p.extract_text() or "") for p in reader.pages[:3])
                out["method"] = "pdf-text"
            except Exception:
                pass
        if len(out["text"].strip()) < 40 and pypdfium2 is not None:
            # Scanned PDF: render the first pages and OCR them.
            try:
                pdf = pypdfium2.PdfDocument(data)
                texts = []
                for i in range(min(2, len(pdf))):
                    t = _ocr(pdf[i].render(scale=2.5).to_pil())
                    if t:
                        texts.append(t)
                if texts:
                    out["text"], out["method"] = "\n".join(texts), "ocr"
            except Exception:
                pass
    elif Image is not None:
        try:
            img = Image.open(io.BytesIO(data))
            exif = img.getexif() if hasattr(img, "getexif") else {}
            out["metadata_software"] = str(exif.get(0x0131) or "") or None  # EXIF "Software"
            t = _ocr(img)
            if t:
                out["text"], out["method"] = t, "ocr"
        except Exception:
            pass
    return out


# ── Analysis ──────────────────────────────────────────────────────────────────

def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower())


def _has_phrase(norm_text: str, phrase: str) -> bool:
    return re.search(r"(?<![a-z0-9])" + re.escape(phrase.lower()) + r"(?![a-z0-9])",
                     norm_text) is not None


def _match_issuer(norm_text: str, issuers: list) -> Optional[dict]:
    # Full names first: acronyms are ambiguous (PRC is both the Professional
    # Regulation Commission and the Philippine Red Cross) and also show up
    # inside certificate numbers.
    for iss in issuers:
        names = [iss["issuer_name"]] + dp.ISSUER_ALIASES.get(iss["issuer_name"], [])
        if any(_has_phrase(norm_text, n) for n in names):
            return iss
    for iss in issuers:
        if iss.get("acronym") and _has_phrase(norm_text, iss["acronym"]):
            return iss
    return None


def _match_certification(norm_text: str, certs: list, issuer: Optional[dict]) -> tuple:
    """(best catalog certification or None, confidence 0-1)."""
    words = keywords(norm_text)
    best, best_score = None, 0.0
    for c in certs:
        _desc, aliases = dp.CERTIFICATION_INFO.get(c["cert_name"], ("", []))
        score = 0.0
        if _has_phrase(norm_text, c["cert_name"]):
            score = 1.0
        elif any(_has_phrase(norm_text, a) for a in aliases):
            score = 0.9
        else:
            kw = keywords(c["cert_name"])
            if kw:
                score = 0.8 * len(kw & words) / len(kw)
        if issuer and c.get("issuer_id") == issuer["id"]:
            score += 0.1
        if score > best_score:
            best, best_score = c, score
    return (best, min(best_score, 1.0)) if best_score >= 0.55 else (None, best_score)


_DATE_RES = [
    re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:day\s+of\s+)?([a-z]{3,9})\.?,?\s+(\d{4})\b"),
    re.compile(r"\b([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b"),
    re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b"),
    re.compile(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b"),
]


def _dates(norm_text: str) -> list:
    found = []
    for i, rx in enumerate(_DATE_RES):
        for m in rx.finditer(norm_text):
            try:
                if i == 0:
                    d, mon, y = int(m.group(1)), _MONTHS.get(m.group(2)[:3]), int(m.group(3))
                elif i == 1:
                    mon, d, y = _MONTHS.get(m.group(1)[:3]), int(m.group(2)), int(m.group(3))
                elif i == 2:
                    y, mon, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
                else:
                    mon, d, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
                if mon and 1950 <= y <= 2100:
                    found.append((m.start(), date(y, mon, d)))
            except (ValueError, TypeError):
                continue
    return found


_NUMBER_RE = re.compile(
    r"(?:certificate|cert\.?|license|licence|registration|reg\.?|control|serial|id)\s*"
    r"(?:no\.?|number|#)\s*[:.]?\s*([a-z0-9][a-z0-9-]{3,})")


def _person_name_parts(user: dict) -> list:
    first = (user.get("first_name") or "").strip()
    last = (user.get("last_name") or "").strip()
    if not (first and last):
        parts = re.sub(r"^(principal|coordinator|dean|registrar|teacher|admin)\s+", "",
                       (user.get("full_name") or "").strip(), flags=re.I).split()
        first, last = (parts[0], parts[-1]) if len(parts) >= 2 else ("", "")
    return [p.lower() for p in (first.split()[:1] + last.split()[-1:]) if len(p) >= 2]


def analyze(db, user: dict, data: bytes, filename: str) -> dict:
    """Read the certificate and run the checks. Raises ValueError for a file
    that can't be accepted at all."""
    ext, mime = detect_kind(filename, data)
    digest = sha256(data)
    ex = extract(data, mime)
    text = ex["text"] or ""
    norm = _norm(text)

    issuers = [dict(r) for r in db.execute("SELECT * FROM certification_issuers").fetchall()]
    certs = [dict(r) for r in db.execute(
        """SELECT c.id, c.cert_name, c.issuer_id, cc.category_name, ci.issuer_name, ci.acronym
           FROM certifications c
           LEFT JOIN certification_categories cc ON cc.id = c.category_id
           LEFT JOIN certification_issuers ci ON ci.id = c.issuer_id""").fetchall()]
    issuer = _match_issuer(norm, issuers)
    cert, confidence = _match_certification(norm, certs, issuer)

    checks = []

    def add(key, status, label, detail):
        checks.append({"key": key, "status": status, "label": label, "detail": detail})

    readable = len(norm.strip()) >= 25
    if readable:
        add("readable", "pass", "Text could be read",
            "Read from the PDF's text." if ex["method"] == "pdf-text" else "Read with text recognition (OCR).")
    elif not ex["ocr_available"] and mime != "application/pdf":
        add("readable", "warn", "Text recognition unavailable",
            "This server can't read photos yet; choose the certificate from the list below.")
    else:
        add("readable", "fail", "Couldn't read the certificate",
            "Use a clear, well-lit, straight photo or the original PDF.")

    if readable:
        cues = [c for c in CERTIFICATE_CUES if c in norm]
        add("is_certificate", "pass" if cues else "fail",
            "Looks like a certificate" if cues else "Doesn't read like a certificate",
            f"Found wording such as “{cues[0]}”." if cues
            else "No certificate wording (e.g. “This is to certify”) was found.")

        if issuer:
            add("issuer", "pass", "Issuer recognized", f"Issued by {issuer['issuer_name']}.")
        else:
            add("issuer", "warn", "Issuer not recognized",
                "No known issuing body (PRC, CSC, NEAP, TESDA, Red Cross, ...) was found.")

        if cert:
            add("title", "pass", "Certification identified",
                f"Matches “{cert['cert_name']}” ({round(confidence * 100)}% match).")
            if issuer and cert.get("issuer_id") and cert["issuer_id"] != issuer["id"]:
                add("issuer_consistent", "warn", "Issuer doesn't usually issue this",
                    f"{cert['cert_name']} is normally issued by {cert.get('issuer_name') or 'another body'}.")
        else:
            add("title", "warn", "Certification not identified",
                "Choose which certification this is from the list.")

        name_parts = _person_name_parts(user)
        if name_parts:
            hits = [p for p in name_parts if _has_phrase(norm, p)]
            if len(hits) == len(name_parts):
                add("name", "pass", "Name matches the profile", "The certificate is issued to the profile owner.")
            elif hits:
                add("name", "warn", "Name only partly matches",
                    "Only part of the profile name was found on the certificate.")
            else:
                add("name", "fail", "Name doesn't match the profile",
                    "The name on the certificate doesn't match the profile owner.")

        today = date.today()
        dates = _dates(norm)
        future = [d for _, d in dates if d > today]
        expired = []
        for pos, d in dates:
            window = norm[max(0, pos - 40):pos]
            if any(w in window for w in ("valid until", "expires", "expiry", "valid through", "until")) \
                    and d < today:
                expired.append(d)
        if future and not any(w in norm for w in ("valid until", "expires", "expiry", "valid through")):
            add("dates", "fail", "Date is in the future",
                f"The certificate is dated {future[0].isoformat()}, which hasn't happened yet.")
        elif expired:
            add("dates", "warn", "Certificate has expired", f"Valid until {expired[0].isoformat()}.")
        elif dates:
            add("dates", "pass", "Dates look valid", f"Dated {min(d for _, d in dates).isoformat()}.")
        else:
            add("dates", "warn", "No date found", "Certificates normally show when they were issued.")

        num = _NUMBER_RE.search(norm)
        if num:
            add("number", "pass", "Certificate number found", f"No. {num.group(1).upper()}")
        else:
            add("number", "info", "No certificate number found",
                "Many certificates have none; licenses (e.g. PRC) always do.")

    others = db.execute(
        "SELECT user_id FROM certificate_files WHERE sha256=? AND status != 'pending'",
        (digest,)).fetchall()
    uid = int(user["id"])
    if any(r["user_id"] != uid for r in others):
        add("duplicate", "fail", "Already uploaded by someone else",
            "This exact file is on another person's profile.")
    elif others:
        add("duplicate", "warn", "Uploaded before", "This file is already on the same profile.")
    else:
        add("duplicate", "pass", "Original upload", "No one else has uploaded this file.")

    sw = (ex["metadata_software"] or "").lower()
    if sw and any(h in sw for h in EDITOR_HINTS):
        add("editing", "warn", "Made or edited in an editing app",
            f"File metadata mentions “{ex['metadata_software']}”. Reviewers should compare it with the original.")

    fails = sum(1 for c in checks if c["status"] == "fail")
    passes = sum(1 for c in checks if c["status"] == "pass")
    level = "low" if fails or passes <= 2 else "high" if passes >= 6 else "medium"

    info = dp.CERTIFICATION_INFO.get(cert["cert_name"], ("", []))[0] if cert else ""
    return {
        "ext": ext, "mime": mime, "sha256": digest,
        "extracted_text": text[:20000],
        "certification_id": cert["id"] if cert else None,
        "detected_title": cert["cert_name"] if cert else None,
        "match_confidence": round(confidence, 2),
        "issuer": (cert or {}).get("issuer_name") or (issuer or {}).get("issuer_name"),
        "issuer_acronym": (cert or {}).get("acronym") or (issuer or {}).get("acronym"),
        "category": (cert or {}).get("category_name"),
        "description": info,
        "checks": checks,
        "authenticity": level,
    }

"""Task scanner: read a document that describes a task (a memo, an advisory, a
photo of a notice) and pull out what the task form needs — title,
instructions, start date, due date and due time.

Reading is done locally: PDFs by their text layer (OCR when they are scans),
images by OCR, Word files from their XML, text files as they are. The fields
are then found with rules (labels such as "Deadline:" and date patterns), not
by a language model, so the result is a starting point the user reviews in the
form before saving.
"""
import io
import re
import zipfile
from datetime import date
from typing import Optional
from xml.etree import ElementTree

from certificate_reader import Image, PdfReader, _ocr, pypdfium2, pytesseract

MAX_BYTES = 15 * 1024 * 1024
MAX_PDF_PAGES = 10      # pages read from a PDF's text layer
MAX_OCR_PAGES = 5       # pages rendered and OCR'd when the PDF is a scan
MAX_INSTRUCTIONS = 8000

_IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp")
SUPPORTED = (".pdf", ".docx", ".txt") + _IMAGE_EXTS


# ── Reading ───────────────────────────────────────────────────────────────────

def _docx_text(data: bytes) -> str:
    """Paragraph text of a .docx (its main document part), one line each."""
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        root = ElementTree.fromstring(z.read("word/document.xml"))
    lines = []
    for para in root.iter(f"{ns}p"):
        parts = []
        for node in para.iter():
            if node.tag == f"{ns}t":
                parts.append(node.text or "")
            elif node.tag in (f"{ns}tab",):
                parts.append("\t")
            elif node.tag in (f"{ns}br", f"{ns}cr"):
                parts.append("\n")
        lines.append("".join(parts))
    return "\n".join(lines)


def _ocr_page(img) -> tuple:
    """(text, segments) for one page image. Segments are the recognised lines
    with their position on the page — {text, words: [(word, left, right)], top,
    bottom} — so a calendar laid out in columns can be read row by row."""
    text = _ocr(img)
    segments = []
    try:
        gray = img.convert("L")
        if gray.width < 1600:  # same upscale _ocr applies
            scale = 1600 / gray.width
            gray = gray.resize((int(gray.width * scale), int(gray.height * scale)))
        d = pytesseract.image_to_data(gray, output_type=pytesseract.Output.DICT)
        lines = {}
        for i, word in enumerate(d["text"]):
            word = (word or "").strip()
            try:
                conf = float(d["conf"][i])
            except (TypeError, ValueError):
                conf = -1
            if not word or conf < 0:  # conf -1 marks layout boxes, not words
                continue
            key = (d["block_num"][i], d["par_num"][i], d["line_num"][i])
            lines.setdefault(key, []).append(
                (word, d["left"][i], d["left"][i] + d["width"][i], d["top"][i], d["top"][i] + d["height"][i]))
        for words in lines.values():
            words.sort(key=lambda w: w[1])
            segments.append({
                "text": " ".join(w[0] for w in words),
                "words": [(w[0], w[1], w[2]) for w in words],
                "top": min(w[3] for w in words), "bottom": max(w[4] for w in words),
            })
    except Exception:
        segments = []
    return text, segments


def read_text(data: bytes, filename: str) -> dict:
    """{text, method, pages}: method is 'text' (read directly) or 'ocr'
    (recognised from an image); pages holds each OCR'd page's positioned lines.
    Raises ValueError with a message for the user."""
    name = (filename or "").lower()
    ext = "." + name.rsplit(".", 1)[-1] if "." in name else ""
    if ext not in SUPPORTED:
        raise ValueError("Upload a PDF, a Word file (.docx), a text file, or a photo (PNG, JPG, WEBP).")
    if len(data) > MAX_BYTES:
        raise ValueError("The file is larger than 15 MB.")
    if not data:
        raise ValueError("The file is empty.")

    if ext == ".txt":
        return {"text": data.decode("utf-8", errors="replace"), "method": "text"}

    if ext == ".docx":
        try:
            return {"text": _docx_text(data), "method": "text"}
        except Exception:
            raise ValueError("That Word file couldn't be opened. Save it as .docx or PDF and try again.")

    if ext == ".pdf":
        text = ""
        if PdfReader is not None:
            try:
                reader = PdfReader(io.BytesIO(data))
                text = "\n".join((p.extract_text() or "") for p in reader.pages[:MAX_PDF_PAGES])
            except Exception:
                text = ""
        if len(text.strip()) >= 40:
            return {"text": text, "method": "text"}
        # A scanned PDF has no text layer: render its pages and OCR them.
        if pypdfium2 is not None and pytesseract is not None:
            try:
                pdf = pypdfium2.PdfDocument(data)
                pages = [_ocr_page(pdf[i].render(scale=2.5).to_pil())
                         for i in range(min(MAX_OCR_PAGES, len(pdf)))]
                ocr = "\n".join(t for t, _ in pages if t)
                if ocr.strip():
                    return {"text": ocr, "method": "ocr", "pages": [seg for _, seg in pages]}
            except Exception:
                pass
        if text.strip():
            return {"text": text, "method": "text"}
        raise ValueError("No readable text was found in that PDF.")

    # Images
    if Image is None or pytesseract is None:
        raise ValueError("Reading photos isn't available on this server. Upload a PDF or Word file instead.")
    try:
        text, segments = _ocr_page(Image.open(io.BytesIO(data)))
    except Exception:
        text, segments = None, []
    if not text or not text.strip():
        raise ValueError("No readable text was found in that image. Try a sharper, straighter photo.")
    return {"text": text, "method": "ocr", "pages": [segments]}


# ── Dates and times ───────────────────────────────────────────────────────────

_MONTHS = {}
for _i, _names in enumerate([
        ("january", "jan"), ("february", "feb"), ("march", "mar"), ("april", "apr"),
        ("may",), ("june", "jun"), ("july", "jul"), ("august", "aug"),
        ("september", "sept", "sep"), ("october", "oct"), ("november", "nov"),
        ("december", "dec")]):
    for _n in _names:
        _MONTHS[_n] = _i + 1

_MON = r"(?P<{0}>" + "|".join(sorted(_MONTHS, key=len, reverse=True)) + r")\.?"
_DAY = r"(?P<{0}>\d{{1,2}})(?:st|nd|rd|th)?"
_YEAR = r"(?P<{0}>(?:19|20)\d{{2}})"
_TO = r"\s*(?:-|–|—|to|until|through|thru)\s*"

# "October 5-9, 2026" and "October 5 to November 2, 2026"
_RANGE_SAME_MONTH = re.compile(
    _MON.format("m1") + r"\s+" + _DAY.format("d1") + _TO + _DAY.format("d2") + r",?\s+" + _YEAR.format("y"),
    re.I)
_RANGE_TWO_MONTHS = re.compile(
    _MON.format("m1") + r"\s+" + _DAY.format("d1") + r"(?:,?\s+" + _YEAR.format("y1") + r")?" + _TO
    + _MON.format("m2") + r"\s+" + _DAY.format("d2") + r",?\s+" + _YEAR.format("y2"),
    re.I)
_SINGLE = [
    re.compile(_MON.format("m") + r"\s+" + _DAY.format("d") + r",?\s+" + _YEAR.format("y"), re.I),
    re.compile(_DAY.format("d") + r"\s+(?:of\s+)?" + _MON.format("m") + r",?\s+" + _YEAR.format("y"), re.I),
    re.compile(r"(?P<y>(?:19|20)\d{2})-(?P<mn>\d{1,2})-(?P<d>\d{1,2})"),
    re.compile(r"(?<!\d)(?P<mn>\d{1,2})/(?P<d>\d{1,2})/(?P<y>(?:19|20)\d{2})(?!\d)"),
]

_END_CUES = ("deadline", "due", "on or before", "not later than", "no later than", "until",
             "submit", "submission", "end date", "ends", "end:", "closing", "by ")
_START_CUES = ("start date", "starts", "start:", "begin", "commence", "effective", "from ", "opening")

_TIME = re.compile(
    r"(?<![\d:])(?P<h>\d{1,2})(?:[:.](?P<mi>\d{2}))?\s*(?P<ap>a\.?\s?m\.?|p\.?\s?m\.?|nn|noon)(?![a-z])", re.I)
_TIME_WORDS = re.compile(r"\b(?:12\s*)?(noon|midnight)\b", re.I)


def _make(y, m, d) -> Optional[date]:
    try:
        return date(int(y), int(m), int(d))
    except (ValueError, TypeError):
        return None


def _find_dates(text: str) -> list:
    """Every date in the text as (position, date, role) in reading order; role is
    'start' / 'end' for the two halves of a range, else None."""
    found, taken = [], []

    def free(span):
        return all(span[1] <= a or span[0] >= b for a, b in taken)

    for m in _RANGE_TWO_MONTHS.finditer(text):
        end = _make(m["y2"], _MONTHS[m["m2"].lower().rstrip(".")], m["d2"])
        start = _make(m["y1"] or m["y2"], _MONTHS[m["m1"].lower().rstrip(".")], m["d1"])
        if start and end and free(m.span()):
            if start > end and not m["y1"]:  # "December 20 to January 5, 2027"
                start = _make(int(m["y2"]) - 1, start.month, start.day) or start
            taken.append(m.span())
            found += [(m.start(), start, "start"), (m.start() + 1, end, "end")]
    for m in _RANGE_SAME_MONTH.finditer(text):
        month = _MONTHS[m["m1"].lower().rstrip(".")]
        start, end = _make(m["y"], month, m["d1"]), _make(m["y"], month, m["d2"])
        if start and end and start <= end and free(m.span()):
            taken.append(m.span())
            found += [(m.start(), start, "start"), (m.start() + 1, end, "end")]
    for rx in _SINGLE:
        for m in rx.finditer(text):
            g = m.groupdict()
            month = _MONTHS[g["m"].lower().rstrip(".")] if g.get("m") else g.get("mn")
            d = _make(g["y"], month, g["d"])
            if d and free(m.span()):
                taken.append(m.span())
                found.append((m.start(), d, None))
    return sorted(found, key=lambda f: f[0])


def _cue(text: str, pos: int) -> Optional[str]:
    """Whether the words just before a date (same line) mark it as the start or
    the end of the task."""
    line_start = text.rfind("\n", 0, pos) + 1
    before = text[max(line_start, pos - 60):pos].lower()
    last_end = max((before.rfind(c) for c in _END_CUES), default=-1)
    last_start = max((before.rfind(c) for c in _START_CUES), default=-1)
    if last_end < 0 and last_start < 0:
        return None
    return "end" if last_end > last_start else "start"


def _format_time(hour: int, minute: int) -> str:
    h = hour % 12 or 12
    return f"{h}:{minute:02d} {'AM' if hour < 12 else 'PM'}"


def _times_in(line: str) -> list:
    out = []
    for m in _TIME.finditer(line):
        hour, minute = int(m["h"]), int(m["mi"] or 0)
        ap = m["ap"].lower().replace(".", "").replace(" ", "")
        if hour > 12 or minute > 59 or hour == 0:
            continue
        if ap in ("nn", "noon"):
            hour = 12
        elif ap == "pm" and hour != 12:
            hour += 12
        elif ap == "am" and hour == 12:
            hour = 0
        out.append((m.start(), _format_time(hour, minute)))
    for m in _TIME_WORDS.finditer(line):
        out.append((m.start(), "12:00 PM" if m[1].lower() == "noon" else "11:59 PM"))
    return [t for _, t in sorted(out)]


def _due_time(text: str) -> Optional[str]:
    """The time on a line that talks about the deadline (the last one, so
    "8:00 AM - 5:00 PM" gives 5:00 PM); failing that, the first time found."""
    first = None
    for line in text.splitlines():
        times = _times_in(line)
        if not times:
            continue
        if any(c in line.lower() for c in _END_CUES):
            return times[-1]
        first = first or times[-1]
    return first


# ── Title and instructions ────────────────────────────────────────────────────

_TITLE_LABEL = re.compile(
    r"^\s*(?:task\s*(?:title|name)?|title|subject|activity|topic|assignment|re)\s*[:\-–]\s*(?P<v>\S.*)$", re.I)
_BODY_LABEL = re.compile(
    r"^\s*(?:instructions?|description|details|directions|guidelines|procedures?|what to do|requirements?)"
    r"\s*[:\-–]?\s*(?P<v>.*)$", re.I)
_FIELD_LABEL = re.compile(
    r"^\s*(?:date|start(?:\s*date)?|end(?:\s*date)?|due(?:\s*date)?|deadline|time|to|from|for|cc|memo(?:randum)?(?:\s*no\.?)?)"
    r"\s*[:\-–]", re.I)


def _clean(text: str) -> list:
    lines = [re.sub(r"[ \t ]+", " ", ln).strip() for ln in text.replace("\r", "\n").split("\n")]
    out = []
    for ln in lines:  # collapse runs of blank lines
        if ln or (out and out[-1]):
            out.append(ln)
    while out and not out[-1]:
        out.pop()
    return out


def parse(text: str) -> dict:
    """Task fields found in a document's text. Missing ones are None."""
    lines = _clean(text)
    body_text = "\n".join(lines)

    # Title: a labelled line, else the first line that reads like a heading.
    title, title_idx = None, None
    for i, ln in enumerate(lines[:40]):
        m = _TITLE_LABEL.match(ln)
        if m:
            title, title_idx = m["v"].strip(), i
            break
    if title is None:
        for i, ln in enumerate(lines[:15]):
            if len(re.findall(r"[A-Za-z]", ln)) >= 3 and not _FIELD_LABEL.match(ln) and not _BODY_LABEL.match(ln):
                title, title_idx = ln, i
                break
    if title:
        title = title.strip(" :-–")[:200]

    # Instructions: the labelled section when there is one, else everything
    # but the title line, so nothing in the document is dropped.
    body_idx = next((i for i, ln in enumerate(lines)
                     if _BODY_LABEL.match(ln) and i != title_idx), None)
    if body_idx is not None:
        first = _BODY_LABEL.match(lines[body_idx])["v"].strip()
        body = ([first] if first else []) + lines[body_idx + 1:]
    else:
        body = [ln for i, ln in enumerate(lines) if i != title_idx]
    instructions = re.sub(r"\n{3,}", "\n\n", "\n".join(body)).strip()[:MAX_INSTRUCTIONS] or None

    # Dates: a written range or a labelled date wins; with no labels at all,
    # a single date is the deadline and several span earliest → latest.
    start = end = None
    dates = _find_dates(body_text)
    for pos, d, role in dates:
        role = role or _cue(body_text, pos)
        if role == "start" and start is None:
            start = d
        elif role == "end" and end is None:
            end = d
    if start is None and end is None and dates:
        distinct = sorted({d for _, d, _ in dates})
        end = distinct[-1]
        if len(distinct) > 1:
            start = distinct[0]
    if start and end and start > end:
        start, end = end, start

    return {
        "title": title,
        "instructions": instructions,
        "start_date": start.isoformat() if start else None,
        "end_date": end.isoformat() if end else None,
        "due_time": _due_time(body_text),
    }


# ── Schedules (a list of dates, each with what happens then) ─────────────────

_LEADING = [_RANGE_TWO_MONTHS, _RANGE_SAME_MONTH] + _SINGLE
_MIN_SCHEDULE_ITEMS = 3


def _leading_date(text: str):
    """(start, end, rest, words) when the text begins with a date or a date
    range ("December 3-4, 2026 TERM 2 EXAMINATION"), else None. `words` is how
    many whitespace-separated words the date takes up."""
    text = text.strip()
    for rx in _LEADING:
        m = rx.match(text)
        if not m:
            continue
        found = _find_dates(m.group(0))
        if not found:
            continue
        start, end = found[0][1], found[-1][1]
        if start > end:
            start, end = end, start
        return start, end, text[m.end():], len(m.group(0).split())
    return None


def _tidy_title(text: str) -> str:
    # Drop stray symbols OCR picks up from decorations, keeping real separators.
    text = " ".join(w for w in text.split() if re.search(r"[A-Za-z0-9]", w) or w in ("&", "|", "-", "/"))
    text = re.sub(r"^[^A-Za-z0-9(]+", "", text)        # leading bullets / OCR specks
    text = re.sub(r"[^A-Za-z0-9).!?]+$", "", text)     # trailing ones
    return text[:200]


def _item(start, end, title) -> Optional[dict]:
    title = _tidy_title(title)
    if len(re.findall(r"[A-Za-z]", title)) < 3:
        return None
    return {"title": title, "start_date": start.isoformat(), "end_date": end.isoformat()}


def _items_from_lines(lines: list) -> list:
    """Schedule rows written on one line each: "Oct 7, 2026 - First test"."""
    items = []
    for ln in lines:
        lead = _leading_date(ln.lstrip("•*-–—·|> "))
        if lead:
            it = _item(lead[0], lead[1], lead[2])
            if it:
                items.append(it)
    return items


def _items_from_page(segments: list) -> list:
    """Schedule rows on an OCR'd page where the dates sit in one column and
    what happens sits beside them (a calendar poster). Each date takes the text
    to its right that is level with it, including a wrapped second line."""
    dates, texts = [], []
    for seg in segments:
        lead = _leading_date(seg["text"])
        words = seg["words"]
        if lead:
            n = min(lead[3], len(words))
            dates.append({"start": lead[0], "end": lead[1], "top": seg["top"], "bottom": seg["bottom"],
                          "left": words[0][1], "right": words[n - 1][2], "parts": []})
            words = words[n:]
        if words:
            texts.append({"text": " ".join(w[0] for w in words), "left": words[0][1],
                          "mid": (seg["top"] + seg["bottom"]) / 2, "top": seg["top"]})
    if len(dates) < _MIN_SCHEDULE_ITEMS:
        return []
    dates.sort(key=lambda d: d["top"])
    mids = [(d["top"] + d["bottom"]) / 2 for d in dates]
    gaps = sorted(b - a for a, b in zip(mids, mids[1:]) if b - a > 0)
    pitch = gaps[len(gaps) // 2] if gaps else 60          # typical distance between rows
    for i, d in enumerate(dates):
        lo = (mids[i - 1] + mids[i]) / 2 if i > 0 else mids[i] - pitch / 2
        hi = (mids[i] + mids[i + 1]) / 2 if i + 1 < len(dates) else mids[i] + pitch * 0.75
        lo, hi = max(lo, mids[i] - pitch), min(hi, mids[i] + pitch)
        for t in texts:
            if lo <= t["mid"] < hi and t["left"] >= d["right"] - 5:
                d["parts"].append(t)
    items = []
    for d in dates:
        d["parts"].sort(key=lambda t: (t["top"], t["left"]))
        it = _item(d["start"], d["end"], " ".join(t["text"] for t in d["parts"]))
        if it:
            items.append(it)
    return items


def find_schedule(read: dict) -> list:
    """The dated items of a schedule/calendar document, or [] when the
    document isn't one (fewer than three dated rows)."""
    best = _items_from_lines(_clean(read["text"]))
    for segments in read.get("pages") or []:
        positioned = _items_from_page(segments)
        if len(positioned) > len(best):
            best = positioned
    return best if len(best) >= _MIN_SCHEDULE_ITEMS else []


def scan(data: bytes, filename: str) -> dict:
    """Read a file and return the task fields found in it, plus how it was read.
    `items` lists the dated rows when the file is a schedule of several."""
    read = read_text(data, filename)
    result = parse(read["text"])
    result["items"] = find_schedule(read)
    result["method"] = read["method"]
    result["characters_read"] = len(read["text"].strip())
    return result

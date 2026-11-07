"""Event proposal reader: turns an uploaded proposal (Word, PDF or a photo/scan)
into the fields of the Add Event wizard, so the proponent only reviews them.

How it reads
  * .docx  — paragraphs and tables in document order (python-docx). Tables are
             read cell by cell, so this is the most accurate source.
  * .pdf   — text and ruled tables per page (pdfplumber). A PDF without a text
             layer (a scan) falls back to OCR, like a photo.
  * photos — OCR (Tesseract, see certificate_reader). Only plain-text fields
             are reliable; tables usually need checking by hand.

What it looks for
  The school's proposal format (the same one the system prints): I. Proposal
  Brief (a. Title … i. Focal Person), II. Rationale, III. Objectives,
  IV. Methodology, V. Activity Matrix, VI. Working Committee (Executive
  Committee + Technical Working Group), VII. Proposed Budget, VIII. Monitoring
  and Evaluation, then the signatories. Tables are recognised by their column
  headings (e.g. Day / Time / Event / Speaker), not by their position, so the
  order of sections in the file doesn't matter.

Nothing here touches the database; matching committee names to TaskNet users
is done by the caller (routes/events.py).
"""
import io
import re
from datetime import date
from typing import Optional

from date_utils import parse_event_date

try:
    import docx  # python-docx
    from docx.table import Table as _DocxTable
    from docx.text.paragraph import Paragraph as _DocxParagraph
except ImportError:  # pragma: no cover
    docx = None
try:
    import pdfplumber
except ImportError:  # pragma: no cover
    pdfplumber = None

MAX_BYTES = 15 * 1024 * 1024
KINDS = {  # extension → magic-bytes test
    ".docx": lambda b: b.startswith(b"PK"),
    ".pdf": lambda b: b.startswith(b"%PDF"),
    ".png": lambda b: b.startswith(b"\x89PNG\r\n\x1a\n"),
    ".jpg": lambda b: b.startswith(b"\xff\xd8\xff"),
    ".jpeg": lambda b: b.startswith(b"\xff\xd8\xff"),
    ".webp": lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP",
}
MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]
NATURES = ("Curricular", "Co-curricular", "Extra-curricular")
SIGNATORY_ROLES = ("Noted", "Endorsed", "Recommending Approval", "Approved")


# ── Blocks: the document as paragraphs and tables, in reading order ───────────

def _clean(s) -> str:
    s = "" if s is None else str(s)
    s = s.replace(" ", " ").replace("\t", " ")
    return re.sub(r"[   ]+", " ", s).strip()


def _clean_cell(s) -> str:
    """Cell text keeps its line breaks (activities, terms of reference)."""
    lines = [_clean(x) for x in ("" if s is None else str(s)).splitlines()]
    return "\n".join(x for x in lines if x)


def _docx_blocks(data: bytes) -> list:
    if docx is None:
        raise ValueError("Word files can't be read on this server (python-docx is missing).")
    try:
        d = docx.Document(io.BytesIO(data))
    except Exception:
        raise ValueError("That Word file couldn't be opened. Save it again as .docx and retry.")
    blocks = []
    for el in d.element.body.iterchildren():
        tag = el.tag.rsplit("}", 1)[-1]
        if tag == "p":
            text = _clean(_DocxParagraph(el, d).text)
            if text:
                blocks.append(("p", text))
        elif tag == "tbl":
            rows = []
            for r in _DocxTable(el, d).rows:
                try:
                    # A merged cell is returned once per grid column it spans
                    # (the same underlying cell); keep it once. Equal values in
                    # separate cells (cost 270.00 | total 270.00) stay.
                    cells, seen = [], None
                    for c in r.cells:
                        if c._tc is seen:
                            continue
                        seen = c._tc
                        cells.append(_clean_cell(c.text))
                except Exception:
                    continue
                if any(cells):
                    rows.append(cells)
            if rows:
                blocks.append(("t", rows))
    return blocks


def _pdf_blocks(data: bytes) -> list:
    if pdfplumber is None:
        raise ValueError("PDF files can't be read on this server (pdfplumber is missing).")
    blocks = []
    try:
        pdf = pdfplumber.open(io.BytesIO(data))
    except Exception:
        raise ValueError("That PDF couldn't be opened. Save it again as PDF and retry.")
    pages = []  # [[block, ...] per page]
    with pdf:
        for page in pdf.pages[:30]:
            items = []  # (top, block)
            tables = page.find_tables()
            boxes = [t.bbox for t in tables]
            for t in tables:
                rows = []
                for r in t.extract():
                    cells = [_clean_cell(c) for c in r]  # spanned cells come back empty
                    if any(cells):
                        rows.append(cells)
                if rows:
                    items.append((t.bbox[1], ("t", rows)))

            def outside(obj, boxes=boxes):
                cx, cy = (obj["x0"] + obj["x1"]) / 2, (obj["top"] + obj["bottom"]) / 2
                return not any(b[0] <= cx <= b[2] and b[1] <= cy <= b[3] for b in boxes)

            body = page.filter(outside) if boxes else page
            for line in body.extract_text_lines(keep_blank_chars=False):
                text = _clean(line.get("text"))
                if text:
                    items.append((line["top"], ("p", text)))
            items.sort(key=lambda x: x[0])
            pages.append([b for _, b in items])
    # Letterhead and footer lines repeat on every page ("Email Address: …",
    # "Republic of the Philippines", "Page 2 of 5"); drop them so they aren't
    # taken for committee names or section text. The first page keeps its
    # letterhead (harmless there: the brief comes after it).
    seen = {}
    for pg in pages:
        for t in {_norm(re.sub(r"\d+", "#", b[1])) for b in pg if b[0] == "p"}:
            seen[t] = seen.get(t, 0) + 1
    repeated = {t for t, n in seen.items() if n >= 2 and len(pages) >= 2}
    for i, pg in enumerate(pages):
        for b in pg:
            if i > 0 and b[0] == "p" and (_norm(re.sub(r"\d+", "#", b[1])) in repeated or _is_page_furniture(b[1])):
                continue
            blocks.append(b)
    return blocks


def _is_page_furniture(text: str) -> bool:
    """Contact details and page numbers from a letterhead or footer."""
    return bool(re.search(r"\S+@\S+\.\w+|^\s*page\s+\d+(\s+of\s+\d+)?\s*$|^\s*\d+\s*$"
                          r"|^(?:email|e-mail|tel|telephone|contact|mobile|website|facebook|address)(?:\s+\w+)?\s*(?:no\.?)?\s*:",
                          text, re.I))


def _ocr_blocks(data: bytes, mime: str) -> list:
    import certificate_reader as cr  # OCR helpers (Tesseract)
    out = cr.extract(data, mime)
    if not out.get("ocr_available"):
        raise ValueError("Photos and scanned files can't be read on this server (OCR is not installed).")
    return [("p", _clean(l)) for l in (out.get("text") or "").splitlines() if _clean(l)]


def _blocks_for(filename: str, data: bytes) -> tuple:
    """(blocks, method)."""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in (filename or "") else ""
    if ext == ".doc":
        raise ValueError("Old .doc files aren't supported. In Word, use Save As → Word Document (.docx).")
    if ext not in KINDS:
        raise ValueError("Upload the proposal as a Word file (.docx), a PDF, or a photo (PNG, JPG or WEBP).")
    if len(data) > MAX_BYTES:
        raise ValueError("The file is larger than 15 MB.")
    if not KINDS[ext](data):
        raise ValueError("The file's contents don't match its type. Upload the original file.")
    if ext == ".docx":
        return _docx_blocks(data), "docx"
    if ext == ".pdf":
        blocks = _pdf_blocks(data)
        if sum(len(b[1]) for b in blocks if b[0] == "p") >= 80 or any(b[0] == "t" for b in blocks):
            return blocks, "pdf-text"
        return _ocr_blocks(data, "application/pdf"), "ocr"  # scanned PDF
    mime = {".png": "image/png", ".webp": "image/webp"}.get(ext, "image/jpeg")
    return _ocr_blocks(data, mime), "ocr"


# ── Recognising headings, labels and tables ───────────────────────────────────

def _norm(s: str) -> str:
    """Lowercase words only: 'VII. Proposed  Budget:' → 'vii proposed budget'."""
    return " ".join(re.sub(r"[^a-z0-9 ]+", " ", (s or "").lower()).split())


# Section headings, matched against the normalized paragraph (roman numeral optional).
SECTIONS = [
    ("brief", r"proposal brief|project brief|activity brief"),
    ("rationale", r"rationale|background|justification"),
    ("objectives", r"objectives?|goals? and objectives"),
    ("methodology", r"methodology|methods?|implementation plan|strategies"),
    ("matrix", r"activity matrix|matrix of activities|schedule of activities|program of activities|activity schedule"),
    ("committee", r"working committees?|committees?|management committee"),
    ("exec", r"(?:[a-z]\s*)?executive committee"),
    ("twg", r"(?:[a-z]\s*)?technical working group(?: twg)?|twg"),
    ("budget", r"(?:proposed )?budget(?:ary requirements?)?|budget estimates?|financial plan"),
    ("monitoring", r"monitoring (?:and|&) evaluation|monitoring|evaluation"),
    ("indicators", r"observation tool(?: indicators)?|indicators"),
]


def _section_of(text: str) -> Optional[str]:
    """Section key when a paragraph is a heading (short, maybe numbered)."""
    if len(text) > 70:
        return None
    n = _norm(text)
    # "vii proposed budget" → "proposed budget"; OCR reads II/III/VII as Il/Ill/Vil.
    n = re.sub(r"^(?:[ivxl1]+|\d+)\s+", "", n)
    for key, pat in SECTIONS:
        if re.fullmatch(pat, n):
            return key
    return None


# Brief labels → form key. Matched at the start of a line / first cell.
BRIEF_LABELS = [
    ("title", r"title(?: of (?:the )?(?:activity|project|event|proposal))?|project title|activity title|name of (?:the )?(?:activity|event|project)"),
    ("nature", r"nature(?: of (?:the )?activity)?|type of activity|classification"),
    ("targetDate", r"(?:target |proposed |inclusive )?dates?(?: of (?:implementation|activity|the activity))?|schedule|when"),
    ("time", r"time|inclusive time"),
    ("venue", r"(?:proposed )?venue|location|place|where"),
    ("participants", r"(?:target )?participants|target (?:audience|beneficiaries)|beneficiaries"),
    ("outputs", r"expected outputs?|outputs?|expected outcomes?"),
    ("budget", r"(?:proposed |total |estimated )?budget(?: requirement)?|amount"),
    ("fundSource", r"source(?:s)? of funds?|fund source|funding source|charging"),
    ("focal", r"focal person|proponent|contact person|person in charge|coordinator"),
]
_LABEL_RE = re.compile(r"^\s*(?:[a-i][.)]\s*)?([A-Za-z][A-Za-z /&()-]{1,48}?)\s*[:\-–]\s*(.*)$")


# Exact brief labels from the school's format, matched as a line prefix when the
# separator is missing ("c. Target Date December 12, 2026" from OCR).
_PREFIX_LABELS = [
    ("title", "title"), ("nature", "nature of activity"), ("targetDate", "target date"),
    ("venue", "proposed venue"), ("participants", "target participants"),
    ("outputs", "expected outputs"), ("budget", "proposed budget"),
    ("fundSource", "source of fund"), ("focal", "focal person"),
]
_ENUM = r"^\s*[a-i][.),]\s*"


def _label_prefix(line: str) -> Optional[tuple]:
    """(key, rest) for '[a.] <label> value' lines; the enumerator is required
    except for the multi-word labels, so ordinary sentences aren't taken."""
    enum = re.match(_ENUM, line)
    body = line[enum.end():] if enum else line
    for key, label in _PREFIX_LABELS:
        m = re.match(r"(?i)" + r"\s+".join(map(re.escape, label.split())) + r"s?\b(.*)$", body)
        if m and (enum or " " in label):
            return key, m.group(1)
    return None


def _value(s: str) -> str:
    """Drop separators OCR and tables leave in front of a value (': | _')."""
    return re.sub(r"^[\s:|_;]+", "", s or "").strip()


def _keep_lines(s: str, wrapped: bool) -> str:
    """A cell whose line breaks matter (a description with bullets). In a PDF,
    text also breaks where it wrapped inside the cell; rejoin those lines
    unless the next one starts a new bullet/number or the previous one ended
    a sentence."""
    lines = [l.strip() for l in (s or "").splitlines() if l.strip()]
    if not wrapped or len(lines) < 2:
        return "\n".join(lines)
    # A line wrapped when the next word didn't fit after it; if it would have
    # fit (a heading like "Leads the committee", a paragraph's last line), the
    # break was typed. The cell's width ≈ its longest line.
    full = max(len(l) for l in lines)
    out, prev = [lines[0]], lines[0]
    for l in lines[1:]:
        new_item = re.match(r"^(?:[-•▪●◦*–]|\(?\d{1,2}[.)]|\(?[a-z][.)])\s+", l)
        would_fit = len(prev) + 1 + len(l.split()[0]) <= 0.9 * full
        if not new_item and not would_fit and not prev.endswith((".", ";", ":")):
            out[-1] = out[-1] + " " + l
        else:
            out.append(l)
        prev = l
    return "\n".join(out)


def _one_line(s: str) -> str:
    """Text that wrapped inside a PDF table cell, back on one line."""
    return " ".join((s or "").split())


def _brief_label(raw: str) -> Optional[str]:
    n = _norm(re.sub(r"^\s*[a-i][.)]\s*", "", raw))
    for key, pat in BRIEF_LABELS:
        if re.fullmatch(pat, n):
            return key
    return None


def _table_kind(header: list) -> Optional[str]:
    h = " | ".join(_norm(c) for c in header)
    has = lambda *words: all(w in h for w in words)
    if has("day") and has("time") and ("event" in h or "activit" in h or "session" in h or "topic" in h):
        return "matrix"
    if ("phase" in h or "stage" in h) and "activit" in h:
        return "phases"
    if has("particular") and ("participant" in h or "pax" in h):
        return "snacks"
    if (has("particular") or has("item")) and ("quantity" in h or "qty" in h or "unit" in h or "cost" in h or "amount" in h):
        return "materials"
    if has("name") and ("terms" in h or "output" in h or "reference" in h or "responsibilit" in h or "function" in h):
        return "twg"
    if has("name") and ("position" in h or "designation" in h):
        return "exec"
    if has("male") and has("female"):
        return "participants"
    if "indicator" in h:
        return "indicators"
    return None


def _is_header_row(row: list) -> bool:
    """Column headings are short labels without numbers ("Terms of Reference",
    "No. of Participants"); data rows ("Phase 3 | … | Evaluation of the
    activity") have numbers or longer text."""
    cells = [c for c in row if c]
    return bool(cells) and all(len(c) <= 32 and len(c.split()) <= 5 and not re.search(r"\d", c)
                               for c in cells)


def _col(header: list, *patterns) -> Optional[int]:
    for i, c in enumerate(header):
        n = _norm(c)
        if any(re.search(p, n) for p in patterns):
            return i
    return None


def _cell(row: list, i: Optional[int]) -> str:
    return row[i] if i is not None and i < len(row) else ""


def _is_total_row(row: list) -> bool:
    first = _norm(next((c for c in row if c), ""))
    return first.startswith(("total", "grand total", "sub total", "subtotal", "overall total"))


def _strip_bullet(s: str) -> str:
    return re.sub(r"^\s*(?:[-•▪●◦*–]|\(?\d{1,2}[.)]|\(?[a-z][.)])\s+", "", s).strip()


def _long_date(text: str) -> str:
    """'October 1, 2026' when the date is understood, else the text as written."""
    d = parse_event_date(text)
    if isinstance(d, date):
        return f"{MONTHS[d.month - 1]} {d.day}, {d.year}"
    return text.strip()


def _money(text: str) -> str:
    m = re.search(r"(?:₱|php|p)?\s*([0-9][0-9,]*(?:\.\d{1,2})?)", text, re.I)
    return m.group(1) if m else text.strip()


def _int(text: str) -> int:
    m = re.search(r"\d+", text or "")
    return int(m.group()) if m else 0


# ── Parsing ───────────────────────────────────────────────────────────────────

def _empty_form() -> dict:
    return {
        "title": "", "nature": "", "targetDate": "", "venue": "", "time": "",
        "budget": "", "fundSource": "", "focalName": "", "focalRole": "", "focalContact": "",
        "participants": [], "outputs": [], "rationale": "", "objectives": "",
        "phases": [], "matrix": [], "materials": [], "snacks": [], "exec": [], "twg": [],
        "monitoring": "", "indicators": [], "signatories": [],
    }


def _apply_brief(form: dict, key: str, value: str, pending: dict):
    """Store one brief value; multi-line fields keep collecting in `pending`."""
    value = _value(value)
    if key in ("title", "targetDate", "time", "venue", "budget", "fundSource"):
        value = _one_line(value)
    if key == "title":
        form["title"] = form["title"] or value.strip('"“” ')
    elif key == "nature":
        form["nature"] = form["nature"] or _nature(value)
    elif key == "targetDate":
        form["targetDate"] = form["targetDate"] or (_long_date(value) if value else "")
    elif key == "time":
        form["time"] = form["time"] or value
    elif key == "venue":
        form["venue"] = form["venue"] or value
    elif key == "budget":
        form["budget"] = form["budget"] or (_money(value) if value else "")
    elif key == "fundSource":
        form["fundSource"] = form["fundSource"] or value
    elif key == "outputs":
        form["outputs"].extend(_strip_bullet(l) for l in value.splitlines() if _strip_bullet(l))
    elif key == "focal":
        _focal(form, value)
    pending["key"] = key


def _nature(value: str) -> str:
    """The ticked nature (☑ Co-curricular ☐ …), or the one named."""
    v = value.replace("\n", " ")
    for mark in ("☑", "☒", "✓", "✔", "■", "[x]", "[X]", "(x)", "(X)", "/"):
        for n in NATURES:
            if re.search(re.escape(mark) + r"\s*" + re.escape(n) + r"\b", v, re.I):
                return n
    named = [n for n in NATURES if re.search(r"(?<![a-z-])" + re.escape(n) + r"\b", v, re.I)]
    if len(named) == 1:
        return named[0]
    # OCR turns boxes into characters: an empty box reads as O/0/o/□, a ticked
    # one as anything else (4, v, M …). One odd mark out of three → that one.
    marks = {}
    for n in NATURES:
        m = re.search(r"(\S)\s*(?<![-\w])" + re.escape(n) + r"\b", v, re.I)
        if m:
            marks[n] = m.group(1)
    ticked = [n for n, c in marks.items() if c not in "O0o□☐[(|"]
    return ticked[0] if len(marks) == 3 and len(ticked) == 1 else ""


def _focal(form: dict, value: str):
    lines = [l.strip() for l in re.split(r"\n|,(?=\s*(?:CP|Cel|Contact|Mobile|0?9\d))", value) if l.strip()]
    for l in lines:
        phone = re.search(r"(\+?63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}", l)
        if phone or re.match(r"(cp|cel|contact|mobile)", l, re.I):
            form["focalContact"] = form["focalContact"] or (phone.group() if phone else re.sub(r"^[^0-9+]*", "", l))
        elif not form["focalName"]:
            form["focalName"] = l
        elif not form["focalRole"]:
            form["focalRole"] = l


def _parse_table(form: dict, rows: list, section: Optional[str], last: dict, warnings: list):
    """Route one table to the form field its columns describe."""
    header, kind, body = rows[0], None, rows[1:]
    # The heading row isn't always first: a committee title row ("Supervising
    # Committee") or a caption can sit above it inside the same table.
    for i, r in enumerate(rows[:3]):
        k = _table_kind(r) if _is_header_row(r) else None
        if k:
            header, kind, body = r, k, rows[i + 1:]
            above = [v for row in rows[:i] for v in row if v]
            if k == "twg" and above:
                last["twg_title"] = _one_line(above[-1]).rstrip(":")
                last.pop("continuing_twg", None)
            break
    if kind is None:
        # A brief laid out as a table: "a. Title | : | value".
        labelled = [r for r in rows if r and _brief_label(r[0])]
        if len(labelled) >= 2 or (labelled and section == "brief"):
            pending = {}
            for r in rows:
                key = _brief_label(r[0]) if r else None
                vals = [c for c in r[1:] if c and c != ":"]
                if key and key != "participants":
                    _apply_brief(form, key, "\n".join(vals), pending)
                elif key == "participants" and len(r) >= 4:
                    pass  # an inline participants grid is rare; leave for review
            return
        # A table without a heading row that continues the previous one (page break).
        if last.get("kind") and len(header) == last.get("ncols"):
            kind, body, header = last["kind"], rows, last["header"]
        # Headerless committee tables inside the working-committee section.
        elif section in ("exec", "twg", "committee") and len(header) in (2, 4, 5):
            kind = "exec" if len(header) == 2 else "twg"
            header = (["Name", "Position"] if kind == "exec"
                      else ["Name", "Designation", "Terms of Reference", "Output"])
            body = rows
        elif section == "matrix" and len(header) >= 4:
            kind, header, body = "matrix", ["Day", "Time", "Event", "Speaker"], rows
        else:
            return
    last.update(kind=kind, ncols=len(header), header=header)
    # A heading row repeated further down (new page, next committee) is not data.
    body = [r for r in body if r != header and not (_is_header_row(r) and _table_kind(r) == kind)]

    if kind == "matrix":
        cd, ct = _col(header, r"^day|date"), _col(header, r"^time")
        ce = _col(header, r"event|activit|session|topic|program")
        cs = _col(header, r"speaker|facilitator|resource|person|in charge|lecturer")
        day = ""
        for r in body:
            if _is_total_row(r):
                continue
            day = _cell(r, cd) or day  # merged "Day" cell covers following rows
            item = {"day": _one_line(day), "time": _one_line(_cell(r, ct)),
                    "event": _one_line(_cell(r, ce)), "speaker": _one_line(_cell(r, cs))}
            if item["time"] or item["event"]:
                form["matrix"].append(item)
    elif kind == "phases":
        cst = _col(header, r"stage|phase")
        ca = _col(header, r"activit")
        for r in body:
            stage = _cell(r, cst)
            if cst is not None and re.fullmatch(r"phase\s*\d+", _norm(stage)) and len(r) >= 3:
                stage = r[1]  # "Phase 1 | Stage | Activities"
            acts = _cell(r, ca)
            if stage or acts:
                form["phases"].append({"stage": stage, "activities": acts})
    elif kind == "materials":
        ci = _col(header, r"particular|item|description")
        cq = _col(header, r"quantit|qty|unit|no")
        cc = _col(header, r"cost|price")
        ctot = _col(header, r"total|amount")
        for r in body:
            if _is_total_row(r) or not _cell(r, ci):
                continue
            form["materials"].append({"item": _one_line(_cell(r, ci)), "qty": _one_line(_cell(r, cq)),
                                      "cost": _money(_cell(r, cc)) if _cell(r, cc) else "",
                                      "total": _money(_cell(r, ctot)) if _cell(r, ctot) else ""})
    elif kind == "snacks":
        ci = _col(header, r"particular|item")
        cp = _col(header, r"participant|pax")
        cc = _col(header, r"cost")
        ctot = _col(header, r"total|amount")
        for r in body:
            if _is_total_row(r) or not _cell(r, ci):
                continue
            form["snacks"].append({"item": _one_line(_cell(r, ci)), "pax": _one_line(_cell(r, cp)),
                                   "cost": _money(_cell(r, cc)) if _cell(r, cc) else "",
                                   "total": _money(_cell(r, ctot)) if _cell(r, ctot) else ""})
    elif kind == "exec":
        cn, cp = _col(header, r"name"), _col(header, r"position|designation")
        for r in body:
            if len(set(c for c in r if c)) == 1 and len(r) == 1:
                continue
            if _cell(r, cn):
                form["exec"].append({"name": _one_line(_cell(r, cn)), "position": _one_line(_cell(r, cp))})
    elif kind == "twg":
        cn = _col(header, r"name|member")
        cd = _col(header, r"designation|position|role")
        ct = _col(header, r"terms|reference|responsibilit|function|duties")
        co = _col(header, r"output|deliverable")
        title = last.pop("twg_title", None)
        group = None
        if form["twg"] and title is None and last.get("continuing_twg"):
            group = form["twg"][-1]
        for r in body:
            vals = [c for c in r if c]
            if r and r[0] and all(not c or c == r[0] for c in r[1:]) and (len(r) == 1 or len(vals) < len(r)):
                # A full-width (merged) row naming the committee: text in the first column only.
                group = {"title": _one_line(vals[0]).rstrip(":"), "members": []}
                form["twg"].append(group)
                continue
            if not _cell(r, cn):
                # The rest of a member's row that broke onto the next page.
                prev = group["members"][-1] if group and group["members"] else None
                if prev and vals:
                    wrapped = last.get("wrapped", False)
                    for key, ci in (("designation", cd), ("tor", ct), ("output", co)):
                        more = _cell(r, ci)
                        if more:
                            prev[key] = (_keep_lines(prev[key] + "\n" + more, wrapped) if key == "tor"
                                         else _one_line(prev[key] + " " + more))
                continue
            if group is None:
                group = {"title": title or "Technical Working Group", "members": []}
                form["twg"].append(group)
            group["members"].append({"name": _one_line(_cell(r, cn)), "designation": _one_line(_cell(r, cd)),
                                     "tor": _keep_lines(_cell(r, ct), last.get("wrapped", False)), "output": _one_line(_cell(r, co))})
        last["continuing_twg"] = True
    elif kind == "participants":
        cm, cf = _col(header, r"^male"), _col(header, r"female")
        for r in body:
            if _is_total_row(r) or not r or not r[0]:
                continue
            form["participants"].append({"category": _one_line(r[0]), "male": _int(_cell(r, cm)), "female": _int(_cell(r, cf))})
    elif kind == "indicators":
        ci = _col(header, r"indicator")
        for r in body:
            v = _strip_bullet(_one_line(_cell(r, ci)))
            if v and not _is_total_row(r):
                form["indicators"].append(v)


def parse(blocks: list, line_tables: bool = False, wrapped_cells: bool = False) -> dict:
    """`line_tables`: also read tables from plain text lines (photos and scans,
    where table borders are lost)."""
    form = _empty_form()
    sub = {"budget": None}  # which budget table the lines belong to
    warnings = []
    section = None
    pending = {}   # the brief label whose value continues on following lines
    last = {"wrapped": wrapped_cells}  # previous table (continuation across pages); PDF cell wrapping
    text = {"rationale": [], "objectives": [], "monitoring": [], "methodology_intro": []}
    sig = {"role": None, "lines": []}
    sigs = []

    def flush_sig():
        if sig["role"] and sig["lines"]:
            name = sig["lines"][0]
            title = sig["lines"][1] if len(sig["lines"]) > 1 else ""
            sigs.append({"role": sig["role"], "name": name, "title": title})
        sig.update(role=None, lines=[])

    for kind, val in blocks:
        if kind == "t":
            _parse_table(form, val, section, last, warnings)
            pending = {}
            continue
        line = val
        heading = _section_of(line)
        if heading:
            flush_sig()
            section = heading
            pending = {}
            sub["budget"] = None
            if heading != "twg":
                last.pop("continuing_twg", None)
            continue
        # "Prepared by:" / signatories ("Noted:", "Recommending Approval:" …) close the document.
        if re.match(r"^(prepared|submitted)(?: by)?\s*:?\s*$|^proponent\s*:\s*$", line, re.I):
            flush_sig()
            section = "signatories"
            continue
        sm = re.match(r"^(noted|endorsed|recommending approval|approved)(?: by)?\s*:?\s*(.*)$", line, re.I)
        if sm and len(line) < 80:
            flush_sig()
            sig["role"] = next(r for r in SIGNATORY_ROLES if r.lower() == sm.group(1).lower())
            if sm.group(2).strip():
                sig["lines"].append(sm.group(2).strip())
            section = "signatories"
            continue
        if section == "signatories":
            if re.match(r"^(prepared|proponent|submitted)", line, re.I):
                flush_sig()
                continue
            if sig["role"] and len(sig["lines"]) < 2:
                sig["lines"].append(line)
            continue

        # Brief "label: value" lines can appear anywhere before the rationale.
        lm = _LABEL_RE.match(line)
        key = _brief_label(lm.group(1)) if lm else _brief_label(line.rstrip(":")) if line.endswith(":") else None
        rest = lm.group(2) if lm else ""
        if not key and section in (None, "brief"):
            hit = _label_prefix(line)  # no separator (OCR)
            if hit:
                key, rest = hit
        if key and section in (None, "brief"):
            _apply_brief(form, key, rest, pending)
            continue
        if section in (None, "brief") and pending.get("key") == "participants":
            pm = re.match(r"^\W*([A-Za-z][A-Za-z /&()'.-]+?)\s+(\d+)\s+(\d+)(?:\s+\d+)?\W*$", line)
            if pm and not _norm(pm.group(1)).startswith("total"):
                form["participants"].append({"category": pm.group(1).strip(),
                                             "male": int(pm.group(2)), "female": int(pm.group(3))})
            continue
        if line_tables and _table_line(form, section, sub, line):
            continue
        if section in (None, "brief"):
            # Value lines under a label ("f. Expected Outputs:" then bullets).
            k = pending.get("key")
            if k == "outputs":
                form["outputs"].append(_strip_bullet(line))
            elif k == "focal":
                _focal(form, line)
            elif k in ("title", "venue", "fundSource", "nature", "targetDate", "time", "budget"):
                _apply_brief(form, k, line, pending)
                pending = {}
            elif section is None and not form["title"] and len(line) < 120 and line.isupper() and len(line.split()) >= 2:
                pass  # letterhead lines (Republic of the Philippines …) are skipped
            continue
        if section == "twg" and len(line) < 80 and not line.endswith(".") and not _is_page_furniture(line):
            last["twg_title"] = line.rstrip(":")  # committee name above its table
            last.pop("continuing_twg", None)
            continue
        if section in ("rationale", "objectives", "monitoring"):
            text[section].append(line)
        elif section == "indicators":
            if re.match(r"(?i)^\W*indicators?\b", line):
                continue  # the table's heading row, read as text
            v = _strip_bullet(re.sub(r"[|_]+", " ", line))
            v = _trim_box_noise(v)  # empty Evident/Not Evident boxes read as "a ee eee"
            if v and len(v) > 3:
                form["indicators"].append(v)
    flush_sig()

    form["rationale"] = _paragraphs(text["rationale"])
    objectives = [l for l in text["objectives"] if not l.rstrip().endswith(":")]
    form["objectives"] = "\n".join(_strip_bullet(l) for l in _join_wrapped(objectives))
    form["monitoring"] = _paragraphs(text["monitoring"])
    form["signatories"] = sigs
    return form


_TIME = r"\d{1,2}(?::\d{2})?\s*(?:[AaPp]\.?[Mm]\.?)?\s*(?:-|–|to)\s*\d{1,2}(?::\d{2})?\s*[AaPp]\.?[Mm]\.?"
_AMOUNT = r"(?:₱|P|Php)?\s*\d[\d,]*\.\d{2}"
_STAGE = r"(pre-?\s*i?l?mplementation(?:\s+stage)?|post-?\s*i?l?mplementation(?:\s+stage)?|i?l?mplementation(?:\s+stage)?|planning(?:\s+stage)?|evaluation(?:\s+stage)?)"


def _table_line(form: dict, section: Optional[str], sub: dict, line: str) -> bool:
    """One text line of a table whose borders were lost (OCR). True if used."""
    clean = re.sub(r"[|«»_]+", " ", line).strip()
    n = _norm(clean)
    if section == "methodology":
        m = re.match(r"(?i)^phase\s*(\d+)\s+" + _STAGE + r"\s*(.*)$", clean)
        if m:
            stage = re.sub(r"(?i)i?l?mplementation", "Implementation", m.group(2))
            form["phases"].append({"stage": stage, "activities": m.group(3).strip()})
            return True
        if form["phases"] and not re.match(r"(?i)^(phase|stage|activities)\b", clean):
            p = form["phases"][-1]
            p["activities"] = (p["activities"] + "\n" + clean).strip()
            return True
    elif section == "matrix":
        m = re.search(_TIME, clean)
        if m:
            before, after = clean[:m.start()].strip(" ,"), clean[m.end():].strip()
            day = before if parse_event_date(before) else (form["matrix"][-1]["day"] if form["matrix"] else before)
            form["matrix"].append({"day": day, "time": m.group().strip(), "event": after, "speaker": ""})
            return True
    elif section == "exec" and not re.match(r"(?i)^name\b", clean):
        # "LIZA RAMOS Principal": the name in capitals, then the position.
        m = re.match(r"^((?:[A-ZÑ][A-ZÑ.'-]*\s+){1,5}[A-ZÑ][A-ZÑ.'-]+)\s+([A-Z][a-z].*)$", clean)
        if m:
            form["exec"].append({"name": m.group(1), "position": m.group(2)})
            return True
    elif section == "budget":
        if re.match(r"(?i)^(?:[a-z][.)]\s*)?(?:training )?(?:materials|supplies)", clean):
            sub["budget"] = "materials"
            return True
        if re.match(r"(?i)^(?:[a-z][.)]\s*)?(?:snacks|meals|food)", clean) and not re.search(_AMOUNT, clean):
            sub["budget"] = "snacks"
            return True
        amounts = re.findall(_AMOUNT, clean)
        if amounts and not n.startswith(("total", "grand total", "sub total")):
            head = clean[:clean.find(amounts[0].strip())].strip()
            total = _money(amounts[-1])
            cost = _money(amounts[-2]) if len(amounts) >= 2 else ""
            qm = re.search(r"(\d+\s*(?:pax|pcs|pieces|reams?|boxes|box|packs?|sets?|bottles?|rolls?|units?)\.?)$", head, re.I)
            qty = qm.group(1) if qm else ""
            item = head[:qm.start()].strip() if qm else head
            if not item:
                return False
            if sub["budget"] == "snacks":
                form["snacks"].append({"item": item, "pax": qty, "cost": cost, "total": total})
            else:
                form["materials"].append({"item": item, "qty": qty, "cost": cost, "total": total})
            return True
    return False


_SHORT_WORDS = {"a", "an", "the", "of", "to", "in", "on", "at", "for", "and", "or", "by", "is",
                "are", "it", "be", "as", "day", "way", "use", "set", "all", "per", "pm", "am",
                "who", "how", "why", "its", "own", "new", "one", "two", "can", "do", "did", "has", "had"}


def _trim_box_noise(v: str) -> str:
    """Drop trailing OCR noise ('… article a ee eee'): two or more short tokens
    at the end, at least one of which isn't an ordinary short word."""
    m = re.search(r"(?:\s+[A-Za-z]{1,3}){2,}\s*$", v)
    if m and any(w.lower() not in _SHORT_WORDS for w in m.group().split()):
        return v[:m.start()].strip()
    return v


def _join_wrapped(lines: list) -> list:
    """PDF lines wrap mid-sentence; join a line to the previous one unless it
    starts a new numbered/bulleted item."""
    out = []
    for l in lines:
        if out and not re.match(r"^\s*(?:[-•▪●◦*–]|\(?\d{1,2}[.)]|\(?[a-z][.)])\s+", l) \
                and not out[-1].rstrip().endswith((".", ";", ":")):
            out[-1] = out[-1].rstrip() + " " + l.strip()
        else:
            out.append(l.strip())
    return out


def _paragraphs(lines: list) -> str:
    """Wrapped lines back into paragraphs (blank line between paragraphs)."""
    paras, cur = [], []
    for l in lines:
        cur.append(l.strip())
        if l.rstrip().endswith((".", "!", "?", ":")) and len(l) < 95:
            paras.append(" ".join(cur))
            cur = []
    if cur:
        paras.append(" ".join(cur))
    return "\n\n".join(p for p in paras if p)


SECTION_FIELDS = [  # (wizard step label, form keys that count as "found")
    ("Proposal Brief", ("title", "targetDate", "venue", "budget", "fundSource", "focalName", "outputs", "participants")),
    ("Rationale & Objectives", ("rationale", "objectives")),
    ("Methodology", ("phases",)),
    ("Activity Matrix", ("matrix",)),
    ("Budget", ("materials", "snacks")),
    ("Working Committee", ("exec", "twg")),
    ("Monitoring & Evaluation", ("monitoring", "indicators")),
]


IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp")
MAX_PAGES = 12


def read(files: list) -> dict:
    """files: [(filename, bytes)] — one Word/PDF file, or the photos of the
    pages in order. → {form, method, sections: [{label, found, fields}], warnings}."""
    if not files:
        raise ValueError("Choose the proposal file to upload.")
    if len(files) > 1:
        if not all((name or "").lower().endswith(IMAGE_EXTS) for name, _ in files):
            raise ValueError("Upload one Word or PDF file, or several photos (one per page) — not a mix.")
        if len(files) > MAX_PAGES:
            raise ValueError(f"Upload at most {MAX_PAGES} page photos at a time.")
        blocks = []
        for name, data in files:
            blocks += _blocks_for(name, data)[0]
        method = "ocr"
    else:
        blocks, method = _blocks_for(*files[0])
    if not blocks:
        raise ValueError("No text could be read from this file. If it's a photo, retake it in good light, flat and in focus.")
    has_tables = any(b[0] == "t" for b in blocks)
    form = parse(blocks, line_tables=(method == "ocr" or not has_tables),
                 wrapped_cells=(method == "pdf-text"))
    warnings = []
    if method == "ocr":
        warnings.append("This file was read with OCR (photo or scanned copy). Check every field, "
                        "especially the tables, before submitting.")
        if not form["twg"]:
            warnings.append("The committee (Technical Working Group) table can't be read reliably from a "
                            "photo. Add its members in the Budget step, or upload the Word or PDF file.")
        if any(not r["speaker"] for r in form["matrix"]):
            warnings.append("In the Activity Matrix, the event and the speaker were read as one text. "
                            "Move each speaker's name into the Speaker column.")
    if not form["nature"]:
        warnings.append("The nature of the activity (Curricular / Co-curricular / Extra-curricular) "
                        "wasn't found. Choose it in the Proposal Brief.")
    if form["time"] and not any(r.get("time") for r in form["matrix"]):
        warnings.append(f"The proposal gives the time as \"{form['time']}\". Add it to the Activity Matrix rows.")
    if form["targetDate"] and parse_event_date(form["targetDate"]) is None:
        warnings.append(f"The target date \"{form['targetDate']}\" wasn't understood. Pick it on the calendar.")
    sections = []
    for label, keys in SECTION_FIELDS:
        got = [k for k in keys if form.get(k)]
        sections.append({"label": label, "found": bool(got), "fields": got})
    if not any(s["found"] for s in sections):
        raise ValueError("This doesn't look like an event proposal: none of its sections "
                         "(Proposal Brief, Rationale, Activity Matrix, Budget …) were found.")
    return {"form": form, "method": method, "sections": sections, "warnings": warnings}

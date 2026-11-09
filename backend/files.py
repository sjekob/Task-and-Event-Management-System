"""File-upload sanitation.

Protects the upload endpoints against:
  • Path traversal — user-supplied filenames are stripped to a safe basename and
    the final write path is asserted to stay inside the uploads directory.
  • Dangerous/oversized files — extension allowlist + a configurable size cap.
"""
import os
import re
import secrets
import datetime

from fastapi import HTTPException, UploadFile

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Configurable via env (see .env.example).
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "15")) * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".txt", ".csv", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".zip",
}

# What the first bytes must be for these types (the rest can't be checked this
# cheaply). Office files (docx/xlsx/pptx) and zip are zip archives; old .doc/.xls/.ppt
# are OLE compound files.
_ZIP = (bytes.fromhex("504b0304"), bytes.fromhex("504b0506"))
_OLE = (bytes.fromhex("d0cf11e0a1b11ae1"),)
_SIGNATURES = {
    ".pdf": (b"%PDF-",),
    ".png": (bytes.fromhex("89504e470d0a1a0a"),),
    ".jpg": (bytes.fromhex("ffd8ff"),), ".jpeg": (bytes.fromhex("ffd8ff"),),
    ".gif": (b"GIF87a", b"GIF89a"),
    ".docx": _ZIP, ".xlsx": _ZIP, ".pptx": _ZIP, ".zip": _ZIP,
    ".doc": _OLE, ".xls": _OLE, ".ppt": _OLE,
}
_NUL = bytes(1)


def _matches_type(ext: str, data: bytes) -> bool:
    """False when the file's contents clearly aren't the type its name claims."""
    if ext == ".webp":
        return data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if ext in (".txt", ".csv"):
        return _NUL not in data[:4096]  # text, not a renamed binary
    sigs = _SIGNATURES.get(ext)
    return sigs is None or data.startswith(sigs)


_SAFE_CHARS = re.compile(r"[^A-Za-z0-9._-]+")


def _sanitize_name(original: str) -> str:
    """Return a safe `<name><ext>` basename for a user-supplied filename, or
    raise 400 if the extension isn't allowed."""
    # Drop any directory components (handle both / and \\ separators).
    base = os.path.basename((original or "").replace("\\", "/").split("/")[-1])
    name, ext = os.path.splitext(base)
    ext = ext.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type '{ext or 'unknown'}' is not allowed.")
    name = _SAFE_CHARS.sub("_", name).strip("._-")[:80] or "file"
    return name + ext


async def save_upload(file: UploadFile, prefix: str = "") -> dict:
    """Validate and store an upload. Returns {'url', 'name'}.

    `prefix` (e.g. "<task>_<user>_") is prepended to the timestamped stored name.
    """
    safe_name = _sanitize_name(file.filename)

    # Enforce the size cap without buffering an unbounded amount.
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.")

    if not _matches_type(os.path.splitext(safe_name)[1], data):
        raise HTTPException(400, "The file's contents don't match its type. Check the file and try again.")

    # The random part makes stored file URLs impossible to guess.
    ts = int(datetime.datetime.now().timestamp())
    stored = f"{prefix}{ts}_{secrets.token_urlsafe(9)}_{safe_name}"

    # Final guard: the resolved destination must stay inside UPLOAD_DIR.
    dest = os.path.realpath(os.path.join(UPLOAD_DIR, stored))
    if not dest.startswith(os.path.realpath(UPLOAD_DIR) + os.sep):
        raise HTTPException(400, "Invalid file path.")

    with open(dest, "wb") as out:
        out.write(data)
    return {"url": f"/uploads/{stored}", "name": safe_name}

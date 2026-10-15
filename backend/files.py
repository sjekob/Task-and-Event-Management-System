"""File-upload sanitation.

Protects the upload endpoints against:
  • Path traversal — user-supplied filenames are stripped to a safe basename and
    the final write path is asserted to stay inside the uploads directory.
  • Dangerous/oversized files — extension allowlist + a configurable size cap.
"""
import os
import re
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

    ts = int(datetime.datetime.now().timestamp())
    stored = f"{prefix}{ts}_{safe_name}"

    # Final guard: the resolved destination must stay inside UPLOAD_DIR.
    dest = os.path.realpath(os.path.join(UPLOAD_DIR, stored))
    if not dest.startswith(os.path.realpath(UPLOAD_DIR) + os.sep):
        raise HTTPException(400, "Invalid file path.")

    with open(dest, "wb") as out:
        out.write(data)
    return {"url": f"/uploads/{stored}", "name": safe_name}

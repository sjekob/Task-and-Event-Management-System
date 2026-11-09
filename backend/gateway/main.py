"""API Gateway — port 8000
Routes all incoming requests to the correct microservice.
Run from backend/: uvicorn gateway.main:app --port 8000

Service map:
  8001  auth       /api/auth, /api/users, /api/subjects, /api/grade-levels, /api/task-types,
                   /api/school-years, /api/notifications,
                   /api/certificates
  8002  personnel  /api/personnel
  8003  tasks      /api/tasks, /api/templates, /api/reports, /api/comments, /uploads
  8004  events     /api/events, /api/deped-calendar
  8005  appraisal  /api/appraisal, /api/dashboard
"""
import ipaddress
import os
import time
from collections import deque

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

from cors import get_cors_config

AUTH_URL       = os.getenv("AUTH_SERVICE_URL",       "http://localhost:8001")
PERSONNEL_URL  = os.getenv("PERSONNEL_SERVICE_URL",  "http://localhost:8002")
TASKS_URL      = os.getenv("TASKS_SERVICE_URL",       "http://localhost:8003")
EVENTS_URL     = os.getenv("EVENTS_SERVICE_URL",      "http://localhost:8004")
APPRAISAL_URL  = os.getenv("APPRAISAL_SERVICE_URL",   "http://localhost:8005")

# Ordered longest-prefix first so /api/task-types matches before /api/tasks
ROUTE_MAP: list[tuple[str, str]] = [
    ("/api/auth",        AUTH_URL),
    ("/api/users",       AUTH_URL),
    ("/api/school-years", AUTH_URL),
    ("/api/notifications", AUTH_URL),
    ("/api/certificates", AUTH_URL),
    ("/api/audit", AUTH_URL),
    ("/api/subjects",    AUTH_URL),
    ("/api/grade-levels", AUTH_URL),
    ("/api/task-types",  AUTH_URL),
    ("/api/personnel",   PERSONNEL_URL),
    ("/api/templates",   TASKS_URL),
    ("/api/upload",      TASKS_URL),   # task attachment files
    ("/api/reports",     TASKS_URL),
    ("/api/comments",    TASKS_URL),
    ("/api/tasks",       TASKS_URL),
    ("/uploads",         TASKS_URL),
    ("/api/events",      EVENTS_URL),
    ("/api/deped-calendar", EVENTS_URL),
    ("/api/appraisal",   APPRAISAL_URL),
    ("/api/dashboard",   APPRAISAL_URL),
]

app = FastAPI(
    title="TaskNet API Gateway",
    description="Routes requests to auth, personnel, tasks, events, and appraisal services.",
    version="1.0.0",
    docs_url="/docs",
)

_cors_origins, _cors_creds = get_cors_config()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_cors_creds,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rate limiting ─────────────────────────────────────────────────────────────
# The gateway is the single public entry point, so the limits here protect
# every downstream service. Sliding windows per client IP: one overall cap, plus
# tighter caps on the endpoints worth attacking (sign-in, the public guest
# pages) or expensive to run (reading files, uploads). Normal use never trips
# them; floods and password guessing get a 429 with Retry-After.
#   (name, methods or None for all, path test, max requests, window seconds)
_RL_RULES = [
    ("login",   {"POST"}, lambda p: p == "/api/auth/login",                               int(os.getenv("RATE_LIMIT_LOGIN", "20")),  60),
    ("public",  None,     lambda p: p.startswith("/api/appraisal/public/") or "/attendance/guest" in p,
                                                                                            int(os.getenv("RATE_LIMIT_PUBLIC", "60")), 60),
    ("heavy",   {"POST"}, lambda p: p.endswith(("/read-proposal", "/analyze", "/scan", "/upload", "/avatar")),
                                                                                            int(os.getenv("RATE_LIMIT_HEAVY", "30")),  60),
    ("writes",  {"POST", "PUT", "PATCH", "DELETE"}, lambda p: True,                         int(os.getenv("RATE_LIMIT_WRITES", "180")), 60),
    ("all",     None,     lambda p: True,                                                   int(os.getenv("RATE_LIMIT_MAX", "600")),   float(os.getenv("RATE_LIMIT_WINDOW", "60"))),
]
_rl_hits: dict[tuple, deque] = {}
_rl_last_sweep = 0.0

# Requests from these addresses are trusted to name the real client in
# X-Forwarded-For (the Vite dev proxy on this machine, Docker's bridge, a
# reverse proxy). From anyone else the header is ignored, so it can't be
# spoofed to dodge the limits.
_TRUSTED_PROXIES = [ipaddress.ip_network(n.strip()) for n in os.getenv(
    "TRUSTED_PROXIES", "127.0.0.0/8,::1/128,172.16.0.0/12").split(",") if n.strip()]


def _client_ip(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    try:
        trusted = any(ipaddress.ip_address(peer) in n for n in _TRUSTED_PROXIES)
    except ValueError:
        trusted = False
    if trusted:
        fwd = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if fwd:
            return fwd
    return peer


def _sweep(now: float):
    """Drops windows with no recent hits so the table can't grow without bound."""
    global _rl_last_sweep
    if now - _rl_last_sweep < 60:
        return
    _rl_last_sweep = now
    longest = max(r[4] for r in _RL_RULES)
    for k in [k for k, dq in _rl_hits.items() if not dq or dq[-1] < now - longest]:
        _rl_hits.pop(k, None)


def _too_many(ip: str, method: str, path: str, now: float):
    """(rule name, seconds to wait) for the first limit this request exceeds, else None."""
    matched = []
    for name, methods, test, limit, window in _RL_RULES:
        if (methods is None or method in methods) and test(path):
            dq = _rl_hits.setdefault((name, ip), deque())
            while dq and dq[0] < now - window:
                dq.popleft()
            if len(dq) >= limit:
                return name, max(1, int(dq[0] + window - now) + 1)
            matched.append(dq)
    for dq in matched:  # count the request only once it's allowed
        dq.append(now)
    return None


_RATE_MESSAGES = {
    "login": "Too many sign-in attempts. Please wait a minute and try again.",
    "public": "Too many requests from this device. Please wait a moment and try again.",
}

# Largest request body accepted (uploads are capped again, per file, downstream).
_MAX_BODY = int(os.getenv("MAX_REQUEST_MB", "25")) * 1024 * 1024

# ── Security headers ──────────────────────────────────────────────────────────
_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",          # no guessing a file's type
    "X-Frame-Options": "DENY",                    # can't be framed (clickjacking)
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
}
# Uploaded files skip X-Frame-Options: the app shows PDFs and text in a frame.
# They can't be web pages (HTML/SVG aren't accepted, and nosniff stops a
# browser from treating a file as anything but its declared type).


def _json(status: int, detail: str, headers: dict = None) -> Response:
    import json as _j
    return Response(content=_j.dumps({"detail": detail}).encode(), status_code=status,
                    media_type="application/json", headers={**_SECURITY_HEADERS, **(headers or {})})


@app.middleware("http")
async def guard(request: Request, call_next):
    path = request.url.path
    if request.method != "OPTIONS" and path != "/health":
        size = request.headers.get("content-length")
        if size and size.isdigit() and int(size) > _MAX_BODY:
            return _json(413, f"The request is too large (limit {_MAX_BODY // (1024 * 1024)} MB).")
        now = time.monotonic()
        _sweep(now)
        hit = _too_many(_client_ip(request), request.method, path, now)
        if hit:
            name, retry = hit
            return _json(429, _RATE_MESSAGES.get(name, "Too many requests. Please slow down."), {"Retry-After": str(retry)})
    response = await call_next(request)
    upload = path.startswith("/uploads/")
    for k, v in _SECURITY_HEADERS.items():
        if not (upload and k == "X-Frame-Options"):
            response.headers.setdefault(k, v)
    if path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")  # personal data stays out of caches
    return response


def _resolve(path: str) -> str | None:
    for prefix, target in ROUTE_MAP:
        if path == prefix or path.startswith(prefix + "/") or path.startswith(prefix + "?"):
            return target
    return None


@app.get("/health")
async def health():
    results: dict = {"gateway": "ok"}
    services = {
        "auth": AUTH_URL,
        "personnel": PERSONNEL_URL,
        "tasks": TASKS_URL,
        "events": EVENTS_URL,
        "appraisal": APPRAISAL_URL,
    }
    async with httpx.AsyncClient(timeout=2.0) as client:
        for name, url in services.items():
            try:
                r = await client.get(f"{url}/health")
                results[name] = "ok" if r.status_code == 200 else "degraded"
            except Exception:
                results[name] = "unreachable"
    return results


@app.api_route(
    "/{path:path}",
    methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def proxy(request: Request, path: str):
    url_path = request.url.path
    target = _resolve(url_path)

    if target is None:
        return Response(
            content=b'{"detail":"No service found for this route"}',
            status_code=404,
            media_type="application/json",
        )

    dest = f"{target}{url_path}"
    if request.url.query:
        dest += f"?{request.url.query}"

    # Strip hop-by-hop headers that must not be forwarded
    skip = {"host", "content-length", "transfer-encoding", "connection"}
    headers = {k: v for k, v in request.headers.items() if k.lower() not in skip}
    # Downstream services only ever see this gateway's IP unless we pass the
    # real client IP along — needed for any per-client logic they do (e.g.
    # the public evaluation endpoint's per-device submission throttle).
    headers["x-forwarded-for"] = _client_ip(request)

    body = await request.body()

    # Reading a proposal from page photos runs OCR on each page, which can take a while.
    timeout = 180.0 if url_path.endswith("/read-proposal") else 30.0
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.request(
            method=request.method,
            url=dest,
            headers=headers,
            content=body,
        )

    # Strip hop-by-hop response headers
    resp_headers = {
        k: v for k, v in resp.headers.items()
        if k.lower() not in {"transfer-encoding", "connection", "content-encoding"}
    }

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=resp_headers,
        media_type=resp.headers.get("content-type"),
    )

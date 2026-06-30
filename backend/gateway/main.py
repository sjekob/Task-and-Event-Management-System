"""API Gateway — port 8000
Routes all incoming requests to the correct microservice.
Run from backend/: uvicorn gateway.main:app --port 8000

Service map:
  8001  auth       /api/auth, /api/users, /api/subjects, /api/grade-levels, /api/task-types
  8002  personnel  /api/personnel
  8003  tasks      /api/tasks, /api/templates, /api/reports, /api/comments, /uploads
  8004  events     /api/events
  8005  appraisal  /api/appraisal, /api/dashboard
"""
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
    ("/api/subjects",    AUTH_URL),
    ("/api/grade-levels", AUTH_URL),
    ("/api/task-types",  AUTH_URL),
    ("/api/personnel",   PERSONNEL_URL),
    ("/api/templates",   TASKS_URL),
    ("/api/reports",     TASKS_URL),
    ("/api/comments",    TASKS_URL),
    ("/api/tasks",       TASKS_URL),
    ("/uploads",         TASKS_URL),
    ("/api/events",      EVENTS_URL),
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

# ── Per-IP rate limiting ──────────────────────────────────────────────────────
# The gateway is the single public entry point, so one limiter here protects
# every downstream service. Sliding window keyed by client IP. Generous enough
# that normal use never trips it; abuse/floods get a 429.
_RL_WINDOW = float(os.getenv("RATE_LIMIT_WINDOW", "60"))      # seconds
_RL_MAX    = int(os.getenv("RATE_LIMIT_MAX", "600"))          # requests / window / IP
_rl_hits: dict[str, deque] = {}


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    # Skip CORS preflight and health checks.
    if request.method == "OPTIONS" or request.url.path == "/health":
        return await call_next(request)
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    dq = _rl_hits.setdefault(ip, deque())
    cutoff = now - _RL_WINDOW
    while dq and dq[0] < cutoff:
        dq.popleft()
    if len(dq) >= _RL_MAX:
        retry = max(1, int(dq[0] + _RL_WINDOW - now))
        return Response(
            content=b'{"detail":"Too many requests. Please slow down."}',
            status_code=429,
            media_type="application/json",
            headers={"Retry-After": str(retry)},
        )
    dq.append(now)
    if not dq:
        _rl_hits.pop(ip, None)
    return await call_next(request)


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
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
    headers["x-forwarded-for"] = request.client.host if request.client else "unknown"

    body = await request.body()

    async with httpx.AsyncClient(timeout=30.0) as client:
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

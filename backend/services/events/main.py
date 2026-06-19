"""Events Service — port 8004
Handles: event calendar, activity events, approvals.
Run from backend/: uvicorn services.events.main:app --port 8004
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from cors import get_cors_config
from database import init_db
from routes.events import router as events_router

SERVICE_PORT = int(os.getenv("EVENTS_SERVICE_PORT", "8004"))

app = FastAPI(
    title="TaskNet Events Service",
    description="Event calendar and activity management.",
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


@app.on_event("startup")
def startup():
    init_db()


app.include_router(events_router)


@app.get("/health")
def health():
    return {"service": "events", "status": "ok", "port": SERVICE_PORT}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.events.main:app", host="0.0.0.0", port=SERVICE_PORT, reload=True)

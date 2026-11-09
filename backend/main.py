from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from database import init_db
from cors import get_cors_config
from routes import auth, users, tasks, reports, comments, dashboard, templates, personnel, appraisal, events, notifications, school_years, certificates, audit_log, attendance, public_evaluation, deped_calendar

app = FastAPI(title="TaskNet API", docs_url="/docs", redoc_url="/redoc")

_cors_origins, _cors_creds = get_cors_config()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_cors_creds,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.on_event("startup")
def startup():
    init_db()


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(tasks.router)
app.include_router(reports.router)
app.include_router(comments.router)
app.include_router(dashboard.router)
app.include_router(templates.router)
app.include_router(personnel.router)
app.include_router(appraisal.router)
app.include_router(events.router)
app.include_router(attendance.router)
app.include_router(public_evaluation.router)
app.include_router(deped_calendar.router)
app.include_router(notifications.router)
app.include_router(school_years.router)
app.include_router(certificates.router)
app.include_router(audit_log.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


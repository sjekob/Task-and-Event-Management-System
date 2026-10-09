from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from database import init_db
from routes import auth, users, tasks, reports, comments, dashboard, templates, personnel, appraisal, events, notifications, school_years, certificates, audit_log

app = FastAPI(title="TaskNet API", docs_url="/docs", redoc_url="/redoc")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
app.include_router(notifications.router)
app.include_router(school_years.router)
app.include_router(certificates.router)
app.include_router(audit_log.router)

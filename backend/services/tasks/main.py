"""Tasks Service — port 8003
Handles: tasks, templates, reports, comments, file uploads.
Run from backend/: uvicorn services.tasks.main:app --port 8003
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import init_db
from routes.tasks import router as tasks_router
from routes.templates import router as templates_router
from routes.reports import router as reports_router
from routes.comments import router as comments_router

SERVICE_PORT = int(os.getenv("TASKS_SERVICE_PORT", "8003"))

app = FastAPI(
    title="TaskNet Tasks Service",
    description="Task management, templates, reports, and comments.",
    version="1.0.0",
    docs_url="/docs",
)

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


app.include_router(tasks_router)
app.include_router(templates_router)
app.include_router(reports_router)
app.include_router(comments_router)


@app.get("/health")
def health():
    return {"service": "tasks", "status": "ok", "port": SERVICE_PORT}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.tasks.main:app", host="0.0.0.0", port=SERVICE_PORT, reload=True)

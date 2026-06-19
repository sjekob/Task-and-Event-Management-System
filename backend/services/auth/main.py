"""Auth Service — port 8001
Handles: authentication, user management, grade levels, subjects, task types.
Run from backend/: uvicorn services.auth.main:app --port 8001
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from cors import get_cors_config
from database import init_db
from routes.auth import router as auth_router
from routes.users import router as users_router

SERVICE_PORT = int(os.getenv("AUTH_SERVICE_PORT", "8001"))

app = FastAPI(
    title="TaskNet Auth Service",
    description="Authentication, user management, and reference data.",
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


app.include_router(auth_router)
app.include_router(users_router)


@app.get("/health")
def health():
    return {"service": "auth", "status": "ok", "port": SERVICE_PORT}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.auth.main:app", host="0.0.0.0", port=SERVICE_PORT, reload=True)

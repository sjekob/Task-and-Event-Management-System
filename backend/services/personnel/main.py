"""Personnel Service — port 8002
Handles: personnel CRUD, coordinator assignments, dean assignments, subjects.
Run from backend/: uvicorn services.personnel.main:app --port 8002
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from cors import get_cors_config
from database import init_db
from routes.personnel import router as personnel_router

SERVICE_PORT = int(os.getenv("PERSONNEL_SERVICE_PORT", "8002"))

app = FastAPI(
    title="TaskNet Personnel Service",
    description="Personnel management, roles, and assignments.",
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


app.include_router(personnel_router)


@app.get("/health")
def health():
    return {"service": "personnel", "status": "ok", "port": SERVICE_PORT}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.personnel.main:app", host="0.0.0.0", port=SERVICE_PORT, reload=True)

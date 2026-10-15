"""Appraisal Service — port 8005
Handles: appraisal evaluations, analytics, and dashboard aggregation.
Run from backend/: uvicorn services.appraisal.main:app --port 8005
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from cors import get_cors_config
from database import init_db
from routes.appraisal import router as appraisal_router
from routes.dashboard import router as dashboard_router
from routes.public_evaluation import router as public_evaluation_router

SERVICE_PORT = int(os.getenv("APPRAISAL_SERVICE_PORT", "8005"))

app = FastAPI(
    title="TaskNet Appraisal Service",
    description="Appraisal evaluations, analytics, and dashboard.",
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


app.include_router(appraisal_router)
app.include_router(dashboard_router)
app.include_router(public_evaluation_router)


@app.get("/health")
def health():
    return {"service": "appraisal", "status": "ok", "port": SERVICE_PORT}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("services.appraisal.main:app", host="0.0.0.0", port=SERVICE_PORT, reload=True)

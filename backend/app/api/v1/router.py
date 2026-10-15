from fastapi import APIRouter
from app.api.v1.endpoints import auth, tasks, events

api_router = APIRouter()

api_router.include_router(auth.router,   tags=["auth"])
api_router.include_router(tasks.router,  tags=["tasks"])
api_router.include_router(events.router, tags=["events"])

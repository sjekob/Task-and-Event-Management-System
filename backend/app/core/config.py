from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "TaskNet"
    DEBUG: bool = True
    SECRET_KEY: str = "tasknet-secret-key-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # SQLite — no server, no C compiler needed
    DATABASE_URL: str = "sqlite+aiosqlite:///./tasknet.db"

    ALLOWED_ORIGINS: List[str] = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:8080",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
"""
TaskNet - App Configuration
File: core/config.py

All settings are read from environment variables / .env file.
Import `settings` anywhere in the app instead of reading os.environ directly.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # PostgreSQL
    postgres_host:     str = "localhost"
    postgres_port:     int = 5432
    postgres_db:       str = "tasknet_db"
    postgres_user:     str = "tasknet_user"
    postgres_password: str = "tasknet_pass"

    # JWT
    secret_key:                  str = "REPLACE_WITH_STRONG_SECRET"
    algorithm:                   str = "HS256"
    access_token_expire_minutes: int = 480   # 8 hours

    # App
    app_env:         str = "development"
    debug:           bool = True
    allowed_origins: str = "http://localhost:8080,http://localhost:3000"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

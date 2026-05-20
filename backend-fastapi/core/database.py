"""
TaskNet - PostgreSQL Connection
File: core/database.py
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from core.config import settings
from models.user_model import Base

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,      # Reconnects silently if the DB dropped the connection
    pool_size=10,            # Max persistent connections in pool
    max_overflow=20,         # Extra connections allowed beyond pool_size
    echo=settings.debug,     # Log SQL queries in development
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """
    Creates all tables that don't exist yet.
    In production, prefer Alembic migrations over this.
    """
    from sqlalchemy import text
    with engine.begin() as conn:
        conn.execute(text("CREATE TYPE IF NOT EXISTS userrole AS ENUM ('principal', 'dean', 'coordinator', 'registrar', 'teacher')"))
        conn.execute(text("CREATE TYPE IF NOT EXISTS userstatus AS ENUM ('active', 'deactivated')"))
    Base.metadata.create_all(bind=engine, checkfirst=True)


def get_db():
    """FastAPI Dependency: yields a scoped DB session, always closed on exit."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()

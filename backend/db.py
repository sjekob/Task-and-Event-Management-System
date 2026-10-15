"""
db.py — SQLAlchemy 2.0 (sync) engine, session, and FastAPI dependency.

This is the new data layer that replaces the raw-sqlite `database.py`.
During the migration both coexist: routes are ported service-by-service, and
the running app keeps working on raw sqlite until each is cut over.

Configuration (env):
  DATABASE_URL   Full SQLAlchemy URL. Examples:
                   postgresql+psycopg2://tasknet:tasknet@postgres:5432/tasknet
                   sqlite:///./tasknet.db        (local fallback)
  SQL_ECHO       "1" to log all SQL (debug only).
"""
import os
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./tasknet.db")
_ECHO = os.getenv("SQL_ECHO", "") == "1"

# SQLite needs check_same_thread=False under a threaded server; Postgres takes
# real pool settings.
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        echo=_ECHO,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(
        DATABASE_URL,
        echo=_ECHO,
        pool_pre_ping=True,   # drop dead connections instead of erroring
        pool_size=10,
        max_overflow=20,
        pool_recycle=1800,
    )

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a session and always closes it.

        def endpoint(db: Session = Depends(get_db)): ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def db_session():
    """Context manager for manual (non-dependency) use, with commit/rollback:

        with db_session() as db:
            db.add(obj)
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

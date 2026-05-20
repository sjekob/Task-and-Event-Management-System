"""
Alembic environment — reads DATABASE_URL from TaskNet's config.
File: alembic/env.py
"""

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import sys
import os

# Make sure the app root is on the path so imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.config import settings
from models.user_model import Base   # Import ALL models so Alembic sees them

# ── Alembic Config object ─────────────────────────────────────────────────────
config = context.config

# Override the sqlalchemy.url from alembic.ini with our real URL from .env
config.set_main_option("sqlalchemy.url", settings.database_url)

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata for autogenerate
target_metadata = Base.metadata


# ── Offline migrations (generates SQL script without connecting) ──────────────
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online migrations (connects to the live DB) ───────────────────────────────
def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)) + '/app')

from models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_online():
    database_url = os.environ.get('DATABASE_URL') or 'sqlite:///./dev.db'
    from sqlalchemy import create_engine
    connectable = create_engine(database_url)
    target_metadata.create_all(connectable)
    print('Tables created/ensured on', database_url)


if context.is_offline_mode():
    raise RuntimeError('Offline mode not supported for this env')
else:
    run_migrations_online()

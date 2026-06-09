"""initial create

Revision ID: 0001
Revises: 
Create Date: 2026-05-14
"""
from alembic import op
import sqlalchemy as sa

# this migration is a placeholder. The env.py uses SQLModel.metadata.create_all
# to synchronise the schema for development. Use alembic commands to trigger it.

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # placeholder: actual table creation handled by env.py
    pass

def downgrade():
    pass

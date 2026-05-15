"""Add first_login column to users

Revision ID: 002
Revises: 001
Create Date: 2026-05-14 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users',
        sa.Column('first_login', sa.Boolean(), nullable=False, server_default='true')
    )
    # Allow empty string for first_name / last_name (quick-created users)
    op.alter_column('users', 'first_name', existing_type=sa.String(80), nullable=False)
    op.alter_column('users', 'last_name',  existing_type=sa.String(80), nullable=False)


def downgrade() -> None:
    op.drop_column('users', 'first_login')

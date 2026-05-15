"""Add delegation history table and granular updated-at timestamps to users

Revision ID: 004
Revises: 003
Create Date: 2026-05-14
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Granular timestamps on users
    op.add_column('users', sa.Column('personal_info_updated_at',
                                     sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('academic_delegation_updated_at',
                                     sa.DateTime(timezone=True), nullable=True))

    # Delegation history table
    op.create_table(
        'user_delegation_history',
        sa.Column('id',            sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id',       sa.Integer(), nullable=False),
        sa.Column('changed_by_id', sa.Integer(), nullable=True),
        sa.Column('changed_at',    sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('role',                  sa.String(20),  nullable=True),
        sa.Column('grade_level_handled',   sa.String(50),  nullable=True),
        sa.Column('coordinator_type',      sa.String(100), nullable=True),
        sa.Column('subject_grade_summary', sa.Text(),      nullable=True),
        sa.Column('notes',                 sa.String(200), nullable=True),
        sa.ForeignKeyConstraint(['user_id'],       ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['changed_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_delegation_history_user_id',
                    'user_delegation_history', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_delegation_history_user_id', 'user_delegation_history')
    op.drop_table('user_delegation_history')
    op.drop_column('users', 'academic_delegation_updated_at')
    op.drop_column('users', 'personal_info_updated_at')

"""Add coordinator_types table and coordinator_type_id on users; seed departments

Revision ID: 003
Revises: 002
Create Date: 2026-05-14
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'coordinator_types',
        sa.Column('id',   sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )

    op.add_column('users',
        sa.Column('coordinator_type_id', sa.Integer(),
                  sa.ForeignKey('coordinator_types.id', ondelete='SET NULL'),
                  nullable=True)
    )

    # Seed coordinator types
    op.execute("""
        INSERT INTO coordinator_types (name) VALUES
        ('Grade Level Coordinator'),
        ('Subject Area Coordinator')
        ON CONFLICT DO NOTHING;
    """)

    # Seed departments
    op.execute("""
        INSERT INTO departments (name, grade_range) VALUES
        ('Primary Department',      'Kinder - Grade 3'),
        ('Intermediate Department', 'Grade 4 - Grade 6')
        ON CONFLICT DO NOTHING;
    """)


def downgrade() -> None:
    op.drop_column('users', 'coordinator_type_id')
    op.drop_table('coordinator_types')

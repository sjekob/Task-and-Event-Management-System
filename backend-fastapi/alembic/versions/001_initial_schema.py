"""Initial schema — users, grade_levels, subjects, departments, junction tables

Revision ID: 001
Revises: 
Create Date: 2026-01-01 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Enums (safe re-run: swallow duplicate_object) ─────────────────────────
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE userrole AS ENUM ('principal', 'dean', 'coordinator', 'registrar', 'teacher');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE userstatus AS ENUM ('active', 'deactivated');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    # ── grade_levels ───────────────────────────────────────────────────────────
    op.create_table(
        'grade_levels',
        sa.Column('id',   sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )

    # ── subjects ───────────────────────────────────────────────────────────────
    op.create_table(
        'subjects',
        sa.Column('id',   sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )

    # ── departments ────────────────────────────────────────────────────────────
    op.create_table(
        'departments',
        sa.Column('id',          sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name',        sa.String(150), nullable=False),
        sa.Column('grade_range', sa.String(50),  nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )

    # ── users ──────────────────────────────────────────────────────────────────
    op.create_table(
        'users',
        sa.Column('id',          sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('employee_no', sa.String(20),  nullable=True),
        sa.Column('first_name',  sa.String(80),  nullable=False),
        sa.Column('middle_name', sa.String(80),  nullable=True),
        sa.Column('last_name',   sa.String(80),  nullable=False),
        sa.Column('suffix',      sa.String(20),  nullable=True),
        sa.Column('username',    sa.String(80),  nullable=True),
        sa.Column('hashed_password', sa.String(256), nullable=False),
        sa.Column('email',       sa.String(200), nullable=False),
        sa.Column('role',   postgresql.ENUM('principal','dean','coordinator','registrar','teacher', name='userrole',   create_type=False), nullable=False),
        sa.Column('status', postgresql.ENUM('active','deactivated',                                  name='userstatus', create_type=False), nullable=False, server_default='active'),
        sa.Column('contact_number',    sa.String(30),  nullable=True),
        sa.Column('birthdate',         sa.Date(),      nullable=True),
        sa.Column('address',           sa.Text(),      nullable=True),
        sa.Column('tin_number',        sa.String(30),  nullable=True),
        sa.Column('gsis_number',       sa.String(30),  nullable=True),
        sa.Column('pagibig_number',    sa.String(30),  nullable=True),
        sa.Column('philhealth_number', sa.String(30),  nullable=True),
        sa.Column('date_hired',        sa.Date(),      nullable=True),
        sa.Column('date_of_appointment', sa.Date(),    nullable=True),
        sa.Column('avatar_url',        sa.String(500), nullable=True),
        sa.Column('department_id',     sa.Integer(),   nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('username'),
        sa.UniqueConstraint('employee_no'),
    )
    op.create_index('ix_users_email',       'users', ['email'])
    op.create_index('ix_users_employee_no', 'users', ['employee_no'])
    op.create_index('ix_users_role',        'users', ['role'])
    op.create_index('ix_users_status',      'users', ['status'])

    # ── user_grade_levels (junction) ───────────────────────────────────────────
    op.create_table(
        'user_grade_levels',
        sa.Column('user_id',        sa.Integer(), nullable=False),
        sa.Column('grade_level_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'],        ['users.id'],        ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['grade_level_id'], ['grade_levels.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'grade_level_id'),
    )

    # ── user_subject_grade_assignments (junction) ──────────────────────────────
    op.create_table(
        'user_subject_grade_assignments',
        sa.Column('id',             sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id',        sa.Integer(), nullable=False),
        sa.Column('grade_level_id', sa.Integer(), nullable=False),
        sa.Column('subject_id',     sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'],        ['users.id'],        ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['grade_level_id'], ['grade_levels.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['subject_id'],     ['subjects.id'],     ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── Seed data — grade levels ───────────────────────────────────────────────
    op.execute("""
        INSERT INTO grade_levels (name) VALUES
        ('Kinder'), ('Grade 1'), ('Grade 2'), ('Grade 3'), ('Grade 4'),
        ('Grade 5'), ('Grade 6')
        ON CONFLICT DO NOTHING;
    """)

    # ── Seed data — subjects ───────────────────────────────────────────────────
    op.execute("""
        INSERT INTO subjects (name) VALUES
        ('Mathematics'), ('Science'), ('English'), ('Filipino'),
        ('Araling Panlipunan'), ('MAPEH'), ('ESP'),
        ('TLE'), ('ICT'), ('Research')
        ON CONFLICT DO NOTHING;
    """)


def downgrade() -> None:
    op.drop_table('user_subject_grade_assignments')
    op.drop_table('user_grade_levels')
    op.drop_index('ix_users_status',      'users')
    op.drop_index('ix_users_role',        'users')
    op.drop_index('ix_users_employee_no', 'users')
    op.drop_index('ix_users_email',       'users')
    op.drop_table('users')
    op.drop_table('departments')
    op.drop_table('subjects')
    op.drop_table('grade_levels')

    # Drop enums
    op.execute("DROP TYPE IF EXISTS userstatus")
    op.execute("DROP TYPE IF EXISTS userrole")

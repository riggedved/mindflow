"""add password hash to users

Revision ID: c7a5f3d219ab
Revises: b8f3c4d21a34
Create Date: 2025-11-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c7a5f3d219ab'
down_revision = 'b8f3c4d21a34'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('password_hash', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'password_hash')

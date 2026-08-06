"""add_intelligent_space_fields

Revision ID: b8f3c4d21a34
Revises: aa751e417f62
Create Date: 2025-10-28 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'b8f3c4d21a34'
down_revision = 'aa751e417f62'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to spaces table
    op.add_column('spaces', sa.Column('description', sa.String(), nullable=True))
    op.add_column('spaces', sa.Column('icon', sa.String(), nullable=True, server_default='Folder'))
    op.add_column('spaces', sa.Column('is_suggested', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('spaces', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('spaces', sa.Column('item_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('spaces', sa.Column('similarity_threshold', sa.Float(), nullable=False, server_default='0.75'))
    op.add_column('spaces', sa.Column('centroid_embedding', postgresql.ARRAY(sa.Float()), nullable=True))
    op.add_column('spaces', sa.Column('space_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('spaces', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))
    
    # Add space_id to items table
    op.add_column('items', sa.Column('space_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_items_space_id', 'items', 'spaces', ['space_id'], ['id'], ondelete='SET NULL')
    op.create_index('ix_items_space_id', 'items', ['space_id'])


def downgrade() -> None:
    # Remove space_id from items table
    op.drop_index('ix_items_space_id', table_name='items')
    op.drop_constraint('fk_items_space_id', 'items', type_='foreignkey')
    op.drop_column('items', 'space_id')
    
    # Remove new columns from spaces table
    op.drop_column('spaces', 'updated_at')
    op.drop_column('spaces', 'space_metadata')
    op.drop_column('spaces', 'centroid_embedding')
    op.drop_column('spaces', 'similarity_threshold')
    op.drop_column('spaces', 'item_count')
    op.drop_column('spaces', 'is_active')
    op.drop_column('spaces', 'is_suggested')
    op.drop_column('spaces', 'icon')
    op.drop_column('spaces', 'description')

"""Persist each user's dashboard currency preferences.

Revision ID: 029
Revises: 028
"""
from alembic import op
import sqlalchemy as sa

revision = "029"
down_revision = "028"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("currency_display_mode", sa.String(12), nullable=False, server_default="both"))
    op.add_column("users", sa.Column("currency_base", sa.String(3), nullable=False, server_default="EUR"))


def downgrade():
    op.drop_column("users", "currency_base")
    op.drop_column("users", "currency_display_mode")

"""Add a currency to each budget, preserving existing budgets in EUR.

Revision ID: 030
Revises: 029
"""
from alembic import op
import sqlalchemy as sa

revision = "030"
down_revision = "029"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("budgets", sa.Column("currency", sa.String(3), nullable=False, server_default="EUR"))


def downgrade():
    op.drop_column("budgets", "currency")

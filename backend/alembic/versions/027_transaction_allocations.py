"""Store additional category allocations without splitting bank transactions.

Revision ID: 027
Revises: 026
"""
from alembic import op
import sqlalchemy as sa

revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "transaction_allocations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("transaction_id", sa.Integer(), sa.ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id"), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.CheckConstraint("amount > 0", name="ck_allocation_positive"),
    )
    op.create_index("ix_transaction_allocations_transaction_id", "transaction_allocations", ["transaction_id"])


def downgrade():
    op.drop_index("ix_transaction_allocations_transaction_id", table_name="transaction_allocations")
    op.drop_table("transaction_allocations")

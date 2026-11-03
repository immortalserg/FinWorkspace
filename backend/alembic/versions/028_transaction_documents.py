"""Link existing local and Paperless documents to transactions.

Revision ID: 028
Revises: 027
"""
from alembic import op
import sqlalchemy as sa

revision = "028"
down_revision = "027"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "transaction_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("transaction_id", sa.Integer(), sa.ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("document_id", sa.String(100), nullable=False),
        sa.UniqueConstraint("transaction_id", "source", "document_id", name="uq_transaction_document"),
        sa.CheckConstraint("source IN ('local', 'paperless')", name="ck_transaction_document_source"),
    )
    op.create_index("ix_transaction_documents_transaction", "transaction_documents", ["transaction_id"])


def downgrade():
    op.drop_index("ix_transaction_documents_transaction", table_name="transaction_documents")
    op.drop_table("transaction_documents")

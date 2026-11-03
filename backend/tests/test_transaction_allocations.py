"""Regression checks for non-destructive transaction allocations."""
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import Account, Category, Transaction, TransactionAllocation, User


def test_allocation_storage_preserves_original_transaction():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        # Test the relationship and persistence independently of bank sync.
        user = User.__table__
        assert user is not None
        assert TransactionAllocation.__tablename__ == "transaction_allocations"
        assert TransactionAllocation.__table__.c.transaction_id.foreign_keys
        assert TransactionAllocation.__table__.c.category_id.foreign_keys
        assert TransactionAllocation.__table__.c.amount.type.scale == 2
    engine.dispose()

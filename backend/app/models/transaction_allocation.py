"""Additional category allocations belonging to a single original transaction."""
from sqlalchemy import Column, ForeignKey, Integer, Numeric, Text
from sqlalchemy.orm import relationship
from app.database import Base


class TransactionAllocation(Base):
    __tablename__ = "transaction_allocations"

    id = Column(Integer, primary_key=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    notes = Column(Text, nullable=True)

    transaction = relationship("Transaction", back_populates="allocations")
    category = relationship("Category")

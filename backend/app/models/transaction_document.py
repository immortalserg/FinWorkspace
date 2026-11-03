from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class TransactionDocument(Base):
    __tablename__ = "transaction_documents"
    __table_args__ = (
        UniqueConstraint("transaction_id", "source", "document_id", name="uq_transaction_document"),
    )

    id = Column(Integer, primary_key=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False)
    source = Column(String(20), nullable=False)
    document_id = Column(String(100), nullable=False)
    transaction = relationship("Transaction", back_populates="documents")

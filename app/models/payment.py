
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.db.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)

    ride_id = Column(Integer, ForeignKey("rides.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="INR", nullable=False)

    payment_method = Column(String(30), nullable=True)
    payment_status = Column(String(30), default="pending", nullable=False)

    stripe_payment_intent_id = Column(String(255), unique=True, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

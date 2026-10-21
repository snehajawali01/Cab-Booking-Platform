
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.sql import func

from app.db.database import Base


class Review(Base):
    __tablename__ = "reviews"

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="check_review_rating"),
    )

    id = Column(Integer, primary_key=True, index=True)

    ride_id = Column(Integer, ForeignKey("rides.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)

    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

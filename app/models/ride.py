
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.db.database import Base


class Ride(Base):
    __tablename__ = "rides"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)

    pickup_address = Column(String(255), nullable=False)
    pickup_latitude = Column(Float, nullable=False)
    pickup_longitude = Column(Float, nullable=False)

    dropoff_address = Column(String(255), nullable=False)
    dropoff_latitude = Column(Float, nullable=False)
    dropoff_longitude = Column(Float, nullable=False)

    distance_km = Column(Float, nullable=True)
    estimated_fare = Column(Float, nullable=True)
    final_fare = Column(Float, nullable=True)

    status = Column(String(30), default="requested", nullable=False)

    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

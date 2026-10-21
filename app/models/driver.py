
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime
from sqlalchemy.sql import func

from app.db.database import Base


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone_number = Column(String(20), unique=True, nullable=False)
    vehicle_model = Column(String(100), nullable=False)
    vehicle_number = Column(String(30), unique=True, nullable=False)
    license_number = Column(String(50), unique=True, nullable=False)
    is_available = Column(Boolean, default=False, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    current_latitude = Column(Float, nullable=True)
    current_longitude = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


from datetime import datetime
from math import radians, sin, cos, sqrt, atan2
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.models.driver import Driver
from app.models.ride import Ride
from app.api.users import get_current_user
from app.services.websocket_manager import manager

router = APIRouter(prefix="/api/drivers", tags=["Drivers"])


def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two GPS coordinates in kilometres."""
    earth_radius_km = 6371.0

    lat1, lon1, lat2, lon2 = map(
        radians, [lat1, lon1, lat2, lon2]
    )

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = (
        sin(dlat / 2) ** 2
        + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    )

    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return earth_radius_km * c


class DriverRegisterInput(BaseModel):
    vehicle_model: str = Field(min_length=2, max_length=100)
    vehicle_number: str = Field(min_length=2, max_length=30)
    license_number: str = Field(min_length=2, max_length=50)


class DriverAvailabilityInput(BaseModel):
    is_available: bool
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class DriverRideStatusInput(BaseModel):
    status: Literal["in_progress", "completed"]


def get_driver_for_user(db: Session, user: User):
    """Return the driver profile belonging to the authenticated user."""
    driver = (
        db.query(Driver)
        .filter(Driver.email == user.email)
        .first()
    )

    if not driver:
        raise HTTPException(
            status_code=404,
            detail="Register a driver profile first",
        )

    return driver


def ride_details(ride: Ride):
    """Format ride information for the driver dashboard."""
    return {
        "id": ride.id,
        "rider_id": ride.rider_id,
        "driver_id": ride.driver_id,
        "pickup_address": ride.pickup_address,
        "dropoff_address": ride.dropoff_address,
        "pickup_latitude": ride.pickup_latitude,
        "pickup_longitude": ride.pickup_longitude,
        "dropoff_latitude": ride.dropoff_latitude,
        "dropoff_longitude": ride.dropoff_longitude,
        "distance_km": ride.distance_km,
        "estimated_fare": ride.estimated_fare,
        "final_fare": ride.final_fare,
        "status": ride.status,
        "requested_at": ride.requested_at,
        "completed_at": ride.completed_at,
    }


@router.post("/register", status_code=201)
def register_driver(
    data: DriverRegisterInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing_driver = (
        db.query(Driver)
        .filter(Driver.email == current_user.email)
        .first()
    )

    if existing_driver:
        raise HTTPException(
            status_code=409,
            detail="A driver profile already exists for this account",
        )

    vehicle_number = data.vehicle_number.strip().upper()
    license_number = data.license_number.strip().upper()

    if db.query(Driver).filter(
        Driver.vehicle_number == vehicle_number
    ).first():
        raise HTTPException(
            status_code=409,
            detail="Vehicle number is already registered",
        )

    if db.query(Driver).filter(
        Driver.license_number == license_number
    ).first():
        raise HTTPException(
            status_code=409,
            detail="License number is already registered",
        )

    driver = Driver(
        full_name=current_user.full_name,
        email=current_user.email,
        phone_number=current_user.phone_number or f"USER-{current_user.id}",
        vehicle_model=data.vehicle_model.strip(),
        vehicle_number=vehicle_number,
        license_number=license_number,
        is_available=False,
        is_verified=True,
    )

    db.add(driver)
    db.commit()
    db.refresh(driver)

    return {
        "message": "Driver profile created. Verification is required before matching.",
        "driver": {
            "id": driver.id,
            "full_name": driver.full_name,
            "email": driver.email,
            "vehicle_model": driver.vehicle_model,
            "vehicle_number": driver.vehicle_number,
            "is_available": driver.is_available,
            "is_verified": driver.is_verified,
        },
    }


@router.patch("/me/availability")
def update_driver_availability(
    data: DriverAvailabilityInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    driver = get_driver_for_user(db, current_user)

    if data.is_available and not driver.is_verified:
        raise HTTPException(
            status_code=403,
            detail="Your driver profile must be verified first",
        )

    if data.is_available:
        active_ride = (
            db.query(Ride)
            .filter(
                Ride.driver_id == driver.id,
                Ride.status.in_(["accepted", "in_progress"]),
            )
            .first()
        )

        if active_ride:
            raise HTTPException(
                status_code=409,
                detail="Complete your active ride before becoming available",
            )

    driver.current_latitude = data.latitude
    driver.current_longitude = data.longitude
    driver.is_available = data.is_available

    db.commit()
    db.refresh(driver)

    return {
        "message": "Driver availability updated",
        "driver_id": driver.id,
        "is_available": driver.is_available,
        "latitude": driver.current_latitude,
        "longitude": driver.current_longitude,
    }


@router.post("/match/{ride_id}")
async def match_driver_to_ride(
    ride_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ride = db.query(Ride).filter(Ride.id == ride_id).first()

    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if ride.rider_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot match a driver to another rider's ride",
        )

    if ride.status != "requested" or ride.driver_id is not None:
        raise HTTPException(
            status_code=400,
            detail="This ride is not available for driver matching",
        )

    available_drivers = (
        db.query(Driver)
        .filter(
            Driver.is_available.is_(True),
            Driver.is_verified.is_(True),
            Driver.current_latitude.isnot(None),
            Driver.current_longitude.isnot(None),
        )
        .with_for_update()
        .all()
    )

    if not available_drivers:
        raise HTTPException(
            status_code=404,
            detail="No verified drivers are currently available",
        )

    nearest_driver = min(
        available_drivers,
        key=lambda driver: calculate_distance(
            ride.pickup_latitude,
            ride.pickup_longitude,
            driver.current_latitude,
            driver.current_longitude,
        ),
    )

    distance_km = calculate_distance(
        ride.pickup_latitude,
        ride.pickup_longitude,
        nearest_driver.current_latitude,
        nearest_driver.current_longitude,
    )

    nearest_driver.is_available = False
    ride.driver_id = nearest_driver.id
    ride.status = "accepted"

    try:
        db.commit()
        db.refresh(ride)
        db.refresh(nearest_driver)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Driver matching failed. Please try again.",
        )

    await manager.send_to_rider(
        ride.rider_id,
        {
            "event": "driver_matched",
            "ride_id": ride.id,
            "status": ride.status,
            "driver": {
                "id": nearest_driver.id,
                "full_name": nearest_driver.full_name,
                "vehicle_model": nearest_driver.vehicle_model,
                "vehicle_number": nearest_driver.vehicle_number,
            },
            "driver_distance_km": round(distance_km, 2),
        },
    )

    return {
        "message": "Driver matched successfully",
        "ride_id": ride.id,
        "ride_status": ride.status,
        "driver": {
            "id": nearest_driver.id,
            "full_name": nearest_driver.full_name,
            "vehicle_model": nearest_driver.vehicle_model,
            "vehicle_number": nearest_driver.vehicle_number,
        },
        "driver_distance_km": round(distance_km, 2),
    }


@router.get("/me/rides")
def get_my_assigned_rides(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List rides assigned to the authenticated driver's profile."""
    driver = get_driver_for_user(db, current_user)

    rides = (
        db.query(Ride)
        .filter(Ride.driver_id == driver.id)
        .order_by(Ride.id.desc())
        .all()
    )

    return {
        "driver": {
            "id": driver.id,
            "full_name": driver.full_name,
            "vehicle_model": driver.vehicle_model,
            "vehicle_number": driver.vehicle_number,
            "is_available": driver.is_available,
        },
        "rides": [ride_details(ride) for ride in rides],
        "total_rides": len(rides),
    }


@router.patch("/rides/{ride_id}/status")
async def update_assigned_ride_status(
    ride_id: int,
    data: DriverRideStatusInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Allow the assigned driver to start or complete a ride."""
    driver = get_driver_for_user(db, current_user)

    ride = db.query(Ride).filter(Ride.id == ride_id).first()

    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if ride.driver_id != driver.id:
        raise HTTPException(
            status_code=403,
            detail="This ride is not assigned to your driver profile",
        )

    if data.status == "in_progress":
        if ride.status != "accepted":
            raise HTTPException(
                status_code=400,
                detail="Only accepted rides can be started",
            )

        ride.status = "in_progress"

    elif data.status == "completed":
        if ride.status != "in_progress":
            raise HTTPException(
                status_code=400,
                detail="Only rides in progress can be completed",
            )

        ride.status = "completed"
        ride.completed_at = datetime.utcnow()
        ride.final_fare = ride.estimated_fare
        driver.is_available = False

    try:
        db.commit()
        db.refresh(ride)
        db.refresh(driver)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Ride status update failed. Please try again.",
        )

    await manager.send_to_rider(
        ride.rider_id,
        {
            "event": "ride_status_updated",
            "ride": ride_details(ride),
        },
    )

    return {
        "message": "Ride status updated successfully",
        "ride": ride_details(ride),
        "driver_is_available": driver.is_available,
    }

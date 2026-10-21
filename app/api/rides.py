
from math import radians, sin, cos, sqrt, atan2

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.models.ride import Ride
from app.api.users import get_current_user

router = APIRouter(prefix="/api/rides", tags=["Rides"])

BASE_FARE = 50.0
FARE_PER_KM = 12.0


class Coordinates(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class FareEstimateInput(BaseModel):
    pickup: Coordinates
    dropoff: Coordinates


class RideRequestInput(BaseModel):
    pickup_address: str = Field(min_length=2, max_length=255)
    dropoff_address: str = Field(min_length=2, max_length=255)
    pickup_latitude: float = Field(ge=-90, le=90)
    pickup_longitude: float = Field(ge=-180, le=180)
    dropoff_latitude: float = Field(ge=-90, le=90)
    dropoff_longitude: float = Field(ge=-180, le=180)


class RideStatusInput(BaseModel):
    status: str


class RideOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rider_id: int
    driver_id: int | None = None
    pickup_address: str
    dropoff_address: str
    pickup_latitude: float
    pickup_longitude: float
    dropoff_latitude: float
    dropoff_longitude: float
    distance_km: float
    estimated_fare: float
    final_fare: float | None = None
    status: str


def calculate_distance(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
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

    return round(earth_radius_km * c, 2)


def calculate_fare(distance_km: float) -> float:
    return round(BASE_FARE + distance_km * FARE_PER_KM, 2)


@router.post("/estimate")
def estimate_fare(data: FareEstimateInput):
    distance = calculate_distance(
        data.pickup.latitude,
        data.pickup.longitude,
        data.dropoff.latitude,
        data.dropoff.longitude,
    )

    return {
        "distance_km": distance,
        "estimated_fare": calculate_fare(distance),
        "currency": "INR",
    }


@router.post("/request", response_model=RideOutput, status_code=201)
def request_ride(
    data: RideRequestInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # The rider ID comes from the verified JWT, not the request body.
    distance = calculate_distance(
        data.pickup_latitude,
        data.pickup_longitude,
        data.dropoff_latitude,
        data.dropoff_longitude,
    )

    ride = Ride(
        rider_id=current_user.id,
        pickup_address=data.pickup_address.strip(),
        dropoff_address=data.dropoff_address.strip(),
        pickup_latitude=data.pickup_latitude,
        pickup_longitude=data.pickup_longitude,
        dropoff_latitude=data.dropoff_latitude,
        dropoff_longitude=data.dropoff_longitude,
        distance_km=distance,
        estimated_fare=calculate_fare(distance),
        status="requested",
    )

    db.add(ride)
    db.commit()
    db.refresh(ride)

    return ride


@router.get("/", response_model=list[RideOutput])
def list_rides(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Ride)
        .filter(Ride.rider_id == current_user.id)
        .order_by(Ride.requested_at.desc())
        .all()
    )


@router.get("/{ride_id}", response_model=RideOutput)
def get_ride(
    ride_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ride = db.query(Ride).filter(Ride.id == ride_id).first()

    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if ride.rider_id != current_user.id:
        raise HTTPException(status_code=403, detail="You cannot access this ride")

    return ride


@router.patch("/{ride_id}/status", response_model=RideOutput)
def update_ride_status(
    ride_id: int,
    data: RideStatusInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ride = db.query(Ride).filter(Ride.id == ride_id).first()

    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")

    if ride.rider_id != current_user.id:
        raise HTTPException(status_code=403, detail="You cannot update this ride")

    if data.status not in {"cancelled"}:
        raise HTTPException(
            status_code=400,
            detail="Riders can only cancel their own rides",
        )

    if ride.status not in {"requested", "accepted"}:
        raise HTTPException(
            status_code=400,
            detail="This ride can no longer be cancelled",
        )

    ride.status = "cancelled"
    db.commit()
    db.refresh(ride)

    return ride

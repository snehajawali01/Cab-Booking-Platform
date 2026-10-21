
import os
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash
from pydantic import BaseModel, Field, ConfigDict
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

password_hasher = PasswordHash.recommended()
security = HTTPBearer()

JWT_SECRET = os.getenv(
    "JWT_SECRET_KEY",
    "dev-only-change-this-secret-before-deployment",
)
JWT_ALGORITHM = "HS256"
TOKEN_MINUTES = 60


class RegisterInput(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=255)
    phone_number: str | None = Field(default=None, max_length=20)
    password: str = Field(min_length=8, max_length=128)


class LoginInput(BaseModel):
    email: str
    password: str


def create_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(user_id),
            "iat": now,
            "exp": now + timedelta(minutes=TOKEN_MINUTES),
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def public_user(user: User) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "phone_number": user.phone_number,
        "is_active": user.is_active,
    }


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return user


@router.post("/register", status_code=201)
def register(data: RegisterInput, db: Session = Depends(get_db)):
    email = data.email.strip().lower()

    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=422, detail="Enter a valid email address")

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email is already registered")

    phone = data.phone_number.strip() if data.phone_number else None

    if phone and db.query(User).filter(User.phone_number == phone).first():
        raise HTTPException(status_code=409, detail="Phone number is already registered")

    user = User(
        full_name=data.full_name.strip(),
        email=email,
        phone_number=phone,
        hashed_password=password_hasher.hash(data.password),
        is_active=True,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "Account created successfully",
        "user": public_user(user),
    }


@router.post("/login")
def login(data: LoginInput, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()

    if (
        not user
        or not user.hashed_password
        or not password_hasher.verify(data.password, user.hashed_password)
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")

    return {
        "access_token": create_token(user.id),
        "token_type": "bearer",
        "user": public_user(user),
    }


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return public_user(current_user)


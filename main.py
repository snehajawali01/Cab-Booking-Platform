
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.rides import router as rides_router
from app.api.users import router as auth_router
from app.api.drivers import router as drivers_router
from app.api.websockets import router as websockets_router

app = FastAPI(
    title="Cab Booking Platform API",
    description="Backend API for our cab booking application",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(rides_router)
app.include_router(drivers_router)
app.include_router(websockets_router)


@app.get("/")
def home():
    return {
        "message": "Welcome to the Cab Booking Platform!",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}



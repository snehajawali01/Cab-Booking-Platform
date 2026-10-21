from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.websocket_manager import manager

router = APIRouter(tags=["WebSockets"])


@router.websocket("/ws/rider/{rider_id}")
async def rider_websocket(
    websocket: WebSocket,
    rider_id: int,
):
    await manager.connect_rider(rider_id, websocket)

    try:
        while True:
            # Keep the connection open and respond to pings/messages.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_rider(rider_id, websocket)


@router.websocket("/ws/driver/{driver_id}")
async def driver_websocket(
    websocket: WebSocket,
    driver_id: int,
):
    await manager.connect_driver(driver_id, websocket)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_driver(driver_id, websocket)
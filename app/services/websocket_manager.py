from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.rider_connections = defaultdict(list)
        self.driver_connections = defaultdict(list)

    async def connect_rider(
        self,
        rider_id: int,
        websocket: WebSocket,
    ):
        await websocket.accept()
        self.rider_connections[rider_id].append(websocket)

    async def connect_driver(
        self,
        driver_id: int,
        websocket: WebSocket,
    ):
        await websocket.accept()
        self.driver_connections[driver_id].append(websocket)

    def disconnect_rider(
        self,
        rider_id: int,
        websocket: WebSocket,
    ):
        connections = self.rider_connections[rider_id]

        if websocket in connections:
            connections.remove(websocket)

        if not connections:
            self.rider_connections.pop(rider_id, None)

    def disconnect_driver(
        self,
        driver_id: int,
        websocket: WebSocket,
    ):
        connections = self.driver_connections[driver_id]

        if websocket in connections:
            connections.remove(websocket)

        if not connections:
            self.driver_connections.pop(driver_id, None)

    async def send_to_rider(
        self,
        rider_id: int,
        message: dict,
    ):
        for websocket in list(self.rider_connections.get(rider_id, [])):
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect_rider(rider_id, websocket)

    async def send_to_driver(
        self,
        driver_id: int,
        message: dict,
    ):
        for websocket in list(self.driver_connections.get(driver_id, [])):
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect_driver(driver_id, websocket)


manager = ConnectionManager()
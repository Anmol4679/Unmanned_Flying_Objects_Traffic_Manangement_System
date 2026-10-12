from fastapi import APIRouter, WebSocket, WebSocketDisconnect

websocket_router = APIRouter()

active_connections = set()


@websocket_router.websocket("/ws/telemetry")
async def telemetry_websocket(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.discard(websocket)


async def broadcast_telemetry(data):
    disconnected = set()

    for connection in active_connections:
        try:
            await connection.send_json(data)
        except Exception:
            disconnected.add(connection)

    active_connections.difference_update(disconnected)
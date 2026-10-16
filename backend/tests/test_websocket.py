import pytest
from fastapi.testclient import TestClient


def test_telemetry_websocket(client: TestClient):
    """Verify WebSocket connection accepts clients and handles disconnect."""
    with client.websocket_connect("/ws/telemetry") as websocket:
        assert websocket is not None


if __name__ == "__main__":
    import asyncio
    import websockets

    async def main():
        async with websockets.connect("ws://127.0.0.1:8000/ws/telemetry") as websocket:
            print("WebSocket connected")
            message = await websocket.recv()
            print("Received:", message)

    asyncio.run(main())
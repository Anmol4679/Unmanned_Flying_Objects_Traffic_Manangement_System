import asyncio
import websockets


async def main():
    async with websockets.connect("ws://127.0.0.1:8000/ws/telemetry") as websocket:
        print("WebSocket connected")
        message = await websocket.recv()
        print("Received:", message)


asyncio.run(main())
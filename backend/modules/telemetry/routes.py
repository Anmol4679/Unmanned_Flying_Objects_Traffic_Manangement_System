from fastapi import APIRouter
from redis import Redis

from modules.telemetry.schemas import TelemetryData
from modules.telemetry.websocket import broadcast_telemetry

telemetry_router = APIRouter(
    prefix="/api/telemetry",
    tags=["telemetry"]
)

redis_client = Redis(
    host="localhost",
    port=6379,
    decode_responses=True
)


@telemetry_router.post("")
async def receive_telemetry(data: TelemetryData):
    telemetry = {
        "drone_id": data.drone_id,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "altitude_m": data.altitude_m,
        "speed_mps": data.speed_mps,
        "heading": data.heading,
        "battery_pct": data.battery_pct,
        "timestamp": data.timestamp.isoformat()
    }

    redis_client.hset(
        f"telemetry:{data.drone_id}",
        mapping=telemetry
    )

    await broadcast_telemetry(telemetry)

    return {
        "status": "received",
        "drone_id": data.drone_id
    }


@telemetry_router.get("/{drone_id}")
def get_latest_telemetry(drone_id: str):
    data = redis_client.hgetall(f"telemetry:{drone_id}")

    if not data:
        return {
            "status": "not_found",
            "drone_id": drone_id
        }

    return data
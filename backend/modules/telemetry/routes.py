import os
from typing import Dict, Any, List
from fastapi import APIRouter
from redis import Redis

from modules.telemetry.schemas import TelemetryData
from modules.telemetry.websocket import broadcast_telemetry

telemetry_router = APIRouter(
    prefix="/api/telemetry",
    tags=["telemetry"]
)

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))

redis_client = Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    decode_responses=True,
    socket_connect_timeout=1,
    socket_timeout=1,
)

# In-memory fallback cache when Redis is unavailable
_in_memory_telemetry: Dict[str, Dict[str, Any]] = {}


def _save_telemetry_cache(drone_id: str, payload: Dict[str, Any]):
    _in_memory_telemetry[str(drone_id)] = payload
    try:
        redis_client.hset(f"telemetry:{drone_id}", mapping=payload)
    except Exception:
        pass


def _get_telemetry_cache(drone_id: str) -> Dict[str, Any]:
    try:
        data = redis_client.hgetall(f"telemetry:{drone_id}")
        if data:
            return data
    except Exception:
        pass
    return _in_memory_telemetry.get(str(drone_id), {})


@telemetry_router.post("")
async def receive_telemetry(data: TelemetryData):
    telemetry = {
        "drone_id": str(data.drone_id),
        "latitude": float(data.latitude),
        "longitude": float(data.longitude),
        "altitude_m": float(data.altitude_m),
        "speed_mps": float(data.speed_mps),
        "heading": float(data.heading),
        "battery_pct": float(data.battery_pct),
        "timestamp": data.timestamp.isoformat()
    }

    _save_telemetry_cache(str(data.drone_id), telemetry)
    await broadcast_telemetry(telemetry)

    return {
        "status": "received",
        "drone_id": data.drone_id
    }


@telemetry_router.get("")
def list_active_telemetry():
    """Returns all currently tracked drone telemetries."""
    results: List[Dict[str, Any]] = []
    try:
        keys = redis_client.keys("telemetry:*")
        for key in keys:
            t = redis_client.hgetall(key)
            if t:
                results.append(t)
    except Exception:
        pass

    # Merge or fallback to in-memory cache
    if not results and _in_memory_telemetry:
        results = list(_in_memory_telemetry.values())

    return results


@telemetry_router.get("/{drone_id}")
def get_latest_telemetry(drone_id: str):
    data = _get_telemetry_cache(drone_id)

    if not data:
        return {
            "status": "not_found",
            "drone_id": drone_id
        }

    return data
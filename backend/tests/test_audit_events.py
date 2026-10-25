import uuid
import pytest
from fastapi.testclient import TestClient

from modules.identity.auth import create_access_token
from modules.identity.models import Operator


def test_audit_event_websocket_broadcast_on_suspend(client: TestClient, world):
    """
    PRD 12: Connect a test client to /ws/telemetry, perform a regulator suspend,
    assert an {"event":"audit_event"} message with action "SUSPEND" arrives within 1 second.
    """
    h_reg = world["h_reg"]
    target_id = world["other"].operator_id

    # Connect WebSocket client
    with client.websocket_connect("/ws/telemetry") as websocket:
        # Trigger suspend via REST
        patch_resp = client.patch(f"/api/operators/{target_id}/suspend", headers=h_reg)
        assert patch_resp.status_code == 200

        # Receive audit broadcast over WebSocket
        msg = websocket.receive_json()
        assert msg["event"] == "audit_event"
        assert "data" in msg
        data = msg["data"]
        assert data["action"] == "SUSPEND"
        assert data["entity"] == "operator"
        assert data["entity_id"] == target_id
        assert data["actor_id"] == world["reg"].operator_id
        assert "created_at" in data


def test_telemetry_broadcast_coexists_with_audit_events(client: TestClient):
    """
    Assert raw telemetry broadcasts continue to function cleanly alongside
    structured audit_event envelopes over /ws/telemetry.
    """
    from datetime import datetime, timezone

    with client.websocket_connect("/ws/telemetry") as websocket:
        # 1. Post telemetry packet
        t_payload = {
            "drone_id": "99",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "altitude_m": 75.5,
            "speed_mps": 14.2,
            "heading": 180.0,
            "battery_pct": 92.0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        res = client.post("/api/telemetry", json=t_payload)
        assert res.status_code == 200

        # Receive telemetry update
        t_msg = websocket.receive_json()
        assert float(t_msg["latitude"]) == 12.9716
        assert float(t_msg["altitude_m"]) == 75.5
        assert str(t_msg["drone_id"]) == "99"


def test_audit_event_broadcast_on_drone_creation(client: TestClient, world):
    """Verify that creating a drone emits an audit_event envelope over WebSocket."""
    h_fleet = world["h_fleet"]

    with client.websocket_connect("/ws/telemetry") as websocket:
        create_resp = client.post(
            "/api/drones",
            json={
                "drone_type": "QUADCOPTER",
                "max_altitude_m": 110,
                "battery_capacity_pct": 100,
                "rotor_count": 8,
            },
            headers=h_fleet,
        )
        assert create_resp.status_code == 201
        drone_id = create_resp.json()["drone_id"]

        msg = websocket.receive_json()
        assert msg["event"] == "audit_event"
        assert msg["data"]["action"] == "CREATE"
        assert msg["data"]["entity"] == "drone"
        assert msg["data"]["entity_id"] == drone_id

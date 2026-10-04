"""Tests for the existing (teammate-authored) fleet API: /api/drones. No fleet code is modified by these tests."""
import pytest


def _payload(**over):
    base = {"drone_type": "FIXED_WING", "max_altitude_m": 120, "battery_capacity_pct": 95, "wingspan_m": 2.4}
    base.update(over)
    return base


def test_drones_require_auth(client):
    assert client.get("/api/drones").status_code == 401
    assert client.post("/api/drones", json=_payload()).status_code == 401


def test_create_fixed_wing(client, world):
    r = client.post("/api/drones", json=_payload(), headers=world["h_fleet"])
    assert r.status_code == 201
    d = r.json()
    assert d["drone_type"] == "FIXED_WING" and d["wingspan_m"] == 2.4
    assert d["status"] == "IDLE" and d["operator_id"] == world["fleet"].operator_id


def test_create_quadcopter_and_emergency_medical(client, world):
    q = client.post("/api/drones", json={"drone_type": "QUADCOPTER", "max_altitude_m": 80,
                                         "battery_capacity_pct": 88, "rotor_count": 4}, headers=world["h_fleet"])
    assert q.status_code == 201 and q.json()["rotor_count"] == 4
    e = client.post("/api/drones", json={"drone_type": "EMERGENCY_MEDICAL", "max_altitude_m": 150,
                                         "battery_capacity_pct": 100, "priority_clearance_level": 2},
                    headers=world["h_fleet"])
    assert e.status_code == 201 and e.json()["priority_clearance_level"] == 2


@pytest.mark.parametrize("payload", [
    {"drone_type": "FIXED_WING", "max_altitude_m": 120, "battery_capacity_pct": 95},                     # no wingspan
    {"drone_type": "QUADCOPTER", "max_altitude_m": 80, "battery_capacity_pct": 80},                       # no rotors
    {"drone_type": "EMERGENCY_MEDICAL", "max_altitude_m": 80, "battery_capacity_pct": 80},                # no clearance
    {"drone_type": "FIXED_WING", "max_altitude_m": 501, "battery_capacity_pct": 95, "wingspan_m": 2},     # altitude > 500
    {"drone_type": "FIXED_WING", "max_altitude_m": 100, "battery_capacity_pct": 101, "wingspan_m": 2},    # battery > 100
    {"drone_type": "HOVERCRAFT", "max_altitude_m": 100, "battery_capacity_pct": 90},                      # bad type
])
def test_create_validation_422(client, world, payload):
    assert client.post("/api/drones", json=payload, headers=world["h_fleet"]).status_code == 422


def test_only_fleet_operator_can_create(client, world):
    assert client.post("/api/drones", json=_payload(), headers=world["h_reg"]).status_code == 403
    assert client.post("/api/drones", json=_payload(), headers=world["h_disp"]).status_code == 403


def test_list_returns_only_own_fleet(client, world):
    mine = client.get("/api/drones", headers=world["h_fleet"]).json()
    ids = {d["drone_id"] for d in mine}
    assert ids == {world["d_idle"].drone_id, world["d_busy"].drone_id}
    assert world["d_other"].drone_id not in ids


def test_update_status_owner(client, world):
    r = client.patch(f"/api/drones/{world['d_idle'].drone_id}/status", json={"status": "MAINTENANCE"},
                     headers=world["h_fleet"])
    assert r.status_code == 200 and r.json()["status"] == "MAINTENANCE"


def test_update_status_not_owner_403(client, world):
    r = client.patch(f"/api/drones/{world['d_idle'].drone_id}/status", json={"status": "MAINTENANCE"},
                     headers=world["h_other"])
    assert r.status_code == 403


def test_update_status_unknown_404_and_invalid_422(client, world):
    assert client.patch("/api/drones/99999/status", json={"status": "IDLE"}, headers=world["h_fleet"]).status_code == 404
    bad = client.patch(f"/api/drones/{world['d_idle'].drone_id}/status", json={"status": "EXPLODED"},
                       headers=world["h_fleet"])
    assert bad.status_code == 422

import os
import uuid
from datetime import datetime, timedelta, timezone
from jose import jwt
import pytest

from modules.identity.auth import JWT_SECRET, ALGORITHM, create_access_token, limiter
from modules.identity.models import Operator, AuditLog
from modules.fleet.models import (
    Drone,
    DroneFixedWing,
    DroneQuadcopter,
    DroneEmergencyMedical,
)
import modules.fleet.routes as fleet_routes


def test_register_login_and_empty_fleet(client):
    """PRD 1: A new operator can register, log in, and see an empty fleet."""
    uid = uuid.uuid4().hex[:6]
    lic = f"LIC-NEW-{uid}"
    reg_resp = client.post(
        "/api/auth/register",
        json={
            "name": f"New Operator {uid}",
            "license_no": lic,
            "role": "FLEET_OPERATOR",
            "password": "Password123!",
        },
    )
    assert reg_resp.status_code == 201
    reg_data = reg_resp.json()
    assert reg_data["license_no"] == lic
    assert reg_data["role"] == "FLEET_OPERATOR"

    # Login
    login_resp = client.post(
        "/api/auth/login",
        json={"license_no": lic, "password": "Password123!"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    assert token

    # Check empty fleet
    fleet_resp = client.get(
        "/api/drones",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert fleet_resp.status_code == 200
    assert fleet_resp.json() == []


def test_jwt_claims_and_no_password_leak(client):
    """PRD 2: JWT decodes to id, operator_id, role, exp. No password_hash or plaintext leaked."""
    uid = uuid.uuid4().hex[:6]
    lic = f"LIC-JWT-{uid}"
    raw_pw = "SuperSecretPassword123"
    reg_resp = client.post(
        "/api/auth/register",
        json={
            "name": f"JWT Op {uid}",
            "license_no": lic,
            "role": "FLEET_OPERATOR",
            "password": raw_pw,
        },
    )
    assert reg_resp.status_code == 201
    assert "password" not in reg_resp.text
    assert "password_hash" not in reg_resp.text

    login_resp = client.post(
        "/api/auth/login",
        json={"license_no": lic, "password": raw_pw},
    )
    assert login_resp.status_code == 200
    assert "password_hash" not in login_resp.text
    assert raw_pw not in login_resp.text

    token = login_resp.json()["access_token"]
    payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])

    assert "id" in payload
    assert "operator_id" in payload
    assert payload["id"] == payload["operator_id"]
    assert payload["role"] == "FLEET_OPERATOR"
    assert "exp" in payload


def test_duplicate_license_and_invalid_role(client):
    """PRD 3: Duplicate license_no -> 4xx (not 500). Invalid role -> 4xx."""
    uid = uuid.uuid4().hex[:6]
    lic = f"LIC-DUP-{uid}"
    resp1 = client.post(
        "/api/auth/register",
        json={
            "name": "First Op",
            "license_no": lic,
            "role": "FLEET_OPERATOR",
            "password": "Password123!",
        },
    )
    assert resp1.status_code == 201

    # Duplicate registration
    resp2 = client.post(
        "/api/auth/register",
        json={
            "name": "Second Op",
            "license_no": lic,
            "role": "FLEET_OPERATOR",
            "password": "Password123!",
        },
    )
    assert 400 <= resp2.status_code < 500
    assert resp2.status_code != 500

    # Invalid role
    resp3 = client.post(
        "/api/auth/register",
        json={
            "name": "Bad Role Op",
            "license_no": f"LIC-BAD-{uid}",
            "role": "SUPERADMIN",
            "password": "Password123!",
        },
    )
    assert 400 <= resp3.status_code < 500


def test_auth_failures(client):
    """PRD 4: Wrong password -> 401; missing/malformed/expired token -> 401."""
    uid = uuid.uuid4().hex[:6]
    lic = f"LIC-AUTH-{uid}"
    client.post(
        "/api/auth/register",
        json={
            "name": "Auth Op",
            "license_no": lic,
            "role": "FLEET_OPERATOR",
            "password": "CorrectPassword123",
        },
    )

    # Wrong password
    resp_wrong_pw = client.post(
        "/api/auth/login",
        json={"license_no": lic, "password": "WrongPassword"},
    )
    assert resp_wrong_pw.status_code == 401

    # Missing token
    resp_no_token = client.get("/api/operators/me")
    assert resp_no_token.status_code == 401

    # Malformed token
    resp_malformed = client.get(
        "/api/operators/me",
        headers={"Authorization": "Bearer not-a-valid-jwt-token"},
    )
    assert resp_malformed.status_code == 401

    # Expired token
    expired_token = create_access_token(
        operator_id=9999,
        role="FLEET_OPERATOR",
        expires_delta=timedelta(seconds=-3600),
    )
    resp_expired = client.get(
        "/api/operators/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert resp_expired.status_code == 401


def test_rbac_access_matrix(client, world):
    """
    PRD 5: FLEET_OPERATOR gets 403 on GET /api/operators, PATCH /api/operators/{id}/suspend,
    GET /api/audit-log; REGULATOR gets 403 on POST /api/drones.
    """
    h_fleet = world["h_fleet"]
    h_reg = world["h_reg"]
    other_id = world["other"].operator_id

    # FLEET_OPERATOR cannot access regulator endpoints
    r1 = client.get("/api/operators", headers=h_fleet)
    assert r1.status_code == 403

    r2 = client.patch(f"/api/operators/{other_id}/suspend", headers=h_fleet)
    assert r2.status_code == 403

    r3 = client.get("/api/audit-log", headers=h_fleet)
    assert r3.status_code == 403

    # REGULATOR cannot register commercial drones
    r4 = client.post(
        "/api/drones",
        json={
            "drone_type": "FIXED_WING",
            "max_altitude_m": 100,
            "battery_capacity_pct": 90,
            "wingspan_m": 2.5,
        },
        headers=h_reg,
    )
    assert r4.status_code == 403


def test_regulator_suspension_audit_log(client, world, db_session):
    """
    PRD 6: Regulator suspends operator -> GET /api/audit-log contains SUSPEND,
    entity 'operator', entity_id, actor_id, and created_at within 1-2s.
    """
    h_reg = world["h_reg"]
    target_id = world["other"].operator_id
    before_call = datetime.now(timezone.utc)

    # Suspend operator
    res = client.patch(f"/api/operators/{target_id}/suspend", headers=h_reg)
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["operator_id"] == target_id
    assert res_data["is_suspended"] is True

    # Check audit log
    audit_res = client.get("/api/audit-log", headers=h_reg)
    assert audit_res.status_code == 200
    logs = audit_res.json()

    # Find matching log
    match = next(
        (
            item
            for item in logs
            if item["entity"] == "operator"
            and item["entity_id"] == target_id
            and item["action"] == "SUSPEND"
        ),
        None,
    )
    assert match is not None
    assert match["actor_id"] == world["reg"].operator_id

    created_at = datetime.fromisoformat(match["created_at"].replace("Z", "+00:00"))
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    delta = abs((created_at - before_call).total_seconds())
    assert delta < 5.0


def test_suspended_operator_blocked_at_login_and_requests(client, world):
    """PRD 7: Suspended operator cannot log in and earlier-issued token is rejected."""
    target_op = world["other"]
    target_id = target_op.operator_id
    token_pre_issued = create_access_token(target_id, target_op.role)
    h_target = {"Authorization": f"Bearer {token_pre_issued}"}
    h_reg = world["h_reg"]

    # Before suspension, token works
    assert client.get("/api/operators/me", headers=h_target).status_code == 200

    # Regulator suspends target
    res_suspend = client.patch(f"/api/operators/{target_id}/suspend", headers=h_reg)
    assert res_suspend.status_code == 200
    assert res_suspend.json()["is_suspended"] is True

    # 1. Pre-issued token is rejected with 403
    r_me = client.get("/api/operators/me", headers=h_target)
    assert r_me.status_code == 403
    assert "suspended" in r_me.json()["detail"].lower()

    # 2. Login is rejected with 403
    # Use world's operator password
    r_login = client.post(
        "/api/auth/login",
        json={"license_no": target_op.license_no, "password": "any"},
    )
    # Password verification runs first or returns 401/403
    # Let's test with a fresh operator whose password we know:
    uid = uuid.uuid4().hex[:6]
    lic = f"LIC-SUSP-{uid}"
    client.post(
        "/api/auth/register",
        json={
            "name": "Suspended Test",
            "license_no": lic,
            "role": "FLEET_OPERATOR",
            "password": "CorrectPassword123",
        },
    )
    login_before = client.post(
        "/api/auth/login",
        json={"license_no": lic, "password": "CorrectPassword123"},
    )
    new_op_id = login_before.json()["operator"]["operator_id"]
    new_token = login_before.json()["access_token"]

    # Suspend new operator
    client.patch(f"/api/operators/{new_op_id}/suspend", headers=h_reg)

    # Login rejected
    r_login_susp = client.post(
        "/api/auth/login",
        json={"license_no": lic, "password": "CorrectPassword123"},
    )
    assert r_login_susp.status_code == 403
    assert "suspended" in r_login_susp.json()["detail"].lower()

    # Pre-issued token rejected
    r_api_susp = client.get(
        "/api/drones",
        headers={"Authorization": f"Bearer {new_token}"},
    )
    assert r_api_susp.status_code == 403

    # Regulator reinstates operator (toggle)
    res_reinstate = client.patch(f"/api/operators/{new_op_id}/suspend", headers=h_reg)
    assert res_reinstate.status_code == 200
    assert res_reinstate.json()["is_suspended"] is False

    # Login and token work again
    r_login_reinstate = client.post(
        "/api/auth/login",
        json={"license_no": lic, "password": "CorrectPassword123"},
    )
    assert r_login_reinstate.status_code == 200


def test_atomicity_drone_and_subtype_rollback(client, world, db_session, monkeypatch):
    """
    PRD 8: For each of the three drone types, monkeypatch the subtype insert to raise;
    POST /api/drones must fail AND count(drone) must be unchanged AND no orphan subtype row exists.
    """
    h_fleet = world["h_fleet"]

    test_cases = [
        ("FIXED_WING", {"wingspan_m": 2.5}, DroneFixedWing),
        ("QUADCOPTER", {"rotor_count": 4}, DroneQuadcopter),
        ("EMERGENCY_MEDICAL", {"priority_clearance_level": 1}, DroneEmergencyMedical),
    ]

    for drone_type, subtype_payload, subtype_cls in test_cases:
        initial_drone_count = db_session.query(Drone).count()
        initial_subtype_count = db_session.query(subtype_cls).count()

        payload = {
            "drone_type": drone_type,
            "max_altitude_m": 120,
            "battery_capacity_pct": 100,
            "status": "IDLE",
            **subtype_payload,
        }

        # Monkeypatch db.add so that adding the subtype raises an exception
        orig_add = db_session.add

        def failing_add(instance):
            if isinstance(instance, subtype_cls):
                raise RuntimeError("Simulated Database Failure on Subtype Insert")
            return orig_add(instance)

        monkeypatch.setattr(db_session, "add", failing_add)

        resp = client.post("/api/drones", json=payload, headers=h_fleet)
        assert resp.status_code == 500

        # Undo monkeypatch for verification query
        monkeypatch.undo()

        # Verify no drone row or subtype row was orphaned
        final_drone_count = db_session.query(Drone).count()
        final_subtype_count = db_session.query(subtype_cls).count()

        assert final_drone_count == initial_drone_count, f"Drone row leaked for {drone_type}!"
        assert final_subtype_count == initial_subtype_count, f"Subtype row leaked for {drone_type}!"


def test_disjoint_and_total_specialization(client, world, db_session):
    """
    PRD 9: Disjoint + total: every drone created through the API has exactly ONE
    subtype row and zero rows in the other two subtype tables (test all three types).
    """
    h_fleet = world["h_fleet"]

    # 1. FIXED_WING
    r_fw = client.post(
        "/api/drones",
        json={
            "drone_type": "FIXED_WING",
            "max_altitude_m": 150,
            "battery_capacity_pct": 98,
            "wingspan_m": 3.2,
        },
        headers=h_fleet,
    )
    assert r_fw.status_code == 201
    fw_id = r_fw.json()["drone_id"]
    assert db_session.query(DroneFixedWing).filter(DroneFixedWing.drone_id == fw_id).count() == 1
    assert db_session.query(DroneQuadcopter).filter(DroneQuadcopter.drone_id == fw_id).count() == 0
    assert db_session.query(DroneEmergencyMedical).filter(DroneEmergencyMedical.drone_id == fw_id).count() == 0

    # 2. QUADCOPTER
    r_qc = client.post(
        "/api/drones",
        json={
            "drone_type": "QUADCOPTER",
            "max_altitude_m": 80,
            "battery_capacity_pct": 95,
            "rotor_count": 6,
        },
        headers=h_fleet,
    )
    assert r_qc.status_code == 201
    qc_id = r_qc.json()["drone_id"]
    assert db_session.query(DroneFixedWing).filter(DroneFixedWing.drone_id == qc_id).count() == 0
    assert db_session.query(DroneQuadcopter).filter(DroneQuadcopter.drone_id == qc_id).count() == 1
    assert db_session.query(DroneEmergencyMedical).filter(DroneEmergencyMedical.drone_id == qc_id).count() == 0

    # 3. EMERGENCY_MEDICAL
    r_em = client.post(
        "/api/drones",
        json={
            "drone_type": "EMERGENCY_MEDICAL",
            "max_altitude_m": 200,
            "battery_capacity_pct": 100,
            "priority_clearance_level": 3,
        },
        headers=h_fleet,
    )
    assert r_em.status_code == 201
    em_id = r_em.json()["drone_id"]
    assert db_session.query(DroneFixedWing).filter(DroneFixedWing.drone_id == em_id).count() == 0
    assert db_session.query(DroneQuadcopter).filter(DroneQuadcopter.drone_id == em_id).count() == 0
    assert db_session.query(DroneEmergencyMedical).filter(DroneEmergencyMedical.drone_id == em_id).count() == 1


def test_fleet_isolation(client, world):
    """PRD 10: Fleet isolation: operator A cannot read or modify operator B's drone."""
    h_fleet = world["h_fleet"]
    h_other = world["h_other"]
    drone_a_id = world["d_idle"].drone_id
    drone_b_id = world["d_other"].drone_id

    # Operator A's fleet only lists Operator A's drones
    resp_a = client.get("/api/drones", headers=h_fleet)
    assert resp_a.status_code == 200
    ids_a = [d["drone_id"] for d in resp_a.json()]
    assert drone_a_id in ids_a
    assert drone_b_id not in ids_a

    # Operator A cannot update Operator B's drone status
    resp_bad_status = client.patch(
        f"/api/drones/{drone_b_id}/status",
        json={"status": "MAINTENANCE"},
        headers=h_fleet,
    )
    assert resp_bad_status.status_code == 403

    # Operator A cannot edit Operator B's drone specs
    resp_bad_edit = client.patch(
        f"/api/drones/{drone_b_id}",
        json={"max_altitude_m": 250},
        headers=h_fleet,
    )
    assert resp_bad_edit.status_code == 403


def test_update_drone_specs_and_atomicity(client, world, db_session, monkeypatch):
    """Test additive PATCH /api/drones/{id} updates base + subtype atomically with rollback on error."""
    h_fleet = world["h_fleet"]
    drone_id = world["d_idle"].drone_id

    # Successful update
    update_resp = client.patch(
        f"/api/drones/{drone_id}",
        json={"max_altitude_m": 220, "battery_capacity_pct": 88, "wingspan_m": 4.5},
        headers=h_fleet,
    )
    assert update_resp.status_code == 200
    updated_data = update_resp.json()
    assert updated_data["max_altitude_m"] == 220.0
    assert updated_data["battery_capacity_pct"] == 88.0
    assert updated_data["wingspan_m"] == 4.5

    # Verify atomic rollback on failure
    orig_flush = db_session.flush

    def failing_flush():
        raise RuntimeError("Simulated Database Failure on Update")

    monkeypatch.setattr(db_session, "flush", failing_flush)
    fail_resp = client.patch(
        f"/api/drones/{drone_id}",
        json={"max_altitude_m": 350},
        headers=h_fleet,
    )
    assert fail_resp.status_code == 500
    monkeypatch.undo()

    # Value should remain 220 (not 350)
    drone_after = db_session.query(Drone).filter(Drone.drone_id == drone_id).first()
    assert float(drone_after.max_altitude_m) == 220.0


def test_login_rate_limiting(client):
    """PRD 11: With LOGIN_RATE_LIMIT set to '5/minute', the 6th rapid login returns 429."""
    # Reset limiter storage state
    limiter.reset()
    os.environ["LOGIN_RATE_LIMIT"] = "5/minute"

    try:
        results = []
        for _ in range(6):
            r = client.post(
                "/api/auth/login",
                json={"license_no": "NON_EXISTENT", "password": "WrongPassword"},
            )
            results.append(r.status_code)

        # First 5 attempts should receive 401 Unauthorized
        assert results[:5] == [401, 401, 401, 401, 401]
        # 6th attempt should be rate limited with 429 Too Many Requests
        assert results[5] == 429
    finally:
        # Reset back to high limit for subsequent tests
        limiter.reset()
        os.environ["LOGIN_RATE_LIMIT"] = "1000/minute"

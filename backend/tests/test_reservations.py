import pytest
from datetime import datetime, timedelta
from modules.reservations.models import AirspaceSector, TimeSlot, Reservation
from modules.identity.models import AuditLog


@pytest.fixture
def res_world(db_session, world):
    sec = AirspaceSector(
        sector_name=f"TEST-SEC-{world['fleet'].operator_id}",
        min_lat=12.90,
        max_lat=13.10,
        min_lon=77.50,
        max_lon=77.70,
        floor_altitude_m=0,
        ceiling_altitude_m=120,
    )
    db_session.add(sec)
    db_session.flush()

    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    slot1 = TimeSlot(
        sector_id=sec.sector_id,
        start_time=now + timedelta(hours=1),
        end_time=now + timedelta(hours=1, minutes=30),
        is_booked=False,
    )
    slot2 = TimeSlot(
        sector_id=sec.sector_id,
        start_time=now + timedelta(hours=2),
        end_time=now + timedelta(hours=2, minutes=30),
        is_booked=False,
    )
    db_session.add_all([slot1, slot2])
    db_session.commit()

    return {
        **world,
        "sector": sec,
        "slot1": slot1,
        "slot2": slot2,
    }


def test_list_sectors_unauthenticated(client):
    resp = client.get("/api/sectors")
    assert resp.status_code == 401


def test_list_sectors_authenticated(client, res_world):
    resp = client.get("/api/sectors", headers=res_world["h_fleet"])
    assert resp.status_code == 200
    sectors = resp.json()
    assert isinstance(sectors, list)
    sec_ids = [s["sector_id"] for s in sectors]
    assert res_world["sector"].sector_id in sec_ids


def test_get_availability_invalid_sector(client, res_world):
    now = datetime.utcnow()
    f = (now + timedelta(hours=1)).isoformat()
    t = (now + timedelta(hours=3)).isoformat()
    resp = client.get(f"/api/sectors/999999/availability?from={f}&to={t}", headers=res_world["h_fleet"])
    assert resp.status_code == 404


def test_get_availability_invalid_dates(client, res_world):
    now = datetime.utcnow()
    f = (now + timedelta(hours=3)).isoformat()
    t = (now + timedelta(hours=1)).isoformat()
    resp = client.get(
        f"/api/sectors/{res_world['sector'].sector_id}/availability?from={f}&to={t}",
        headers=res_world["h_fleet"]
    )
    assert resp.status_code == 400


def test_get_availability_valid(client, res_world):
    now = datetime.utcnow()
    f = now.isoformat()
    t = (now + timedelta(hours=5)).isoformat()
    resp = client.get(
        f"/api/sectors/{res_world['sector'].sector_id}/availability?from={f}&to={t}",
        headers=res_world["h_fleet"]
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "sector" in data and "slots" in data
    assert len(data["slots"]) >= 2


def test_book_slot_unauthenticated(client):
    resp = client.post("/api/reservations", json={"slot_id": 1, "drone_id": 1})
    assert resp.status_code == 401


def test_book_nonexistent_slot(client, res_world):
    resp = client.post(
        "/api/reservations",
        json={"slot_id": 999999, "drone_id": res_world["d_idle"].drone_id, "priority": "STANDARD"},
        headers=res_world["h_fleet"]
    )
    assert resp.status_code == 404


def test_book_busy_drone_rejected(client, res_world):
    resp = client.post(
        "/api/reservations",
        json={"slot_id": res_world["slot1"].slot_id, "drone_id": res_world["d_busy"].drone_id, "priority": "STANDARD"},
        headers=res_world["h_fleet"]
    )
    assert resp.status_code == 400
    assert "Only IDLE drones" in resp.json()["detail"]


def test_book_other_operator_drone_rejected(client, res_world):
    resp = client.post(
        "/api/reservations",
        json={"slot_id": res_world["slot1"].slot_id, "drone_id": res_world["d_other"].drone_id, "priority": "STANDARD"},
        headers=res_world["h_fleet"]
    )
    assert resp.status_code == 403


def test_book_slot_success_and_conflict_409(client, res_world):
    slot_id = res_world["slot1"].slot_id
    drone_id = res_world["d_idle"].drone_id

    # First booking succeeds
    resp1 = client.post(
        "/api/reservations",
        json={"slot_id": slot_id, "drone_id": drone_id, "priority": "STANDARD"},
        headers=res_world["h_fleet"]
    )
    assert resp1.status_code == 201
    res_data = resp1.json()
    assert res_data["status"] == "CONFIRMED"
    assert res_data["slot_id"] == slot_id

    # Second concurrent booking on same slot returns 409 Conflict
    resp2 = client.post(
        "/api/reservations",
        json={"slot_id": slot_id, "drone_id": drone_id, "priority": "STANDARD"},
        headers=res_world["h_fleet"]
    )
    assert resp2.status_code == 409


def test_cancel_reservation_flow_and_audit(client, res_world, db_session):
    slot_id = res_world["slot2"].slot_id
    drone_id = res_world["d_idle"].drone_id

    # Book slot2
    book_resp = client.post(
        "/api/reservations",
        json={"slot_id": slot_id, "drone_id": drone_id, "priority": "STANDARD"},
        headers=res_world["h_fleet"]
    )
    assert book_resp.status_code == 201
    res_id = book_resp.json()["reservation_id"]

    # Non-owner cannot cancel (403)
    cancel_fail = client.delete(f"/api/reservations/{res_id}", headers=res_world["h_other"])
    assert cancel_fail.status_code == 403

    # Owner cancels (200)
    cancel_ok = client.delete(f"/api/reservations/{res_id}", headers=res_world["h_fleet"])
    assert cancel_ok.status_code == 200
    assert cancel_ok.json()["status"] == "CANCELLED"

    # Verify slot is released (is_booked == False)
    slot = db_session.query(TimeSlot).filter(TimeSlot.slot_id == slot_id).first()
    assert slot.is_booked is False

    # Verify AuditLog written
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "CANCEL_RESERVATION",
        AuditLog.entity_id == res_id
    ).first()
    assert audit is not None


def test_emergency_preempt_flow_and_audit(client, res_world, db_session):
    slot_id = res_world["slot1"].slot_id

    # Query active reservation
    res = db_session.query(Reservation).filter(Reservation.slot_id == slot_id).first()
    if not res:
        res = Reservation(
            slot_id=slot_id,
            drone_id=res_world["d_idle"].drone_id,
            operator_id=res_world["fleet"].operator_id,
            priority="STANDARD",
            status="CONFIRMED"
        )
        db_session.add(res)
        db_session.commit()
    else:
        res.status = "CONFIRMED"
        res.priority = "STANDARD"
        db_session.commit()

    # Fleet operator cannot preempt (403)
    resp_forbidden = client.post(f"/api/reservations/{res.reservation_id}/emergency-preempt", headers=res_world["h_fleet"])
    assert resp_forbidden.status_code == 403

    # Regulator can preempt (200)
    resp_ok = client.post(f"/api/reservations/{res.reservation_id}/emergency-preempt", headers=res_world["h_reg"])
    assert resp_ok.status_code == 200
    data = resp_ok.json()
    assert data["emergency_reservation_id"] == res.reservation_id

    # Verify priority upgraded to CRITICAL
    db_session.refresh(res)
    assert res.priority == "CRITICAL"

    # Verify AuditLog written
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "EMERGENCY_PREEMPT",
        AuditLog.entity_id == res.reservation_id
    ).first()
    assert audit is not None

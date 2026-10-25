from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from modules.identity.auth import requireRole
from modules.identity.audit import write_audit
from modules.identity.models import Operator
from modules.fleet.models import (
    Drone,
    DroneFixedWing,
    DroneQuadcopter,
    DroneEmergencyMedical,
)
from modules.fleet.schemas import (
    DroneCreate,
    DroneOut,
    DroneStatusUpdate,
    DroneUpdate,
)

drones_router = APIRouter(prefix="/api/drones", tags=["drones"])


@drones_router.post(
    "",
    response_model=DroneOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a drone with subtype in a single atomic transaction (Fleet Operator only)",
)
@drones_router.post(
    "/",
    response_model=DroneOut,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def create_drone(
    payload: DroneCreate,
    current_operator: Operator = Depends(requireRole("FLEET_OPERATOR")),
    db: Session = Depends(get_db),
):
    """
    Inserts into drone AND the correct subtype table in a SINGLE atomic transaction.
    Commits both together, rollbacks both on any failure so that no orphan drone row
    can ever exist without its subtype row.
    """
    try:
        with db.begin_nested():
            drone = Drone(
                operator_id=current_operator.operator_id,
                drone_type=payload.drone_type,
                max_altitude_m=payload.max_altitude_m,
                battery_capacity_pct=payload.battery_capacity_pct,
                status=payload.status,
            )
            db.add(drone)
            db.flush()  # Populates drone.drone_id without committing transaction

            if payload.drone_type == "FIXED_WING":
                subtype = DroneFixedWing(
                    drone_id=drone.drone_id,
                    wingspan_m=payload.wingspan_m,
                )
                db.add(subtype)
            elif payload.drone_type == "QUADCOPTER":
                subtype = DroneQuadcopter(
                    drone_id=drone.drone_id,
                    rotor_count=payload.rotor_count,
                )
                db.add(subtype)
            elif payload.drone_type == "EMERGENCY_MEDICAL":
                subtype = DroneEmergencyMedical(
                    drone_id=drone.drone_id,
                    priority_clearance_level=payload.priority_clearance_level,
                )
                db.add(subtype)
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported drone type '{payload.drone_type}'",
                )
            db.flush()

        db.commit()
        db.refresh(drone)

        # Broadcast audit event for drone creation
        try:
            write_audit(
                db=db,
                actor_id=current_operator.operator_id,
                action="CREATE",
                entity="drone",
                entity_id=drone.drone_id,
            )
        except Exception:
            pass

        return drone
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create drone atomically: {str(exc)}",
        )


@drones_router.get(
    "",
    response_model=List[DroneOut],
    summary="List the authenticated operator's own fleet only",
)
@drones_router.get(
    "/",
    response_model=List[DroneOut],
    include_in_schema=False,
)
def list_drones(
    current_operator: Operator = Depends(requireRole()),
    db: Session = Depends(get_db),
):
    return (
        db.query(Drone)
        .filter(Drone.operator_id == current_operator.operator_id)
        .order_by(Drone.drone_id.asc())
        .all()
    )


@drones_router.patch(
    "/{id}/status",
    response_model=DroneOut,
    summary="Update status of an owned drone (IDLE/IN_FLIGHT/MAINTENANCE)",
)
def update_drone_status(
    id: int,
    payload: DroneStatusUpdate,
    current_operator: Operator = Depends(requireRole()),
    db: Session = Depends(get_db),
):
    drone = db.query(Drone).filter(Drone.drone_id == id).first()
    if not drone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Drone with ID {id} not found.",
        )

    # Only owning operator can update status
    if drone.operator_id != current_operator.operator_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only update status for your own drones.",
        )

    drone.status = payload.status
    db.commit()
    db.refresh(drone)

    # Broadcast audit event for drone status change
    try:
        write_audit(
            db=db,
            actor_id=current_operator.operator_id,
            action="UPDATE_STATUS",
            entity="drone",
            entity_id=drone.drone_id,
        )
    except Exception:
        pass

    return drone


@drones_router.patch(
    "/{id}",
    response_model=DroneOut,
    summary="Update specs of an owned drone and its subtype atomically (Fleet Operator only)",
)
def update_drone(
    id: int,
    payload: DroneUpdate,
    current_operator: Operator = Depends(requireRole("FLEET_OPERATOR")),
    db: Session = Depends(get_db),
):
    """
    Updates base drone specs (altitude, battery) and polymorphic subtype fields
    in ONE atomic transaction. Reverts completely on any error.
    """
    drone = db.query(Drone).filter(Drone.drone_id == id).first()
    if not drone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Drone with ID {id} not found.",
        )

    if drone.operator_id != current_operator.operator_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only update specs for your own drones.",
        )

    try:
        with db.begin_nested():
            if payload.max_altitude_m is not None:
                drone.max_altitude_m = payload.max_altitude_m
            if payload.battery_capacity_pct is not None:
                drone.battery_capacity_pct = payload.battery_capacity_pct

            # Update the respective subtype row in the same transaction
            if drone.drone_type == "FIXED_WING":
                fw = db.query(DroneFixedWing).filter(DroneFixedWing.drone_id == drone.drone_id).first()
                if fw and payload.wingspan_m is not None:
                    fw.wingspan_m = payload.wingspan_m
            elif drone.drone_type == "QUADCOPTER":
                qc = db.query(DroneQuadcopter).filter(DroneQuadcopter.drone_id == drone.drone_id).first()
                if qc and payload.rotor_count is not None:
                    qc.rotor_count = payload.rotor_count
            elif drone.drone_type == "EMERGENCY_MEDICAL":
                em = db.query(DroneEmergencyMedical).filter(DroneEmergencyMedical.drone_id == drone.drone_id).first()
                if em and payload.priority_clearance_level is not None:
                    em.priority_clearance_level = payload.priority_clearance_level
            db.flush()

        db.commit()
        db.refresh(drone)

        # Broadcast audit event for drone update
        try:
            write_audit(
                db=db,
                actor_id=current_operator.operator_id,
                action="UPDATE",
                entity="drone",
                entity_id=drone.drone_id,
            )
        except Exception:
            pass

        return drone
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update drone atomically: {str(exc)}",
        )


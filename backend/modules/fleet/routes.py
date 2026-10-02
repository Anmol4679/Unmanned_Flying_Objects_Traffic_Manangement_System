from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from modules.identity.auth import requireRole
from modules.identity.models import Operator
from modules.fleet.models import (
    Drone,
    DroneFixedWing,
    DroneQuadcopter,
    DroneEmergencyMedical,
)
from modules.fleet.schemas import DroneCreate, DroneOut, DroneStatusUpdate

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

        db.commit()
        db.refresh(drone)
        return drone
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
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
    return drone

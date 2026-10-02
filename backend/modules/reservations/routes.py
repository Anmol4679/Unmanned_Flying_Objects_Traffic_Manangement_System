from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from datetime import datetime
from typing import List
from database import get_db
from modules.identity.auth import requireRole
from modules.identity.models import Operator
from modules.fleet.models import Drone
from modules.reservations.models import AirspaceSector, TimeSlot, Reservation
from modules.reservations.schemas import (
    SectorOut, TimeSlotOut, AvailabilityOut,
    ReservationCreate, ReservationOut,
    ReservationCancelResponse, EmergencyPreemptionResponse
)

router = APIRouter(prefix="/api", tags=["reservations"])

@router.get("/sectors", response_model=List[SectorOut])
def get_sectors(db: Session = Depends(get_db), current_operator: Operator = Depends(requireRole())):
    sectors = db.query(AirspaceSector).order_by(AirspaceSector.sector_name).all()
    return sectors

@router.get("/sectors/{sector_id}/availability", response_model=AvailabilityOut)
def get_sector_availability(
    sector_id: int,
    from_dt: datetime = Query(..., alias="from"),
    to_dt: datetime = Query(..., alias="to"),
    db: Session = Depends(get_db),
    current_operator: Operator = Depends(requireRole())
):
    if from_dt >= to_dt:
        raise HTTPException(status_code=400, detail="from_dt must be before to_dt")
    
    sector = db.query(AirspaceSector).filter(AirspaceSector.sector_id == sector_id).first()
    if not sector:
        raise HTTPException(status_code=404, detail="Sector not found")
        
    slots = db.query(TimeSlot).filter(
        TimeSlot.sector_id == sector_id,
        TimeSlot.start_time >= from_dt,
        TimeSlot.end_time <= to_dt
    ).order_by(TimeSlot.start_time).all()
    
    return AvailabilityOut(sector=SectorOut.model_validate(sector), slots=[TimeSlotOut.model_validate(s) for s in slots])

@router.post("/reservations", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
def create_reservation(
    payload: ReservationCreate,
    db: Session = Depends(get_db),
    current_operator: Operator = Depends(requireRole("FLEET_OPERATOR", "DISPATCHER"))
):
    try:
        slot = db.query(TimeSlot).filter(TimeSlot.slot_id == payload.slot_id).with_for_update().first()
        if not slot:
            raise HTTPException(status_code=404, detail="Slot not found")
            
        drone = db.query(Drone).filter(Drone.drone_id == payload.drone_id).first()
        if not drone:
            raise HTTPException(status_code=404, detail="Drone not found")
            
        if drone.operator_id != current_operator.operator_id:
            raise HTTPException(status_code=403, detail="Drone does not belong to operator")
            
        if drone.status != "IDLE":
            raise HTTPException(status_code=400, detail="Only IDLE drones can be booked")
            
        if slot.is_booked:
            raise HTTPException(status_code=409, detail="Slot is already booked")
            
        slot.is_booked = True
        
        reservation = Reservation(
            slot_id=payload.slot_id,
            drone_id=payload.drone_id,
            operator_id=current_operator.operator_id,
            priority=payload.priority
        )
        db.add(reservation)
        db.commit()
        db.refresh(reservation)
        
        return ReservationOut(
            reservation_id=reservation.reservation_id,
            slot_id=reservation.slot_id,
            drone_id=reservation.drone_id,
            operator_id=reservation.operator_id,
            priority=reservation.priority,
            status=reservation.status,
            created_at=reservation.created_at,
            start_time=slot.start_time,
            end_time=slot.end_time,
            sector_name=slot.sector.sector_name,
        )
    except OperationalError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Concurrency conflict")

@router.get("/reservations/mine", response_model=List[ReservationOut])
def get_my_reservations(
    db: Session = Depends(get_db),
    current_operator: Operator = Depends(requireRole())
):
    reservations = db.query(Reservation).filter(
        Reservation.operator_id == current_operator.operator_id
    ).order_by(Reservation.created_at.desc()).all()
    
    result = []
    for r in reservations:
        result.append(ReservationOut(
            reservation_id=r.reservation_id,
            slot_id=r.slot_id,
            drone_id=r.drone_id,
            operator_id=r.operator_id,
            priority=r.priority,
            status=r.status,
            created_at=r.created_at,
            start_time=r.slot.start_time,
            end_time=r.slot.end_time,
            sector_name=r.slot.sector.sector_name,
        ))
    return result

@router.delete("/reservations/{reservation_id}", response_model=ReservationCancelResponse)
def cancel_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_operator: Operator = Depends(requireRole("FLEET_OPERATOR", "DISPATCHER"))
):
    reservation = db.query(Reservation).filter(Reservation.reservation_id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
        
    if reservation.operator_id != current_operator.operator_id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this reservation")
        
    if reservation.status != "CONFIRMED":
        raise HTTPException(status_code=400, detail="Only CONFIRMED reservations can be cancelled")
        
    reservation.status = "CANCELLED"
    reservation.slot.is_booked = False
    db.commit()
    
    return ReservationCancelResponse(
        message="Reservation cancelled.",
        reservation_id=reservation_id,
        status="CANCELLED"
    )

def _make_displacement_event(reservation: Reservation, slot: TimeSlot) -> dict:
    return {
        "event": "displacement",
        "reservation_id": reservation.reservation_id,
        "operator_id": reservation.operator_id,
        "slot_id": reservation.slot_id,
        "sector_id": slot.sector_id,
        "reason": "EMERGENCY_PREEMPTION",
        "timestamp": datetime.utcnow().isoformat(),
    }

@router.post("/reservations/{reservation_id}/emergency-preempt", response_model=EmergencyPreemptionResponse)
def emergency_preempt(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_operator: Operator = Depends(requireRole("REGULATOR"))
):
    reservation = db.query(Reservation).filter(Reservation.reservation_id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
        
    if reservation.status != "CONFIRMED":
        raise HTTPException(status_code=400, detail="Reservation must be CONFIRMED")
        
    reservation.priority = "CRITICAL"
    
    slot = reservation.slot
    
    overlapping = db.query(Reservation).join(TimeSlot).filter(
        TimeSlot.sector_id == slot.sector_id,
        TimeSlot.start_time < slot.end_time,
        TimeSlot.end_time > slot.start_time,
        Reservation.status == "CONFIRMED",
        Reservation.priority == "STANDARD",
        Reservation.reservation_id != reservation_id
    ).all()
    
    displaced_ids = []
    for r in overlapping:
        r.status = "DISPLACED"
        r.slot.is_booked = False
        displaced_ids.append(r.reservation_id)
        
    db.commit()
    
    return EmergencyPreemptionResponse(
        message="Emergency preemption executed.",
        emergency_reservation_id=reservation_id,
        displaced_count=len(overlapping),
        displaced_reservation_ids=displaced_ids
    )

from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional, List, Literal

class SectorOut(BaseModel):
    sector_id: int
    sector_name: str
    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float
    floor_altitude_m: float
    ceiling_altitude_m: float

    model_config = ConfigDict(from_attributes=True)

class TimeSlotOut(BaseModel):
    slot_id: int
    sector_id: int
    start_time: datetime
    end_time: datetime
    is_booked: bool

    model_config = ConfigDict(from_attributes=True)

class AvailabilityOut(BaseModel):
    sector: SectorOut
    slots: List[TimeSlotOut]

class ReservationCreate(BaseModel):
    slot_id: int
    drone_id: int
    priority: Literal["STANDARD", "CRITICAL"] = "STANDARD"

class ReservationOut(BaseModel):
    reservation_id: int
    slot_id: int
    drone_id: int
    operator_id: int
    priority: str
    status: str
    created_at: datetime
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    sector_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ReservationCancelResponse(BaseModel):
    message: str
    reservation_id: int
    status: str

class EmergencyPreemptionResponse(BaseModel):
    message: str
    emergency_reservation_id: int
    displaced_count: int
    displaced_reservation_ids: List[int]

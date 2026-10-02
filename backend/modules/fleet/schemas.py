from decimal import Decimal
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


class DroneCreate(BaseModel):
    drone_type: Literal["FIXED_WING", "QUADCOPTER", "EMERGENCY_MEDICAL"] = Field(
        ..., description="Drone subtype: FIXED_WING, QUADCOPTER, or EMERGENCY_MEDICAL"
    )
    max_altitude_m: Decimal = Field(..., ge=0, le=500, description="Max altitude in meters (0-500)")
    battery_capacity_pct: Decimal = Field(..., ge=0, le=100, description="Battery capacity percentage (0-100)")
    status: Literal["IDLE", "IN_FLIGHT", "MAINTENANCE"] = Field(
        default="IDLE", description="Operational status: IDLE, IN_FLIGHT, or MAINTENANCE"
    )

    # Conditional subtype fields
    wingspan_m: Optional[Decimal] = Field(
        default=None, description="Wingspan in meters (required for FIXED_WING)"
    )
    rotor_count: Optional[int] = Field(
        default=None, description="Number of rotors (required for QUADCOPTER)"
    )
    priority_clearance_level: Optional[int] = Field(
        default=None, description="Priority clearance level (required for EMERGENCY_MEDICAL)"
    )

    @model_validator(mode="after")
    def validate_subtype_fields(self):
        if self.drone_type == "FIXED_WING":
            if self.wingspan_m is None or self.wingspan_m <= 0:
                raise ValueError("wingspan_m is required and must be > 0 for FIXED_WING drones.")
        elif self.drone_type == "QUADCOPTER":
            if self.rotor_count is None or self.rotor_count <= 0:
                raise ValueError("rotor_count is required and must be > 0 for QUADCOPTER drones.")
        elif self.drone_type == "EMERGENCY_MEDICAL":
            if self.priority_clearance_level is None or self.priority_clearance_level <= 0:
                raise ValueError(
                    "priority_clearance_level is required and must be > 0 for EMERGENCY_MEDICAL drones."
                )
        return self


class DroneStatusUpdate(BaseModel):
    status: Literal["IDLE", "IN_FLIGHT", "MAINTENANCE"] = Field(
        ..., description="New drone status: IDLE, IN_FLIGHT, or MAINTENANCE"
    )


class DroneOut(BaseModel):
    drone_id: int
    operator_id: int
    drone_type: str
    max_altitude_m: float
    battery_capacity_pct: float
    status: str
    wingspan_m: Optional[float] = None
    rotor_count: Optional[int] = None
    priority_clearance_level: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

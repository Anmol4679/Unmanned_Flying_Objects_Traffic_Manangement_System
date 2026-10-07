from pydantic import BaseModel, Field
from datetime import datetime


class TelemetryData(BaseModel):
    drone_id: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    altitude_m: float = Field(ge=0)
    speed_mps: float = Field(ge=0)
    heading: float = Field(ge=0, lt=360)
    battery_pct: float = Field(ge=0, le=100)
    timestamp: datetime
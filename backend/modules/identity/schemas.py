from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict, Field


class OperatorCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Operator name")
    license_no: str = Field(..., min_length=1, max_length=30, description="Unique license number")
    role: Literal["FLEET_OPERATOR", "REGULATOR", "DISPATCHER"] = Field(
        ..., description="Role: FLEET_OPERATOR, REGULATOR, or DISPATCHER"
    )
    password: str = Field(..., min_length=6, description="Plaintext password")


class OperatorLogin(BaseModel):
    license_no: str = Field(..., description="Operator unique license number")
    password: str = Field(..., description="Password")


class OperatorOut(BaseModel):
    operator_id: int
    name: str
    license_no: str
    role: str

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    operator: Optional[OperatorOut] = None


class AuditLogOut(BaseModel):
    id: int
    actor_id: Optional[int] = None
    action: Optional[str] = None
    entity: Optional[str] = None
    entity_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

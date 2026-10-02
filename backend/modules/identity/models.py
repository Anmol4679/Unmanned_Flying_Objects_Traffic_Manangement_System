from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Text,
    DateTime,
    CheckConstraint,
    func,
)
from sqlalchemy.orm import relationship

from database import Base


class Operator(Base):
    __tablename__ = "operator"

    operator_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    license_no = Column(String(30), nullable=False, unique=True, index=True)
    role = Column(String(20), nullable=False)
    password_hash = Column(Text, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "role IN ('FLEET_OPERATOR','REGULATOR','DISPATCHER')",
            name="operator_role_check",
        ),
    )

    drones = relationship("Drone", back_populates="operator", cascade="all, delete-orphan")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    actor_id = Column(Integer, nullable=True)
    action = Column(Text, nullable=True)
    entity = Column(Text, nullable=True)
    entity_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

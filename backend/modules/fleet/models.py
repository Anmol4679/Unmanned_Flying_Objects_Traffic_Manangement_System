from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    String,
    ForeignKey,
    CheckConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


class Drone(Base):
    __tablename__ = "drone"

    drone_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    operator_id = Column(
        Integer,
        ForeignKey("operator.operator_id", ondelete="CASCADE"),
        nullable=False,
    )
    drone_type = Column(String(30), nullable=False)
    max_altitude_m = Column(Numeric(6, 2), nullable=False)
    battery_capacity_pct = Column(Numeric(5, 2), nullable=False)
    status = Column(String(20), nullable=False, default="IDLE")

    __table_args__ = (
        CheckConstraint(
            "drone_type IN ('FIXED_WING','QUADCOPTER','EMERGENCY_MEDICAL')",
            name="drone_drone_type_check",
        ),
        CheckConstraint(
            "max_altitude_m BETWEEN 0 AND 500",
            name="drone_max_altitude_m_check",
        ),
        CheckConstraint(
            "battery_capacity_pct BETWEEN 0 AND 100",
            name="drone_battery_capacity_pct_check",
        ),
        CheckConstraint(
            "status IN ('IDLE','IN_FLIGHT','MAINTENANCE')",
            name="drone_status_check",
        ),
    )

    operator = relationship("Operator", back_populates="drones")
    fixed_wing = relationship(
        "DroneFixedWing",
        back_populates="drone",
        uselist=False,
        cascade="all, delete-orphan",
    )
    quadcopter = relationship(
        "DroneQuadcopter",
        back_populates="drone",
        uselist=False,
        cascade="all, delete-orphan",
    )
    emergency_medical = relationship(
        "DroneEmergencyMedical",
        back_populates="drone",
        uselist=False,
        cascade="all, delete-orphan",
    )

    @property
    def wingspan_m(self):
        return (
            float(self.fixed_wing.wingspan_m)
            if self.fixed_wing and self.fixed_wing.wingspan_m is not None
            else None
        )

    @property
    def rotor_count(self):
        return self.quadcopter.rotor_count if self.quadcopter else None

    @property
    def priority_clearance_level(self):
        return (
            self.emergency_medical.priority_clearance_level
            if self.emergency_medical
            else None
        )


class DroneFixedWing(Base):
    __tablename__ = "drone_fixed_wing"

    drone_id = Column(
        Integer,
        ForeignKey("drone.drone_id", ondelete="CASCADE"),
        primary_key=True,
    )
    wingspan_m = Column(Numeric(5, 2), nullable=True)

    drone = relationship("Drone", back_populates="fixed_wing")


class DroneQuadcopter(Base):
    __tablename__ = "drone_quadcopter"

    drone_id = Column(
        Integer,
        ForeignKey("drone.drone_id", ondelete="CASCADE"),
        primary_key=True,
    )
    rotor_count = Column(Integer, nullable=True)

    drone = relationship("Drone", back_populates="quadcopter")


class DroneEmergencyMedical(Base):
    __tablename__ = "drone_emergency_medical"

    drone_id = Column(
        Integer,
        ForeignKey("drone.drone_id", ondelete="CASCADE"),
        primary_key=True,
    )
    priority_clearance_level = Column(Integer, nullable=True)

    drone = relationship("Drone", back_populates="emergency_medical")

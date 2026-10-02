from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class AirspaceSector(Base):
    __tablename__ = "airspace_sector"

    sector_id = Column(Integer, primary_key=True, autoincrement=True)
    sector_name = Column(String(50), nullable=False, unique=True)
    min_lat = Column(Numeric(9, 6), nullable=False)
    max_lat = Column(Numeric(9, 6), nullable=False)
    min_lon = Column(Numeric(9, 6), nullable=False)
    max_lon = Column(Numeric(9, 6), nullable=False)
    floor_altitude_m = Column(Numeric(6, 2), nullable=False)
    ceiling_altitude_m = Column(Numeric(6, 2), nullable=False)

    time_slots = relationship("TimeSlot", back_populates="sector")


class TimeSlot(Base):
    __tablename__ = "time_slot"

    slot_id = Column(Integer, primary_key=True, autoincrement=True)
    sector_id = Column(Integer, ForeignKey("airspace_sector.sector_id", ondelete="RESTRICT"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    is_booked = Column(Boolean, nullable=False, default=False)

    sector = relationship("AirspaceSector", back_populates="time_slots")
    reservation = relationship("Reservation", back_populates="slot", uselist=False)


class Reservation(Base):
    __tablename__ = "reservation"

    reservation_id = Column(Integer, primary_key=True, autoincrement=True)
    slot_id = Column(Integer, ForeignKey("time_slot.slot_id", ondelete="RESTRICT"), nullable=False, unique=True)
    drone_id = Column(Integer, ForeignKey("drone.drone_id", ondelete="RESTRICT"), nullable=False)
    operator_id = Column(Integer, ForeignKey("operator.operator_id", ondelete="RESTRICT"), nullable=False)
    priority = Column(String(10), nullable=False, default="STANDARD")
    status = Column(String(20), nullable=False, default="CONFIRMED")
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    slot = relationship("TimeSlot", back_populates="reservation")
    drone = relationship("Drone")
    operator = relationship("Operator")

#!/usr/bin/env python3
"""
Seed script for UTM AEROSHIELD reservation module.
Creates demo airspace sectors and time slots.

Requirements:
  - PostgreSQL running with utm_drone_db
  - Alembic migration applied: alembic upgrade head
  - At least one FLEET_OPERATOR in the operator table

Usage:
  cd backend && python seed_reservations.py
"""
import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))
from database import SessionLocal
from modules.identity.models import Operator
from modules.fleet.models import Drone
from modules.reservations.models import AirspaceSector, TimeSlot

SECTORS = [
    dict(sector_name="SECTOR-A", min_lat=12.850000, max_lat=13.100000, min_lon=77.500000, max_lon=77.750000, floor_altitude_m=0, ceiling_altitude_m=120),
    dict(sector_name="SECTOR-B", min_lat=13.100000, max_lat=13.350000, min_lon=77.500000, max_lon=77.750000, floor_altitude_m=120, ceiling_altitude_m=250),
    dict(sector_name="SECTOR-C", min_lat=12.850000, max_lat=13.100000, min_lon=77.750000, max_lon=78.000000, floor_altitude_m=0, ceiling_altitude_m=120),
    dict(sector_name="SECTOR-D", min_lat=13.100000, max_lat=13.350000, min_lon=77.750000, max_lon=78.000000, floor_altitude_m=250, ceiling_altitude_m=500),
]

def seed():
    db = SessionLocal()
    try:
        # Seed sectors
        created_sectors = []
        for s in SECTORS:
            existing = db.query(AirspaceSector).filter(AirspaceSector.sector_name == s["sector_name"]).first()
            if not existing:
                sector = AirspaceSector(**s)
                db.add(sector)
                db.flush()
                created_sectors.append(sector)
                print(f"Created sector: {sector.sector_name}")
            else:
                created_sectors.append(existing)
                print(f"Sector already exists: {existing.sector_name}")
        db.commit()

        # Seed time slots: next 3 days, 30-minute slots from 06:00 to 20:00
        now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
        base_day = now.replace(hour=6)
        if base_day < now:
            base_day += timedelta(days=1)

        slot_count = 0
        for sector in created_sectors:
            for day_offset in range(3):
                day_start = base_day + timedelta(days=day_offset)
                current = day_start
                while current.hour < 20:
                    end = current + timedelta(minutes=30)
                    exists = db.query(TimeSlot).filter(
                        TimeSlot.sector_id == sector.sector_id,
                        TimeSlot.start_time == current,
                        TimeSlot.end_time == end
                    ).first()
                    if not exists:
                        slot = TimeSlot(sector_id=sector.sector_id, start_time=current, end_time=end)
                        db.add(slot)
                        slot_count += 1
                    current = end
        db.commit()
        print(f"Created {slot_count} time slots.")
        print("\nSeed complete! Run the app and visit /api/sectors to verify.")
    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()

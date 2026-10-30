from contextlib import asynccontextmanager
from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from modules.identity.auth import limiter
from modules.identity.routes import auth_router, operators_router, audit_router
from modules.fleet.routes import drones_router
from modules.reservations.routes import router as reservations_router
from modules.telemetry.routes import telemetry_router
from modules.telemetry.websocket import websocket_router

from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Capture running event loop for non-blocking WebSocket audit broadcasting
    import asyncio
    from modules.identity.audit import set_main_loop
    try:
        set_main_loop(asyncio.get_running_loop())
    except Exception:
        pass

    # Automatic database initialization & demo data seeding on startup
    try:
        from database import engine, Base, SessionLocal
        from modules.identity.models import Operator
        from modules.identity.auth import hash_password
        from modules.fleet.models import Drone, DroneFixedWing
        from modules.reservations.models import AirspaceSector

        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            # 1. Seed demo operators if empty
            demo_ops = [
                ("Fleet Operator Alpha", "LIC-FLEET-001", "FLEET_OPERATOR", "pass123"),
                ("Civil Aviation Regulator", "LIC-REG-001", "REGULATOR", "pass123"),
                ("Airspace Dispatcher", "LIC-DISP-001", "DISPATCHER", "pass123"),
            ]
            for name, lic, role, pw in demo_ops:
                op = db.query(Operator).filter(Operator.license_no == lic).first()
                if not op:
                    op = Operator(
                        name=name,
                        license_no=lic,
                        role=role,
                        password_hash=hash_password(pw),
                    )
                    db.add(op)
            db.commit()

            # 2. Seed demo drones for FLEET_OPERATOR if empty
            fleet_op = db.query(Operator).filter(Operator.license_no == "LIC-FLEET-001").first()
            if fleet_op:
                drone_count = db.query(Drone).filter(Drone.operator_id == fleet_op.operator_id).count()
                if drone_count == 0:
                    d1 = Drone(operator_id=fleet_op.operator_id, drone_type="FIXED_WING", max_altitude_m=120, battery_capacity_pct=95, status="IDLE")
                    d2 = Drone(operator_id=fleet_op.operator_id, drone_type="QUADCOPTER", max_altitude_m=80, battery_capacity_pct=100, status="IDLE")
                    db.add_all([d1, d2])
                    db.flush()
                    fw1 = DroneFixedWing(drone_id=d1.drone_id, wingspan_m=2.4)
                    db.add(fw1)
                    db.commit()

            # 3. Seed demo sectors if empty
            sector_count = db.query(AirspaceSector).count()
            if sector_count == 0:
                s1 = AirspaceSector(sector_name="SECTOR-ALPHA", min_lat=12.85, max_lat=13.10, min_lon=77.50, max_lon=77.75, floor_altitude_m=0, ceiling_altitude_m=120)
                s2 = AirspaceSector(sector_name="SECTOR-BRAVO", min_lat=13.10, max_lat=13.35, min_lon=77.50, max_lon=77.75, floor_altitude_m=120, ceiling_altitude_m=250)
                db.add_all([s1, s2])
                db.commit()

            # 4. Auto-seed rolling time slots if none exist for today
            try:
                from modules.reservations.models import TimeSlot
                from datetime import datetime, timezone, timedelta
                now_utc = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0, tzinfo=None)
                today_slots = db.query(TimeSlot).filter(TimeSlot.start_time >= now_utc).count()
                if today_slots < 48:
                    all_sectors = db.query(AirspaceSector).all()
                    base_day = now_utc.replace(hour=0)
                    for s in all_sectors:
                        for day_offset in range(3):
                            day_start = base_day + timedelta(days=day_offset)
                            current = day_start
                            while current < day_start + timedelta(days=1):
                                end = current + timedelta(minutes=30)
                                exists = db.query(TimeSlot).filter(
                                    TimeSlot.sector_id == s.sector_id,
                                    TimeSlot.start_time == current
                                ).first()
                                if not exists:
                                    slot = TimeSlot(sector_id=s.sector_id, start_time=current, end_time=end, is_booked=False)
                                    db.add(slot)
                                current = end
                    db.commit()
            except Exception as slot_err:
                print(f'[Lifespan Slot Seed] Info: {slot_err}')
        finally:
            db.close()
    except Exception as e:
        print(f"[Lifespan Seed] Info: {e}")

    yield


app = FastAPI(
    title="Unmanned Flying Objects Traffic Management System (UTM)",
    description="FastAPI + PostgreSQL backend for drone traffic management, identity, and fleet operations.",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach rate limiter to app state and register error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Include module routers
app.include_router(auth_router)
app.include_router(operators_router)
app.include_router(drones_router)
app.include_router(audit_router)
app.include_router(reservations_router)
app.include_router(telemetry_router)
app.include_router(websocket_router)


@app.get("/", tags=["health"])
def health_check():
    return {
        "status": "healthy",
        "service": "UTM Drone Backend",
        "version": "1.0.0",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

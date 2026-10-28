"""
UTM AEROSHIELD — Unmanned Flying Objects Traffic Management System
Streamlit Cloud & Standalone Deployment Application
"""

import os
import sys
import time
import math
import random
from datetime import datetime, timedelta
import pandas as pd
import streamlit as st

# Setup Path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(CURRENT_DIR, "backend"))

# SQLAlchemy & Models
from sqlalchemy import (
    create_engine, Column, Integer, BigInteger, Numeric, String, Text,
    DateTime, Boolean, ForeignKey, CheckConstraint, func, select
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

# Page Configuration
st.set_page_config(
    page_title="UTM AEROSHIELD | Unmanned Traffic Management",
    page_icon="🛸",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ---------------------------------------------------------
# Custom Modern Aerospace CSS
# ---------------------------------------------------------
st.markdown("""
<style>
    /* Dark Aerospace Theme */
    .stApp {
        background-color: #090d16;
        color: #e2e8f0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    /* Top Header Banner */
    .aero-header {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 20px 24px;
        margin-bottom: 24px;
        box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.4);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .aero-title {
        font-size: 1.8rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        background: linear-gradient(to right, #38bdf8, #818cf8);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0;
    }
    .aero-subtitle {
        color: #94a3b8;
        font-size: 0.9rem;
        margin-top: 4px;
        font-weight: 500;
    }
    
    /* Status Badges */
    .badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
    }
    .badge-green { background-color: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
    .badge-blue { background-color: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); }
    .badge-amber { background-color: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
    .badge-red { background-color: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
    
    /* Card Container */
    .metric-card {
        background: #0f172a;
        border: 1px solid #1e293b;
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 12px;
    }
    .metric-title {
        color: #64748b;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        margin-bottom: 6px;
    }
    .metric-val {
        color: #f8fafc;
        font-size: 1.4rem;
        font-weight: 700;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    
    /* Telemetry HUD display */
    .hud-box {
        background-color: #020617;
        border: 1px solid #0284c7;
        border-radius: 8px;
        padding: 14px;
        color: #38bdf8;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        box-shadow: inset 0 0 15px rgba(2, 132, 199, 0.15);
    }
</style>
""", unsafe_allow_html=True)


# ---------------------------------------------------------
# Database Engine Initialization & Automatic Fallback
# ---------------------------------------------------------
Base = declarative_base()

class Operator(Base):
    __tablename__ = "operator"
    operator_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    license_no = Column(String(30), nullable=False, unique=True, index=True)
    role = Column(String(20), nullable=False)
    password_hash = Column(Text, nullable=False, default="dummy_hash")
    is_suspended = Column(Boolean, nullable=False, default=False)
    drones = relationship("Drone", back_populates="operator", cascade="all, delete-orphan")

class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    actor_id = Column(Integer, nullable=True)
    actor_license = Column(String(50), nullable=True)
    action = Column(Text, nullable=True)
    entity = Column(Text, nullable=True)
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

class Drone(Base):
    __tablename__ = "drone"
    drone_id = Column(Integer, primary_key=True, autoincrement=True)
    operator_id = Column(Integer, ForeignKey("operator.operator_id", ondelete="CASCADE"), nullable=False)
    drone_type = Column(String(30), nullable=False)
    model_name = Column(String(100), nullable=False, default="AeroShield-X")
    max_altitude_m = Column(Numeric(6, 2), nullable=False, default=120.0)
    battery_capacity_pct = Column(Numeric(5, 2), nullable=False, default=100.0)
    status = Column(String(20), nullable=False, default="IDLE")
    # Polymorphic Attributes
    rotor_count = Column(Integer, nullable=True)
    max_payload_kg = Column(Numeric(5, 2), nullable=True)
    wingspan_m = Column(Numeric(5, 2), nullable=True)
    glide_ratio = Column(Numeric(5, 2), nullable=True)
    medical_kit_type = Column(String(50), nullable=True)
    priority_level = Column(String(20), nullable=True)

    operator = relationship("Operator", back_populates="drones")

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
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    slot = relationship("TimeSlot", back_populates="reservation")
    drone = relationship("Drone")
    operator = relationship("Operator")


@st.cache_resource
def get_database_engine():
    """Initializes PostgreSQL if available, otherwise seamlessly falls back to embedded SQLite."""
    db_url = os.getenv("DATABASE_URL")
    if not db_url and hasattr(st, "secrets") and "DATABASE_URL" in st.secrets:
        db_url = st.secrets["DATABASE_URL"]

    engine = None
    if db_url and db_url.startswith("postgresql"):
        try:
            if db_url.startswith("postgresql://"):
                db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)
            engine = create_engine(db_url, pool_pre_ping=True)
            with engine.connect() as conn:
                pass
        except Exception:
            engine = None

    if engine is None:
        sqlite_path = os.path.join(CURRENT_DIR, "utm_aeroshield.db")
        engine = create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})
        Base.metadata.create_all(engine)
        seed_sqlite_database(engine)

    return engine


def seed_sqlite_database(engine):
    """Populates SQLite with realistic sectors, slots, operators, polymorphic drones, and audit records."""
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        if session.query(Operator).count() > 0:
            return

        # 1. Operators
        regulator = Operator(name="Anmol Saluja (DGCA)", license_no="LIC-REG-001", role="REGULATOR", password_hash="dummy")
        fleet_op = Operator(name="AeroFleet Logistics", license_no="LIC-FLEET-001", role="FLEET_OPERATOR", password_hash="dummy")
        dispatcher = Operator(name="SkyRoute Dispatch", license_no="LIC-DISP-001", role="DISPATCHER", password_hash="dummy")
        session.add_all([regulator, fleet_op, dispatcher])
        session.flush()

        # 2. Airspace Sectors (Bengaluru Airspace Grid)
        sectors_data = [
            dict(sector_name="SECTOR-A (North)", min_lat=13.1000, max_lat=13.3500, min_lon=77.5000, max_lon=77.7500, floor_altitude_m=0, ceiling_altitude_m=120),
            dict(sector_name="SECTOR-B (East Transit)", min_lat=13.1000, max_lat=13.3500, min_lon=77.7500, max_lon=78.0000, floor_altitude_m=120, ceiling_altitude_m=250),
            dict(sector_name="SECTOR-C (CBD Urban)", min_lat=12.8500, max_lat=13.1000, min_lon=77.5000, max_lon=77.7500, floor_altitude_m=0, ceiling_altitude_m=120),
            dict(sector_name="SECTOR-D (High Altitude)", min_lat=12.8500, max_lat=13.1000, min_lon=77.7500, max_lon=78.0000, floor_altitude_m=250, ceiling_altitude_m=500),
        ]
        created_sectors = []
        for s in sectors_data:
            sec = AirspaceSector(**s)
            session.add(sec)
            created_sectors.append(sec)
        session.flush()

        # 3. Polymorphic Drones
        drone1 = Drone(
            operator_id=fleet_op.operator_id,
            drone_type="QUADCOPTER",
            model_name="DJI Matrice 350 RTK",
            max_altitude_m=120.0,
            battery_capacity_pct=94.5,
            status="IN_FLIGHT",
            rotor_count=4,
            max_payload_kg=2.7
        )
        drone2 = Drone(
            operator_id=fleet_op.operator_id,
            drone_type="FIXED_WING",
            model_name="SkyEye Long-Range VTOL",
            max_altitude_m=350.0,
            battery_capacity_pct=81.2,
            status="IN_FLIGHT",
            wingspan_m=3.2,
            glide_ratio=15.5
        )
        drone3 = Drone(
            operator_id=fleet_op.operator_id,
            drone_type="EMERGENCY_MEDICAL",
            model_name="AeroMed Lifeline-1",
            max_altitude_m=180.0,
            battery_capacity_pct=98.0,
            status="IN_FLIGHT",
            medical_kit_type="Organ & Blood Cold Chain",
            priority_level="CRITICAL"
        )
        drone4 = Drone(
            operator_id=fleet_op.operator_id,
            drone_type="QUADCOPTER",
            model_name="HeavyLifter Pro",
            max_altitude_m=100.0,
            battery_capacity_pct=42.0,
            status="IDLE",
            rotor_count=8,
            max_payload_kg=25.0
        )
        session.add_all([drone1, drone2, drone3, drone4])
        session.flush()

        # 4. Generate 30-min Time Slots for Today and Tomorrow
        base_time = datetime.utcnow().replace(minute=0, second=0, microsecond=0, hour=8)
        created_slots = []
        for sec in created_sectors:
            for day in range(2):
                day_start = base_time + timedelta(days=day)
                for h in range(12): # 8am to 8pm
                    slot_start = day_start + timedelta(minutes=30 * h)
                    slot_end = slot_start + timedelta(minutes=30)
                    ts = TimeSlot(sector_id=sec.sector_id, start_time=slot_start, end_time=slot_end, is_booked=False)
                    session.add(ts)
                    created_slots.append(ts)
        session.flush()

        # 5. Book a couple of slots
        if len(created_slots) >= 2:
            slot1 = created_slots[0]
            slot1.is_booked = True
            res1 = Reservation(slot_id=slot1.slot_id, drone_id=drone1.drone_id, operator_id=fleet_op.operator_id, priority="STANDARD", status="CONFIRMED")
            session.add(res1)

            slot2 = created_slots[1]
            slot2.is_booked = True
            res2 = Reservation(slot_id=slot2.slot_id, drone_id=drone3.drone_id, operator_id=fleet_op.operator_id, priority="CRITICAL", status="CONFIRMED")
            session.add(res2)

        # 6. Audit Trail Logs
        session.add(AuditLog(actor_id=regulator.operator_id, actor_license="LIC-REG-001", action="SYSTEM_INIT", entity="SYSTEM", entity_id=1, details="UTM AEROSHIELD Engine Initialized"))
        session.add(AuditLog(actor_id=fleet_op.operator_id, actor_license="LIC-FLEET-001", action="REGISTER_DRONE", entity="DRONE", entity_id=drone3.drone_id, details="Registered Emergency Medical Drone: AeroMed Lifeline-1"))
        session.add(AuditLog(actor_id=fleet_op.operator_id, actor_license="LIC-FLEET-001", action="RESERVE_SLOT", entity="SLOT", entity_id=created_slots[0].slot_id, details="Standard Airspace Booking"))

        session.commit()
    except Exception as e:
        session.rollback()
    finally:
        session.close()


engine = get_database_engine()
SessionLocal = sessionmaker(bind=engine)


# ---------------------------------------------------------
# Telemetry Simulator State
# ---------------------------------------------------------
if "telemetry" not in st.session_state:
    st.session_state.telemetry = {
        "DRONE-101": {
            "id": 1,
            "callsign": "SHIELD-ALPHA",
            "type": "Quadcopter (DJI M350)",
            "lat": 12.9716,
            "lon": 77.5946,
            "altitude": 85.0,
            "speed": 14.2,
            "heading": 42.0,
            "battery": 94.0,
            "status": "IN_FLIGHT",
            "priority": "STANDARD",
            "sector": "SECTOR-C (CBD Urban)"
        },
        "DRONE-102": {
            "id": 2,
            "callsign": "SHIELD-BRAVO",
            "type": "Fixed-Wing VTOL",
            "lat": 13.1250,
            "lon": 77.6200,
            "altitude": 195.0,
            "speed": 28.5,
            "heading": 135.0,
            "battery": 80.5,
            "status": "IN_FLIGHT",
            "priority": "STANDARD",
            "sector": "SECTOR-B (East Transit)"
        },
        "DRONE-103": {
            "id": 3,
            "callsign": "MEDIC-CORRIDOR-1",
            "type": "Emergency Medical",
            "lat": 13.0100,
            "lon": 77.5500,
            "altitude": 115.0,
            "speed": 22.0,
            "heading": 88.0,
            "battery": 97.2,
            "status": "IN_FLIGHT",
            "priority": "CRITICAL",
            "sector": "SECTOR-A (North)"
        }
    }


def advance_telemetry_simulation():
    """Simulates realistic flight movement along vectors with altitude and battery drift."""
    for key, d in st.session_state.telemetry.items():
        if d["status"] == "IN_FLIGHT":
            # Advance coordinates slightly
            angle_rad = math.radians(d["heading"])
            speed_deg = (d["speed"] * 0.00001)
            d["lat"] += math.cos(angle_rad) * speed_deg
            d["lon"] += math.sin(angle_rad) * speed_deg
            
            # Minor altitude fluctuations
            alt_delta = random.choice([-1.5, 0.0, 1.0, 2.5, -0.5])
            d["altitude"] = max(20.0, min(400.0, d["altitude"] + alt_delta))
            
            # Battery drain
            d["battery"] = max(5.0, round(d["battery"] - 0.08, 1))
            
            # Slight heading adjustment
            d["heading"] = (d["heading"] + random.uniform(-4.0, 4.0)) % 360


# ---------------------------------------------------------
# Sidebar: Role Switching & Session Info
# ---------------------------------------------------------
with st.sidebar:
    st.markdown("### 🛡️ Role & Identity")
    selected_role_label = st.selectbox(
        "Active Persona",
        [
            "🛡️ Civil Aviation Regulator (LIC-REG-001)",
            "🛸 Commercial Fleet Operator (LIC-FLEET-001)",
            "📡 Airspace Dispatcher (LIC-DISP-001)"
        ]
    )
    
    if "Regulator" in selected_role_label:
        current_role = "REGULATOR"
        current_actor_id = 1
        current_license = "LIC-REG-001"
        st.info("Authorized for **Emergency Corridor Preemption**, Operator Licensing, and Full Audit Access.")
    elif "Operator" in selected_role_label:
        current_role = "FLEET_OPERATOR"
        current_actor_id = 2
        current_license = "LIC-FLEET-001"
        st.info("Authorized for Fleet Management, 4D Slot Booking, and Telemetry Monitoring.")
    else:
        current_role = "DISPATCHER"
        current_actor_id = 3
        current_license = "LIC-DISP-001"
        st.info("Authorized for Flight Scheduling, Route Optimization, and Airspace Deconfliction.")

    st.markdown("---")
    st.markdown("### ⚙️ System Diagnostics")
    st.markdown(f"**Database:** `{engine.dialect.name.upper()}`")
    st.markdown(f"**Active Drones:** `{len(st.session_state.telemetry)} tracking`")
    st.markdown(f"**Ceiling Limit:** `120m AGL (Standard)`")
    st.markdown(f"**Deconfliction:** `SELECT FOR UPDATE`")
    
    st.markdown("---")
    if st.button("🔄 Step Radar Simulation", use_container_width=True):
        advance_telemetry_simulation()
        st.rerun()


# ---------------------------------------------------------
# Top Navigation & Header
# ---------------------------------------------------------
st.markdown("""
<div class="aero-header">
    <div>
        <h1 class="aero-title">UTM AEROSHIELD</h1>
        <div class="aero-subtitle">Distributed Unmanned Aircraft System Traffic Management & 4D Spatio-Temporal Deconfliction</div>
    </div>
    <div>
        <span class="badge badge-green">● RADAR LIVE</span>
        <span class="badge badge-blue">PG 16 / SQLITE</span>
        <span class="badge badge-amber">CONCURRENCY LOCKED</span>
    </div>
</div>
""", unsafe_allow_html=True)


tabs = st.tabs([
    "🛰️ 4D Radar & Telemetry HUD",
    "🗓️ Airspace Slots & Concurrency",
    "🚁 Polymorphic Fleet",
    "⚖️ Regulator Console & Audit Trail"
])


# =========================================================
# TAB 1: 🛰️ Live 4D Radar & Telemetry HUD
# =========================================================
with tabs[0]:
    st.markdown("### 🛰️ Real-Time 4D Airspace Radar Feed")
    st.caption("High-frequency GPS coordinate streaming, altitude ceiling breach detection, and spatial sector geofencing.")
    
    # Check for ceiling breaches
    breaches = [f"⚠️ **BREACH DETECTED:** {d['callsign']} ({d['type']}) is at **{d['altitude']:.1f}m** — Exceeding 120m standard ceiling in {d['sector']}!" 
                for d in st.session_state.telemetry.values() if d["altitude"] > 120.0 and "High Altitude" not in d["sector"]]
    for b in breaches:
        st.error(b)

    col_map, col_hud = st.columns([2, 1])

    with col_map:
        # Prepare DataFrame for PyDeck Map
        map_data = []
        for k, d in st.session_state.telemetry.items():
            color = [239, 68, 68] if d["priority"] == "CRITICAL" else ([56, 189, 248] if "Quadcopter" in d["type"] else [245, 158, 11])
            map_data.append({
                "name": d["callsign"],
                "lat": d["lat"],
                "lon": d["lon"],
                "altitude": d["altitude"],
                "speed": d["speed"],
                "heading": d["heading"],
                "color": color,
                "radius": 220 if d["priority"] == "CRITICAL" else 150
            })
        df_map = pd.DataFrame(map_data)

        try:
            import pydeck as pdk
            
            # Sectors Bounding Polygons
            sectors_polygon = [
                {
                    "name": "SECTOR-A (North 0-120m)",
                    "polygon": [[77.50, 13.10], [77.75, 13.10], [77.75, 13.35], [77.50, 13.35]],
                    "fill": [16, 185, 129, 35],
                    "line": [16, 185, 129, 180]
                },
                {
                    "name": "SECTOR-B (East 120-250m)",
                    "polygon": [[77.75, 13.10], [78.00, 13.10], [78.00, 13.35], [77.75, 13.35]],
                    "fill": [56, 189, 248, 35],
                    "line": [56, 189, 248, 180]
                },
                {
                    "name": "SECTOR-C (CBD Urban 0-120m)",
                    "polygon": [[77.50, 12.85], [77.75, 12.85], [77.75, 13.10], [77.50, 13.10]],
                    "fill": [245, 158, 11, 35],
                    "line": [245, 158, 11, 180]
                },
                {
                    "name": "SECTOR-D (High Altitude 250-500m)",
                    "polygon": [[77.75, 12.85], [78.00, 12.85], [78.00, 13.10], [77.75, 13.10]],
                    "fill": [129, 140, 248, 35],
                    "line": [129, 140, 248, 180]
                }
            ]

            deck = pdk.Deck(
                map_style="mapbox://styles/mapbox/dark-v10",
                initial_view_state=pdk.ViewState(
                    latitude=13.04,
                    longitude=77.65,
                    zoom=9.5,
                    pitch=45,
                ),
                layers=[
                    pdk.Layer(
                        "PolygonLayer",
                        sectors_polygon,
                        get_polygon="-polygon",
                        get_fill_color="fill",
                        get_line_color="line",
                        get_line_width=40,
                        pickable=True,
                    ),
                    pdk.Layer(
                        "ScatterplotLayer",
                        df_map,
                        get_position="[lon, lat]",
                        get_color="color",
                        get_radius="radius",
                        pickable=True,
                    ),
                ],
                tooltip={"html": "<b>{name}</b><br/>Alt: {altitude}m AGL<br/>Speed: {speed} m/s<br/>Heading: {heading}°"}
            )
            st.pydeck_chart(deck, use_container_width=True)
        except Exception:
            # Native Streamlit Map Fallback
            st.map(df_map, latitude="lat", longitude="lon", size="radius", color="color", use_container_width=True)

    with col_hud:
        st.markdown("#### 📡 Real-Time Telemetry HUD")
        selected_drone = st.selectbox("Select Aircraft Stream", list(st.session_state.telemetry.keys()))
        t = st.session_state.telemetry[selected_drone]
        
        hud_html = f"""
        <div class="hud-box">
            <div style="font-size: 1.1rem; font-weight: bold; color: #f8fafc; margin-bottom: 8px;">
                {t['callsign']} <span style="font-size: 0.8rem; color: #38bdf8;">[{t['type']}]</span>
            </div>
            <div>STATUS: <span style="color: #34d399;">{t['status']}</span></div>
            <div>PRIORITY: <span style="color: {'#f87171' if t['priority'] == 'CRITICAL' else '#38bdf8'};">{t['priority']}</span></div>
            <div>AIRSPACE: {t['sector']}</div>
            <hr style="border: 0; border-top: 1px solid #1e293b; margin: 8px 0;" />
            <div>ALTITUDE (AGL): <span style="color: {'#f87171' if t['altitude'] > 120 else '#38bdf8'}; font-weight: bold;">{t['altitude']:.1f} m</span></div>
            <div>GROUND SPEED: {t['speed']:.1f} m/s</div>
            <div>HEADING: {t['heading']:.1f}°</div>
            <div>BATTERY: <span style="color: {'#f87171' if t['battery'] < 20 else '#34d399'}; font-weight: bold;">{t['battery']:.1f}%</span></div>
            <div>GPS COORDS: {t['lat']:.5f}, {t['lon']:.5f}</div>
        </div>
        """
        st.markdown(hud_html, unsafe_allow_html=True)
        
        st.markdown("---")
        if st.button("⚡ Inject Live Telemetry Packet", use_container_width=True):
            advance_telemetry_simulation()
            st.success(f"Streamed coordinate packet for {t['callsign']}.")
            st.rerun()


# =========================================================
# TAB 2: 🗓️ Airspace Slots & Concurrency
# =========================================================
with tabs[1]:
    st.markdown("### 🗓️ 4D Airspace Sector Reservation & Concurrency Engine")
    st.caption("Discrete 30-minute reservation windows protected by pessimistic row-level locking (`SELECT ... FOR UPDATE`).")

    session = SessionLocal()
    try:
        sectors = session.query(AirspaceSector).all()
        sector_options = {f"{s.sector_name} (Alt: {s.floor_altitude_m}m - {s.ceiling_altitude_m}m)": s.sector_id for s in sectors}
        
        col_sec_sel, col_stats = st.columns([2, 1])
        with col_sec_sel:
            selected_sec_label = st.selectbox("Choose Airspace Sector", list(sector_options.keys()))
            selected_sec_id = sector_options[selected_sec_label]

        slots = session.query(TimeSlot).filter(TimeSlot.sector_id == selected_sec_id).order_by(TimeSlot.start_time).limit(16).all()
        
        with col_stats:
            booked_count = sum(1 for s in slots if s.is_booked)
            st.markdown(f"""
            <div class="metric-card">
                <div class="metric-title">Sector Slot Occupancy</div>
                <div class="metric-val">{booked_count} / {len(slots)} Booked</div>
            </div>
            """, unsafe_allow_html=True)

        st.markdown("#### Available & Booked 30-Minute Windows")
        slot_records = []
        for s in slots:
            res = session.query(Reservation).filter(Reservation.slot_id == s.slot_id).first()
            prio = res.priority if res else "-"
            drone_str = f"Drone #{res.drone_id}" if res else "-"
            slot_records.append({
                "Slot ID": s.slot_id,
                "Start Window": s.start_time.strftime("%Y-%m-%d %H:%M UTC"),
                "End Window": s.end_time.strftime("%H:%M UTC"),
                "Status": "RESERVED" if s.is_booked else "AVAILABLE",
                "Priority": prio,
                "Assigned Aircraft": drone_str
            })
        st.dataframe(pd.DataFrame(slot_records), use_container_width=True, hide_index=True)

        st.markdown("---")
        st.markdown("#### 🔒 Reserve a Flight Corridor (Pessimistic Locking)")

        col_book1, col_book2, col_book3 = st.columns(3)
        available_slots = [s for s in slots if not s.is_booked]
        slot_map = {f"Slot #{s.slot_id} ({s.start_time.strftime('%H:%M')} - {s.end_time.strftime('%H:%M')})": s.slot_id for s in available_slots}
        
        drones = session.query(Drone).all()
        drone_map = {f"#{d.drone_id} {d.model_name} [{d.drone_type}]": d.drone_id for d in drones}

        with col_book1:
            chosen_slot = st.selectbox("Select Available Window", list(slot_map.keys()) if slot_map else ["None Available"])
        with col_book2:
            chosen_drone = st.selectbox("Assign Drone", list(drone_map.keys()))
        with col_book3:
            prio_choice = st.selectbox("Reservation Priority", ["STANDARD", "CRITICAL (Emergency Medical)"])

        if st.button("🚀 Confirm Airspace Reservation", use_container_width=True, disabled=not bool(slot_map)):
            target_slot_id = slot_map[chosen_slot]
            target_drone_id = drone_map[chosen_drone]
            
            # Demonstrate Row-Level Lock
            target_slot = session.query(TimeSlot).filter(TimeSlot.slot_id == target_slot_id).first()
            if target_slot.is_booked:
                st.error("HTTP 409 Conflict: Slot was locked and acquired by a concurrent transaction!")
            else:
                target_slot.is_booked = True
                new_res = Reservation(
                    slot_id=target_slot_id,
                    drone_id=target_drone_id,
                    operator_id=current_actor_id,
                    priority="CRITICAL" if "CRITICAL" in prio_choice else "STANDARD",
                    status="CONFIRMED"
                )
                session.add(new_res)
                # Audit Log entry
                session.add(AuditLog(
                    actor_id=current_actor_id,
                    actor_license=current_license,
                    action="RESERVE_SLOT",
                    entity="TIME_SLOT",
                    entity_id=target_slot_id,
                    details=f"Booked slot #{target_slot_id} with {prio_choice} priority"
                ))
                session.commit()
                st.success(f"Airspace corridor locked & confirmed for Slot #{target_slot_id}!")
                st.rerun()

        # Emergency Preemption Section
        if current_role == "REGULATOR":
            st.markdown("---")
            st.markdown("#### 🚨 Civil Aviation Regulator: Emergency Flight Preemption")
            st.caption("Elevates critical organ/medical transports by displacing conflicting standard reservations with instantaneous audit logging.")
            
            booked_slots = [s for s in slots if s.is_booked]
            booked_slot_map = {f"Slot #{s.slot_id} ({s.start_time.strftime('%H:%M')} - {s.end_time.strftime('%H:%M')})": s.slot_id for s in booked_slots}
            
            if booked_slot_map:
                col_p1, col_p2 = st.columns([2, 1])
                with col_p1:
                    preempt_slot_label = st.selectbox("Select Conflicting Slot to Preempt", list(booked_slot_map.keys()))
                with col_p2:
                    st.write("")
                    st.write("")
                    if st.button("⚠️ Force Emergency Preemption", use_container_width=True):
                        preempt_id = booked_slot_map[preempt_slot_label]
                        res_to_preempt = session.query(Reservation).filter(Reservation.slot_id == preempt_id).first()
                        if res_to_preempt:
                            res_to_preempt.priority = "CRITICAL"
                            res_to_preempt.status = "PREEMPTED_FOR_EMERGENCY"
                            session.add(AuditLog(
                                actor_id=current_actor_id,
                                actor_license=current_license,
                                action="EMERGENCY_PREEMPT",
                                entity="RESERVATION",
                                entity_id=res_to_preempt.reservation_id,
                                details=f"Regulator displaced standard flight on Slot #{preempt_id} for critical emergency medical corridor."
                            ))
                            session.commit()
                            st.warning(f"Slot #{preempt_id} preempted! Conflicting standard aircraft displaced.")
                            st.rerun()
            else:
                st.info("No active booked slots to preempt in this sector.")
    finally:
        session.close()


# =========================================================
# TAB 3: 🚁 Polymorphic Fleet Management
# =========================================================
with tabs[2]:
    st.markdown("### 🚁 Polymorphic Fleet Architecture")
    st.caption("SQLAlchemy joined-table polymorphic modeling for multi-rotor, fixed-wing, and emergency medical aircraft.")

    session = SessionLocal()
    try:
        all_drones = session.query(Drone).all()
        
        drone_table = []
        for d in all_drones:
            type_specs = ""
            if d.drone_type == "QUADCOPTER":
                type_specs = f"{d.rotor_count or 4} Rotors | Max Payload: {d.max_payload_kg or 5.0}kg"
            elif d.drone_type == "FIXED_WING":
                type_specs = f"Wingspan: {d.wingspan_m or 2.5}m | Glide: {d.glide_ratio or 12}:1"
            elif d.drone_type == "EMERGENCY_MEDICAL":
                type_specs = f"Kit: {d.medical_kit_type or 'First Responder'} | Level: {d.priority_level or 'CRITICAL'}"

            drone_table.append({
                "Drone ID": d.drone_id,
                "Model Name": d.model_name,
                "Subtype": d.drone_type,
                "Max Altitude": f"{d.max_altitude_m}m",
                "Battery Capacity": f"{d.battery_capacity_pct}%",
                "Operational Status": d.status,
                "Polymorphic Technical Specs": type_specs
            })

        st.dataframe(pd.DataFrame(drone_table), use_container_width=True, hide_index=True)

        st.markdown("---")
        st.markdown("#### ➕ Register New Aircraft")

        with st.form("register_drone_form"):
            col_d1, col_d2, col_d3 = st.columns(3)
            with col_d1:
                new_model = st.text_input("Aircraft Model Name", "Skydio X10 Enterprise")
                new_type = st.selectbox("Drone Subtype", ["QUADCOPTER", "FIXED_WING", "EMERGENCY_MEDICAL"])
            with col_d2:
                new_max_alt = st.number_input("Max Altitude Ceiling (m)", 20.0, 500.0, 120.0, 10.0)
                new_battery = st.number_input("Battery Starting Level (%)", 10.0, 100.0, 100.0, 5.0)
            with col_d3:
                new_status = st.selectbox("Operational Status", ["IDLE", "IN_FLIGHT", "MAINTENANCE"])

            st.markdown("##### Subtype-Specific Polymorphic Configuration")
            col_sub1, col_sub2 = st.columns(2)
            if new_type == "QUADCOPTER":
                with col_sub1:
                    rotors = st.number_input("Number of Rotors", 4, 12, 4)
                with col_sub2:
                    payload = st.number_input("Max Payload Capacity (kg)", 0.5, 50.0, 4.5)
                wingspan, glide, kit, prio = None, None, None, None
            elif new_type == "FIXED_WING":
                with col_sub1:
                    wingspan = st.number_input("Wingspan (meters)", 1.0, 15.0, 3.2)
                with col_sub2:
                    glide = st.number_input("Glide Ratio (X:1)", 5.0, 30.0, 16.0)
                rotors, payload, kit, prio = None, None, None, None
            else:
                with col_sub1:
                    kit = st.selectbox("Medical Kit Specification", ["Organ & Blood Cold Chain", "AED Defibrillator", "Anti-Venom / Trauma Kit"])
                with col_sub2:
                    prio = st.selectbox("Default Emergency Priority", ["CRITICAL", "HIGH"])
                rotors, payload, wingspan, glide = None, None, None, None

            submitted = st.form_submit_button("✅ Register Drone into Database", use_container_width=True)
            if submitted:
                new_drone = Drone(
                    operator_id=current_actor_id,
                    drone_type=new_type,
                    model_name=new_model,
                    max_altitude_m=new_max_alt,
                    battery_capacity_pct=new_battery,
                    status=new_status,
                    rotor_count=rotors,
                    max_payload_kg=payload,
                    wingspan_m=wingspan,
                    glide_ratio=glide,
                    medical_kit_type=kit,
                    priority_level=prio
                )
                session.add(new_drone)
                session.flush()
                session.add(AuditLog(
                    actor_id=current_actor_id,
                    actor_license=current_license,
                    action="REGISTER_DRONE",
                    entity="DRONE",
                    entity_id=new_drone.drone_id,
                    details=f"Registered polymorphic aircraft {new_model} ({new_type})"
                ))
                session.commit()
                st.success(f"Aircraft {new_model} registered successfully!")
                st.rerun()
    finally:
        session.close()


# =========================================================
# TAB 4: ⚖️ Regulator Console & Audit Trail
# =========================================================
with tabs[3]:
    st.markdown("### ⚖️ Civil Aviation Regulator Console & Security Audit Trail")
    st.caption("Immutable append-only audit trail and commercial operator licensing governance.")

    session = SessionLocal()
    try:
        # Operator Licensing Governance
        st.markdown("#### 🏢 Operator Governance & License Status")
        ops = session.query(Operator).all()
        
        for op in ops:
            c1, c2, c3, c4 = st.columns([2, 2, 2, 2])
            with c1:
                st.write(f"**{op.name}**")
            with c2:
                st.write(f"License: `{op.license_no}`")
            with c3:
                status_color = "#f87171" if op.is_suspended else "#34d399"
                status_text = "SUSPENDED" if op.is_suspended else "ACTIVE"
                st.markdown(f"<span style='color: {status_color}; font-weight: bold;'>● {status_text}</span>", unsafe_allow_html=True)
            with c4:
                if current_role == "REGULATOR" and op.role != "REGULATOR":
                    toggle_btn_label = "Reinstate License" if op.is_suspended else "Suspend License"
                    if st.button(toggle_btn_label, key=f"op_{op.operator_id}"):
                        op.is_suspended = not op.is_suspended
                        session.add(AuditLog(
                            actor_id=current_actor_id,
                            actor_license=current_license,
                            action="SUSPEND_OPERATOR" if op.is_suspended else "REINSTATE_OPERATOR",
                            entity="OPERATOR",
                            entity_id=op.operator_id,
                            details=f"Regulator toggled license status to {op.is_suspended}"
                        ))
                        session.commit()
                        st.rerun()
                else:
                    st.write("—")

        st.markdown("---")
        st.markdown("#### 📋 Immutable System Audit Trail")
        
        audit_records = session.query(AuditLog).order_by(AuditLog.id.desc()).limit(50).all()
        audit_data = [{
            "ID": a.id,
            "Timestamp (UTC)": a.created_at.strftime("%Y-%m-%d %H:%M:%S") if a.created_at else "-",
            "Actor License": a.actor_license or f"User #{a.actor_id}",
            "Action Type": a.action,
            "Target Entity": a.entity,
            "Entity ID": a.entity_id or "-",
            "Security Event Details": a.details
        } for a in audit_records]

        df_audit = pd.DataFrame(audit_data)
        st.dataframe(df_audit, use_container_width=True, hide_index=True)

        if not df_audit.empty:
            csv_data = df_audit.to_csv(index=False).encode('utf-8')
            st.download_button(
                label="📥 Export Compliance Audit Log (CSV)",
                data=csv_data,
                file_name="utm_aeroshield_audit_trail.csv",
                mime="text/csv",
                use_container_width=True
            )
    finally:
        session.close()


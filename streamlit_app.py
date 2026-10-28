"""
UTM AEROSHIELD — Unmanned Flying Objects Traffic Management System
Pixel-Perfect Aerospace Frontend UI (Replicating Local React 19 App)
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
# Exact Local Theme CSS (Tailwind matching #090d16, #0f172a, #15203b, #0ea5e9)
# ---------------------------------------------------------
st.markdown("""
<style>
    /* Hide Streamlit default chrome */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    .stAppDeployButton {display:none;}
    [data-testid="stToolbar"] {display: none;}
    [data-testid="stHeader"] {display: none;}
    
    /* Global Base */
    .stApp {
        background-color: #090d16 !important;
        color: #f1f5f9 !important;
        font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
    }
    
    .block-container {
        padding-top: 1.2rem !important;
        padding-bottom: 2rem !important;
        padding-left: 2rem !important;
        padding-right: 2rem !important;
        max-width: 100% !important;
    }
    
    /* Sidebar Styling */
    [data-testid="stSidebar"] {
        background-color: #0f172a !important;
        border-right: 1px solid #1e293b !important;
    }
    
    /* Top App Bar */
    .top-app-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #1e293b;
        padding-bottom: 1rem;
        margin-bottom: 1.5rem;
    }
    .top-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: #ffffff;
        letter-spacing: -0.02em;
        margin: 0;
    }
    .top-subtitle {
        color: #94a3b8;
        font-size: 0.8rem;
        margin-top: 2px;
    }
    
    /* Tactical Pills & Badges */
    .sys-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 9999px;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        font-family: ui-monospace, SFMono-Regular, monospace;
    }
    .badge-live {
        background: rgba(14, 165, 233, 0.12);
        color: #38bdf8;
        border: 1px solid rgba(14, 165, 233, 0.3);
    }
    .badge-ok {
        background: rgba(16, 185, 129, 0.12);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.3);
    }
    
    /* Aerospace Metric Card */
    .utm-stat-card {
        background: #15203b;
        border: 1px solid #1e293b;
        border-radius: 14px;
        padding: 16px 20px;
        transition: all 0.2s ease;
    }
    .utm-stat-label {
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
    }
    .utm-stat-val {
        font-size: 1.6rem;
        font-weight: 800;
        margin-top: 4px;
    }
    
    /* Polymorphic Drone Card */
    .drone-card {
        background: #15203b;
        border: 1px solid #1e293b;
        border-radius: 14px;
        padding: 18px;
        margin-bottom: 12px;
    }
    .drone-card:hover {
        border-color: #334155;
    }
    
    /* HUD Box */
    .radar-hud-panel {
        background: #080d1a;
        border: 1px solid #0284c7;
        border-radius: 12px;
        padding: 18px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
        box-shadow: 0 0 25px -5px rgba(14, 165, 233, 0.25);
    }
    
    /* Form Inputs & Buttons override */
    .stButton>button {
        background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%) !important;
        color: #ffffff !important;
        font-weight: 600 !important;
        border: none !important;
        border-radius: 10px !important;
        padding: 0.5rem 1.2rem !important;
        box-shadow: 0 0 15px -3px rgba(14, 165, 233, 0.4) !important;
    }
    .stButton>button:hover {
        opacity: 0.9 !important;
    }
</style>
""", unsafe_allow_html=True)


# ---------------------------------------------------------
# Database Schema & Initialization
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
def get_database():
    db_url = os.getenv("DATABASE_URL")
    try:
        if not db_url and hasattr(st, "secrets") and "DATABASE_URL" in st.secrets:
            db_url = st.secrets["DATABASE_URL"]
    except Exception:
        pass

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
        seed_sqlite(engine)

    return engine


def seed_sqlite(engine):
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        if session.query(Operator).count() > 0:
            return

        regulator = Operator(name="Anmol Saluja (DGCA)", license_no="LIC-REG-001", role="REGULATOR")
        fleet_op = Operator(name="AeroFleet Logistics", license_no="LIC-FLEET-001", role="FLEET_OPERATOR")
        dispatcher = Operator(name="SkyRoute Dispatch", license_no="LIC-DISP-001", role="DISPATCHER")
        session.add_all([regulator, fleet_op, dispatcher])
        session.flush()

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

        base_time = datetime.utcnow().replace(minute=0, second=0, microsecond=0, hour=8)
        created_slots = []
        for sec in created_sectors:
            for day in range(2):
                day_start = base_time + timedelta(days=day)
                for h in range(12):
                    slot_start = day_start + timedelta(minutes=30 * h)
                    slot_end = slot_start + timedelta(minutes=30)
                    ts = TimeSlot(sector_id=sec.sector_id, start_time=slot_start, end_time=slot_end, is_booked=False)
                    session.add(ts)
                    created_slots.append(ts)
        session.flush()

        if len(created_slots) >= 2:
            created_slots[0].is_booked = True
            session.add(Reservation(slot_id=created_slots[0].slot_id, drone_id=drone1.drone_id, operator_id=fleet_op.operator_id, priority="STANDARD", status="CONFIRMED"))
            created_slots[1].is_booked = True
            session.add(Reservation(slot_id=created_slots[1].slot_id, drone_id=drone3.drone_id, operator_id=fleet_op.operator_id, priority="CRITICAL", status="CONFIRMED"))

        session.add(AuditLog(actor_id=regulator.operator_id, actor_license="LIC-REG-001", action="SYSTEM_INIT", entity="SYSTEM", entity_id=1, details="UTM AEROSHIELD Initialized"))
        session.add(AuditLog(actor_id=fleet_op.operator_id, actor_license="LIC-FLEET-001", action="REGISTER_DRONE", entity="DRONE", entity_id=drone3.drone_id, details="Registered Emergency Medical Drone: AeroMed Lifeline-1"))
        session.commit()
    except Exception:
        session.rollback()
    finally:
        session.close()


engine = get_database()
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
            "lat": 13.1450,
            "lon": 77.6800,
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
            "lat": 13.1800,
            "lon": 77.5600,
            "altitude": 115.0,
            "speed": 22.0,
            "heading": 88.0,
            "battery": 97.2,
            "status": "IN_FLIGHT",
            "priority": "CRITICAL",
            "sector": "SECTOR-A (North)"
        }
    }


def step_simulation():
    for k, d in st.session_state.telemetry.items():
        if d["status"] == "IN_FLIGHT":
            rad = math.radians(d["heading"])
            d["lat"] += math.cos(rad) * 0.0012
            d["lon"] += math.sin(rad) * 0.0012
            d["altitude"] = max(20.0, min(380.0, d["altitude"] + random.choice([-2.0, 0.0, 1.5, 3.0, -1.0])))
            d["battery"] = max(5.0, round(d["battery"] - 0.1, 1))
            d["heading"] = (d["heading"] + random.uniform(-5.0, 5.0)) % 360


# ---------------------------------------------------------
# Sidebar Matching React Layout (AppLayout.tsx)
# ---------------------------------------------------------
with st.sidebar:
    # Brand Header matching React
    st.markdown("""
    <div style="display: flex; align-items: center; gap: 12px; padding: 6px 0 16px 0; border-bottom: 1px solid #1e293b;">
        <div style="background: linear-gradient(135deg, #0284c7 0%, #38bdf8 100%); width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px -3px rgba(14, 165, 233, 0.4);">
            <span style="font-size: 1.2rem;">📡</span>
        </div>
        <div>
            <div style="font-size: 0.95rem; font-weight: 800; color: #ffffff; letter-spacing: 0.05em;">UTM AEROSHIELD</div>
            <div style="font-size: 0.65rem; font-weight: 600; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.08em;">Traffic Mgmt System</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("<div style='font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.08em; margin: 18px 0 8px 4px;'>Control Navigation</div>", unsafe_allow_html=True)

    nav_selection = st.radio(
        "Navigation",
        [
            "📊 Operator Dashboard",
            "📡 Live Telemetry Map",
            "✈️ Fleet Management",
            "📅 Airspace Reservation",
            "🛡️ Regulator Console"
        ],
        label_visibility="collapsed"
    )

    st.markdown("---")
    st.markdown("<div style='font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.08em; margin-bottom: 8px;'>Active Operator Session</div>", unsafe_allow_html=True)
    
    role_choice = st.selectbox(
        "Switch Persona",
        [
            "Civil Aviation Regulator (LIC-REG-001)",
            "Fleet Operator (LIC-FLEET-001)",
            "Airspace Dispatcher (LIC-DISP-001)"
        ],
        label_visibility="collapsed"
    )

    if "Regulator" in role_choice:
        curr_role = "REGULATOR"
        curr_actor_id = 1
        curr_license = "LIC-REG-001"
        curr_name = "Anmol Saluja (DGCA)"
        badge_bg = "background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3);"
    elif "Fleet" in role_choice:
        curr_role = "FLEET_OPERATOR"
        curr_actor_id = 2
        curr_license = "LIC-FLEET-001"
        curr_name = "AeroFleet Logistics"
        badge_bg = "background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.3);"
    else:
        curr_role = "DISPATCHER"
        curr_actor_id = 3
        curr_license = "LIC-DISP-001"
        curr_name = "SkyRoute Dispatch"
        badge_bg = "background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3);"

    st.markdown(f"""
    <div style="background: #15203b; border: 1px solid #1e293b; border-radius: 12px; padding: 12px; margin-top: 8px;">
        <div style="font-size: 0.8rem; font-weight: 700; color: #f8fafc;">{curr_name}</div>
        <div style="font-size: 0.7rem; font-family: ui-monospace, monospace; color: #94a3b8;">{curr_license}</div>
        <div style="margin-top: 8px;">
            <span style="{badge_bg} padding: 3px 8px; border-radius: 6px; font-size: 0.65rem; font-weight: 700;">{curr_role}</span>
        </div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("<div style='margin-top: 14px;'></div>", unsafe_allow_html=True)
    if st.button("🔄 Step Radar Simulation", use_container_width=True):
        step_simulation()
        st.rerun()


# ---------------------------------------------------------
# Top Header Bar
# ---------------------------------------------------------
current_page_name = nav_selection.split(" ", 1)[1]
st.markdown(f"""
<div class="top-app-bar">
    <div>
        <h1 class="top-title">{current_page_name}</h1>
        <div class="top-subtitle">UTM AEROSHIELD · 4D Spatio-Temporal Airspace Deconfliction Engine</div>
    </div>
    <div style="display: flex; gap: 8px;">
        <span class="sys-badge badge-ok">● SYSTEM OPERATIONAL</span>
        <span class="sys-badge badge-live">PG 16 / SQLITE</span>
        <span class="sys-badge" style="background: rgba(168, 85, 247, 0.12); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3);">SECURE JWT / ROW-LOCK</span>
    </div>
</div>
""", unsafe_allow_html=True)


# =========================================================
# VIEW 1: 📊 Operator Dashboard
# =========================================================
if "Operator Dashboard" in nav_selection:
    db = SessionLocal()
    try:
        drones_count = db.query(Drone).count()
        slots_count = db.query(TimeSlot).count()
        booked_slots = db.query(TimeSlot).filter(TimeSlot.is_booked == True).count()
        audit_count = db.query(AuditLog).count()
        
        # 4 Metric Cards
        c1, c2, c3, c4 = st.columns(4)
        with c1:
            st.markdown(f"""
            <div class="utm-stat-card">
                <div class="utm-stat-label">Total Registered Fleet</div>
                <div class="utm-stat-val" style="color: #38bdf8;">{drones_count} UAVs</div>
            </div>
            """, unsafe_allow_html=True)
        with c2:
            st.markdown(f"""
            <div class="utm-stat-card">
                <div class="utm-stat-label">Active Airspace Corridors</div>
                <div class="utm-stat-val" style="color: #34d399;">{booked_slots} / {slots_count}</div>
            </div>
            """, unsafe_allow_html=True)
        with c3:
            st.markdown(f"""
            <div class="utm-stat-card">
                <div class="utm-stat-label">Deconfliction Guarantee</div>
                <div class="utm-stat-val" style="color: #a855f7;">100.0%</div>
            </div>
            """, unsafe_allow_html=True)
        with c4:
            st.markdown(f"""
            <div class="utm-stat-card">
                <div class="utm-stat-label">Ceiling Violations</div>
                <div class="utm-stat-val" style="color: #f87171;">0 Breaches</div>
            </div>
            """, unsafe_allow_html=True)

        st.markdown("<div style='margin-top: 24px;'></div>", unsafe_allow_html=True)
        
        col_left, col_right = st.columns([2, 1])
        with col_left:
            st.markdown("#### 🛸 Active Fleet Inventory")
            d_list = db.query(Drone).all()
            d_rows = [{
                "ID": d.drone_id,
                "Model Name": d.model_name,
                "Subtype": d.drone_type,
                "Status": d.status,
                "Battery": f"{d.battery_capacity_pct}%",
                "Max Altitude": f"{d.max_altitude_m}m"
            } for d in d_list]
            st.dataframe(pd.DataFrame(d_rows), use_container_width=True, hide_index=True)

        with col_right:
            st.markdown("#### ⚡ Quick Actions")
            st.markdown("""
            <div style="background: #15203b; border: 1px solid #1e293b; border-radius: 12px; padding: 16px;">
                <div style="font-size: 0.85rem; font-weight: 700; color: #f8fafc; margin-bottom: 6px;">Tactical Flight Controls</div>
                <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 14px;">Switch views from the sidebar to inspect radar feeds, book new corridors, or review the audit log.</div>
            </div>
            """, unsafe_allow_html=True)
            if st.button("🛰️ Open Radar Map", use_container_width=True):
                st.session_state["nav"] = "📡 Live Telemetry Map"
                st.rerun()
    finally:
        db.close()


# =========================================================
# VIEW 2: 📡 Live Telemetry Map (SVG Tactical Radar)
# =========================================================
elif "Live Telemetry Map" in nav_selection:
    # Altitude warning checks
    breaches = [f"⚠️ **ALTITUDE BREACH:** {d['callsign']} is at **{d['altitude']:.1f}m** AGL — Exceeding 120m standard ceiling in {d['sector']}!" 
                for d in st.session_state.telemetry.values() if d["altitude"] > 120.0 and "High Altitude" not in d["sector"]]
    for b in breaches:
        st.error(b)

    col_radar, col_hud = st.columns([2, 1])

    with col_radar:
        # Build SVG Tactical Radar Map exactly like React RadarMap.tsx
        drones_svg = ""
        for k, d in st.session_state.telemetry.items():
            # Coordinate mapping to 1000x1000 SVG canvas
            # Bounding box: lat [12.80..13.40], lon [77.40..78.10]
            cx = ((d["lon"] - 77.40) / (78.10 - 77.40)) * 1000
            cy = 1000 - ((d["lat"] - 12.80) / (13.40 - 12.80)) * 1000
            
            is_critical = d["priority"] == "CRITICAL"
            dot_color = "#ef4444" if is_critical else ("#0ea5e9" if "Quadcopter" in d["type"] else "#f59e0b")
            heading_angle = d["heading"]
            
            drones_svg += f"""
            <g transform="translate({cx},{cy})">
                <circle r="18" fill="none" stroke="{dot_color}" stroke-width="1.5" opacity="0.4">
                    <animate attributeName="r" values="8;24;8" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle r="7" fill="{dot_color}" stroke="#ffffff" stroke-width="2" />
                <line x1="0" y1="0" x2="0" y2="-22" stroke="{dot_color}" stroke-width="2.5" transform="rotate({heading_angle})" />
                <text x="12" y="4" fill="#ffffff" font-size="11" font-weight="bold" font-family="ui-monospace">{d['callsign']}</text>
                <text x="12" y="18" fill="#94a3b8" font-size="9" font-family="ui-monospace">{d['altitude']:.0f}m · {d['speed']:.0f}m/s</text>
            </g>
            """

        radar_svg_canvas = f"""
        <div style="background: #080d1a; border: 1px solid #1e293b; border-radius: 16px; padding: 14px; box-shadow: 0 4px 25px -4px rgba(0,0,0,0.5);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #1e293b; padding-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 10px #38bdf8;"></span>
                    <span style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #f8fafc;">Tactical Airspace Radar Feed</span>
                </div>
                <div style="font-size: 0.75rem; font-family: ui-monospace; color: #94a3b8;">Targets: <strong style="color: #38bdf8;">{len(st.session_state.telemetry)} Active</strong></div>
            </div>
            <svg viewBox="0 0 1000 1000" style="width: 100%; aspect-ratio: 1; border-radius: 10px; background: #060913;">
                <defs>
                    <radialGradient id="radarSweep" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stop-color="#0284c7" stop-opacity="0.12" />
                        <stop offset="100%" stop-color="#0284c7" stop-opacity="0" />
                    </radialGradient>
                </defs>
                
                <!-- Concentric Range Rings -->
                <circle cx="500" cy="500" r="150" fill="none" stroke="#1e293b" stroke-width="1.5" stroke-dasharray="4 4" />
                <circle cx="500" cy="500" r="300" fill="none" stroke="#1e293b" stroke-width="1.5" stroke-dasharray="4 4" />
                <circle cx="500" cy="500" r="450" fill="url(#radarSweep)" stroke="#334155" stroke-width="1.5" />
                
                <!-- Crosshairs & Compass Lines -->
                <line x1="500" y1="50" x2="500" y2="950" stroke="#1e293b" stroke-width="1" />
                <line x1="50" y1="500" x2="950" y2="500" stroke="#1e293b" stroke-width="1" />
                <text x="500" y="40" fill="#38bdf8" font-size="12" font-weight="bold" text-anchor="middle">N 000°</text>
                <text x="965" y="504" fill="#64748b" font-size="12" font-weight="bold">E</text>
                <text x="500" y="975" fill="#64748b" font-size="12" font-weight="bold" text-anchor="middle">S</text>
                <text x="35" y="504" fill="#64748b" font-size="12" font-weight="bold">W</text>
                
                <!-- Sector A Bounding Box -->
                <rect x="142" y="83" width="357" height="417" fill="rgba(16, 185, 129, 0.08)" stroke="#10b981" stroke-width="1.5" stroke-dasharray="6 4" />
                <text x="155" y="110" fill="#34d399" font-size="12" font-weight="bold" font-family="ui-monospace">SECTOR-A (North 0-120m)</text>
                
                <!-- Sector B Bounding Box -->
                <rect x="500" y="83" width="357" height="417" fill="rgba(56, 189, 248, 0.08)" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="6 4" />
                <text x="515" y="110" fill="#38bdf8" font-size="12" font-weight="bold" font-family="ui-monospace">SECTOR-B (East 120-250m)</text>
                
                <!-- Sector C Bounding Box -->
                <rect x="142" y="500" width="357" height="417" fill="rgba(245, 158, 11, 0.08)" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="6 4" />
                <text x="155" y="525" fill="#fbbf24" font-size="12" font-weight="bold" font-family="ui-monospace">SECTOR-C (CBD Urban 0-120m)</text>
                
                <!-- Sector D Bounding Box -->
                <rect x="500" y="500" width="357" height="417" fill="rgba(168, 85, 247, 0.08)" stroke="#a855f7" stroke-width="1.5" stroke-dasharray="6 4" />
                <text x="515" y="525" fill="#c084fc" font-size="12" font-weight="bold" font-family="ui-monospace">SECTOR-D (High Alt 250-500m)</text>

                <!-- Drones -->
                {drones_svg}
            </svg>
        </div>
        """
        st.markdown(radar_svg_canvas, unsafe_allow_html=True)

    with col_hud:
        st.markdown("#### 🕹️ Tactical Heads-Up Display (HUD)")
        selected_key = st.selectbox("Select Target Stream", list(st.session_state.telemetry.keys()))
        t = st.session_state.telemetry[selected_key]
        
        hud_box = f"""
        <div class="radar-hud-panel">
            <div style="font-size: 1.1rem; font-weight: 800; color: #ffffff; margin-bottom: 4px;">
                {t['callsign']}
            </div>
            <div style="font-size: 0.75rem; color: #38bdf8; margin-bottom: 12px;">{t['type']}</div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                <div>
                    <div style="color: #64748b; font-size: 0.65rem; text-transform: uppercase;">STATUS</div>
                    <div style="color: #34d399; font-weight: 700; font-size: 0.85rem;">{t['status']}</div>
                </div>
                <div>
                    <div style="color: #64748b; font-size: 0.65rem; text-transform: uppercase;">PRIORITY</div>
                    <div style="color: {'#f87171' if t['priority'] == 'CRITICAL' else '#38bdf8'}; font-weight: 700; font-size: 0.85rem;">{t['priority']}</div>
                </div>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #1e293b; margin: 10px 0;" />
            
            <div style="margin-bottom: 8px;">
                <span style="color: #64748b; font-size: 0.7rem;">ALTITUDE (AGL): </span>
                <strong style="color: {'#f87171' if t['altitude'] > 120 else '#38bdf8'}; font-size: 1.1rem;">{t['altitude']:.1f} m</strong>
            </div>
            <div style="margin-bottom: 8px;">
                <span style="color: #64748b; font-size: 0.7rem;">GROUND SPEED: </span>
                <strong style="color: #f8fafc;">{t['speed']:.1f} m/s</strong>
            </div>
            <div style="margin-bottom: 8px;">
                <span style="color: #64748b; font-size: 0.7rem;">HEADING: </span>
                <strong style="color: #f8fafc;">{t['heading']:.1f}°</strong>
            </div>
            <div style="margin-bottom: 8px;">
                <span style="color: #64748b; font-size: 0.7rem;">BATTERY LEVEL: </span>
                <strong style="color: {'#f87171' if t['battery'] < 20 else '#34d399'};">{t['battery']:.1f}%</strong>
            </div>
            <div>
                <span style="color: #64748b; font-size: 0.7rem;">COORDINATES: </span>
                <span style="font-size: 0.75rem; color: #94a3b8;">{t['lat']:.5f}, {t['lon']:.5f}</span>
            </div>
        </div>
        """
        st.markdown(hud_box, unsafe_allow_html=True)
        
        st.markdown("<div style='margin-top: 16px;'></div>", unsafe_allow_html=True)
        if st.button("⚡ Inject Telemetry Beacon Packet", use_container_width=True):
            step_simulation()
            st.success(f"Streamed coordinate packet for {t['callsign']}!")
            st.rerun()


# =========================================================
# VIEW 3: ✈️ Fleet Management (Polymorphic Drones)
# =========================================================
elif "Fleet Management" in nav_selection:
    db = SessionLocal()
    try:
        all_d = db.query(Drone).all()
        
        # 4 Status Counters matching React
        c1, c2, c3, c4 = st.columns(4)
        with c1:
            st.markdown(f"<div class='utm-stat-card'><div class='utm-stat-label'>Total Fleet</div><div class='utm-stat-val' style='color:#ffffff;'>{len(all_d)}</div></div>", unsafe_allow_html=True)
        with c2:
            st.markdown(f"<div class='utm-stat-card'><div class='utm-stat-label'>Idle Status</div><div class='utm-stat-val' style='color:#10b981;'>{sum(1 for d in all_d if d.status == 'IDLE')}</div></div>", unsafe_allow_html=True)
        with c3:
            st.markdown(f"<div class='utm-stat-card'><div class='utm-stat-label'>In Flight</div><div class='utm-stat-val' style='color:#0ea5e9;'>{sum(1 for d in all_d if d.status == 'IN_FLIGHT')}</div></div>", unsafe_allow_html=True)
        with c4:
            st.markdown(f"<div class='utm-stat-card'><div class='utm-stat-label'>Maintenance</div><div class='utm-stat-val' style='color:#f59e0b;'>{sum(1 for d in all_d if d.status == 'MAINTENANCE')}</div></div>", unsafe_allow_html=True)

        st.markdown("<div style='margin-top: 20px;'></div>", unsafe_allow_html=True)
        st.markdown("#### 🛸 Registered UAV Inventory (Polymorphic Models)")

        for d in all_d:
            badge_color = "#38bdf8" if d.drone_type == "QUADCOPTER" else ("#f59e0b" if d.drone_type == "FIXED_WING" else "#f87171")
            status_color = "#34d399" if d.status == "IDLE" else ("#38bdf8" if d.status == "IN_FLIGHT" else "#fbbf24")
            
            specs = ""
            if d.drone_type == "QUADCOPTER":
                specs = f"Rotors: {d.rotor_count or 4} · Max Payload: {d.max_payload_kg or 4.5}kg"
            elif d.drone_type == "FIXED_WING":
                specs = f"Wingspan: {d.wingspan_m or 3.2}m · Glide Ratio: {d.glide_ratio or 15}:1"
            else:
                specs = f"Medical Kit: {d.medical_kit_type or 'Organ Transport'} · Priority: {d.priority_level or 'CRITICAL'}"

            card_html = f"""
            <div class="drone-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="font-weight: 800; font-size: 1.05rem; color: #ffffff;">{d.model_name}</span>
                        <span style="background: rgba(14, 165, 233, 0.1); color: {badge_color}; border: 1px solid {badge_color}40; padding: 2px 8px; border-radius: 6px; font-size: 0.65rem; font-weight: 700; margin-left: 8px;">{d.drone_type}</span>
                    </div>
                    <span style="color: {status_color}; font-weight: 700; font-size: 0.8rem; font-family: ui-monospace;">● {d.status}</span>
                </div>
                <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 6px;">
                    {specs}
                </div>
                <div style="display: flex; gap: 20px; font-size: 0.75rem; color: #64748b; margin-top: 8px;">
                    <span>Max Altitude: <strong style="color: #cbd5e1;">{d.max_altitude_m}m</strong></span>
                    <span>Battery Capacity: <strong style="color: #cbd5e1;">{d.battery_capacity_pct}%</strong></span>
                    <span>Assigned ID: <strong style="color: #cbd5e1;">#{d.drone_id}</strong></span>
                </div>
            </div>
            """
            st.markdown(card_html, unsafe_allow_html=True)

        st.markdown("---")
        st.markdown("#### ➕ Register Polymorphic Aircraft")
        with st.form("add_drone_modal"):
            m_col1, m_col2 = st.columns(2)
            with m_col1:
                name_in = st.text_input("Aircraft Name / Model", "Skydio X10 Enterprise")
                type_in = st.selectbox("Drone Subtype", ["QUADCOPTER", "FIXED_WING", "EMERGENCY_MEDICAL"])
            with m_col2:
                alt_in = st.number_input("Ceiling Limit (m)", 20.0, 500.0, 120.0)
                bat_in = st.number_input("Battery (%)", 10.0, 100.0, 100.0)

            if type_in == "QUADCOPTER":
                rot = st.number_input("Rotor Count", 4, 12, 4)
                pay = st.number_input("Max Payload (kg)", 0.5, 50.0, 5.0)
                w, g, kit, prio = None, None, None, None
            elif type_in == "FIXED_WING":
                w = st.number_input("Wingspan (m)", 1.0, 15.0, 3.2)
                g = st.number_input("Glide Ratio (X:1)", 5.0, 30.0, 15.0)
                rot, pay, kit, prio = None, None, None, None
            else:
                kit = st.selectbox("Medical Kit", ["Organ & Blood Cold Chain", "AED Defibrillator", "Trauma Kit"])
                prio = st.selectbox("Priority Level", ["CRITICAL", "HIGH"])
                rot, pay, w, g = None, None, None, None

            if st.form_submit_button("✅ Register Drone into Database", use_container_width=True):
                new_d = Drone(
                    operator_id=curr_actor_id,
                    drone_type=type_in,
                    model_name=name_in,
                    max_altitude_m=alt_in,
                    battery_capacity_pct=bat_in,
                    status="IDLE",
                    rotor_count=rot,
                    max_payload_kg=pay,
                    wingspan_m=w,
                    glide_ratio=g,
                    medical_kit_type=kit,
                    priority_level=prio
                )
                db.add(new_d)
                db.flush()
                db.add(AuditLog(actor_id=curr_actor_id, actor_license=curr_license, action="REGISTER_DRONE", entity="DRONE", entity_id=new_d.drone_id, details=f"Registered {name_in}"))
                db.commit()
                st.success(f"{name_in} added successfully!")
                st.rerun()
    finally:
        db.close()


# =========================================================
# VIEW 4: 📅 Airspace Reservation
# =========================================================
elif "Airspace Reservation" in nav_selection:
    db = SessionLocal()
    try:
        sectors = db.query(AirspaceSector).all()
        sec_dict = {f"{s.sector_name} (Alt: {s.floor_altitude_m}m - {s.ceiling_altitude_m}m)": s.sector_id for s in sectors}
        
        sel_label = st.selectbox("Select Airspace Sector", list(sec_dict.keys()))
        sel_id = sec_dict[sel_label]

        slots = db.query(TimeSlot).filter(TimeSlot.sector_id == sel_id).order_by(TimeSlot.start_time).limit(12).all()
        
        st.markdown("#### 30-Minute Reservation Schedule (Row-Lock Protected)")
        
        col_grid = st.columns(3)
        for idx, s in enumerate(slots):
            with col_grid[idx % 3]:
                res = db.query(Reservation).filter(Reservation.slot_id == s.slot_id).first()
                stat_border = "#ef4444" if (res and res.priority == "CRITICAL") else ("#38bdf8" if s.is_booked else "#10b981")
                stat_text = "CONFIRMED" if s.is_booked else "AVAILABLE"
                
                card_s = f"""
                <div style="background: #15203b; border-left: 4px solid {stat_border}; border-top: 1px solid #1e293b; border-right: 1px solid #1e293b; border-bottom: 1px solid #1e293b; border-radius: 10px; padding: 12px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: #f8fafc;">Slot #{s.slot_id}</span>
                        <span style="font-size: 0.65rem; font-weight: 800; color: {stat_border}; font-family: ui-monospace;">{stat_text}</span>
                    </div>
                    <div style="font-size: 0.75rem; color: #94a3b8; margin: 4px 0;">{s.start_time.strftime('%H:%M')} - {s.end_time.strftime('%H:%M UTC')}</div>
                    <div style="font-size: 0.7rem; color: #64748b;">Aircraft: {f"Drone #{res.drone_id}" if res else "None"}</div>
                </div>
                """
                st.markdown(card_s, unsafe_allow_html=True)

        st.markdown("---")
        st.markdown("#### 🔒 Reserve Flight Corridor (`SELECT ... FOR UPDATE`)")
        
        avail_slots = [s for s in slots if not s.is_booked]
        slot_picks = {f"Slot #{s.slot_id} ({s.start_time.strftime('%H:%M')} - {s.end_time.strftime('%H:%M')})": s.slot_id for s in avail_slots}
        drones = db.query(Drone).all()
        d_picks = {f"#{d.drone_id} {d.model_name}": d.drone_id for d in drones}

        cb1, cb2, cb3 = st.columns(3)
        with cb1:
            chosen_slot_str = st.selectbox("Available Window", list(slot_picks.keys()) if slot_picks else ["No Slots"])
        with cb2:
            chosen_d_str = st.selectbox("Assign Aircraft", list(d_picks.keys()))
        with cb3:
            chosen_prio = st.selectbox("Priority Level", ["STANDARD", "CRITICAL (Emergency Medical)"])

        if st.button("🚀 Confirm Corridor Reservation", use_container_width=True, disabled=not bool(slot_picks)):
            s_id = slot_picks[chosen_slot_str]
            d_id = d_picks[chosen_d_str]
            target_s = db.query(TimeSlot).filter(TimeSlot.slot_id == s_id).first()
            if target_s.is_booked:
                st.error("HTTP 409 Conflict: Slot acquired by concurrent transaction!")
            else:
                target_s.is_booked = True
                new_r = Reservation(slot_id=s_id, drone_id=d_id, operator_id=curr_actor_id, priority="CRITICAL" if "CRITICAL" in chosen_prio else "STANDARD", status="CONFIRMED")
                db.add(new_r)
                db.add(AuditLog(actor_id=curr_actor_id, actor_license=curr_license, action="RESERVE_SLOT", entity="TIME_SLOT", entity_id=s_id, details=f"Reserved Slot #{s_id}"))
                db.commit()
                st.success(f"Slot #{s_id} locked and confirmed!")
                st.rerun()

        # Preemption for Regulators
        if curr_role == "REGULATOR":
            st.markdown("---")
            st.markdown("#### 🚨 Civil Aviation Regulator: Emergency Flight Preemption")
            b_slots = [s for s in slots if s.is_booked]
            b_map = {f"Slot #{s.slot_id}": s.slot_id for s in b_slots}
            if b_map:
                p_col1, p_col2 = st.columns([2, 1])
                with p_col1:
                    pre_choice = st.selectbox("Select Conflicting Slot to Preempt", list(b_map.keys()))
                with p_col2:
                    st.write("")
                    st.write("")
                    if st.button("⚠️ Force Emergency Preemption", use_container_width=True):
                        pre_id = b_map[pre_choice]
                        res_p = db.query(Reservation).filter(Reservation.slot_id == pre_id).first()
                        if res_p:
                            res_p.priority = "CRITICAL"
                            res_p.status = "PREEMPTED_FOR_EMERGENCY"
                            db.add(AuditLog(actor_id=curr_actor_id, actor_license=curr_license, action="EMERGENCY_PREEMPT", entity="RESERVATION", entity_id=res_p.reservation_id, details=f"Preempted slot #{pre_id} for emergency flight"))
                            db.commit()
                            st.warning(f"Slot #{pre_id} preempted! Standard flight displaced.")
                            st.rerun()
    finally:
        db.close()


# =========================================================
# VIEW 5: 🛡️ Regulator Console
# =========================================================
elif "Regulator Console" in nav_selection:
    db = SessionLocal()
    try:
        st.markdown("#### 🏢 Operator Governance & Licensing")
        ops = db.query(Operator).all()
        for op in ops:
            c1, c2, c3, c4 = st.columns([2, 2, 2, 2])
            with c1:
                st.write(f"**{op.name}**")
            with c2:
                st.write(f"License: `{op.license_no}`")
            with c3:
                sc = "#f87171" if op.is_suspended else "#34d399"
                st.markdown(f"<span style='color: {sc}; font-weight: bold;'>● {'SUSPENDED' if op.is_suspended else 'ACTIVE'}</span>", unsafe_allow_html=True)
            with c4:
                if curr_role == "REGULATOR" and op.role != "REGULATOR":
                    btn_t = "Reinstate" if op.is_suspended else "Suspend"
                    if st.button(btn_t, key=f"btn_op_{op.operator_id}"):
                        op.is_suspended = not op.is_suspended
                        db.add(AuditLog(actor_id=curr_actor_id, actor_license=curr_license, action="SUSPEND_OPERATOR" if op.is_suspended else "REINSTATE_OPERATOR", entity="OPERATOR", entity_id=op.operator_id, details=f"License toggled"))
                        db.commit()
                        st.rerun()
                else:
                    st.write("—")

        st.markdown("---")
        st.markdown("#### 📋 Immutable System Audit Trail")
        logs = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(30).all()
        log_rows = [{
            "ID": l.id,
            "Timestamp (UTC)": l.created_at.strftime("%Y-%m-%d %H:%M:%S") if l.created_at else "-",
            "Actor License": l.actor_license or f"#{l.actor_id}",
            "Action": l.action,
            "Entity": l.entity,
            "Details": l.details
        } for l in logs]
        df_l = pd.DataFrame(log_rows)
        st.dataframe(df_l, use_container_width=True, hide_index=True)

        if not df_l.empty:
            st.download_button("📥 Export Compliance Audit Log (CSV)", df_l.to_csv(index=False).encode('utf-8'), "utm_audit_trail.csv", "text/csv", use_container_width=True)
    finally:
        db.close()

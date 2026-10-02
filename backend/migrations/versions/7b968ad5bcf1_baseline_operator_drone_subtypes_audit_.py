"""baseline: operator, drone, subtypes, audit_log

Revision ID: 7b968ad5bcf1
Revises: 
Create Date: 2026-10-02 11:20:26.658927

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7b968ad5bcf1'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
    CREATE TABLE operator (
        operator_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        license_no VARCHAR(30) NOT NULL UNIQUE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('FLEET_OPERATOR','REGULATOR','DISPATCHER')),
        password_hash TEXT NOT NULL
    );

    CREATE TABLE drone (
        drone_id SERIAL PRIMARY KEY,
        operator_id INT NOT NULL REFERENCES operator(operator_id) ON DELETE CASCADE,
        drone_type VARCHAR(30) NOT NULL CHECK (drone_type IN ('FIXED_WING','QUADCOPTER','EMERGENCY_MEDICAL')),
        max_altitude_m NUMERIC(6,2) NOT NULL CHECK (max_altitude_m BETWEEN 0 AND 500),
        battery_capacity_pct NUMERIC(5,2) NOT NULL CHECK (battery_capacity_pct BETWEEN 0 AND 100),
        status VARCHAR(20) NOT NULL DEFAULT 'IDLE' CHECK (status IN ('IDLE','IN_FLIGHT','MAINTENANCE'))
    );

    CREATE TABLE drone_fixed_wing (
        drone_id INT PRIMARY KEY REFERENCES drone(drone_id) ON DELETE CASCADE,
        wingspan_m NUMERIC(5,2)
    );
    CREATE TABLE drone_quadcopter (
        drone_id INT PRIMARY KEY REFERENCES drone(drone_id) ON DELETE CASCADE,
        rotor_count INT
    );
    CREATE TABLE drone_emergency_medical (
        drone_id INT PRIMARY KEY REFERENCES drone(drone_id) ON DELETE CASCADE,
        priority_clearance_level INT
    );

    CREATE TABLE audit_log (
        id BIGSERIAL PRIMARY KEY,
        actor_id INT,
        action TEXT,
        entity TEXT,
        entity_id INT,
        created_at TIMESTAMP NOT NULL DEFAULT now()
    );
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("""
    DROP TABLE IF EXISTS audit_log CASCADE;
    DROP TABLE IF EXISTS drone_emergency_medical CASCADE;
    DROP TABLE IF EXISTS drone_quadcopter CASCADE;
    DROP TABLE IF EXISTS drone_fixed_wing CASCADE;
    DROP TABLE IF EXISTS drone CASCADE;
    DROP TABLE IF EXISTS operator CASCADE;
    """)

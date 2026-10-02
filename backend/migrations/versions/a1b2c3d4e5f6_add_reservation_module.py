"""add_reservation_module

Revision ID: a1b2c3d4e5f6
Revises: 7b968ad5bcf1
Create Date: 2026-10-02 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '7b968ad5bcf1'
branch_labels = None
depends_on = None

def upgrade():
    op.execute("""
-- airspace_sector
CREATE TABLE airspace_sector (
    sector_id SERIAL PRIMARY KEY,
    sector_name VARCHAR(50) NOT NULL UNIQUE,
    min_lat NUMERIC(9,6) NOT NULL,
    max_lat NUMERIC(9,6) NOT NULL,
    min_lon NUMERIC(9,6) NOT NULL,
    max_lon NUMERIC(9,6) NOT NULL,
    floor_altitude_m NUMERIC(6,2) NOT NULL,
    ceiling_altitude_m NUMERIC(6,2) NOT NULL,
    CHECK (max_lat > min_lat),
    CHECK (max_lon > min_lon),
    CHECK (ceiling_altitude_m > floor_altitude_m)
);

-- GiST index on bounding box (uses built-in PostgreSQL box/point types)
CREATE INDEX idx_sector_bbox
ON airspace_sector USING GIST (
    box(point(min_lon, min_lat), point(max_lon, max_lat))
);

-- time_slot
CREATE TABLE time_slot (
    slot_id SERIAL PRIMARY KEY,
    sector_id INT NOT NULL REFERENCES airspace_sector(sector_id) ON DELETE RESTRICT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    is_booked BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK (end_time > start_time),
    UNIQUE (sector_id, start_time, end_time)
);

CREATE INDEX idx_timeslot_btree
ON time_slot (sector_id, start_time, end_time);

-- reservation
CREATE TABLE reservation (
    reservation_id SERIAL PRIMARY KEY,
    slot_id INT NOT NULL UNIQUE REFERENCES time_slot(slot_id) ON DELETE RESTRICT,
    drone_id INT NOT NULL REFERENCES drone(drone_id) ON DELETE RESTRICT,
    operator_id INT NOT NULL REFERENCES operator(operator_id) ON DELETE RESTRICT,
    priority VARCHAR(10) NOT NULL DEFAULT 'STANDARD' CHECK (priority IN ('STANDARD', 'CRITICAL')),
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED','CANCELLED','COMPLETED','DISPLACED')),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
    """)

def downgrade():
    op.execute("""
DROP TABLE reservation CASCADE;
DROP TABLE time_slot CASCADE;
DROP INDEX IF EXISTS idx_sector_bbox;
DROP TABLE airspace_sector CASCADE;
    """)

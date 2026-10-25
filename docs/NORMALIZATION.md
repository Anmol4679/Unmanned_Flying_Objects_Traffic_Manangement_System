# Relational Schema Normalization Specification

This document presents the formal normalization analysis for all relational tables in the **Unmanned Flying Objects Traffic Management System (UTM)** database (`utm_drone_db`).

---

## 1. Relational Definitions, Functional Dependencies & Normal Forms

### 1.1 Relation: `operator`
- **Attributes**: `(operator_id, name, license_no, role, password_hash)`
- **Candidate Keys**: `{operator_id}`, `{license_no}`
- **Primary Key**: `operator_id`
- **Functional Dependencies (FDs)**:
  - `FD1`: `operator_id -> name, license_no, role, password_hash`
  - `FD2`: `license_no -> operator_id, name, role, password_hash`
- **Highest Normal Form Reached**: **BCNF (Boyce-Codd Normal Form)**
- **One-Line Justification**: For every non-trivial functional dependency $X \rightarrow Y$, the determinant $X$ is a superkey (both `{operator_id}` and `{license_no}` are candidate keys).

---

### 1.2 Relation: `drone` (Superclass Base Table)
- **Attributes**: `(drone_id, operator_id, drone_type, max_altitude_m, battery_capacity_pct, status)`
- **Candidate Keys**: `{drone_id}`
- **Primary Key**: `drone_id`
- **Foreign Keys**: `operator_id -> operator(operator_id) ON DELETE CASCADE`
- **Functional Dependencies (FDs)**:
  - `FD1`: `drone_id -> operator_id, drone_type, max_altitude_m, battery_capacity_pct, status`
- **Highest Normal Form Reached**: **BCNF (Boyce-Codd Normal Form)**
- **One-Line Justification**: `{drone_id}` is the sole determinant of all attributes and is the relation's candidate key, with no transitive or partial dependencies.

---

### 1.3 Relation: `drone_fixed_wing` (Subtype Specification)
- **Attributes**: `(drone_id, wingspan_m)`
- **Candidate Keys**: `{drone_id}`
- **Primary Key**: `drone_id` (also Foreign Key to `drone(drone_id) ON DELETE CASCADE`)
- **Functional Dependencies (FDs)**:
  - `FD1`: `drone_id -> wingspan_m`
- **Highest Normal Form Reached**: **BCNF (Boyce-Codd Normal Form)**
- **One-Line Justification**: Trivial binary relation where the determinant `{drone_id}` is the candidate key.

---

### 1.4 Relation: `drone_quadcopter` (Subtype Specification)
- **Attributes**: `(drone_id, rotor_count)`
- **Candidate Keys**: `{drone_id}`
- **Primary Key**: `drone_id` (also Foreign Key to `drone(drone_id) ON DELETE CASCADE`)
- **Functional Dependencies (FDs)**:
  - `FD1`: `drone_id -> rotor_count`
- **Highest Normal Form Reached**: **BCNF (Boyce-Codd Normal Form)**
- **One-Line Justification**: Trivial binary relation where the determinant `{drone_id}` is the candidate key.

---

### 1.5 Relation: `drone_emergency_medical` (Subtype Specification)
- **Attributes**: `(drone_id, priority_clearance_level)`
- **Candidate Keys**: `{drone_id}`
- **Primary Key**: `drone_id` (also Foreign Key to `drone(drone_id) ON DELETE CASCADE`)
- **Functional Dependencies (FDs)**:
  - `FD1`: `drone_id -> priority_clearance_level`
- **Highest Normal Form Reached**: **BCNF (Boyce-Codd Normal Form)**
- **One-Line Justification**: Trivial binary relation where the determinant `{drone_id}` is the candidate key.

---

### 1.6 Relation: `audit_log` (Compliance Ledger)
- **Attributes**: `(id, actor_id, action, entity, entity_id, created_at)`
- **Candidate Keys**: `{id}`
- **Primary Key**: `id`
- **Functional Dependencies (FDs)**:
  - `FD1`: `id -> actor_id, action, entity, entity_id, created_at`
- **Highest Normal Form Reached**: **BCNF (Boyce-Codd Normal Form)**
- **One-Line Justification**: `{id}` is the candidate key and determinant for all attributes in the relation.
- **Deliberate Design Decision**:
  - `audit_log.actor_id` **deliberately does not define a Foreign Key constraint** to `operator(operator_id)`.
  - **Rationale**: In regulatory aviation compliance, an audit trail must be permanent and immutable. If an operator's account is suspended, decommissioned, or GDPR-deleted, the historical actions they executed must never be cascaded or nullified. Omitting the FK ensures the audit row permanently survives operator lifecycle events.

---

### 1.7 Relation: `airspace_sector`
- **Attributes**: `(sector_id, sector_name, min_lat, max_lat, min_lon, max_lon, floor_altitude_m, ceiling_altitude_m)`
- **Candidate Keys**: `{sector_id}`, `{sector_name}`
- **Primary Key**: `sector_id`
- **Functional Dependencies (FDs)**:
  - `FD1`: `sector_id -> sector_name, min_lat, max_lat, min_lon, max_lon, floor_altitude_m, ceiling_altitude_m`
  - `FD2`: `sector_name -> sector_id, min_lat, max_lat, min_lon, max_lon, floor_altitude_m, ceiling_altitude_m`
- **Highest Normal Form Reached**: **BCNF (Boyce-Codd Normal Form)**
- **One-Line Justification**: All determinants (`{sector_id}` and `{sector_name}`) are candidate keys, satisfying BCNF.

---

### 1.8 Relation: `time_slot`
- **Attributes**: `(slot_id, sector_id, start_time, end_time, is_booked)`
- **Candidate Keys**: `{slot_id}`, `{sector_id, start_time, end_time}`
- **Primary Key**: `slot_id`
- **Foreign Keys**: `sector_id -> airspace_sector(sector_id) ON DELETE RESTRICT`
- **Functional Dependencies (FDs)**:
  - `FD1`: `slot_id -> sector_id, start_time, end_time, is_booked`
  - `FD2`: `{sector_id, start_time, end_time} -> slot_id, is_booked`
- **Highest Normal Form Reached**: **BCNF (Boyce-Codd Normal Form)**
- **One-Line Justification**: Every determinant is a candidate key of the relation, leaving zero partial or transitive dependencies.

---

### 1.9 Relation: `reservation`
- **Attributes**: `(reservation_id, slot_id, drone_id, operator_id, priority, status, created_at)`
- **Candidate Keys**: `{reservation_id}`, `{slot_id}`
- **Primary Key**: `reservation_id`
- **Foreign Keys**:
  - `slot_id -> time_slot(slot_id) ON DELETE RESTRICT`
  - `drone_id -> drone(drone_id) ON DELETE RESTRICT`
  - `operator_id -> operator(operator_id) ON DELETE RESTRICT`
- **Functional Dependencies (FDs)**:
  - `FD1`: `reservation_id -> slot_id, drone_id, operator_id, priority, status, created_at`
  - `FD2`: `slot_id -> reservation_id, drone_id, operator_id, priority, status, created_at` (enforced by `reservation_slot_id_key` UNIQUE constraint)
- **Highest Normal Form Reached**: **BCNF (Boyce-Codd Normal Form)**
- **One-Line Justification**: Every determinant is a candidate key of the relation.

---

## 2. Worked Example: Decomposition vs. Single "Wide Table" Anomalies

### 2.1 The Anti-Pattern: Flattened Wide Table
Suppose an un-normalized, single table was adopted to store all drones and subtype attributes together:
```sql
CREATE TABLE wide_drone (
    drone_id SERIAL PRIMARY KEY,
    operator_id INT REFERENCES operator(operator_id),
    drone_type VARCHAR(30), -- 'FIXED_WING', 'QUADCOPTER', 'EMERGENCY_MEDICAL'
    max_altitude_m NUMERIC(6, 2),
    battery_capacity_pct NUMERIC(5, 2),
    status VARCHAR(20),
    wingspan_m NUMERIC(5, 2),            -- Fixed-Wing only
    rotor_count INT,                     -- Quadcopter only
    priority_clearance_level INT         -- Emergency Medical only
);
```

### 2.2 Resulting Anomalies

#### 1. Insertion & NULL-Pollution Anomaly
- **Problem**: When inserting a `QUADCOPTER`, attributes `wingspan_m` and `priority_clearance_level` have no physical meaning and must be set to `NULL`.
- **Consequence**:
  - More than 66% of subtype column cells in the database become sparse `NULL` values.
  - Column-level constraints cannot be enforced cleanly: `wingspan_m NOT NULL` cannot be applied to the column because quadcopters would fail insertion.
  - Requires complex multi-column conditional check constraints (e.g. `CHECK (drone_type = 'FIXED_WING' AND wingspan_m IS NOT NULL AND rotor_count IS NULL ...)`) that become brittle and error-prone as new drone classes are introduced.

#### 2. Update & Domain Integrity Anomaly (Disjointness Violation)
- **Problem**: If an operator or buggy script executes:
  ```sql
  UPDATE wide_drone SET drone_type = 'QUADCOPTER', rotor_count = 6 WHERE drone_id = 42;
  ```
  without explicitly wiping `wingspan_m`, the database now holds a row with `drone_type = 'QUADCOPTER'`, `rotor_count = 6`, AND `wingspan_m = 4.5`.
- **Consequence**:
  - The fundamental **DISJOINT** specialization constraint is corrupted. The database contains impossible hybrid aircraft states that deceive downstream flight reservation and safety dispatch algorithms.

#### 3. Query & Performance Degradation
- **Problem**: Queries calculating average wingspan or rotor count must scan large, sparse tables and filter `WHERE wingspan_m IS NOT NULL`.
- **Consequence**:
  - Buffer cache pages are dominated by `NULL` bitmaps and wasted byte offsets.
  - In Joined Table Inheritance, queries for quadcopters only scan `drone_quadcopter`, which is dense, indexed, and contains zero NULLs.

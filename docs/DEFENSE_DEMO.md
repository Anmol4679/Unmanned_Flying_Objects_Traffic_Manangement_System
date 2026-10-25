# Project Defense & Viva Demonstration Guide

This document provides a complete, step-by-step live demonstration script and an extensive question-and-answer catalog for the defense of **Module 1 (Identity, Auth & RBAC)** and **Module 2 (Fleet Management & Polymorphic Drone Subtypes)**.

---

## Part 1: Numbered Live Demonstration Script

### Setup & Prerequisites
1. Ensure the PostgreSQL database is active: `postgresql://postgres:***@localhost:5432/utm_drone_db`.
2. Start the FastAPI backend:
   ```powershell
   cd backend
   .\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
   ```
3. Start the Vite React frontend:
   ```powershell
   cd frontend
   npm run dev
   ```
4. Open the browser to `http://localhost:5173`.

---

### Demo Step 1: Register -> Login -> Empty Fleet Dashboard
1. **Navigate to `/login`**:
   - Click the **Register** tab.
   - Fill in:
     - Name: `Captain Vikram`
     - License No: `LIC-DEMO-001`
     - Role: `FLEET_OPERATOR`
     - Password: `password123`
   - Click **Create Account**.
2. **Login**:
   - Enter `LIC-DEMO-001` and `password123`.
   - Click **Sign In**.
3. **Verify Empty State**:
   - Redirects to `/` (Operator Dashboard).
   - The Fleet Summary card displays:
     - Total Aircraft: `0`
     - Status: `No drones yet in your fleet`
     - Direct CTA button: **Register Your First Drone** linking to `/fleet`.

---

### Demo Step 2: Add One Drone of Each Subtype & Verify in PostgreSQL (`psql`)
1. **Add FIXED_WING Drone**:
   - Go to `/fleet` -> click **Register Aircraft**.
   - Select **Drone Subtype**: `FIXED_WING`.
   - Parameters: Max Altitude `350` m, Battery `95` %, Wingspan `4.2` m.
   - Click **Confirm Registration**.
2. **Add QUADCOPTER Drone**:
   - Click **Register Aircraft**.
   - Select **Drone Subtype**: `QUADCOPTER`.
   - Parameters: Max Altitude `120` m, Battery `100` %, Rotor Count `8`.
   - Click **Confirm Registration**.
3. **Add EMERGENCY_MEDICAL Drone**:
   - Click **Register Aircraft**.
   - Select **Drone Subtype**: `EMERGENCY_MEDICAL`.
   - Parameters: Max Altitude `250` m, Battery `88` %, Priority Clearance Level `1`.
   - Click **Confirm Registration**.
4. **Inspect in `psql`**:
   Open a terminal and connect:
   ```powershell
   psql -U postgres -d utm_drone_db
   ```
   Execute:
   ```sql
   -- View base drone rows
   SELECT drone_id, operator_id, drone_type, max_altitude_m, battery_capacity_pct, status 
   FROM drone 
   ORDER BY drone_id DESC LIMIT 3;

   -- View corresponding subtype rows
   SELECT d.drone_id, d.drone_type, fw.wingspan_m, qc.rotor_count, em.priority_clearance_level
   FROM drone d
   LEFT JOIN drone_fixed_wing fw ON d.drone_id = fw.drone_id
   LEFT JOIN drone_quadcopter qc ON d.drone_id = qc.drone_id
   LEFT JOIN drone_emergency_medical em ON d.drone_id = em.drone_id
   ORDER BY d.drone_id DESC LIMIT 3;
   ```
   **Observation**: Every base drone row has exactly one corresponding row in its respective subtype table and `NULL` in the other two.

---

### Demo Step 3: The Transaction Atomicity & Rollback Demo
Demonstrate that a failure in the subtype insertion leaves zero orphan rows in the base `drone` table.
1. Run the automated atomicity verification test:
   ```powershell
   cd backend
   .\venv\Scripts\python.exe -m pytest tests/test_identity.py -k "test_atomicity_drone_and_subtype_rollback" -v
   ```
2. Or perform the manual command using Python:
   ```powershell
   cd backend
   .\venv\Scripts\python.exe -c "
   from database import SessionLocal
   from modules.fleet.models import Drone, DroneFixedWing
   db = SessionLocal()
   initial_count = db.query(Drone).count()
   try:
       with db.begin_nested():
           base = Drone(operator_id=1, drone_type='FIXED_WING', max_altitude_m=100, battery_capacity_pct=100, status='IDLE')
           db.add(base)
           db.flush()
           raise RuntimeError('Simulated Hardware Sensor Failure during Subtype Allocation!')
   except Exception as e:
       print('Caught expected failure:', e)
   final_count = db.query(Drone).count()
   print(f'Initial Drone Count: {initial_count}, Final Drone Count: {final_count} -> Orphan Leaks: {final_count - initial_count}')
   db.close()
   "
   ```
   **Observation**: The base `drone` insert was rolled back completely. No orphan base row exists.

---

### Demo Step 4: Live Regulator Suspension & Real-Time WebSocket Audit Event
1. Open two browser windows side by side:
   - **Window A (Left)**: Logged in as `LIC-REG-001` (`REGULATOR`) on `/regulator`.
     - Select the **Audit Log** tab.
     - Toggle on **Timeline View (Live)**. Notice the green indicator: `LIVE WS CONNECTED`.
   - **Window B (Right)**: On `/regulator` -> **Operators** tab.
2. In Window B:
   - Find operator `Captain Vikram` (`LIC-DEMO-001`).
   - Click **Suspend**. In the confirmation dialog, click **Suspend Account**.
3. **Observe Window A**:
   - Within **< 1 second**, a new audit event card animates to the top of the Timeline with a blue pulsing highlight:
     - `Action: SUSPEND`
     - `Entity: operator`
     - `Actor: REGULATOR (ID 2)`
     - `Entity ID: 4`
     - `Time: Just now`

---

### Demo Step 5: RBAC Matrix (403 Forbidden Security Verification)
1. In Window B, log in as `LIC-DEMO-001` (Role: `FLEET_OPERATOR`).
2. Try accessing forbidden endpoints directly via `curl` or PowerShell:
   ```powershell
   $token = "<fleet_operator_token>"
   Invoke-RestMethod -Uri "http://localhost:8000/api/operators" -Headers @{ Authorization = "Bearer $token" }
   ```
   **Result**: `HTTP 403 Forbidden` (`{"detail": "Access forbidden: insufficient role permissions"}`).
3. Try accessing `/api/audit-log` as `FLEET_OPERATOR`:
   **Result**: `HTTP 403 Forbidden`.
4. Try registering a drone as `REGULATOR`:
   ```powershell
   $reg_token = "<regulator_token>"
   Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/drones" -Headers @{ Authorization = "Bearer $reg_token" } -Body '{"drone_type": "QUADCOPTER", ...}'
   ```
   **Result**: `HTTP 403 Forbidden` (`{"detail": "Access forbidden: insufficient role permissions"}`).

---

### Demo Step 6: Login Rate Limiting (SlowAPI 429 Demo)
1. Execute rapid login attempts against `/api/auth/login`:
   ```powershell
   cd backend
   .\venv\Scripts\python.exe -m pytest tests/test_identity.py -k "test_login_rate_limiting" -v
   ```
2. Or run via curl in PowerShell:
   ```powershell
   1..6 | ForEach-Object {
       try {
           Invoke-RestMethod -Method Post -Uri "http://localhost:8000/api/auth/login" -Body '{"license_no":"LIC-FLEET-001","password":"wrong"}' -ContentType "application/json"
       } catch {
           Write-Host "Attempt $_ : $($_.Exception.Response.StatusCode.value__)"
       }
   }
   ```
   **Result**:
   - Attempts 1–5: `401 Unauthorized`.
   - Attempt 6: `429 Too Many Requests` (`{"detail": "Rate limit exceeded: 5 per 1 minute"}`).

---

## Part 2: 14 High-Yield Viva Questions & Concise Answers

### Q1: Why did you use `SERIAL` (or `IDENTITY`) instead of UUIDs for primary keys?
> **Answer**: `SERIAL` generates sequentially incrementing 4-byte integers. In PostgreSQL, integer B-Tree indexes are compact (4 bytes vs. 16 bytes for UUID), fit entirely into RAM buffer cache, eliminate B-Tree page splits caused by random UUID insertions, and provide maximum throughput for join-heavy 1:1 and 1:N relations.

### Q2: What is the purpose of database `CHECK` constraints versus application validation?
> **Answer**: Pydantic validates inputs at the HTTP boundary, but `CHECK` constraints guarantee database-level consistency that no script, background worker, or manual SQL query can bypass. In our schema, `CHECK` constraints enforce `max_altitude_m BETWEEN 0 AND 500`, `battery_capacity_pct BETWEEN 0 AND 100`, and restricted enum strings for `drone_type`, `status`, and `role`.

### Q3: What are the architectural implications of `ON DELETE CASCADE` between `operator`, `drone`, and subtype tables?
> **Answer**: When an `operator` is deleted, `ON DELETE CASCADE` automatically removes all associated `drone` base rows, which in turn cascades to delete the respective `drone_fixed_wing`, `drone_quadcopter`, or `drone_emergency_medical` rows. This prevents orphan records and eliminates dangling foreign keys without requiring multi-table manual cleanup queries.

### Q4: What is the difference between ER and Enhanced ER (EER)?
> **Answer**: Classic ER models entities, attributes, and relationships. Enhanced ER (EER) introduces object-oriented abstractions—specifically **Specialization/Generalization** (subclasses and superclasses), **Categorization** (union types), and **Attribute Inheritance**—enabling formal modeling of polymorphic hierarchies like our drone subtypes.

### Q5: Explain the difference between Disjoint and Overlapping specialization.
> **Answer**: In **Disjoint** specialization ($d$), an entity instance can belong to at most one subclass (e.g. a UAV is either a Fixed-Wing, Quadcopter, or Emergency Medical, but never two at once). In **Overlapping** specialization ($o$), an entity can simultaneously belong to multiple subclasses (e.g., an employee who is both an Engineer and a Manager).

### Q6: Explain the difference between Total and Partial specialization.
> **Answer**: In **Total** specialization (double line), every superclass entity must belong to at least one subclass (no generic "drone" exists without a concrete type). In **Partial** specialization (single line), an entity can exist as a standalone superclass instance without belonging to any subclass.

### Q7: Why did you choose Joined Table Inheritance over a single wide table with NULLs?
> **Answer**: A wide table causes sparse data where >60% of columns are NULL, precludes standard `NOT NULL` constraints on subtype-specific fields, and permits invalid hybrid rows (e.g., a quadcopter having wingspan). Joined Table Inheritance maintains 3NF/BCNF normalization, enforces non-null specs on subtype tables, and avoids storage bloat.

### Q8: What does it mean that your relations reach BCNF?
> **Answer**: Boyce-Codd Normal Form (BCNF) requires that for every non-trivial functional dependency $X \rightarrow Y$, $X$ must be a superkey. In our schema, all tables have no partial or transitive dependencies, and every functional dependency is determined solely by candidate keys (`operator_id`, `license_no`, `drone_id`, `slot_id`), guaranteeing zero update or deletion anomalies.

### Q9: Why did you use `bcrypt` directly instead of standard SHA-256 or MD5?
> **Answer**: SHA-256 and MD5 are cryptographic digest algorithms designed for high speed (billions of hashes per second on GPUs), making them vulnerable to brute-force dictionary attacks. `bcrypt` is an adaptive key derivation function with an adjustable work factor (cost) and built-in salting, designed specifically to be computationally expensive and resistant to hardware-accelerated attacks.

### Q10: Why use stateless JWT tokens instead of server-side sessions?
> **Answer**: JWTs encapsulate claims (`id`, `operator_id`, `role`, `exp`) signed cryptographically with HMAC-SHA256. They allow microservices, background dispatchers, and WebSocket handlers to verify authenticity and enforce RBAC independently without querying a central session database on every high-frequency HTTP or WebSocket request.

### Q11: What guarantees does an atomic transaction provide during drone registration and editing?
> **Answer**: Atomicity ensures that inserting or updating the base `drone` row and its subtype row succeed together or fail together. If an error occurs while writing the subtype record, the transaction rolls back completely using savepoints (`db.begin_nested()`), ensuring no corrupt or orphan base drone rows are ever committed.

### Q12: How do ACID properties map to your airspace reservation transactions?
> **Answer**:
> - **Atomicity**: Slot booking and reservation record creation commit or rollback as one unit.
> - **Consistency**: Enforced by check constraints (`end_time > start_time`) and foreign key references.
> - **Isolation**: Achieved via pessimistic row locking (`SELECT ... FOR UPDATE`) to prevent race conditions when concurrent operators attempt to book the same slot.
> - **Durability**: PostgreSQL write-ahead logs (WAL) guarantee committed slot reservations survive system crashes.

### Q13: Why does `audit_log.actor_id` deliberately lack a foreign key constraint to `operator`?
> **Answer**: Regulatory compliance rules dictate that security and operational audit trails must be immutable. If an operator's account is deleted or purged under data privacy policies, a foreign key with `ON DELETE CASCADE` would destroy the audit trail, while `ON DELETE RESTRICT` would block operator deletion. Omitting the FK preserves the historical compliance log permanently.

### Q14: How does the login rate limiter protect against brute-force attacks?
> **Answer**: SlowAPI tracks client IP addresses and enforces `LOGIN_RATE_LIMIT` (default 5 requests/minute). After 5 failed or rapid attempts, the limiter halts execution before password verification runs, returning `HTTP 429 Too Many Requests` and throttling automated password guessing attacks.

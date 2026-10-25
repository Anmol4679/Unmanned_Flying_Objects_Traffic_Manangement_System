# Real-Time Audit Event WebSocket Contract

## 1. Overview & Purpose
This document specifies the real-time event envelope emitted by the **Identity, Fleet & Foundation Platform** module into the system-wide WebSocket connection pool (owned and managed by Shlok in the Telemetry module).

Whenever critical identity, compliance, or fleet state changes occur, an audit record is committed to PostgreSQL and immediately broadcasted to all connected frontend clients (e.g., Regulator Console, Operator Dashboard) without blocking the HTTP request thread.

---

## 2. Event Envelope Schema

Audit events are broadcast as JSON payloads matching the following schema:

```json
{
  "event": "audit_event",
  "data": {
    "id": 1024,
    "actor_id": 2,
    "action": "SUSPEND",
    "entity": "operator",
    "entity_id": 5,
    "created_at": "2026-10-24T13:45:00.123456+00:00"
  }
}
```

### Field Definitions:
- `event` (*string*, required): Constant string `"audit_event"`. Distinguishes audit messages from raw telemetry packets.
- `data` (*object*, required): The audit event payload:
  - `id` (*integer*, required): Primary key of the persisted `audit_log` row in PostgreSQL.
  - `actor_id` (*integer | null*): The `operator_id` who triggered the action.
  - `action` (*string*, required): The uppercase action identifier (see Section 3).
  - `entity` (*string*, required): The target entity type (`"operator"`, `"drone"`, or `"reservation"`).
  - `entity_id` (*integer | null*): Primary key of the affected entity.
  - `created_at` (*string*, required): ISO-8601 UTC timestamp of creation.

---

## 3. Emitted Actions Matrix

| Action | Entity | Triggered By | Endpoint / Origin | Description |
|---|---|---|---|---|
| `REGISTER` | `operator` | Self (New User) | `POST /api/auth/register` | New operator account registered. |
| `SUSPEND` | `operator` | Regulator | `PATCH /api/operators/{id}/suspend` | Regulator flags operator license as suspended. |
| `REINSTATE` | `operator` | Regulator | `PATCH /api/operators/{id}/suspend` | Regulator reinstates suspended operator license. |
| `CREATE` | `drone` | Fleet Operator | `POST /api/drones` | New polymorphic drone + subtype registered. |
| `UPDATE` | `drone` | Fleet Operator | `PATCH /api/drones/{id}` | Drone specs (altitude, battery, wingspan/rotors) modified. |
| `UPDATE_STATUS` | `drone` | Fleet Operator | `PATCH /api/drones/{id}/status` | Drone status transitioned (`IDLE`, `IN_FLIGHT`, `MAINTENANCE`). |

---

## 4. Teammate Cross-Slice Audit Locations (`modules/reservations`)

The `modules/reservations` module currently inserts audit entries directly into PostgreSQL. When coordinating with Shravan, the following locations should be migrated to call `write_audit`:

1. `backend/modules/reservations/routes.py` (Line 143):
   - Action: `CANCEL_RESERVATION`
   - Entity: `reservation`
   - Trigger: `DELETE /api/reservations/{reservation_id}`
2. `backend/modules/reservations/routes.py` (Line 201):
   - Action: `EMERGENCY_PREEMPT`
   - Entity: `reservation`
   - Trigger: `POST /api/reservations/{reservation_id}/emergency-preempt`

---

## 5. Architectural & Transport Open Point

### PRD vs. Codebase Feed Endpoint:
- **PRD Specification**: The PRD specifies WebSocket URL `ws://.../live-feed`.
- **Existing Implementation**: The active WebSocket server in `modules/telemetry/websocket.py` is served at `/ws/telemetry`.
- **Agreement / Settlement**:
  - The `write_audit` helper directly utilizes the existing connection pool in `modules/telemetry/websocket.py` to preserve runtime stability and avoid running competing WebSocket managers.
  - Clients connecting to `/ws/telemetry` receive both raw telemetry updates and structured `audit_event` envelopes.
  - Telemetry visualizers simply ignore messages where `event === "audit_event"`, while the Regulator Console filters for `event === "audit_event"`.

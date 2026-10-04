// Fleet-specific types. Mirrors backend/modules/fleet/schemas.py (DroneOut / DroneCreate / DroneStatusUpdate).
// OperatorRole / TokenPayload / OperatorProfile live in "shared" and must not be redefined here.

export type DroneType = 'FIXED_WING' | 'QUADCOPTER' | 'EMERGENCY_MEDICAL';
export type DroneStatus = 'IDLE' | 'IN_FLIGHT' | 'MAINTENANCE';

export const DRONE_TYPES: DroneType[] = ['FIXED_WING', 'QUADCOPTER', 'EMERGENCY_MEDICAL'];
export const DRONE_STATUSES: DroneStatus[] = ['IDLE', 'IN_FLIGHT', 'MAINTENANCE'];

export interface FleetDrone {
  drone_id: number;
  operator_id: number;
  drone_type: DroneType;
  max_altitude_m: number;
  battery_capacity_pct: number;
  status: DroneStatus;
  wingspan_m: number | null;
  rotor_count: number | null;
  priority_clearance_level: number | null;
}

export interface DroneCreatePayload {
  drone_type: DroneType;
  max_altitude_m: number;
  battery_capacity_pct: number;
  status: DroneStatus;
  wingspan_m?: number;
  rotor_count?: number;
  priority_clearance_level?: number;
}

/**
 * Turns a FastAPI error body into a readable message.
 * `detail` is a string for HTTPException and an array of {loc,msg} for 422 validation errors.
 */
export function extractApiError(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      const msgs = detail
        .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : null))
        .filter((m): m is string => m !== null);
      if (msgs.length > 0) return msgs.join('; ');
    }
  }
  return fallback;
}

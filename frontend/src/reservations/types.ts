// DO NOT re-export or redefine OperatorRole, TokenPayload, OperatorProfile
// Those come from 'shared'

export interface AirspaceSector {
  sector_id: number;
  sector_name: string;
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
  floor_altitude_m: number;
  ceiling_altitude_m: number;
}

export interface TimeSlot {
  slot_id: number;
  sector_id: number;
  start_time: string; // ISO datetime string
  end_time: string;
  is_booked: boolean;
}

export interface AvailabilityResponse {
  sector: AirspaceSector;
  slots: TimeSlot[];
}

export interface Reservation {
  reservation_id: number;
  slot_id: number;
  drone_id: number;
  operator_id: number;
  priority: 'STANDARD' | 'CRITICAL';
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'DISPLACED';
  created_at: string;
  start_time?: string;
  end_time?: string;
  sector_name?: string;
}

export interface Drone {
  drone_id: number;
  operator_id: number;
  drone_type: 'FIXED_WING' | 'QUADCOPTER' | 'EMERGENCY_MEDICAL';
  max_altitude_m: number;
  battery_capacity_pct: number;
  status: 'IDLE' | 'IN_FLIGHT' | 'MAINTENANCE';
  wingspan_m?: number;
  rotor_count?: number;
  priority_clearance_level?: number;
}

export interface EmergencyPreemptionResponse {
  message: string;
  emergency_reservation_id: number;
  displaced_count: number;
  displaced_reservation_ids: number[];
}

export interface TelemetryPoint {
  drone_id: string | number;
  latitude: number;
  longitude: number;
  altitude_m: number;
  speed_mps: number;
  heading: number;
  battery_pct: number;
  timestamp: string;
  trail?: Array<{ lat: number; lon: number }>;
  lastSeen?: number;
  status?: "ACTIVE" | "STALE" | "LOST";
}

export interface SectorBoundary {
  sector_id: number;
  sector_name: string;
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
  floor_altitude_m: number;
  ceiling_altitude_m: number;
}

export interface TelemetryAlert {
  id: string;
  drone_id: string | number;
  type: "ALTITUDE_BREACH" | "GEOFENCE_BREACH" | "LOW_BATTERY";
  message: string;
  timestamp: string;
  severity: "CRITICAL" | "WARNING";
}


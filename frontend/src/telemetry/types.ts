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
  distance_to_station_km?: number;
  in_restricted_zone?: boolean;
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

export interface RestrictedZone {
  zone_id: string;
  zone_name: string;
  code: string;
  description: string;
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
  max_altitude_m: number;
  color?: string;
}

export interface GroundStation {
  station_id: string;
  station_name: string;
  latitude: number;
  longitude: number;
}

export interface TelemetryAlert {
  id: string;
  drone_id: string | number;
  type: "RESTRICTED_ZONE_INTRUSION" | "ALTITUDE_BREACH" | "GEOFENCE_BREACH" | "LOW_BATTERY" | "BATTERY_STATION_CRITICAL";
  message: string;
  timestamp: string;
  severity: "CRITICAL" | "WARNING";
  details?: {
    zone_name?: string;
    distance_km?: number;
    battery_pct?: number;
  };
}

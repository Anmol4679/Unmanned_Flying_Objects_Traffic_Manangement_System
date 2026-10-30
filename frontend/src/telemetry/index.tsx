import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "shared";
import { RadarMap } from "./components/RadarMap";
import { TelemetryHUD } from "./components/TelemetryHUD";
import { AlertsBanner } from "./components/AlertsBanner";
import { soundFX } from "./utils/soundFX";
import type { TelemetryPoint, SectorBoundary, RestrictedZone, GroundStation, TelemetryAlert } from "./types";
import { Radar, Play, Square, Volume2, VolumeX } from "lucide-react";

// Pre-defined High-Security Restricted Military No-Fly Zones
const DEFAULT_RESTRICTED_ZONES: RestrictedZone[] = [
  {
    zone_id: "RZ-RED-01",
    zone_name: "Yelahanka Air Force Base Airspace",
    code: "RESTRICTED-AFB-01",
    description: "Strict military air defense corridor. Immediate interception protocol active.",
    min_lat: 13.1200,
    max_lat: 13.1900,
    min_lon: 77.5700,
    max_lon: 77.6400,
    max_altitude_m: 500,
  },
  {
    zone_id: "RZ-RED-02",
    zone_name: "HAL Defense Aerodrome & Radar Array",
    code: "DEFENSE-RADAR-02",
    description: "Critical national defense radar array. Electronic warfare zone.",
    min_lat: 12.9300,
    max_lat: 12.9800,
    min_lon: 77.6400,
    max_lon: 77.7100,
    max_altitude_m: 400,
  },
];

// Drone Ground Charging & Recovery Stations
const GROUND_STATIONS: GroundStation[] = [
  {
    station_id: "GS-NORTH",
    station_name: "Hebbal Hub Alpha",
    latitude: 13.0350,
    longitude: 77.5950,
  },
  {
    station_id: "GS-SOUTH",
    station_name: "Electronic City Bravo",
    latitude: 12.8450,
    longitude: 77.6650,
  },
];

// Helper to compute Euclidean distance in KM roughly
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export const TelemetryPage: React.FC = () => {
  const { token } = useAuth();
  const [telemetries, setTelemetries] = useState<Map<string, TelemetryPoint>>(new Map());
  const [sectors, setSectors] = useState<SectorBoundary[]>([]);
  const [selectedDroneId, setSelectedDroneId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<TelemetryAlert[]>([]);
  const [, setWsConnected] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [hasActiveIntrusion, setHasActiveIntrusion] = useState<boolean>(false);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1. Fetch Airspace Sectors
  useEffect(() => {
    if (!token) return;
    fetch("/api/sectors", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: SectorBoundary[]) => setSectors(data))
      .catch((err) => console.error("Failed to load sectors for radar:", err));
  }, [token]);

  // 2. Fetch Initial Active Telemetry Points
  useEffect(() => {
    if (!token) return;
    fetch("/api/telemetry", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setTelemetries((prev) => {
            const next = new Map(prev);
            data.forEach((item) => {
              const id = String(item.drone_id);
              next.set(id, {
                drone_id: id,
                latitude: Number(item.latitude),
                longitude: Number(item.longitude),
                altitude_m: Number(item.altitude_m),
                speed_mps: Number(item.speed_mps),
                heading: Number(item.heading),
                battery_pct: Number(item.battery_pct),
                timestamp: item.timestamp || new Date().toISOString(),
                trail: [{ lat: Number(item.latitude), lon: Number(item.longitude) }],
                status: "ACTIVE",
              });
            });
            return next;
          });
        }
      })
      .catch((err) => console.error("Initial telemetry fetch:", err));
  }, [token]);

  // Handle incoming telemetry packet and analyze threats
  const handleIncomingTelemetry = useCallback((data: any) => {
    const droneId = String(data.drone_id);
    const lat = Number(data.latitude);
    const lon = Number(data.longitude);
    const alt = Number(data.altitude_m);
    const speed = Number(data.speed_mps);
    const heading = Number(data.heading);
    const battery = Number(data.battery_pct);
    const ts = data.timestamp || new Date().toISOString();

    // Check if drone has entered any restricted military no-fly zone
    let inRestrictedZone = false;
    let breachedZone: RestrictedZone | null = null;
    for (const rz of DEFAULT_RESTRICTED_ZONES) {
      if (
        lat >= rz.min_lat &&
        lat <= rz.max_lat &&
        lon >= rz.min_lon &&
        lon <= rz.max_lon &&
        alt <= rz.max_altitude_m
      ) {
        inRestrictedZone = true;
        breachedZone = rz;
        break;
      }
    }

    // Distance to nearest ground station
    let minStationDist = 999;
    for (const gs of GROUND_STATIONS) {
      const d = calculateDistanceKm(lat, lon, gs.latitude, gs.longitude);
      if (d < minStationDist) minStationDist = d;
    }

    setTelemetries((prev) => {
      const next = new Map(prev);
      const existing = next.get(droneId);
      const prevTrail = existing?.trail || [];
      const newTrail = [...prevTrail, { lat, lon }].slice(-30);

      next.set(droneId, {
        drone_id: droneId,
        latitude: lat,
        longitude: lon,
        altitude_m: alt,
        speed_mps: speed,
        heading: heading,
        battery_pct: battery,
        timestamp: ts,
        trail: newTrail,
        status: "ACTIVE",
        distance_to_station_km: minStationDist,
        in_restricted_zone: inRestrictedZone,
      });
      return next;
    });

    const newAlerts: TelemetryAlert[] = [];

    // 🚨 1. WAR/RED ALERT: Restricted Zone Intrusion
    if (inRestrictedZone && breachedZone) {
      setHasActiveIntrusion(true);
      soundFX.startWarAlarm();
      soundFX.playMissileLock();

      newAlerts.push({
        id: `intrude-${droneId}-${Date.now()}`,
        drone_id: droneId,
        type: "RESTRICTED_ZONE_INTRUSION",
        message: `🚨 WAR EMERGENCY: UAV-${droneId} BREACHED ${breachedZone.code} (${breachedZone.zone_name})! AIR DEFENSE ENGAGED!`,
        timestamp: ts,
        severity: "CRITICAL",
        details: { zone_name: breachedZone.zone_name },
      });
    }

    // ⚡ 2. LOW BATTERY & GROUND STATION FAR
    if (battery <= 25 && minStationDist >= 12.0) {
      soundFX.playBatteryAlert();
      newAlerts.push({
        id: `bat-dist-${droneId}-${Date.now()}`,
        drone_id: droneId,
        type: "BATTERY_STATION_CRITICAL",
        message: `⚡ CRITICAL ENERGY THREAT: UAV-${droneId} Battery at ${Math.round(battery)}%, Nearest Charging Station is ${minStationDist}km away! Immediate return or emergency landing required!`,
        timestamp: ts,
        severity: "CRITICAL",
        details: { distance_km: minStationDist, battery_pct: battery },
      });
    } else if (battery < 20) {
      soundFX.playBatteryAlert();
      newAlerts.push({
        id: `bat-${droneId}-${Date.now()}`,
        drone_id: droneId,
        type: "LOW_BATTERY",
        message: `UAV-${droneId} battery low (${Math.round(battery)}%)!`,
        timestamp: ts,
        severity: "WARNING",
      });
    }

    // 3. Altitude Ceiling
    if (alt > 120) {
      newAlerts.push({
        id: `alt-${droneId}-${Date.now()}`,
        drone_id: droneId,
        type: "ALTITUDE_BREACH",
        message: `UAV-${droneId} exceeded 120m ceiling at ${Math.round(alt)}m!`,
        timestamp: ts,
        severity: "WARNING",
      });
    }

    if (newAlerts.length > 0) {
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 6));
    }
  }, []);

  // 3. WebSocket Connection with auto-reconnection
  useEffect(() => {
    const connectWs = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/telemetry`;

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          handleIncomingTelemetry(parsed);
        } catch (err) {
          console.error("Malformed telemetry packet:", err);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
      soundFX.stopWarAlarm();
    };
  }, [handleIncomingTelemetry]);

  // 4. Drone Flight Simulation Generator for Live Demonstration
  const toggleSimulation = () => {
    if (isSimulating) {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
      setIsSimulating(false);
      setHasActiveIntrusion(false);
      soundFX.stopWarAlarm();
      return;
    }

    setIsSimulating(true);

    let step = 0;
    // Drone 1: Patrolling toward Yelahanka Air Force Restricted Base
    let simLat1 = 13.0800;
    let simLon1 = 77.5600;
    let simHeading1 = 30;

    // Drone 2: Flying with depleting battery far from charging station
    let simLat2 = 13.2500;
    let simLon2 = 77.7200;
    let simHeading2 = 210;
    let simBat2 = 30;

    simulationIntervalRef.current = setInterval(async () => {
      step++;

      // Drone 1 heads directly into Restricted Zone RZ-RED-01
      simLat1 += 0.0016 * Math.cos((simHeading1 * Math.PI) / 180);
      simLon1 += 0.0016 * Math.sin((simHeading1 * Math.PI) / 180);

      // Drone 2 battery drops and travels further North away from ground stations
      simLat2 += 0.0012 * Math.cos((simHeading2 * Math.PI) / 180);
      simLon2 += 0.0012 * Math.sin((simHeading2 * Math.PI) / 180);
      simBat2 = Math.max(simBat2 - 0.7, 8);

      const p1 = {
        drone_id: "1",
        latitude: simLat1,
        longitude: simLon1,
        altitude_m: 95,
        speed_mps: 26.5,
        heading: simHeading1,
        battery_pct: 78,
        timestamp: new Date().toISOString(),
      };

      const p2 = {
        drone_id: "2",
        latitude: simLat2,
        longitude: simLon2,
        altitude_m: 85,
        speed_mps: 21.0,
        heading: simHeading2,
        battery_pct: Math.round(simBat2),
        timestamp: new Date().toISOString(),
      };

      // Update local telemetry state directly for instantaneous, fluid radar movement
      handleIncomingTelemetry(p1);
      handleIncomingTelemetry(p2);

      // Also dispatch to backend to persist and broadcast
      fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p1),
      }).catch(() => {});
      fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p2),
      }).catch(() => {});
    }, 700);
  };

  const handleDismissAlert = (id: string) => {
    setAlerts((prev) => {
      const remaining = prev.filter((a) => a.id !== id);
      const stillHasIntrusion = remaining.some((a) => a.type === "RESTRICTED_ZONE_INTRUSION");
      if (!stillHasIntrusion) {
        setHasActiveIntrusion(false);
        soundFX.stopWarAlarm();
      }
      return remaining;
    });
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundFX.setMuted(nextMuted);
  };

  const selectedDrone = selectedDroneId ? telemetries.get(selectedDroneId) ?? null : null;
  const droneArray = Array.from(telemetries.values());

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl shadow-glow ${
            hasActiveIntrusion ? "bg-red-600 animate-bounce" : "bg-gradient-to-tr from-brand-600 to-cyan-400"
          }`}>
            <Radar className="h-6 w-6 text-white animate-spin [animation-duration:8s]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Live Tactical Telemetry & Radar Defense
              {hasActiveIntrusion && (
                <span className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-black text-white animate-pulse">
                  RED ALERT
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400">
              Air Defense Monitoring · No-Fly Threat Detection · Audible Tactical Klaxons · Energy Proximity
            </p>
          </div>
        </div>

        {/* Action Controls & Simulator */}
        <div className="flex items-center gap-3">
          {/* Audio Alarm Toggle */}
          <button
            onClick={toggleMute}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
              isMuted
                ? "border-slate-700 bg-utm-card text-slate-400 hover:text-white"
                : "border-red-500/50 bg-red-500/20 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse"
            }`}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-red-400" />}
            <span>{isMuted ? "Audio Muted" : "Audio Armed"}</span>
          </button>

          {/* Simulate Live Flight Telemetry & Threat Incursion */}
          <button
            onClick={toggleSimulation}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-lg ${
              isSimulating
                ? "bg-red-600 hover:bg-red-700 text-white shadow-red-500/30 animate-pulse"
                : "bg-gradient-to-r from-brand-600 to-cyan-500 hover:from-brand-500 hover:to-cyan-400 text-white shadow-brand-500/20"
            }`}
          >
            {isSimulating ? (
              <>
                <Square className="h-4 w-4 fill-white" />
                <span>Stop Live Simulation</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-white" />
                <span>Simulate Threat & Incursion Demo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Threat and Alert Banners with Klaxons */}
      <AlertsBanner
        alerts={alerts}
        onDismiss={handleDismissAlert}
        isMuted={isMuted}
        onToggleMute={toggleMute}
      />

      {/* Main Radar Tactical Dashboard */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Radar Map Canvas with Restricted Airspace */}
        <div className="lg:col-span-2">
          <RadarMap
            telemetries={telemetries}
            sectors={sectors}
            restrictedZones={DEFAULT_RESTRICTED_ZONES}
            groundStations={GROUND_STATIONS}
            selectedDroneId={selectedDroneId}
            onSelectDrone={(id) => setSelectedDroneId(id)}
            hasActiveIntrusion={hasActiveIntrusion}
          />
        </div>

        {/* Tactical HUD & Telemetry Telemetry Cards */}
        <div className="lg:col-span-1">
          <TelemetryHUD
            selectedDrone={selectedDrone}
            drones={droneArray}
            onSelectDrone={(id) => setSelectedDroneId(id)}
          />
        </div>
      </div>
    </div>
  );
};

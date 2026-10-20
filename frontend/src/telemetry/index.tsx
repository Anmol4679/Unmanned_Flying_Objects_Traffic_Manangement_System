import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "shared";
import { RadarMap } from "./components/RadarMap";
import { TelemetryHUD } from "./components/TelemetryHUD";
import { AlertsBanner } from "./components/AlertsBanner";
import type { TelemetryPoint, SectorBoundary, TelemetryAlert } from "./types";
import { Radar, Play, Square, Wifi, WifiOff, RefreshCw } from "lucide-react";

export const TelemetryPage: React.FC = () => {
  const { token, user } = useAuth();
  const [telemetries, setTelemetries] = useState<Map<string, TelemetryPoint>>(new Map());
  const [sectors, setSectors] = useState<SectorBoundary[]>([]);
  const [selectedDroneId, setSelectedDroneId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<TelemetryAlert[]>([]);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Handle incoming telemetry packet
  const handleIncomingTelemetry = useCallback((data: any) => {
    const droneId = String(data.drone_id);
    const lat = Number(data.latitude);
    const lon = Number(data.longitude);
    const alt = Number(data.altitude_m);
    const speed = Number(data.speed_mps);
    const heading = Number(data.heading);
    const battery = Number(data.battery_pct);
    const ts = data.timestamp || new Date().toISOString();

    setTelemetries((prev) => {
      const next = new Map(prev);
      const existing = next.get(droneId);
      const prevTrail = existing?.trail || [];
      const newTrail = [...prevTrail, { lat, lon }].slice(-25);

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
      });
      return next;
    });

    // Check for alerts
    const newAlerts: TelemetryAlert[] = [];
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

    if (battery < 20) {
      newAlerts.push({
        id: `bat-${droneId}-${Date.now()}`,
        drone_id: droneId,
        type: "LOW_BATTERY",
        message: `UAV-${droneId} battery critical (${Math.round(battery)}%)!`,
        timestamp: ts,
        severity: "WARNING",
      });
    }

    if (newAlerts.length > 0) {
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 5));
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
        // Retry connection in 3 seconds
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
    };
  }, [handleIncomingTelemetry]);

  // 4. Drone Flight Simulation Generator for Live Demonstration
  const toggleSimulation = () => {
    if (isSimulating) {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
      setIsSimulating(false);
      return;
    }

    setIsSimulating(true);

    let step = 0;
    let simLat1 = 12.9800;
    let simLon1 = 77.5800;
    let simHeading1 = 45;

    let simLat2 = 13.1500;
    let simLon2 = 77.6500;
    let simHeading2 = 180;

    simulationIntervalRef.current = setInterval(async () => {
      step++;
      // Drone 1 (Fixed-Wing巡航)
      simLat1 += 0.0012 * Math.cos((simHeading1 * Math.PI) / 180);
      simLon1 += 0.0012 * Math.sin((simHeading1 * Math.PI) / 180);
      if (step % 20 === 0) simHeading1 = (simHeading1 + 45) % 360;

      // Drone 2 (Emergency Medical Flight)
      simLat2 += 0.0015 * Math.cos((simHeading2 * Math.PI) / 180);
      simLon2 += 0.0015 * Math.sin((simHeading2 * Math.PI) / 180);
      if (step % 15 === 0) simHeading2 = (simHeading2 + 30) % 360;

      const p1 = {
        drone_id: "1",
        latitude: simLat1,
        longitude: simLon1,
        altitude_m: 85 + Math.sin(step) * 10,
        speed_mps: 18.5,
        heading: simHeading1,
        battery_pct: Math.max(98 - step * 0.2, 15),
        timestamp: new Date().toISOString(),
      };

      const p2 = {
        drone_id: "2",
        latitude: simLat2,
        longitude: simLon2,
        altitude_m: 125, // Triggers altitude alert
        speed_mps: 22.0,
        heading: simHeading2,
        battery_pct: 18, // Triggers low battery alert
        timestamp: new Date().toISOString(),
      };

      try {
        await fetch("/api/telemetry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p1),
        });
        await fetch("/api/telemetry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p2),
        });
      } catch (err) {
        console.error("Simulation dispatch:", err);
      }
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    };
  }, []);

  const selectedDrone = selectedDroneId ? telemetries.get(selectedDroneId) ?? null : null;
  const droneArray = Array.from(telemetries.values());

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-400 shadow-glow">
              <Radar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Live Telemetry & Radar</h1>
              <p className="text-xs text-slate-400">
                Real-time 4D radar tracking · WebSocket GPS streaming · Altitude & Geofence detection
              </p>
            </div>
          </div>
        </div>

        {/* Tactical Controls & Status */}
        <div className="flex items-center gap-3">
          {/* Connection Status Badge */}
          <div className="flex items-center gap-2 rounded-xl border border-utm-border bg-utm-card px-3 py-2 text-xs">
            {wsConnected ? (
              <>
                <Wifi className="h-4 w-4 text-emerald-400" />
                <span className="font-mono text-emerald-400">WS Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-amber-400" />
                <span className="font-mono text-amber-400">Reconnecting...</span>
              </>
            )}
          </div>

          {/* Simulation Toggle Button */}
          <button
            onClick={toggleSimulation}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold shadow-glow transition ${
              isSimulating
                ? "border border-red-500/40 bg-red-500/20 text-red-300 hover:bg-red-500/30"
                : "bg-gradient-to-r from-brand-600 to-cyan-500 text-white hover:from-brand-500 hover:to-cyan-400"
            }`}
          >
            {isSimulating ? (
              <>
                <Square className="h-3.5 w-3.5 fill-current" />
                Stop Simulation
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                Simulate Flight Telemetry
              </>
            )}
          </button>
        </div>
      </div>

      {/* Safety Alerts Banner */}
      <AlertsBanner
        alerts={alerts}
        onDismiss={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))}
      />

      {/* Main Radar Layout: 2 Columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2 Cols): Interactive Radar Map */}
        <div className="lg:col-span-2">
          <RadarMap
            telemetries={telemetries}
            sectors={sectors}
            selectedDroneId={selectedDroneId}
            onSelectDrone={(id) => setSelectedDroneId(id)}
          />
        </div>

        {/* Right Column (1 Col): Tactical Telemetry HUD */}
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


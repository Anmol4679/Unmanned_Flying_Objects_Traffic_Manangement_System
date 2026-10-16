import React from "react";
import type { TelemetryPoint } from "../types";
import {
  Gauge,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Navigation,
  Activity,
  MapPin,
  Clock,
  Radio,
  Crosshair,
} from "lucide-react";

interface TelemetryHUDProps {
  selectedDrone: TelemetryPoint | null;
  drones: TelemetryPoint[];
  onSelectDrone: (id: string) => void;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  selectedDrone,
  drones,
  onSelectDrone,
}) => {
  const getHeadingCardinal = (deg: number) => {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(((deg % 360) / 45)) % 8;
    return directions[index];
  };

  const getBatteryIcon = (pct: number) => {
    if (pct < 20) return <BatteryWarning className="h-4 w-4 text-red-400" />;
    if (pct < 50) return <Battery className="h-4 w-4 text-amber-400" />;
    return <BatteryCharging className="h-4 w-4 text-emerald-400" />;
  };

  return (
    <div className="space-y-4">
      {/* Target Inspector Card */}
      <div className="rounded-2xl border border-utm-border bg-utm-card p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between border-b border-utm-border pb-3">
          <div className="flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-brand-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Telemetry Flight HUD
            </h3>
          </div>
          {selectedDrone && (
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              {selectedDrone.status || "TRACKED"}
            </span>
          )}
        </div>

        {selectedDrone ? (
          <div className="space-y-3">
            {/* Primary ID & Position */}
            <div className="flex items-center justify-between rounded-xl border border-utm-border/80 bg-utm-bg/60 p-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-slate-400">Target Callout</span>
                <div className="font-mono text-base font-bold text-white">UAV-{selectedDrone.drone_id}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">Heading</span>
                <div className="flex items-center justify-end gap-1 font-mono text-sm font-semibold text-brand-400">
                  <Navigation
                    className="h-3.5 w-3.5"
                    style={{ transform: `rotate(${selectedDrone.heading}deg)` }}
                  />
                  <span>{Math.round(selectedDrone.heading)}° {getHeadingCardinal(selectedDrone.heading)}</span>
                </div>
              </div>
            </div>

            {/* Tactical 2x2 Telemetry Metric Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Altitude Gauge */}
              <div className="rounded-xl border border-utm-border bg-utm-surface/80 p-3">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] uppercase tracking-wider">Altitude</span>
                  <Activity className="h-3.5 w-3.5 text-brand-400" />
                </div>
                <div className="mt-1 font-mono text-lg font-bold text-white">
                  {Math.round(selectedDrone.altitude_m)}
                  <span className="text-xs font-normal text-slate-400"> m AGL</span>
                </div>
                {/* Progress bar vs 120m standard ceiling */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-utm-bg">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      selectedDrone.altitude_m > 120 ? "bg-amber-400" : "bg-brand-500"
                    }`}
                    style={{ width: `${Math.min((selectedDrone.altitude_m / 150) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Ground Speed Gauge */}
              <div className="rounded-xl border border-utm-border bg-utm-surface/80 p-3">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] uppercase tracking-wider">Ground Speed</span>
                  <Gauge className="h-3.5 w-3.5 text-brand-400" />
                </div>
                <div className="mt-1 font-mono text-lg font-bold text-white">
                  {selectedDrone.speed_mps.toFixed(1)}
                  <span className="text-xs font-normal text-slate-400"> m/s</span>
                </div>
                <div className="mt-1 text-[11px] font-mono text-slate-400">
                  {(selectedDrone.speed_mps * 3.6).toFixed(1)} km/h
                </div>
              </div>

              {/* Battery Status Gauge */}
              <div className="rounded-xl border border-utm-border bg-utm-surface/80 p-3">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] uppercase tracking-wider">Battery Power</span>
                  {getBatteryIcon(selectedDrone.battery_pct)}
                </div>
                <div className="mt-1 font-mono text-lg font-bold text-white">
                  {Math.round(selectedDrone.battery_pct)}%
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-utm-bg">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      selectedDrone.battery_pct < 20
                        ? "bg-red-400"
                        : selectedDrone.battery_pct < 50
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                    }`}
                    style={{ width: `${selectedDrone.battery_pct}%` }}
                  />
                </div>
              </div>

              {/* GPS Coordinates */}
              <div className="rounded-xl border border-utm-border bg-utm-surface/80 p-3">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] uppercase tracking-wider">Coordinates</span>
                  <MapPin className="h-3.5 w-3.5 text-brand-400" />
                </div>
                <div className="mt-1 font-mono text-xs font-semibold text-slate-200">
                  {selectedDrone.latitude.toFixed(4)}° N
                </div>
                <div className="font-mono text-xs font-semibold text-slate-200">
                  {selectedDrone.longitude.toFixed(4)}° E
                </div>
              </div>
            </div>

            {/* Timestamp & Feed info */}
            <div className="flex items-center justify-between border-t border-utm-border/60 pt-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1 font-mono">
                <Clock className="h-3 w-3" /> {new Date(selectedDrone.timestamp).toLocaleTimeString()}
              </span>
              <span className="flex items-center gap-1 font-mono text-emerald-400">
                <Radio className="h-3 w-3 animate-pulse" /> WS Synchronized
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
            <Crosshair className="h-8 w-8 text-slate-600 mb-2" />
            <p className="text-xs font-medium text-slate-300">No Target Selected</p>
            <p className="mt-1 text-[11px] text-slate-400">Click any aircraft on the radar map or select below</p>
          </div>
        )}
      </div>

      {/* Target Directory List */}
      <div className="rounded-2xl border border-utm-border bg-utm-card p-4 shadow-xl">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Active Targets ({drones.length})
          </span>
          <span className="text-[10px] text-slate-400">Live Telemetry Queue</span>
        </div>

        {drones.length > 0 ? (
          <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
            {drones.map((d) => {
              const isSelected = String(d.drone_id) === String(selectedDrone?.drone_id);
              return (
                <button
                  key={d.drone_id}
                  onClick={() => onSelectDrone(String(d.drone_id))}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                    isSelected
                      ? "border border-brand-500/50 bg-brand-500/15 text-white"
                      : "border border-utm-border/60 bg-utm-surface hover:bg-utm-cardHover text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-mono font-bold">UAV-{d.drone_id}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                    <span>{Math.round(d.altitude_m)}m</span>
                    <span>{Math.round(d.battery_pct)}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="py-4 text-center text-[11px] text-slate-400">
            Waiting for live WebSocket packets...
          </div>
        )}
      </div>
    </div>
  );
};


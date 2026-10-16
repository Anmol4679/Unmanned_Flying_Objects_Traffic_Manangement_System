import React, { useMemo } from "react";
import type { TelemetryPoint, SectorBoundary } from "../types";
import { Compass, Navigation, Radio } from "lucide-react";

interface RadarMapProps {
  telemetries: Map<string, TelemetryPoint>;
  sectors: SectorBoundary[];
  selectedDroneId: string | null;
  onSelectDrone: (id: string) => void;
}

export const RadarMap: React.FC<RadarMapProps> = ({
  telemetries,
  sectors,
  selectedDroneId,
  onSelectDrone,
}) => {
  // Compute coordinate bounding box encompassing sectors and drones
  const bbox = useMemo(() => {
    let minLat = 12.80;
    let maxLat = 13.40;
    let minLon = 77.40;
    let maxLon = 78.10;

    if (sectors.length > 0) {
      minLat = Math.min(...sectors.map((s) => Number(s.min_lat)));
      maxLat = Math.max(...sectors.map((s) => Number(s.max_lat)));
      minLon = Math.min(...sectors.map((s) => Number(s.min_lon)));
      maxLon = Math.max(...sectors.map((s) => Number(s.max_lon)));
    }

    // Expand margin by 10%
    const latMargin = (maxLat - minLat) * 0.1 || 0.05;
    const lonMargin = (maxLon - minLon) * 0.1 || 0.05;

    return {
      minLat: minLat - latMargin,
      maxLat: maxLat + latMargin,
      minLon: minLon - lonMargin,
      maxLon: maxLon + lonMargin,
    };
  }, [sectors]);

  // Transform GPS Lat/Lon to SVG viewBox coordinates [0..1000, 0..1000]
  const toSvgX = (lon: number) => {
    return ((lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * 1000;
  };

  const toSvgY = (lat: number) => {
    // Invert Y axis because latitude increases upwards but SVG Y increases downwards
    return 1000 - ((lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * 1000;
  };

  const droneList = Array.from(telemetries.values());

  return (
    <div className="relative flex flex-col rounded-2xl border border-utm-border bg-utm-card p-4 shadow-2xl">
      {/* Top Header & Tactical Info */}
      <div className="mb-3 flex items-center justify-between border-b border-utm-border pb-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 animate-pulse text-brand-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Tactical Airspace Radar Map
          </span>
          <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-400">
            Live 4D Telemetry
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
          <span>Active Targets: <strong className="text-white">{droneList.length}</strong></span>
          <span>Sectors: <strong className="text-white">{sectors.length}</strong></span>
        </div>
      </div>

      {/* SVG Canvas Map */}
      <div className="relative aspect-square w-full max-h-[640px] overflow-hidden rounded-xl border border-utm-border bg-[#080d1a]">
        <svg
          viewBox="0 0 1000 1000"
          className="h-full w-full select-none"
        >
          <defs>
            {/* Concentric radar gradient */}
            <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.08" />
              <stop offset="60%" stopColor="#0ea5e9" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </radialGradient>

            {/* Glowing filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Radar Sweeper Background */}
          <rect width="1000" height="1000" fill="url(#radarGlow)" />

          {/* Concentric Radar Distance Rings */}
          <circle cx="500" cy="500" r="450" fill="none" stroke="#1e293b" strokeWidth="1.5" strokeDasharray="4 6" />
          <circle cx="500" cy="500" r="320" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 5" />
          <circle cx="500" cy="500" r="180" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 5" />
          <circle cx="500" cy="500" r="60" fill="none" stroke="#0ea5e9" strokeWidth="1" strokeOpacity="0.3" />

          {/* Crosshair Grids */}
          <line x1="500" y1="20" x2="500" y2="980" stroke="#1e293b" strokeWidth="1" />
          <line x1="20" y1="500" x2="980" y2="500" stroke="#1e293b" strokeWidth="1" />

          {/* Cardinal Labels */}
          <text x="500" y="35" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="bold">N</text>
          <text x="975" y="504" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="bold">E</text>
          <text x="500" y="985" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="bold">S</text>
          <text x="25" y="504" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="bold">W</text>

          {/* Airspace Sectors Polygons */}
          {sectors.map((sec) => {
            const x1 = toSvgX(Number(sec.min_lon));
            const y1 = toSvgY(Number(sec.max_lat));
            const x2 = toSvgX(Number(sec.max_lon));
            const y2 = toSvgY(Number(sec.min_lat));

            const width = Math.max(x2 - x1, 10);
            const height = Math.max(y2 - y1, 10);

            return (
              <g key={sec.sector_id}>
                <rect
                  x={x1}
                  y={y1}
                  width={width}
                  height={height}
                  fill="#0ea5e9"
                  fillOpacity="0.06"
                  stroke="#0284c7"
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                  rx="6"
                />
                <text
                  x={x1 + 8}
                  y={y1 + 18}
                  fill="#38bdf8"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {sec.sector_name}
                </text>
                <text
                  x={x1 + 8}
                  y={y1 + 32}
                  fill="#64748b"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  0–{sec.ceiling_altitude_m}m AGL
                </text>
              </g>
            );
          })}

          {/* Drone Breadcrumb Flight Trails */}
          {droneList.map((d) => {
            if (!d.trail || d.trail.length < 2) return null;
            const points = d.trail
              .map((pt) => `${toSvgX(pt.lon)},${toSvgY(pt.lat)}`)
              .join(" ");

            return (
              <polyline
                key={`trail-${d.drone_id}`}
                points={points}
                fill="none"
                stroke={String(d.drone_id) === String(selectedDroneId) ? "#38bdf8" : "#0284c7"}
                strokeWidth="2"
                strokeDasharray="2 3"
                strokeOpacity="0.6"
              />
            );
          })}

          {/* Drone Target Markers */}
          {droneList.map((d) => {
            const cx = toSvgX(d.longitude);
            const cy = toSvgY(d.latitude);
            const isSelected = String(d.drone_id) === String(selectedDroneId);
            const isAlert = d.battery_pct < 20 || d.altitude_m > 120;

            const markerColor = isAlert ? "#f59e0b" : isSelected ? "#38bdf8" : "#10b981";

            return (
              <g
                key={d.drone_id}
                onClick={() => onSelectDrone(String(d.drone_id))}
                className="cursor-pointer transition-transform hover:scale-110"
              >
                {/* Outer Ping Animation Circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="18"
                  fill={markerColor}
                  fillOpacity="0.15"
                  className="animate-ping"
                />

                {/* Selection Halo */}
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="24"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                )}

                {/* Rotated Aircraft Heading Icon */}
                <g transform={`rotate(${d.heading}, ${cx}, ${cy})`}>
                  <polygon
                    points={`${cx},${cy - 12} ${cx + 9},${cy + 9} ${cx},${cy + 4} ${cx - 9},${cy + 9}`}
                    fill={markerColor}
                    filter="url(#glow)"
                  />
                </g>

                {/* Drone Callout Tag */}
                <rect
                  x={cx + 12}
                  y={cy - 16}
                  width="78"
                  height="26"
                  rx="4"
                  fill="#0f172a"
                  fillOpacity="0.9"
                  stroke={isSelected ? "#38bdf8" : "#334155"}
                  strokeWidth="1"
                />
                <text
                  x={cx + 16}
                  y={cy - 4}
                  fill="#ffffff"
                  fontSize="9"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  UAV-{d.drone_id}
                </text>
                <text
                  x={cx + 16}
                  y={cy + 6}
                  fill="#94a3b8"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  {Math.round(d.altitude_m)}m · {Math.round(d.speed_mps * 3.6)}km/h
                </text>
              </g>
            );
          })}
        </svg>

        {/* Radar Corner Compass Widget */}
        <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg border border-utm-border/80 bg-utm-card/80 px-2.5 py-1 text-[10px] text-slate-300 backdrop-blur">
          <Compass className="h-3.5 w-3.5 text-brand-400" />
          <span>True North Grid</span>
        </div>
      </div>
    </div>
  );
};


import React, { useMemo } from "react";
import type { TelemetryPoint, SectorBoundary, RestrictedZone, GroundStation } from "../types";
import { Radio, AlertOctagon } from "lucide-react";

interface RadarMapProps {
  telemetries: Map<string, TelemetryPoint>;
  sectors: SectorBoundary[];
  restrictedZones: RestrictedZone[];
  groundStations: GroundStation[];
  selectedDroneId: string | null;
  onSelectDrone: (id: string) => void;
  hasActiveIntrusion?: boolean;
}

export const RadarMap: React.FC<RadarMapProps> = ({
  telemetries,
  sectors,
  restrictedZones,
  groundStations,
  selectedDroneId,
  onSelectDrone,
  hasActiveIntrusion = false,
}) => {
  // Compute coordinate bounding box encompassing sectors, restricted zones, and drones
  const bbox = useMemo(() => {
    let minLat = 12.80;
    let maxLat = 13.40;
    let minLon = 77.40;
    let maxLon = 78.10;

    const allLats: number[] = [];
    const allLons: number[] = [];

    sectors.forEach((s) => {
      allLats.push(Number(s.min_lat), Number(s.max_lat));
      allLons.push(Number(s.min_lon), Number(s.max_lon));
    });

    restrictedZones.forEach((z) => {
      allLats.push(z.min_lat, z.max_lat);
      allLons.push(z.min_lon, z.max_lon);
    });

    groundStations.forEach((g) => {
      allLats.push(g.latitude);
      allLons.push(g.longitude);
    });

    if (allLats.length > 0) {
      minLat = Math.min(...allLats);
      maxLat = Math.max(...allLats);
      minLon = Math.min(...allLons);
      maxLon = Math.max(...allLons);
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
  }, [sectors, restrictedZones, groundStations]);

  // Transform GPS Lat/Lon to SVG viewBox coordinates [0..1000, 0..1000]
  const toSvgX = (lon: number) => {
    return ((lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * 1000;
  };

  const toSvgY = (lat: number) => {
    return 1000 - ((lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * 1000;
  };

  const droneList = Array.from(telemetries.values());

  return (
    <div className={`relative flex flex-col rounded-2xl border bg-utm-card p-4 shadow-2xl transition-all duration-300 ${
      hasActiveIntrusion ? "border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.35)]" : "border-utm-border"
    }`}>
      {/* Top Header & Tactical Info */}
      <div className="mb-3 flex items-center justify-between border-b border-utm-border pb-3">
        <div className="flex items-center gap-2">
          <Radio className={`h-4 w-4 animate-pulse ${hasActiveIntrusion ? "text-red-500" : "text-brand-400"}`} />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Tactical Airspace Radar & Threat Detection
          </span>
          {hasActiveIntrusion ? (
            <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-0.5 text-[10px] font-bold text-red-400 animate-pulse border border-red-500/40">
              <AlertOctagon className="h-3 w-3" />
              RESTRICTED ZONE INTRUSION ALERT
            </span>
          ) : (
            <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-400">
              Live 4D Telemetry
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
          <span>Active Targets: <strong className="text-white">{droneList.length}</strong></span>
          <span className="text-red-400 font-semibold">No-Fly Zones: <strong className="text-red-400">{restrictedZones.length}</strong></span>
          <span>Sectors: <strong className="text-white">{sectors.length}</strong></span>
        </div>
      </div>

      {/* SVG Canvas Map */}
      <div className={`relative aspect-square w-full max-h-[640px] overflow-hidden rounded-xl border bg-[#060a14] transition-colors duration-300 ${
        hasActiveIntrusion ? "border-red-500/60" : "border-utm-border"
      }`}>
        {/* Flashing Red Screen Alarm Overlay for War / Red Alert */}
        {hasActiveIntrusion && (
          <div className="pointer-events-none absolute inset-0 z-10 bg-red-950/20 animate-pulse border-4 border-red-600/40" />
        )}

        <svg
          viewBox="0 0 1000 1000"
          className="h-full w-full select-none"
        >
          <defs>
            {/* Concentric radar gradient */}
            <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={hasActiveIntrusion ? "#ef4444" : "#0ea5e9"} stopOpacity={hasActiveIntrusion ? "0.15" : "0.08"} />
              <stop offset="60%" stopColor={hasActiveIntrusion ? "#b91c1c" : "#0ea5e9"} stopOpacity="0.02" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </radialGradient>

            {/* Pattern for Restricted Airspace Military Stripes */}
            <pattern id="restrictedStripes" width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="16" stroke="#ef4444" strokeWidth="4" strokeOpacity="0.3" />
            </pattern>

            {/* Glow Filter */}
            <filter id="threatGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Radar Sweeper Background */}
          <rect width="1000" height="1000" fill="url(#radarGlow)" />

          {/* Concentric Radar Distance Rings */}
          <circle cx="500" cy="500" r="450" fill="none" stroke={hasActiveIntrusion ? "#7f1d1d" : "#1e293b"} strokeWidth="1.5" strokeDasharray="4 6" />
          <circle cx="500" cy="500" r="320" fill="none" stroke={hasActiveIntrusion ? "#7f1d1d" : "#1e293b"} strokeWidth="1" strokeDasharray="3 5" />
          <circle cx="500" cy="500" r="180" fill="none" stroke={hasActiveIntrusion ? "#7f1d1d" : "#1e293b"} strokeWidth="1" strokeDasharray="3 5" />
          <circle cx="500" cy="500" r="60" fill="none" stroke={hasActiveIntrusion ? "#ef4444" : "#0ea5e9"} strokeWidth="1" strokeOpacity="0.3" />

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
                  fillOpacity="0.05"
                  stroke="#0284c7"
                  strokeWidth="1.2"
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

          {/* RESTRICTED NO-FLY WAR / AIR-DEFENSE ZONES */}
          {restrictedZones.map((zone) => {
            const x1 = toSvgX(zone.min_lon);
            const y1 = toSvgY(zone.max_lat);
            const x2 = toSvgX(zone.max_lon);
            const y2 = toSvgY(zone.min_lat);

            const width = Math.max(x2 - x1, 20);
            const height = Math.max(y2 - y1, 20);

            return (
              <g key={zone.zone_id}>
                {/* Threat Zone Fill with warning stripes */}
                <rect
                  x={x1}
                  y={y1}
                  width={width}
                  height={height}
                  fill="url(#restrictedStripes)"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  rx="8"
                />
                {/* Perimeter Glow */}
                <rect
                  x={x1}
                  y={y1}
                  width={width}
                  height={height}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  filter="url(#threatGlow)"
                  className="animate-pulse"
                  strokeOpacity="0.8"
                  rx="8"
                />
                {/* Danger Badge */}
                <g transform={`translate(${x1 + 8}, ${y1 + 18})`}>
                  <rect x="-2" y="-12" width="170" height="34" fill="#0f172a" fillOpacity="0.85" rx="4" stroke="#ef4444" strokeWidth="1" />
                  <text
                    x="4"
                    y="2"
                    fill="#ef4444"
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    ⚠ RESTRICTED: {zone.code}
                  </text>
                  <text
                    x="4"
                    y="16"
                    fill="#fca5a5"
                    fontSize="8.5"
                    fontFamily="monospace"
                  >
                    {zone.zone_name.toUpperCase()} (NO-FLY)
                  </text>
                </g>
              </g>
            );
          })}

          {/* GROUND CHARGING / RECOVERY STATIONS */}
          {groundStations.map((gs) => {
            const gx = toSvgX(gs.longitude);
            const gy = toSvgY(gs.latitude);
            return (
              <g key={gs.station_id} transform={`translate(${gx}, ${gy})`}>
                <circle r="12" fill="#10b981" fillOpacity="0.15" stroke="#10b981" strokeWidth="1.5" />
                <circle r="4" fill="#10b981" />
                <text x="16" y="4" fill="#34d399" fontSize="9.5" fontWeight="bold" fontFamily="monospace">
                  ⚓ {gs.station_name}
                </text>
              </g>
            );
          })}

          {/* Range Vectors to Closest Charging Station for Low Battery Targets */}
          {droneList.map((d) => {
            if (d.battery_pct >= 25 || groundStations.length === 0) return null;
            const cx = toSvgX(d.longitude);
            const cy = toSvgY(d.latitude);
            const nearestGs = groundStations[0];
            const gx = toSvgX(nearestGs.longitude);
            const gy = toSvgY(nearestGs.latitude);

            return (
              <g key={`vector-${d.drone_id}`}>
                <line
                  x1={cx}
                  y1={cy}
                  x2={gx}
                  y2={gy}
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  className="animate-pulse"
                />
                <text
                  x={(cx + gx) / 2}
                  y={(cy + gy) / 2 - 6}
                  fill="#fbbf24"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  ⚡ RETURN PATH ({d.distance_to_station_km ? `${d.distance_to_station_km}km` : 'FAR'})
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

            const trailColor = d.in_restricted_zone ? "#ef4444" : String(d.drone_id) === String(selectedDroneId) ? "#38bdf8" : "#0284c7";

            return (
              <polyline
                key={`trail-${d.drone_id}`}
                points={points}
                fill="none"
                stroke={trailColor}
                strokeWidth={d.in_restricted_zone ? "3" : "2"}
                strokeDasharray="2 3"
                strokeOpacity={d.in_restricted_zone ? "0.9" : "0.6"}
              />
            );
          })}

          {/* Drone Target Markers */}
          {droneList.map((d) => {
            const cx = toSvgX(d.longitude);
            const cy = toSvgY(d.latitude);
            const isSelected = String(d.drone_id) === String(selectedDroneId);
            const isIntruder = d.in_restricted_zone;
            const isLowBat = d.battery_pct < 25;
            
            const markerColor = isIntruder
              ? "#ef4444"
              : isLowBat
              ? "#f59e0b"
              : isSelected
              ? "#38bdf8"
              : "#10b981";

            return (
              <g
                key={d.drone_id}
                onClick={() => onSelectDrone(String(d.drone_id))}
                className="cursor-pointer transition-transform hover:scale-110"
              >
                {/* Outer Threat / Intrusion Ping Animation */}
                {isIntruder && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="32"
                    fill="#ef4444"
                    fillOpacity="0.25"
                    stroke="#dc2626"
                    strokeWidth="2.5"
                    className="animate-ping"
                  />
                )}

                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? "18" : "14"}
                  fill={markerColor}
                  fillOpacity="0.2"
                  stroke={markerColor}
                  strokeWidth="1.5"
                />

                {/* Rotated Drone Heading Arrow Icon */}
                <g transform={`translate(${cx}, ${cy}) rotate(${d.heading})`}>
                  <polygon
                    points="0,-10 6,8 0,5 -6,8"
                    fill={markerColor}
                    stroke="#ffffff"
                    strokeWidth="0.8"
                  />
                </g>

                {/* Tactical Target Callout Box */}
                <g transform={`translate(${cx + 14}, ${cy - 12})`}>
                  <rect
                    x="0"
                    y="0"
                    width={isIntruder ? "120" : "90"}
                    height={isIntruder ? "42" : "32"}
                    fill="#0b1120"
                    fillOpacity="0.9"
                    stroke={markerColor}
                    strokeWidth="1"
                    rx="3"
                  />
                  <text x="4" y="11" fill={markerColor} fontSize="9" fontWeight="bold" fontFamily="monospace">
                    {isIntruder ? `🚨 INTRUDER UAV-${d.drone_id}` : `UAV-${d.drone_id}`}
                  </text>
                  <text x="4" y="21" fill="#94a3b8" fontSize="8" fontFamily="monospace">
                    {Math.round(d.altitude_m)}m · {Math.round(d.speed_mps * 3.6)}km/h
                  </text>
                  {isIntruder ? (
                    <text x="4" y="33" fill="#ef4444" fontSize="8" fontWeight="bold" fontFamily="monospace">
                      IN RESTRICTED ZONE!
                    </text>
                  ) : (
                    <text x="4" y="29" fill={d.battery_pct < 20 ? "#ef4444" : "#10b981"} fontSize="7.5" fontFamily="monospace">
                      BAT: {Math.round(d.battery_pct)}%
                    </text>
                  )}
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tactical Legend Bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between border-t border-utm-border pt-3 text-[11px] text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 font-semibold text-red-400">
            <span className="h-3 w-4 border border-red-500 bg-red-500/30" />
            Restricted Military / High-Security Zone
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="h-2 w-3 border border-dashed border-sky-400 bg-sky-500/10" />
            Civilian Air Corridor
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Normal Target
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Low Battery / Warning
          </span>
          <span className="flex items-center gap-1.5 font-bold text-red-400 animate-pulse">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            Restricted Zone Intruder
          </span>
          <span className="flex items-center gap-1.5 text-emerald-300">
            <span>⚓</span> Ground Station
          </span>
        </div>
      </div>
    </div>
  );
};

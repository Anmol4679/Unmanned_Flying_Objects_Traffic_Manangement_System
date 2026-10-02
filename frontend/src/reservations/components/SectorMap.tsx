import React from 'react';
import { clsx } from 'clsx';
import type { AirspaceSector } from '../types';

interface SectorMapProps {
  sectors: AirspaceSector[];
  selectedSectorId: number | null;
  onSelectSector: (sectorId: number) => void;
}

export const SectorMap: React.FC<SectorMapProps> = ({ sectors, selectedSectorId, onSelectSector }) => {
  if (sectors.length === 0) {
    return (
      <div className="rounded-2xl border border-utm-border bg-utm-card p-4">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Airspace Sectors</h3>
        <div className="flex h-64 items-center justify-center rounded-xl bg-utm-bg">
          <p className="text-sm text-utm-muted">No sectors available</p>
        </div>
      </div>
    );
  }

  // Calculate bounding box for all sectors to normalize positions
  const minLat = Math.min(...sectors.map(s => s.min_lat));
  const maxLat = Math.max(...sectors.map(s => s.max_lat));
  const minLon = Math.min(...sectors.map(s => s.min_lon));
  const maxLon = Math.max(...sectors.map(s => s.max_lon));

  const latRange = maxLat - minLat || 1;
  const lonRange = maxLon - minLon || 1;

  // Add 10% padding
  const padLat = latRange * 0.1;
  const padLon = lonRange * 0.1;

  const paddedMinLat = minLat - padLat;
  const paddedMaxLat = maxLat + padLat;
  const paddedMinLon = minLon - padLon;
  const paddedMaxLon = maxLon + padLon;

  const paddedLatRange = paddedMaxLat - paddedMinLat;
  const paddedLonRange = paddedMaxLon - paddedMinLon;

  return (
    <div className="rounded-2xl border border-utm-border bg-utm-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Airspace Sectors</h3>
        <div className="flex gap-3 text-[10px] text-slate-400">
          <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-sm bg-brand-500/20 border border-brand-500/40"></div>Available</div>
          <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-sm bg-brand-500/40 border border-brand-500"></div>Selected</div>
          {/* We don't have booked status per sector natively yet, but requested in design */}
          <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-sm bg-red-500/20 border border-red-500/40"></div>Booked</div>
        </div>
      </div>
      
      <div className="relative h-64 w-full rounded-xl bg-utm-bg overflow-hidden border border-utm-borderLight">
        {sectors.map((sector) => {
          // X goes with Longitude, Y goes with Latitude (inverted for screen coordinates)
          const left = ((sector.min_lon - paddedMinLon) / paddedLonRange) * 100;
          const width = ((sector.max_lon - sector.min_lon) / paddedLonRange) * 100;
          const bottom = ((sector.min_lat - paddedMinLat) / paddedLatRange) * 100;
          const height = ((sector.max_lat - sector.min_lat) / paddedLatRange) * 100;

          const isSelected = selectedSectorId === sector.sector_id;

          return (
            <div
              key={sector.sector_id}
              onClick={() => onSelectSector(sector.sector_id)}
              className={clsx(
                "absolute cursor-pointer flex flex-col items-center justify-center text-center transition-all duration-200 border",
                isSelected 
                  ? "bg-brand-500/40 border-brand-500 z-10 shadow-glow" 
                  : "bg-brand-500/20 border-brand-500/40 hover:bg-brand-500/30 hover:border-brand-500/60"
              )}
              style={{
                left: `${left}%`,
                bottom: `${bottom}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
            >
              <span className={clsx("text-xs font-bold", isSelected ? "text-white" : "text-brand-300")}>
                {sector.sector_name}
              </span>
              <span className="text-[10px] text-brand-400/80">
                {sector.floor_altitude_m}m - {sector.ceiling_altitude_m}m
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[10px] text-utm-muted">
        SVG map — architecture ready for Leaflet/Mapbox replacement
      </p>
    </div>
  );
};

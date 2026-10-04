import React, { useState } from 'react';
import { Plane, Radar, Plus, Loader2, AlertCircle, Battery, Mountain } from 'lucide-react';
import { clsx } from 'clsx';
import type { FleetDrone, DroneStatus } from '../types';
import { DRONE_STATUSES, extractApiError } from '../types';

interface DroneListProps {
  drones: FleetDrone[];
  token: string | null;
  onDroneUpdated: (drone: FleetDrone) => void;
}

const statusClasses: Record<DroneStatus, string> = {
  IDLE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  IN_FLIGHT: 'bg-brand-500/10 text-brand-400 border-brand-500/30',
  MAINTENANCE: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

const typeIcon = (type: FleetDrone['drone_type']) => {
  switch (type) {
    case 'FIXED_WING': return <Plane className="h-5 w-5" />;
    case 'QUADCOPTER': return <Radar className="h-5 w-5" />;
    case 'EMERGENCY_MEDICAL': return <Plus className="h-5 w-5" />;
  }
};

const subtypeSpec = (d: FleetDrone): string => {
  if (d.drone_type === 'FIXED_WING') return d.wingspan_m != null ? `Wingspan ${d.wingspan_m} m` : 'Wingspan n/a';
  if (d.drone_type === 'QUADCOPTER') return d.rotor_count != null ? `${d.rotor_count} rotors` : 'Rotors n/a';
  return d.priority_clearance_level != null ? `Clearance L${d.priority_clearance_level}` : 'Clearance n/a';
};

export const DroneList: React.FC<DroneListProps> = ({ drones, token, onDroneUpdated }) => {
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null);

  const changeStatus = async (drone: FleetDrone, next: DroneStatus) => {
    if (!token || next === drone.status) return;
    setUpdatingId(drone.drone_id);
    setRowError(null);
    try {
      const res = await fetch(`/api/drones/${drone.drone_id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractApiError(body, `Status update failed (${res.status})`));
      onDroneUpdated(body as FleetDrone);
    } catch (err) {
      setRowError({ id: drone.drone_id, message: err instanceof Error ? err.message : 'Status update failed' });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {drones.map((d) => (
        <div key={d.drone_id} className="relative flex flex-col overflow-hidden rounded-2xl border border-utm-border bg-utm-card p-5 shadow-card">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-utm-bg text-brand-400">{typeIcon(d.drone_type)}</div>
              <div>
                <div className="text-sm font-bold text-white">Drone #{d.drone_id}</div>
                <div className="text-xs text-utm-muted">{d.drone_type.replace(/_/g, ' ')}</div>
              </div>
            </div>
            <span className={clsx('rounded-md border px-2 py-1 text-[10px] font-bold', statusClasses[d.status])}>{d.status.replace('_', ' ')}</span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 text-xs text-utm-muted">
            <div className="flex items-center gap-1.5"><Battery className="h-3.5 w-3.5" />{d.battery_capacity_pct}%</div>
            <div className="flex items-center gap-1.5"><Mountain className="h-3.5 w-3.5" />{d.max_altitude_m} m max</div>
            <div className="col-span-2 text-brand-400/90">{subtypeSpec(d)}</div>
          </div>

          <div className="mt-auto flex items-center gap-2 border-t border-utm-borderLight pt-3">
            <label htmlFor={`status-${d.drone_id}`} className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Status</label>
            <select
              id={`status-${d.drone_id}`}
              value={d.status}
              disabled={updatingId === d.drone_id}
              onChange={(e) => changeStatus(d, e.target.value as DroneStatus)}
              className="flex-1 rounded-lg border border-utm-border bg-utm-bg px-2 py-1.5 text-xs text-white focus:border-brand-500 focus:outline-none disabled:opacity-50"
            >
              {DRONE_STATUSES.map((s) => (<option key={s} value={s}>{s.replace('_', ' ')}</option>))}
            </select>
            {updatingId === d.drone_id && <Loader2 className="h-4 w-4 animate-spin text-brand-500" />}
          </div>

          {rowError?.id === d.drone_id && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{rowError.message}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

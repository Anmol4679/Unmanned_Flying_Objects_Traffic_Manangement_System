import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from 'shared';
import { Boxes, Plus, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { DroneList } from './components/DroneList';
import { RegisterDroneModal } from './components/RegisterDroneModal';
import type { DroneType, FleetDrone } from './types';
import { DRONE_TYPES, extractApiError } from './types';

type TypeFilter = 'ALL' | DroneType;

export const FleetPage: React.FC = () => {
  const { token, operator } = useAuth();
  const [drones, setDrones] = useState<FleetDrone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TypeFilter>('ALL');
  const [showRegister, setShowRegister] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/drones', { headers: { Authorization: `Bearer ${token}` } });
      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractApiError(body, `Failed to load fleet (${res.status})`));
      setDrones(body as FleetDrone[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fleet');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => (filter === 'ALL' ? drones : drones.filter((d) => d.drone_type === filter)), [drones, filter]);

  const counts = useMemo(() => ({
    total: drones.length,
    idle: drones.filter((d) => d.status === 'IDLE').length,
    inFlight: drones.filter((d) => d.status === 'IN_FLIGHT').length,
    maintenance: drones.filter((d) => d.status === 'MAINTENANCE').length,
  }), [drones]);

  const upsert = (updated: FleetDrone) =>
    setDrones((prev) => {
      const exists = prev.some((d) => d.drone_id === updated.drone_id);
      const next = exists ? prev.map((d) => (d.drone_id === updated.drone_id ? updated : d)) : [...prev, updated];
      return next.sort((a, b) => a.drone_id - b.drone_id);
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-400 shadow-glow">
            <Boxes className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Fleet Management</h1>
            <p className="text-xs text-slate-400">{operator?.name ? `${operator.name} · ` : ''}Registered UAV inventory and operational status</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="rounded-xl border border-utm-border bg-utm-card p-2.5 text-utm-muted hover:text-white" aria-label="Refresh fleet">
            <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
          </button>
          <button onClick={() => setShowRegister(true)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-glow hover:opacity-90">
            <Plus className="h-4 w-4" /> Register Drone
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: counts.total, cls: 'text-white' },
          { label: 'Idle', value: counts.idle, cls: 'text-emerald-400' },
          { label: 'In Flight', value: counts.inFlight, cls: 'text-brand-400' },
          { label: 'Maintenance', value: counts.maintenance, cls: 'text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-utm-border bg-utm-card p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{s.label}</div>
            <div className={clsx('mt-1 text-2xl font-bold', s.cls)}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['ALL', ...DRONE_TYPES] as TypeFilter[]).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={clsx(
              'rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
              filter === t ? 'border-brand-500 bg-brand-500/10 text-brand-400' : 'border-utm-border text-slate-400 hover:text-white',
            )}
          >
            {t === 'ALL' ? 'All Types' : t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading && drones.length === 0 ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      ) : drones.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-utm-border bg-utm-card">
          <p className="text-sm text-utm-muted">No drones registered yet. Use “Register Drone” to add your first UAV.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-2xl border border-utm-border bg-utm-card">
          <p className="text-sm text-utm-muted">No drones match this filter.</p>
        </div>
      ) : (
        <DroneList drones={visible} token={token} onDroneUpdated={upsert} />
      )}

      {showRegister && <RegisterDroneModal token={token} onClose={() => setShowRegister(false)} onCreated={upsert} />}
    </div>
  );
};

export default FleetPage;

import React, { useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import type { DroneCreatePayload, DroneType, FleetDrone } from '../types';
import { DRONE_TYPES, extractApiError } from '../types';

interface RegisterDroneModalProps {
  token: string | null;
  onClose: () => void;
  onCreated: (drone: FleetDrone) => void;
}

const inputCls =
  'w-full rounded-xl border border-utm-border bg-utm-bg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const labelCls = 'mb-1 block text-xs font-medium text-slate-300';

export const RegisterDroneModal: React.FC<RegisterDroneModalProps> = ({ token, onClose, onCreated }) => {
  const [droneType, setDroneType] = useState<DroneType>('FIXED_WING');
  const [maxAlt, setMaxAlt] = useState('120');
  const [battery, setBattery] = useState('100');
  const [wingspan, setWingspan] = useState('');
  const [rotors, setRotors] = useState('');
  const [clearance, setClearance] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);

    const payload: DroneCreatePayload = {
      drone_type: droneType,
      max_altitude_m: Number(maxAlt),
      battery_capacity_pct: Number(battery),
      status: 'IDLE',
    };
    if (droneType === 'FIXED_WING') payload.wingspan_m = Number(wingspan);
    if (droneType === 'QUADCOPTER') payload.rotor_count = Number(rotors);
    if (droneType === 'EMERGENCY_MEDICAL') payload.priority_clearance_level = Number(clearance);

    setSubmitting(true);
    try {
      const res = await fetch('/api/drones', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body: unknown = await res.json().catch(() => ({}));
      // Server-side validation is authoritative (ranges, subtype-required fields); surface its message.
      if (!res.ok) throw new Error(extractApiError(body, `Registration failed (${res.status})`));
      onCreated(body as FleetDrone);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Register drone">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-utm-border bg-utm-surface p-6 shadow-card">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Register Drone</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-utm-card hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="drone-type" className={labelCls}>Drone Type</label>
            <select id="drone-type" value={droneType} onChange={(e) => setDroneType(e.target.value as DroneType)} className={inputCls}>
              {DRONE_TYPES.map((t) => (<option key={t} value={t}>{t.replace(/_/g, ' ')}</option>))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="max-alt" className={labelCls}>Max Altitude (m, 0–500)</label>
              <input id="max-alt" type="number" required min={0} max={500} step="any" value={maxAlt} onChange={(e) => setMaxAlt(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="battery" className={labelCls}>Battery (%, 0–100)</label>
              <input id="battery" type="number" required min={0} max={100} step="any" value={battery} onChange={(e) => setBattery(e.target.value)} className={inputCls} />
            </div>
          </div>

          {droneType === 'FIXED_WING' && (
            <div>
              <label htmlFor="wingspan" className={labelCls}>Wingspan (m)</label>
              <input id="wingspan" type="number" required min={0.01} step="any" value={wingspan} onChange={(e) => setWingspan(e.target.value)} className={inputCls} placeholder="e.g. 2.4" />
            </div>
          )}
          {droneType === 'QUADCOPTER' && (
            <div>
              <label htmlFor="rotors" className={labelCls}>Rotor Count</label>
              <input id="rotors" type="number" required min={1} step={1} value={rotors} onChange={(e) => setRotors(e.target.value)} className={inputCls} placeholder="e.g. 4" />
            </div>
          )}
          {droneType === 'EMERGENCY_MEDICAL' && (
            <div>
              <label htmlFor="clearance" className={labelCls}>Priority Clearance Level</label>
              <input id="clearance" type="number" required min={1} step={1} value={clearance} onChange={(e) => setClearance(e.target.value)} className={inputCls} placeholder="e.g. 1" />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-utm-border px-4 py-2 text-sm text-slate-300 hover:bg-utm-card">Cancel</button>
          <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-glow hover:opacity-90 disabled:opacity-50">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Register
          </button>
        </div>
      </form>
    </div>
  );
};

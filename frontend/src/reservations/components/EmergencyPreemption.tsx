import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, Zap, X, CheckCircle2 } from 'lucide-react';
import type { EmergencyPreemptionResponse } from '../types';

interface EmergencyPreemptionProps {
  token: string | null;
  userRole: string | null | undefined;
}

export const EmergencyPreemption: React.FC<EmergencyPreemptionProps> = ({ token, userRole }) => {
  const [resIdInput, setResIdInput] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmergencyPreemptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (userRole !== 'REGULATOR') {
    return null;
  }

  const handlePreempt = async () => {
    if (!token || !resIdInput) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${resIdInput}/emergency-preempt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to execute emergency preemption');
      }
      const data = await res.json();
      setResult(data);
      setShowConfirm(false);
      setResIdInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-amber-500">⚠ Emergency Corridor Pre-emption</h2>
          <p className="text-xs text-amber-500/80">Regulator Override System</p>
        </div>
      </div>

      <div className="max-w-md">
        <div className="mb-4 flex gap-3">
          <input
            type="number"
            placeholder="Reservation ID"
            value={resIdInput}
            onChange={(e) => setResIdInput(e.target.value)}
            className="flex-1 rounded-xl border border-amber-500/30 bg-utm-card px-4 py-2 text-sm text-white focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!resIdInput}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-utm-bg hover:bg-amber-400 disabled:opacity-50"
          >
            <Zap className="h-4 w-4" /> Pre-empt
          </button>
        </div>

        {showConfirm && (
          <div className="mb-4 rounded-xl border border-amber-500/50 bg-utm-bg p-4 shadow-lg">
            <h4 className="mb-2 flex items-center gap-2 font-bold text-amber-500">
              <AlertTriangle className="h-4 w-4" /> Confirm Action
            </h4>
            <p className="mb-4 text-sm text-white">
              Reservation #{resIdInput} will be elevated to CRITICAL priority. 
              All overlapping STANDARD reservations in the same sector will be DISPLACED.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg border border-slate-500 bg-transparent py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handlePreempt}
                disabled={loading}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {loading ? 'Executing...' : 'Confirm Emergency Pre-emption'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="mb-2 flex items-center gap-2 font-bold text-emerald-500">
              <CheckCircle2 className="h-5 w-5" /> Emergency Pre-emption Executed
            </div>
            <div className="text-sm text-emerald-400/90">
              <p>{result.message}</p>
              <p className="mt-1">
                Reservation <strong className="text-emerald-300">#{result.emergency_reservation_id}</strong> marked CRITICAL.
              </p>
              {result.displaced_count > 0 ? (
                <p className="mt-1 text-amber-400">
                  {result.displaced_count} reservations displaced: {result.displaced_reservation_ids.join(', ')}
                </p>
              ) : (
                <p className="mt-1 text-slate-400">No reservations needed displacement.</p>
              )}
            </div>
            <button 
              onClick={() => setResult(null)} 
              className="absolute right-4 top-4 text-emerald-500/50 hover:text-emerald-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

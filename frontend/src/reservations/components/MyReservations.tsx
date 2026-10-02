import React, { useState, useEffect } from 'react';
import { RefreshCw, X, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { Reservation } from '../types';

interface MyReservationsProps {
  token: string | null;
  refreshKey: number;
}

export const MyReservations: React.FC<MyReservationsProps> = ({ token, refreshKey }) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);

  const fetchReservations = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reservations/mine', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch reservations');
      const data = await res.json();
      // Sort newest first
      const sorted = (data || []).sort((a: Reservation, b: Reservation) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setReservations(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, [token, refreshKey, localRefresh]);

  const handleCancel = async (id: number) => {
    if (!token) return;
    setCancelingId(id);
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to cancel reservation');
      setLocalRefresh(k => k + 1);
    } catch (err) {
      console.error(err);
      alert('Error canceling reservation');
    } finally {
      setCancelingId(null);
      setConfirmCancelId(null);
    }
  };

  const formatTimeRange = (start?: string, end?: string) => {
    if (!start || !end) return 'Unknown Time';
    const dStart = new Date(start);
    const dEnd = new Date(end);
    const dateStr = dStart.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const timeStr = `${dStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${dEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return `${dateStr}, ${timeStr}`;
  };

  const getStatusClasses = (status: Reservation['status']) => {
    switch (status) {
      case 'CONFIRMED': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'CANCELLED': return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
      case 'COMPLETED': return 'bg-brand-500/10 text-brand-400 border-brand-500/30';
      case 'DISPLACED': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="rounded-2xl border border-utm-border bg-utm-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Flight Log</h3>
        <button 
          onClick={() => setLocalRefresh(k => k + 1)}
          className="rounded-lg bg-utm-bg p-2 text-utm-muted hover:text-white"
        >
          <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {loading && reservations.length === 0 ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center text-sm text-red-400">
          {error}
        </div>
      ) : reservations.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-utm-borderLight bg-utm-bg">
          <p className="text-sm text-utm-muted">No reservations found. Book your first airspace slot above.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reservations.map(res => (
            <div key={res.reservation_id} className="flex flex-col rounded-xl border border-utm-borderLight bg-utm-bg p-4 relative overflow-hidden">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <div className="text-sm font-bold text-white">{res.sector_name || `Sector #${res.slot_id}`}</div>
                  <div className="text-xs text-utm-muted">Res #{res.reservation_id} • Drone #{res.drone_id}</div>
                </div>
                {res.priority === 'CRITICAL' && (
                  <span className="animate-pulse rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400">
                    CRITICAL
                  </span>
                )}
              </div>
              
              <div className="mb-3 text-sm text-brand-100">
                {formatTimeRange(res.start_time, res.end_time)}
              </div>
              
              <div className="mt-auto flex items-center justify-between border-t border-utm-borderLight pt-3">
                <span className={clsx("rounded-md border px-2 py-1 text-[10px] font-bold", getStatusClasses(res.status))}>
                  {res.status}
                </span>
                
                {res.status === 'CONFIRMED' && (
                  confirmCancelId === res.reservation_id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-red-400">Cancel?</span>
                      <button 
                        onClick={() => handleCancel(res.reservation_id)}
                        disabled={cancelingId === res.reservation_id}
                        className="rounded bg-red-500/20 px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-500/30"
                      >
                        Yes
                      </button>
                      <button 
                        onClick={() => setConfirmCancelId(null)}
                        className="rounded bg-slate-500/20 px-2 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-500/30"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setConfirmCancelId(res.reservation_id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-400"
                      title="Cancel reservation"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )
                )}
              </div>
              
              {/* Decorative side accent */}
              <div className={clsx(
                "absolute bottom-0 left-0 top-0 w-1",
                res.status === 'CONFIRMED' ? "bg-emerald-500" : 
                res.status === 'CANCELLED' ? "bg-slate-500" :
                res.status === 'COMPLETED' ? "bg-brand-500" :
                "bg-amber-500"
              )} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Calendar, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import type { TimeSlot } from '../types';

interface AvailabilityCalendarProps {
  selectedSectorId: number | null;
  token: string | null;
  onSelectSlot: (slot: TimeSlot) => void;
  selectedSlotId: number | null;
  refreshKey: number; // increment to force refresh
}

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  selectedSectorId,
  token,
  onSelectSlot,
  selectedSlotId,
  refreshKey
}) => {
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default query window to current time + 1 hour through + 12 hours
  const resetToCurrentWindow = () => {
    const now = new Date();
    const fromTime = new Date(now.getTime());
    fromTime.setMinutes(0, 0, 0); // start of current hour
    const toTime = new Date(fromTime.getTime() + 18 * 60 * 60 * 1000); // next 18 hours

    const toDatetimeLocal = (date: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    setFromDate(toDatetimeLocal(fromTime));
    setToDate(toDatetimeLocal(toTime));
  };

  useEffect(() => {
    resetToCurrentWindow();
  }, []);

  const fetchAvailability = async () => {
    if (!selectedSectorId || !token || !fromDate || !toDate) return;
    
    setLoading(true);
    setError(null);
    try {
      const fromISO = new Date(fromDate).toISOString();
      const toISO = new Date(toDate).toISOString();
      const res = await fetch(`/api/sectors/${selectedSectorId}/availability?from=${fromISO}&to=${toISO}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch availability');
      const data = await res.json();
      setSlots(data.slots || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailability();
  }, [selectedSectorId, fromDate, toDate, token, refreshKey]);

  if (!selectedSectorId) {
    return (
      <div className="rounded-2xl border border-utm-border bg-utm-card p-6 text-center">
        <p className="text-sm text-utm-muted">Select a sector from the map above to view available airspace reservation windows.</p>
      </div>
    );
  }

  const formatTimeRange = (start: string, end: string) => {
    const dStart = new Date(start);
    const dEnd = new Date(end);
    return `${dStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${dEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };
  
  const formatDateHeader = (start: string) => {
    return new Date(start).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="rounded-2xl border border-utm-border bg-utm-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-brand-400" />
          4D Airspace Time Slots
        </h3>
        <button
          onClick={resetToCurrentWindow}
          className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 font-medium"
        >
          <Sparkles className="h-3 w-3" />
          Jump to Now
        </button>
      </div>
      
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">From</label>
          <input 
            type="datetime-local" 
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="rounded-xl border border-utm-border bg-utm-card px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">To</label>
          <input 
            type="datetime-local" 
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="rounded-xl border border-utm-border bg-utm-card px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button 
          onClick={fetchAvailability}
          disabled={loading}
          className="flex h-[38px] items-center justify-center rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 text-sm font-semibold text-white shadow-glow hover:opacity-90 disabled:opacity-50 gap-1.5"
        >
          <RefreshCw className={clsx("h-3.5 w-3.5", loading && "animate-spin")} />
          Check Slots
        </button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      ) : error ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : slots.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-36 rounded-xl border border-utm-borderLight bg-utm-bg p-4 text-center">
          <p className="text-sm text-slate-300 font-medium">No 30-minute slots found in selected range.</p>
          <p className="text-xs text-slate-500 mt-1">Click "Jump to Now" above or broaden your date range to view upcoming reservation slots.</p>
          <button
            onClick={resetToCurrentWindow}
            className="mt-3 rounded-lg bg-brand-500/10 border border-brand-500/30 px-3 py-1.5 text-xs text-brand-400 hover:bg-brand-500/20"
          >
            Show Today's Available Slots
          </button>
        </div>
      ) : (
        <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
          {slots.map(slot => {
            const isSelected = selectedSlotId === slot.slot_id;
            const isBooked = slot.is_booked;

            return (
              <button
                key={slot.slot_id}
                disabled={isBooked}
                onClick={() => onSelectSlot(slot)}
                className={clsx(
                  "flex flex-col items-center justify-center rounded-lg border p-2 text-xs transition-all",
                  isBooked && "cursor-not-allowed border-red-500/30 bg-red-500/10 text-red-400 opacity-60",
                  isSelected && !isBooked && "border-brand-500 bg-brand-500/20 text-brand-300 shadow-glow",
                  !isSelected && !isBooked && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/20"
                )}
              >
                <span className="mb-1 text-[10px] opacity-80">{formatDateHeader(slot.start_time)}</span>
                <span className="font-semibold">{formatTimeRange(slot.start_time, slot.end_time)}</span>
                <span className={clsx("mt-1 text-[9px] font-bold", isBooked ? "text-red-400" : "text-emerald-400")}>
                  {isBooked ? "BOOKED" : "AVAILABLE"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

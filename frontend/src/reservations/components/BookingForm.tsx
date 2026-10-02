import React, { useState, useEffect } from 'react';
import { Plane, Radar, Plus, ArrowRight, Loader2, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from 'shared';
import type { TimeSlot, AirspaceSector, Drone } from '../types';

interface BookingFormProps {
  selectedSlot: TimeSlot | null;
  selectedSector: AirspaceSector | null;
  token: string | null;
  onBookingSuccess: () => void;
  onConflict: () => void;
}

export const BookingForm: React.FC<BookingFormProps> = ({
  selectedSlot,
  selectedSector,
  token,
  onBookingSuccess,
  onConflict
}) => {
  const { user } = useAuth();
  const [drones, setDrones] = useState<Drone[]>([]);
  const [selectedDroneId, setSelectedDroneId] = useState<number | null>(null);
  const [priority, setPriority] = useState<'STANDARD' | 'CRITICAL'>('STANDARD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch('/api/drones', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setDrones)
      .catch(console.error);
  }, [token]);

  // Reset form when slot changes
  useEffect(() => {
    setError(null);
    setConflict(false);
    setSuccess(false);
  }, [selectedSlot]);

  if (!selectedSlot || !selectedSector) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border border-utm-border bg-utm-card p-6 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-utm-bg text-brand-500">
          <Plane className="h-6 w-6" />
        </div>
        <h3 className="mb-2 text-sm font-semibold text-white">No Slot Selected</h3>
        <p className="text-xs text-utm-muted">Select an available time slot to begin booking</p>
      </div>
    );
  }

  const formatTimeRange = (start: string, end: string) => {
    const dStart = new Date(start);
    const dEnd = new Date(end);
    return `${dStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${dEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };
  
  const formatDate = (start: string) => {
    return new Date(start).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDroneIcon = (type: Drone['drone_type']) => {
    switch(type) {
      case 'FIXED_WING': return <Plane className="h-5 w-5" />;
      case 'QUADCOPTER': return <Radar className="h-5 w-5" />;
      case 'EMERGENCY_MEDICAL': return <Plus className="h-5 w-5" />;
    }
  };

  const handleBook = async () => {
    if (!selectedDroneId || !token) return;
    
    setLoading(true);
    setError(null);
    setConflict(false);
    
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          slot_id: selectedSlot.slot_id,
          drone_id: selectedDroneId,
          priority
        })
      });

      if (res.status === 409) {
        setConflict(true);
        onConflict();
        return;
      }
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to book slot');
      }

      setSuccess(true);
      onBookingSuccess();
      setSelectedDroneId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const isDispatcher = user?.role === 'DISPATCHER';

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-utm-border bg-utm-card p-6">
      <div>
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Selected Slot</h3>
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-4">
          <div className="mb-2 text-sm font-bold text-brand-300">{selectedSector.sector_name}</div>
          <div className="mb-1 text-sm text-white">{formatDate(selectedSlot.start_time)}</div>
          <div className="mb-2 text-lg font-bold text-white">{formatTimeRange(selectedSlot.start_time, selectedSlot.end_time)}</div>
          <div className="text-xs text-brand-400/80">Altitude: {selectedSector.floor_altitude_m}m - {selectedSector.ceiling_altitude_m}m</div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Select Drone</h3>
        <div className="space-y-3">
          {drones.length === 0 ? (
            <div className="rounded-xl border border-utm-borderLight bg-utm-bg p-3 text-center text-xs text-utm-muted">
              No drones available
            </div>
          ) : (
            drones.map(drone => {
              const isIdle = drone.status === 'IDLE';
              const isSelected = selectedDroneId === drone.drone_id;
              
              return (
                <label 
                  key={drone.drone_id} 
                  className={clsx(
                    "flex cursor-pointer items-center gap-4 rounded-xl border p-3 transition-all",
                    !isIdle && "cursor-not-allowed border-utm-borderLight bg-utm-bg/50 opacity-60",
                    isIdle && !isSelected && "border-utm-borderLight bg-utm-bg hover:border-brand-500/50 hover:bg-brand-500/5",
                    isIdle && isSelected && "border-brand-500 bg-brand-500/10 shadow-glow"
                  )}
                >
                  <input 
                    type="radio" 
                    name="drone" 
                    value={drone.drone_id} 
                    disabled={!isIdle}
                    checked={isSelected}
                    onChange={() => setSelectedDroneId(drone.drone_id)}
                    className="hidden" 
                  />
                  <div className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", isSelected ? "bg-brand-500 text-white" : "bg-utm-card text-utm-muted")}>
                    {getDroneIcon(drone.drone_type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">ID: {drone.drone_id}</span>
                      <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-md", isIdle ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400")}>
                        {drone.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-utm-muted">
                      <span>{drone.drone_type.replace('_', ' ')}</span>
                      <span>{drone.battery_capacity_pct}% 🔋</span>
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>
      </div>

      {isDispatcher && (
        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Flight Priority</h3>
          <div className="flex gap-4">
            <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-utm-borderLight bg-utm-bg p-3">
              <input 
                type="radio" 
                name="priority" 
                value="STANDARD" 
                checked={priority === 'STANDARD'}
                onChange={() => setPriority('STANDARD')}
                className="text-brand-500 focus:ring-brand-500"
              />
              <span className="text-sm text-white">Standard</span>
            </label>
            <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
              <input 
                type="radio" 
                name="priority" 
                value="CRITICAL" 
                checked={priority === 'CRITICAL'}
                onChange={() => setPriority('CRITICAL')}
                className="text-red-500 focus:ring-red-500"
              />
              <span className="text-sm font-semibold text-red-400">Critical <Zap className="inline h-3 w-3" /></span>
            </label>
          </div>
        </div>
      )}

      {conflict && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <h4 className="text-sm font-bold text-amber-500">Slot Conflict</h4>
            <p className="text-xs text-amber-400/80">This slot was just taken by another operator. Please select another available time slot.</p>
          </div>
        </div>
      )}
      
      {error && !conflict && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          <p className="text-sm text-emerald-400">Slot booked successfully!</p>
        </div>
      )}

      <button
        onClick={handleBook}
        disabled={!selectedDroneId || loading || conflict}
        className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-sm font-semibold text-white shadow-glow transition-all hover:opacity-90 disabled:opacity-50 disabled:shadow-none"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <>
            Book Slot <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
};

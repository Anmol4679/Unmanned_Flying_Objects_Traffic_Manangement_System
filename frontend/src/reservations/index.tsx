import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from 'shared';
import { SectorMap } from './components/SectorMap';
import { AvailabilityCalendar } from './components/AvailabilityCalendar';
import { BookingForm } from './components/BookingForm';
import { MyReservations } from './components/MyReservations';
import { EmergencyPreemption } from './components/EmergencyPreemption';
import type { AirspaceSector, TimeSlot } from './types';
import { CalendarCheck } from 'lucide-react';

export const ReservationsPage: React.FC = () => {
  const { token, user, operator } = useAuth();
  
  const [sectors, setSectors] = useState<AirspaceSector[]>([]);
  const [selectedSectorId, setSelectedSectorId] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState(0);

  const selectedSector = sectors.find(s => s.sector_id === selectedSectorId) ?? null;

  useEffect(() => {
    if (!token) return;
    fetch('/api/sectors', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setSectors)
      .catch(console.error);
  }, [token]);

  const handleBookingSuccess = useCallback(() => {
    setSelectedSlot(null);
    setRefreshKey(k => k + 1);
    setAvailabilityRefreshKey(k => k + 1);
  }, []);

  const handleConflict = useCallback(() => {
    setSelectedSlot(null);
    setAvailabilityRefreshKey(k => k + 1);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-400 shadow-glow">
            <CalendarCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Airspace Reservation</h1>
            <p className="text-xs text-slate-400">Conflict-free 4D flight slot booking · Sector · Time · Altitude</p>
          </div>
        </div>
        
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-slate-400">Operator:</span>
          <span className="text-xs font-semibold text-white">{operator?.name || 'Unknown Operator'}</span>
          <span className="rounded-md border bg-brand-500/10 text-brand-400 border-brand-500/30 px-2 py-0.5 text-[10px] font-bold">
            {user?.role || 'UNKNOWN ROLE'}
          </span>
        </div>
      </div>
      
      {/* Main booking interface */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Sector Map + Availability */}
        <div className="space-y-6 lg:col-span-2">
          <SectorMap
            sectors={sectors}
            selectedSectorId={selectedSectorId}
            onSelectSector={(id) => { setSelectedSectorId(id); setSelectedSlot(null); }}
          />
          <AvailabilityCalendar
            selectedSectorId={selectedSectorId}
            token={token}
            onSelectSlot={setSelectedSlot}
            selectedSlotId={selectedSlot?.slot_id ?? null}
            refreshKey={availabilityRefreshKey}
          />
        </div>
        
        {/* Right: Booking Form */}
        <div className="lg:col-span-1">
          <BookingForm
            selectedSlot={selectedSlot}
            selectedSector={selectedSector}
            token={token}
            onBookingSuccess={handleBookingSuccess}
            onConflict={handleConflict}
          />
        </div>
      </div>
      
      {/* My Reservations */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">My Reservations</h2>
        <MyReservations token={token} refreshKey={refreshKey} />
      </div>
      
      {/* Emergency Pre-emption (Regulator only) */}
      <EmergencyPreemption token={token} userRole={user?.role} />
    </div>
  );
};

export default ReservationsPage;

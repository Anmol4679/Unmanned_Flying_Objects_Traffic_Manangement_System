import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  User,
  Shield,
  Plane,
  Radar,
  CalendarCheck,
  ShieldAlert,
  BatteryCharging,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  Clock,
  Radio,
  FileBadge,
} from "lucide-react";

interface OperatorProfile {
  operator_id: number;
  name: string;
  license_no: string;
  role: "FLEET_OPERATOR" | "REGULATOR" | "DISPATCHER";
  is_suspended?: boolean;
}

interface DroneSummary {
  drone_id: number;
  operator_id: number;
  drone_type: string;
  max_altitude_m: number;
  battery_capacity_pct: number;
  status: "IDLE" | "IN_FLIGHT" | "MAINTENANCE";
}

interface OperatorSummary {
  operator_id: number;
  name: string;
  license_no: string;
  role: string;
  is_suspended?: boolean;
}

export const DashboardPage: React.FC = () => {
  const { token } = useAuth();
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [drones, setDrones] = useState<DroneSummary[]>([]);
  const [operators, setOperators] = useState<OperatorSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      // 1. All roles: load profile
      const profRes = await fetch("/api/operators/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!profRes.ok) throw new Error("Failed to load operator profile");
      const profData: OperatorProfile = await profRes.json();
      setProfile(profData);

      // 2. Role-specific data
      if (profData.role === "FLEET_OPERATOR") {
        const droneRes = await fetch("/api/drones", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (droneRes.ok) {
          const droneData: DroneSummary[] = await droneRes.json();
          setDrones(droneData);
        }
      } else if (profData.role === "REGULATOR") {
        const opRes = await fetch("/api/operators", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (opRes.ok) {
          const opData: OperatorSummary[] = await opRes.json();
          setOperators(opData);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  // Calculations for FLEET_OPERATOR
  const totalDrones = drones.length;
  const idleDrones = drones.filter((d) => d.status === "IDLE").length;
  const inFlightDrones = drones.filter((d) => d.status === "IN_FLIGHT").length;
  const maintenanceDrones = drones.filter((d) => d.status === "MAINTENANCE").length;
  const avgBattery =
    totalDrones > 0
      ? Math.round(
          drones.reduce((acc, curr) => acc + Number(curr.battery_capacity_pct), 0) /
            totalDrones
        )
      : 0;

  // Calculations for REGULATOR
  const totalOps = operators.length;
  const suspendedOps = operators.filter((o) => o.is_suspended).length;
  const activeOps = totalOps - suspendedOps;

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-utm-card" />
          <div className="h-8 w-24 animate-pulse rounded-lg bg-utm-card" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-utm-border bg-utm-card"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl border border-utm-border bg-utm-card" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center"
      >
        <AlertCircle className="h-10 w-10 text-red-400" />
        <h2 className="mt-3 text-base font-bold text-white">Error Loading Dashboard</h2>
        <p className="mt-1 text-xs text-red-300">{error}</p>
        <button
          onClick={() => void loadDashboardData()}
          className="mt-4 flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-utm-bg"
          aria-label="Retry loading dashboard data"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Operational Dashboard
          </h1>
          <p className="text-xs text-slate-400">
            Real-time status overview, fleet telemetry metrics, and airspace control access
          </p>
        </div>
        <button
          onClick={() => void loadDashboardData()}
          className="inline-flex items-center gap-2 rounded-xl border border-utm-border bg-utm-card px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-utm-cardHover hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          aria-label="Refresh operational dashboard"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Operator Identity Profile Card */}
      {profile && (
        <div className="relative overflow-hidden rounded-2xl border border-utm-border bg-gradient-to-r from-utm-card to-utm-surface p-5 shadow-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/30">
                <User className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{profile.name}</h2>
                  <span className="rounded-md border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-400">
                    {profile.role}
                  </span>
                  {profile.is_suspended ? (
                    <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400">
                      SUSPENDED
                    </span>
                  ) : (
                    <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                      ACTIVE LICENSE
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <FileBadge className="h-3.5 w-3.5 text-brand-400" />
                  <span>License No: {profile.license_no}</span>
                  <span className="text-slate-600">·</span>
                  <span>ID: #{profile.operator_id}</span>
                </div>
              </div>
            </div>
            {profile.is_suspended && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                <div className="font-semibold text-red-200">Regulatory Action Notice</div>
                Your operator authority has been temporarily suspended by the Regulator.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Role-Specific Metric Cards */}
      {profile?.role === "FLEET_OPERATOR" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-utm-border bg-utm-card p-4 shadow-card">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  Total Fleet
                </span>
                <Plane className="h-4 w-4 text-brand-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-white">{totalDrones}</div>
              <p className="mt-1 text-[11px] text-slate-400">Registered UAVs</p>
            </div>

            <div className="rounded-2xl border border-utm-border bg-utm-card p-4 shadow-card">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  Active in Flight
                </span>
                <Radio className="h-4 w-4 text-brand-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-brand-400">{inFlightDrones}</div>
              <p className="mt-1 text-[11px] text-slate-400">Streaming live GPS</p>
            </div>

            <div className="rounded-2xl border border-utm-border bg-utm-card p-4 shadow-card">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  Standby / Idle
                </span>
                <Clock className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-400">{idleDrones}</div>
              <p className="mt-1 text-[11px] text-slate-400">Available for booking</p>
            </div>

            <div className="rounded-2xl border border-utm-border bg-utm-card p-4 shadow-card">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  Average Battery
                </span>
                <BatteryCharging className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-cyan-400">{avgBattery}%</div>
              <p className="mt-1 text-[11px] text-slate-400">Fleet charge readiness</p>
            </div>
          </div>

          {/* Empty State for New Operator */}
          {totalDrones === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-utm-border bg-utm-surface/50 p-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/20">
                <Plane className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-base font-bold text-white">No Drones in Fleet</h3>
              <p className="mt-1 max-w-sm text-xs text-slate-400">
                You haven&apos;t registered any aircraft yet. Register your Fixed-Wing, Quadcopter,
                or Emergency Medical UAV to begin 4D slot reservations.
              </p>
              <Link
                to="/fleet"
                className="mt-5 flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 px-4 py-2.5 text-xs font-semibold text-white shadow-glow transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <PlusCircle className="h-4 w-4" /> Go to Fleet Management
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-utm-border bg-utm-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Fleet Readiness Status</h3>
                <Link
                  to="/fleet"
                  className="flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-300"
                >
                  Manage Fleet <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-utm-border bg-utm-bg p-3">
                  <div className="text-[11px] text-slate-400">Ready for Slots</div>
                  <div className="mt-1 text-lg font-bold text-emerald-400">
                    {idleDrones} UAVs Available
                  </div>
                </div>
                <div className="rounded-xl border border-utm-border bg-utm-bg p-3">
                  <div className="text-[11px] text-slate-400">In Maintenance</div>
                  <div className="mt-1 text-lg font-bold text-amber-400">
                    {maintenanceDrones} UAVs Grounded
                  </div>
                </div>
                <div className="rounded-xl border border-utm-border bg-utm-bg p-3">
                  <div className="text-[11px] text-slate-400">Airborne</div>
                  <div className="mt-1 text-lg font-bold text-brand-400">
                    {inFlightDrones} UAVs Active
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {profile?.role === "REGULATOR" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-utm-border bg-utm-card p-4 shadow-card">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                Total Operators
              </span>
              <Shield className="h-4 w-4 text-purple-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-white">{totalOps}</div>
            <p className="mt-1 text-[11px] text-slate-400">Registered commercial licenses</p>
          </div>

          <div className="rounded-2xl border border-utm-border bg-utm-card p-4 shadow-card">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                Active Operators
              </span>
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-400">{activeOps}</div>
            <p className="mt-1 text-[11px] text-slate-400">Fully compliant authority</p>
          </div>

          <div className="rounded-2xl border border-utm-border bg-utm-card p-4 shadow-card">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider">
                Suspended Licenses
              </span>
              <ShieldAlert className="h-4 w-4 text-red-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-red-400">{suspendedOps}</div>
            <p className="mt-1 text-[11px] text-slate-400">Enforcement restrictions active</p>
          </div>
        </div>
      )}

      {/* Cross-Slice Quick Action Cards */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
          Integrated Airspace Operations
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Shravan's Booking Engine */}
          <Link
            to="/reservations"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-utm-border bg-utm-card p-5 transition hover:border-brand-500/50 hover:bg-utm-cardHover"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <h4 className="mt-3 text-base font-bold text-white group-hover:text-brand-300">
                4D Airspace Slot Reservations
              </h4>
              <p className="mt-1 text-xs text-slate-400">
                Book conflict-free 4D spatial and temporal corridor slots with pessimistic row-locking.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-brand-400">
              Launch Reservation Portal <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Shlok's Telemetry Radar */}
          <Link
            to="/telemetry"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-utm-border bg-utm-card p-5 transition hover:border-cyan-500/50 hover:bg-utm-cardHover"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                <Radar className="h-5 w-5" />
              </div>
              <h4 className="mt-3 text-base font-bold text-white group-hover:text-cyan-300">
                Tactical Radar & Telemetry HUD
              </h4>
              <p className="mt-1 text-xs text-slate-400">
                Stream real-time WebSocket GPS coordinates, altitude breaches, and simulated obstacles.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
              Open Tactical Radar <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { X, Loader2, AlertCircle, Edit3 } from "lucide-react";
import type { FleetDrone } from "../types";
import { extractApiError } from "../types";

interface EditDroneModalProps {
  drone: FleetDrone;
  token: string | null;
  onClose: () => void;
  onUpdated: (drone: FleetDrone) => void;
}

const inputCls =
  "w-full rounded-xl border border-utm-border bg-utm-bg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelCls = "mb-1 block text-xs font-medium text-slate-300";

export const EditDroneModal: React.FC<EditDroneModalProps> = ({
  drone,
  token,
  onClose,
  onUpdated,
}) => {
  const [maxAlt, setMaxAlt] = useState(String(drone.max_altitude_m));
  const [battery, setBattery] = useState(String(drone.battery_capacity_pct));
  const [wingspan, setWingspan] = useState(
    drone.wingspan_m != null ? String(drone.wingspan_m) : ""
  );
  const [rotors, setRotors] = useState(
    drone.rotor_count != null ? String(drone.rotor_count) : ""
  );
  const [clearance, setClearance] = useState(
    drone.priority_clearance_level != null
      ? String(drone.priority_clearance_level)
      : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keyboard accessibility: Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);

    const payload: Record<string, unknown> = {
      max_altitude_m: Number(maxAlt),
      battery_capacity_pct: Number(battery),
    };

    if (drone.drone_type === "FIXED_WING" && wingspan) {
      payload.wingspan_m = Number(wingspan);
    } else if (drone.drone_type === "QUADCOPTER" && rotors) {
      payload.rotor_count = Number(rotors);
    } else if (drone.drone_type === "EMERGENCY_MEDICAL" && clearance) {
      payload.priority_clearance_level = Number(clearance);
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/drones/${drone.drone_id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(extractApiError(body, `Drone update failed (${res.status})`));
      }

      onUpdated(body as FleetDrone);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update drone");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-drone-title"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-utm-border bg-utm-surface p-6 shadow-card"
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="edit-drone-title" className="text-lg font-bold text-white">
                Edit Drone #{drone.drone_id}
              </h2>
              <p className="text-xs text-slate-400">Update aircraft flight specs</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-utm-card hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Close edit drone modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Drone Type is immutable */}
          <div>
            <label className={labelCls}>Drone Type (Immutable)</label>
            <div className="flex items-center gap-2 rounded-xl border border-utm-border bg-utm-bg/50 px-3 py-2 text-xs font-semibold text-slate-300">
              <span className="font-mono text-brand-400">
                {drone.drone_type.replace(/_/g, " ")}
              </span>
              <span className="ml-auto text-[10px] text-slate-500 uppercase tracking-wider">
                Read-only
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-max-alt" className={labelCls}>
                Max Altitude (m, 0–500)
              </label>
              <input
                id="edit-max-alt"
                type="number"
                required
                min={0}
                max={500}
                step="any"
                value={maxAlt}
                onChange={(e) => setMaxAlt(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="edit-battery" className={labelCls}>
                Battery (%, 0–100)
              </label>
              <input
                id="edit-battery"
                type="number"
                required
                min={0}
                max={100}
                step="any"
                value={battery}
                onChange={(e) => setBattery(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {drone.drone_type === "FIXED_WING" && (
            <div>
              <label htmlFor="edit-wingspan" className={labelCls}>
                Wingspan (m)
              </label>
              <input
                id="edit-wingspan"
                type="number"
                required
                min={0.01}
                step="any"
                value={wingspan}
                onChange={(e) => setWingspan(e.target.value)}
                className={inputCls}
                placeholder="e.g. 2.4"
              />
            </div>
          )}

          {drone.drone_type === "QUADCOPTER" && (
            <div>
              <label htmlFor="edit-rotors" className={labelCls}>
                Rotor Count
              </label>
              <input
                id="edit-rotors"
                type="number"
                required
                min={1}
                step={1}
                value={rotors}
                onChange={(e) => setRotors(e.target.value)}
                className={inputCls}
                placeholder="e.g. 4"
              />
            </div>
          )}

          {drone.drone_type === "EMERGENCY_MEDICAL" && (
            <div>
              <label htmlFor="edit-clearance" className={labelCls}>
                Priority Clearance Level
              </label>
              <input
                id="edit-clearance"
                type="number"
                required
                min={1}
                max={10}
                step={1}
                value={clearance}
                onChange={(e) => setClearance(e.target.value)}
                className={inputCls}
                placeholder="e.g. 1 (Highest)"
              />
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-utm-border px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-utm-card focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-cyan-500 px-5 py-2 text-xs font-semibold text-white shadow-glow transition hover:opacity-90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

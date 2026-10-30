import React from "react";
import type { TelemetryAlert } from "../types";
import { AlertOctagon, AlertTriangle, ShieldAlert, BatteryWarning, X, Volume2, VolumeX, Flame } from "lucide-react";

interface AlertsBannerProps {
  alerts: TelemetryAlert[];
  onDismiss: (id: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const AlertsBanner: React.FC<AlertsBannerProps> = ({
  alerts,
  onDismiss,
  isMuted,
  onToggleMute,
}) => {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 animate-bounce text-red-500" />
          Active Airspace Threat & Defense Alarms ({alerts.length})
        </span>
        <button
          onClick={onToggleMute}
          className="flex items-center gap-1.5 rounded-lg border border-utm-border bg-utm-surface px-2.5 py-1 text-[11px] text-slate-300 hover:text-white transition-colors"
          title={isMuted ? "Unmute Tactical Sirens" : "Mute Sirens"}
        >
          {isMuted ? (
            <>
              <VolumeX className="h-3.5 w-3.5 text-amber-400" />
              <span>Alarm Muted</span>
            </>
          ) : (
            <>
              <Volume2 className="h-3.5 w-3.5 text-red-400 animate-pulse" />
              <span className="text-red-400 font-semibold">Alarm Audio Active</span>
            </>
          )}
        </button>
      </div>

      {alerts.map((alert) => {
        const isRestricted = alert.type === "RESTRICTED_ZONE_INTRUSION";
        const isBatteryStation = alert.type === "BATTERY_STATION_CRITICAL";
        const isCritical = alert.severity === "CRITICAL" || isRestricted || isBatteryStation;

        return (
          <div
            key={alert.id}
            className={`relative overflow-hidden flex items-center justify-between rounded-xl border p-3.5 text-xs transition-all ${
              isRestricted
                ? "border-red-600 bg-gradient-to-r from-red-950/90 via-red-900/60 to-red-950/90 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] animate-pulse"
                : isBatteryStation
                ? "border-amber-500 bg-gradient-to-r from-amber-950/80 via-orange-950/60 to-amber-950/80 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.4)]"
                : isCritical
                ? "border-red-500/60 bg-red-500/15 text-red-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-300"
            }`}
          >
            {/* Warning Flasher Stripe for Restricted Zone Intrusion */}
            {isRestricted && (
              <div className="absolute inset-y-0 left-0 w-2 bg-red-500 animate-ping" />
            )}

            <div className="flex items-center gap-3">
              {isRestricted ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white shadow-lg shrink-0 animate-bounce">
                  <AlertOctagon className="h-5 w-5" />
                </div>
              ) : isBatteryStation ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                  <BatteryWarning className="h-5 w-5" />
                </div>
              ) : alert.type === "GEOFENCE_BREACH" ? (
                <ShieldAlert className="h-5 w-5 shrink-0 text-red-400" />
              ) : alert.type === "LOW_BATTERY" ? (
                <BatteryWarning className="h-5 w-5 shrink-0 text-amber-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
              )}

              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-[10px] font-black px-1.5 py-0.5 rounded ${
                    isRestricted ? "bg-red-600 text-white" : isBatteryStation ? "bg-amber-500/30 text-amber-300" : "bg-white/10 text-slate-300"
                  }`}>
                    {alert.type}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="mt-1 font-semibold tracking-wide">
                  {alert.message}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onDismiss(alert.id)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                title="Acknowledge Alert"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

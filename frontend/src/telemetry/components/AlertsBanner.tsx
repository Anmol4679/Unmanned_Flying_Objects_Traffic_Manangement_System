import React from "react";
import type { TelemetryAlert } from "../types";
import { AlertTriangle, ShieldAlert, BatteryWarning, X } from "lucide-react";

interface AlertsBannerProps {
  alerts: TelemetryAlert[];
  onDismiss: (id: string) => void;
}

export const AlertsBanner: React.FC<AlertsBannerProps> = ({ alerts, onDismiss }) => {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const isCritical = alert.severity === "CRITICAL";
        return (
          <div
            key={alert.id}
            className={`flex items-center justify-between rounded-xl border p-3 text-xs transition-all animate-pulse ${
              isCritical
                ? "border-red-500/40 bg-red-500/10 text-red-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {alert.type === "GEOFENCE_BREACH" ? (
                <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
              ) : alert.type === "LOW_BATTERY" ? (
                <BatteryWarning className="h-4 w-4 shrink-0 text-amber-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              )}
              <div>
                <span className="font-bold mr-1.5 font-mono">[{alert.type}]</span>
                <span>{alert.message}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] opacity-75 font-mono">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </span>
              <button
                onClick={() => onDismiss(alert.id)}
                className="rounded p-1 hover:bg-white/10"
                title="Dismiss Alert"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};


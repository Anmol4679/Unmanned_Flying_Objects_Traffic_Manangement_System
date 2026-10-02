import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { OperatorRole } from "../types/auth";

interface Forbidden403Props {
  requiredRoles?: OperatorRole[];
}

export const Forbidden403: React.FC<Forbidden403Props> = ({ requiredRoles }) => {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 ring-1 ring-red-500/30 shadow-lg shadow-red-500/10">
        <ShieldAlert className="h-10 w-10 animate-pulse" />
      </div>

      <span className="mb-2 rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-red-400 ring-1 ring-red-500/20">
        403 Forbidden
      </span>

      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
        Restricted Airspace / Access Denied
      </h1>

      <p className="mt-3 max-w-md text-sm text-slate-400">
        Your current operator role does not have authorization to view this
        module. This clearance level is restricted by traffic management policy.
      </p>

      {/* Role details box */}
      <div className="mt-6 flex flex-col gap-2 rounded-xl bg-utm-card p-4 text-xs ring-1 ring-utm-border">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Your Current Role:</span>
          <span className="font-mono font-semibold text-brand-400">
            {user?.role ?? "UNAUTHORIZED"}
          </span>
        </div>
        {requiredRoles && requiredRoles.length > 0 && (
          <div className="flex items-center justify-between gap-4 border-t border-utm-border pt-2">
            <span className="text-slate-400">Required Role(s):</span>
            <span className="font-mono font-semibold text-emerald-400">
              {requiredRoles.join(" or ")}
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 rounded-lg border border-utm-border bg-utm-surface px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-utm-card hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Switch Operator
        </button>
      </div>
    </div>
  );
};

import React, { useState } from "react";
import type { OperatorItem } from "../types";
import {
  Search,
  ShieldAlert,
  UserX,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileBadge,
} from "lucide-react";

interface OperatorTableProps {
  operators: OperatorItem[];
  token: string | null;
  onOperatorSuspended: () => void;
}

export const OperatorTable: React.FC<OperatorTableProps> = ({
  operators,
  token,
  onOperatorSuspended,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [suspendingOp, setSuspendingOp] = useState<OperatorItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredOperators = operators.filter((op) => {
    const matchesSearch =
      op.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.license_no.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === "ALL" || op.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const handleConfirmSuspend = async () => {
    if (!suspendingOp || !token) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/operators/${suspendingOp.operator_id}/suspend`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to suspend operator");
      }

      setSuccess(`Operator ${suspendingOp.name} (${suspendingOp.license_no}) has been suspended.`);
      setSuspendingOp(null);
      onOperatorSuspended();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "REGULATOR":
        return "border-purple-500/30 bg-purple-500/10 text-purple-400";
      case "FLEET_OPERATOR":
        return "border-brand-500/30 bg-brand-500/10 text-brand-400";
      case "DISPATCHER":
        return "border-amber-500/30 bg-amber-500/10 text-amber-400";
      default:
        return "border-slate-500/30 bg-slate-500/10 text-slate-400";
    }
  };

  return (
    <div className="space-y-4">
      {/* Alert notifications */}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by license number or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-utm-border bg-utm-card py-2 pl-10 pr-4 text-xs text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Filter Role:</span>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="rounded-xl border border-utm-border bg-utm-card px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
          >
            <option value="ALL">All Roles</option>
            <option value="FLEET_OPERATOR">Fleet Operators</option>
            <option value="REGULATOR">Regulators</option>
            <option value="DISPATCHER">Dispatchers</option>
          </select>
        </div>
      </div>

      {/* Operators Table */}
      <div className="overflow-hidden rounded-2xl border border-utm-border bg-utm-surface shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-utm-border bg-utm-card text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">ID</th>
                <th className="px-5 py-3.5">Operator Name</th>
                <th className="px-5 py-3.5">License Number</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-utm-border/60">
              {filteredOperators.length > 0 ? (
                filteredOperators.map((op) => (
                  <tr key={op.operator_id} className="transition hover:bg-utm-cardHover/50">
                    <td className="px-5 py-4 font-mono font-bold text-slate-300">
                      #{op.operator_id}
                    </td>
                    <td className="px-5 py-4 font-medium text-white">
                      {op.name}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-300">
                      <span className="inline-flex items-center gap-1.5">
                        <FileBadge className="h-3.5 w-3.5 text-brand-400" />
                        {op.license_no}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${getRoleBadge(op.role)}`}>
                        {op.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {op.role !== "REGULATOR" ? (
                        <button
                          onClick={() => setSuspendingOp(op)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-400 transition hover:bg-red-500/20"
                        >
                          <UserX className="h-3.5 w-3.5" />
                          Suspend
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-mono">Protected</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No operators found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suspension Confirmation Modal */}
      {suspendingOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-utm-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Regulatory Suspension</h3>
                <p className="text-xs text-slate-400">Civil Aviation Authority Enforcement</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to suspend operator <strong className="text-white">{suspendingOp.name}</strong> (License:{" "}
              <code className="text-brand-400">{suspendingOp.license_no}</code>)?
              An immutable entry will be written to the regulatory audit log.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setSuspendingOp(null)}
                className="rounded-xl border border-utm-border px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-utm-card"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSuspend}
                className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Enforcing Suspension...
                  </>
                ) : (
                  <>
                    <UserX className="h-3.5 w-3.5" />
                    Confirm Suspension
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


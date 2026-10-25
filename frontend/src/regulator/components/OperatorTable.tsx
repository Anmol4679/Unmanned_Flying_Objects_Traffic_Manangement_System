import React, { useState, useMemo, useEffect } from "react";
import type { OperatorItem } from "../types";
import {
  Search,
  ShieldAlert,
  UserX,
  UserCheck,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileBadge,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

interface OperatorTableProps {
  operators: OperatorItem[];
  token: string | null;
  onOperatorSuspended: () => void;
}

type SortField = "operator_id" | "name" | "license_no" | "role" | "status";
type SortDirection = "asc" | "desc";

export const OperatorTable: React.FC<OperatorTableProps> = ({
  operators,
  token,
  onOperatorSuspended,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | "ACTIVE" | "SUSPENDED">("ALL");
  const [sortField, setSortField] = useState<SortField>("operator_id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [actionOp, setActionOp] = useState<OperatorItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Keyboard accessibility: Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActionOp(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const processedOperators = useMemo(() => {
    return operators
      .filter((op) => {
        const matchesSearch =
          op.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          op.license_no.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = selectedRole === "ALL" || op.role === selectedRole;
        const matchesStatus =
          selectedStatus === "ALL" ||
          (selectedStatus === "SUSPENDED" ? !!op.is_suspended : !op.is_suspended);
        return matchesSearch && matchesRole && matchesStatus;
      })
      .sort((a, b) => {
        let valA: string | number = "";
        let valB: string | number = "";

        if (sortField === "operator_id") {
          valA = a.operator_id;
          valB = b.operator_id;
        } else if (sortField === "name") {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        } else if (sortField === "license_no") {
          valA = a.license_no.toLowerCase();
          valB = b.license_no.toLowerCase();
        } else if (sortField === "role") {
          valA = a.role;
          valB = b.role;
        } else if (sortField === "status") {
          valA = a.is_suspended ? 1 : 0;
          valB = b.is_suspended ? 1 : 0;
        }

        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [operators, searchTerm, selectedRole, selectedStatus, sortField, sortDirection]);

  const handleConfirmAction = async () => {
    if (!actionOp || !token) return;
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const isCurrentlySuspended = !!actionOp.is_suspended;
    const actionVerb = isCurrentlySuspended ? "reinstated" : "suspended";

    try {
      const res = await fetch(`/api/operators/${actionOp.operator_id}/suspend`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to ${actionVerb} operator`);
      }

      setSuccess(`Operator ${actionOp.name} (${actionOp.license_no}) has been ${actionVerb}.`);
      setActionOp(null);
      onOperatorSuspended();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
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

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-40 group-hover:opacity-100" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 text-brand-400" />
    ) : (
      <ArrowDown className="h-3 w-3 text-brand-400" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Alert notifications */}
      {success && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300"
        >
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300"
        >
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
            className="w-full rounded-xl border border-utm-border bg-utm-card py-2 pl-10 pr-4 text-xs text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            aria-label="Search operators by license number or name"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="filter-role" className="text-xs text-slate-400">
              Role:
            </label>
            <select
              id="filter-role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="rounded-xl border border-utm-border bg-utm-card px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="ALL">All Roles</option>
              <option value="FLEET_OPERATOR">Fleet Operators</option>
              <option value="REGULATOR">Regulators</option>
              <option value="DISPATCHER">Dispatchers</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="filter-status" className="text-xs text-slate-400">
              Status:
            </label>
            <select
              id="filter-status"
              value={selectedStatus}
              onChange={(e) =>
                setSelectedStatus(e.target.value as "ALL" | "ACTIVE" | "SUSPENDED")
              }
              className="rounded-xl border border-utm-border bg-utm-card px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="SUSPENDED">Suspended Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Operators Table */}
      <div className="overflow-hidden rounded-2xl border border-utm-border bg-utm-surface shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" aria-label="Operators Management Table">
            <thead className="border-b border-utm-border bg-utm-card text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th
                  scope="col"
                  onClick={() => handleSort("operator_id")}
                  className="group cursor-pointer px-5 py-3.5 transition hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    ID {renderSortIndicator("operator_id")}
                  </div>
                </th>
                <th
                  scope="col"
                  onClick={() => handleSort("name")}
                  className="group cursor-pointer px-5 py-3.5 transition hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    Operator Name {renderSortIndicator("name")}
                  </div>
                </th>
                <th
                  scope="col"
                  onClick={() => handleSort("license_no")}
                  className="group cursor-pointer px-5 py-3.5 transition hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    License Number {renderSortIndicator("license_no")}
                  </div>
                </th>
                <th
                  scope="col"
                  onClick={() => handleSort("role")}
                  className="group cursor-pointer px-5 py-3.5 transition hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    Role {renderSortIndicator("role")}
                  </div>
                </th>
                <th
                  scope="col"
                  onClick={() => handleSort("status")}
                  className="group cursor-pointer px-5 py-3.5 transition hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    Status {renderSortIndicator("status")}
                  </div>
                </th>
                <th scope="col" className="px-5 py-3.5 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-utm-border/60">
              {processedOperators.length > 0 ? (
                processedOperators.map((op) => (
                  <tr
                    key={op.operator_id}
                    className="transition hover:bg-utm-cardHover/50"
                  >
                    <td className="px-5 py-4 font-mono font-bold text-slate-300">
                      #{op.operator_id}
                    </td>
                    <td className="px-5 py-4 font-medium text-white">{op.name}</td>
                    <td className="px-5 py-4 font-mono text-slate-300">
                      <span className="inline-flex items-center gap-1.5">
                        <FileBadge className="h-3.5 w-3.5 text-brand-400" />
                        {op.license_no}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${getRoleBadge(
                          op.role
                        )}`}
                      >
                        {op.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {op.is_suspended ? (
                        <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400">
                          SUSPENDED
                        </span>
                      ) : (
                        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          ACTIVE
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {op.role !== "REGULATOR" ? (
                        op.is_suspended ? (
                          <button
                            type="button"
                            onClick={() => setActionOp(op)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 transition hover:bg-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            aria-label={`Reinstate operator ${op.name}`}
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            Reinstate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setActionOp(op)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-400 transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-400"
                            aria-label={`Suspend operator ${op.name}`}
                          >
                            <UserX className="h-3.5 w-3.5" />
                            Suspend
                          </button>
                        )
                      ) : (
                        <span className="font-mono text-[11px] text-slate-500">
                          Protected
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No operators found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Confirmation Modal (Suspend or Reinstate) */}
      {actionOp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-action-title"
        >
          <div
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl bg-utm-surface ${
              actionOp.is_suspended
                ? "border-emerald-500/40"
                : "border-red-500/40"
            }`}
          >
            <div className="mb-4 flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  actionOp.is_suspended
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                {actionOp.is_suspended ? (
                  <UserCheck className="h-6 w-6" />
                ) : (
                  <ShieldAlert className="h-6 w-6" />
                )}
              </div>
              <div>
                <h3 id="modal-action-title" className="text-base font-bold text-white">
                  {actionOp.is_suspended
                    ? "Confirm License Reinstatement"
                    : "Confirm Regulatory Suspension"}
                </h3>
                <p className="text-xs text-slate-400">Civil Aviation Authority Enforcement</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-slate-300">
              Are you sure you want to{" "}
              <strong className="text-white">
                {actionOp.is_suspended ? "reinstate" : "suspend"}
              </strong>{" "}
              operator <strong className="text-white">{actionOp.name}</strong> (License:{" "}
              <code className="text-brand-400">{actionOp.license_no}</code>)?
              An immutable entry will be written to the regulatory audit log and broadcasted in real time.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setActionOp(null)}
                className="rounded-xl border border-utm-border px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-utm-card focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmAction}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 focus:outline-none focus:ring-2 ${
                  actionOp.is_suspended
                    ? "bg-emerald-600 hover:bg-emerald-500 focus:ring-emerald-400"
                    : "bg-red-600 hover:bg-red-500 focus:ring-red-400"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Processing...
                  </>
                ) : actionOp.is_suspended ? (
                  <>
                    <UserCheck className="h-3.5 w-3.5" />
                    Confirm Reinstatement
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

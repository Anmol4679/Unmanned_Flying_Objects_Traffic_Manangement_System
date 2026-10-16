import React, { useState } from "react";
import type { AuditLogItem } from "../types";
import { Search, Download, ShieldCheck, Activity, Calendar } from "lucide-react";

interface AuditTrailTableProps {
  auditLogs: AuditLogItem[];
}

export const AuditTrailTable: React.FC<AuditTrailTableProps> = ({ auditLogs }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("ALL");

  const filteredLogs = auditLogs.filter((log) => {
    const act = (log.action || "").toLowerCase();
    const ent = (log.entity || "").toLowerCase();
    const matchesSearch =
      act.includes(searchTerm.toLowerCase()) ||
      ent.includes(searchTerm.toLowerCase()) ||
      String(log.actor_id || "").includes(searchTerm) ||
      String(log.entity_id || "").includes(searchTerm);

    const matchesAction =
      selectedAction === "ALL" || log.action?.toUpperCase() === selectedAction.toUpperCase();

    return matchesSearch && matchesAction;
  });

  const exportCsv = () => {
    if (filteredLogs.length === 0) return;
    const headers = ["Log ID", "Actor ID", "Action", "Entity", "Entity ID", "Timestamp"];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.actor_id ?? "SYSTEM",
      l.action ?? "UNKNOWN",
      l.entity ?? "UNKNOWN",
      l.entity_id ?? "N/A",
      `"${new Date(l.created_at).toISOString()}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `utm_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionBadge = (action?: string | null) => {
    switch (action?.toUpperCase()) {
      case "SUSPEND":
        return "border-red-500/30 bg-red-500/10 text-red-400";
      case "EMERGENCY_PREEMPT":
        return "border-amber-500/30 bg-amber-500/10 text-amber-400";
      case "CANCEL_RESERVATION":
        return "border-slate-500/30 bg-slate-500/10 text-slate-400";
      default:
        return "border-brand-500/30 bg-brand-500/10 text-brand-400";
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit trail by action, entity, actor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-utm-border bg-utm-card py-2 pl-10 pr-4 text-xs text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="rounded-xl border border-utm-border bg-utm-card px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none"
          >
            <option value="ALL">All Actions</option>
            <option value="SUSPEND">SUSPEND</option>
            <option value="EMERGENCY_PREEMPT">EMERGENCY_PREEMPT</option>
            <option value="CANCEL_RESERVATION">CANCEL_RESERVATION</option>
          </select>

          <button
            onClick={exportCsv}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-utm-border bg-utm-card px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-utm-cardHover hover:text-white disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-hidden rounded-2xl border border-utm-border bg-utm-surface shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-utm-border bg-utm-card text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Log ID</th>
                <th className="px-5 py-3.5">Action</th>
                <th className="px-5 py-3.5">Entity</th>
                <th className="px-5 py-3.5">Entity ID</th>
                <th className="px-5 py-3.5">Actor ID</th>
                <th className="px-5 py-3.5 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-utm-border/60">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-utm-cardHover/50">
                    <td className="px-5 py-4 font-mono font-bold text-slate-400">
                      #{log.id}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${getActionBadge(log.action)}`}>
                        {log.action || "SYSTEM_EVENT"}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-medium text-white">
                      {log.entity || "general"}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-300">
                      {log.entity_id ? `#${log.entity_id}` : "—"}
                    </td>
                    <td className="px-5 py-4 font-mono text-brand-400">
                      {log.actor_id ? `OP-${log.actor_id}` : "SYSTEM"}
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-500" />
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No audit records found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};


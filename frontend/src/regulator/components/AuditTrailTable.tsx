import React, { useState, useEffect, useRef, useMemo } from "react";
import type { AuditLogItem } from "../types";
import {
  Search,
  Download,
  Calendar,
  List,
  GitCommit,
  Radio,
  User,
  ShieldAlert,
  ShieldCheck,
  Plane,
  CalendarX,
  Zap,
} from "lucide-react";

interface AuditTrailTableProps {
  auditLogs: AuditLogItem[];
}

export const AuditTrailTable: React.FC<AuditTrailTableProps> = ({ auditLogs: initialLogs }) => {
  const [logs, setLogs] = useState<AuditLogItem[]>(initialLogs);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("ALL");
  const [actorFilter, setActorFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");
  const [recentLiveIds, setRecentLiveIds] = useState<Set<number>>(new Set());

  // Synchronize with parent props
  useEffect(() => {
    setLogs((prev) => {
      // Merge unique logs
      const map = new Map<number, AuditLogItem>();
      prev.forEach((l) => map.set(l.id, l));
      initialLogs.forEach((l) => map.set(l.id, l));
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [initialLogs]);

  // WebSocket Live Subscription for {"event": "audit_event"}
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let unmounted = false;

    const connectWebSocket = () => {
      if (unmounted) return;
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws/telemetry`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttempts.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed && parsed.event === "audit_event" && parsed.data) {
              const item = parsed.data as AuditLogItem;
              setLogs((prev) => {
                if (prev.some((l) => l.id === item.id)) return prev;
                return [item, ...prev];
              });
              setRecentLiveIds((prev) => {
                const next = new Set(prev);
                next.add(item.id);
                return next;
              });
              setTimeout(() => {
                setRecentLiveIds((prev) => {
                  const next = new Set(prev);
                  next.delete(item.id);
                  return next;
                });
              }, 4000);
            }
          } catch {
            // Ignore non-json or other message shapes silently
          }
        };

        ws.onerror = () => {
          // Fail silently as required
        };

        ws.onclose = () => {
          if (unmounted) return;
          // Reconnect with exponential backoff (max 10s)
          const backoff = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          reconnectAttempts.current += 1;
          reconnectTimeout.current = setTimeout(connectWebSocket, backoff);
        };
      } catch {
        // Fail silently
      }
    };

    connectWebSocket();

    return () => {
      unmounted = true;
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const act = (log.action || "").toLowerCase();
      const ent = (log.entity || "").toLowerCase();
      const matchesSearch =
        act.includes(searchTerm.toLowerCase()) ||
        ent.includes(searchTerm.toLowerCase()) ||
        String(log.actor_id || "").includes(searchTerm) ||
        String(log.entity_id || "").includes(searchTerm);

      const matchesAction =
        selectedAction === "ALL" || log.action?.toUpperCase() === selectedAction.toUpperCase();

      const matchesActor =
        !actorFilter.trim() ||
        String(log.actor_id || "").includes(actorFilter.trim()) ||
        (log.actor_id === null && "system".includes(actorFilter.trim().toLowerCase()));

      return matchesSearch && matchesAction && matchesActor;
    });
  }, [logs, searchTerm, selectedAction, actorFilter]);

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
      case "REINSTATE":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
      case "EMERGENCY_PREEMPT":
        return "border-amber-500/30 bg-amber-500/10 text-amber-400";
      case "CANCEL_RESERVATION":
        return "border-slate-500/30 bg-slate-500/10 text-slate-400";
      case "REGISTER":
        return "border-purple-500/30 bg-purple-500/10 text-purple-400";
      case "CREATE":
        return "border-brand-500/30 bg-brand-500/10 text-brand-400";
      case "UPDATE":
      case "UPDATE_STATUS":
        return "border-cyan-500/30 bg-cyan-500/10 text-cyan-400";
      default:
        return "border-brand-500/30 bg-brand-500/10 text-brand-400";
    }
  };

  const getActionIcon = (action?: string | null) => {
    switch (action?.toUpperCase()) {
      case "SUSPEND":
        return <ShieldAlert className="h-4 w-4 text-red-400" />;
      case "REINSTATE":
        return <ShieldCheck className="h-4 w-4 text-emerald-400" />;
      case "CREATE":
      case "UPDATE":
      case "UPDATE_STATUS":
        return <Plane className="h-4 w-4 text-brand-400" />;
      case "CANCEL_RESERVATION":
      case "EMERGENCY_PREEMPT":
        return <CalendarX className="h-4 w-4 text-amber-400" />;
      default:
        return <Zap className="h-4 w-4 text-brand-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search, Filter and View Toggle Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          {/* General Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search action, entity, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-utm-border bg-utm-card py-2 pl-10 pr-4 text-xs text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              aria-label="Search audit trail"
            />
          </div>

          {/* Actor Filter */}
          <div className="relative max-w-xs">
            <User className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by Actor ID..."
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="w-full rounded-xl border border-utm-border bg-utm-card py-2 pl-9 pr-3 text-xs text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              aria-label="Filter audit logs by actor ID"
            />
          </div>
        </div>

        {/* Action Dropdown, View Toggle and Export */}
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="action-filter-select" className="sr-only">
            Filter by Action
          </label>
          <select
            id="action-filter-select"
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="rounded-xl border border-utm-border bg-utm-card px-3 py-2 text-xs text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="ALL">All Actions</option>
            <option value="REGISTER">REGISTER</option>
            <option value="SUSPEND">SUSPEND</option>
            <option value="REINSTATE">REINSTATE</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="UPDATE_STATUS">UPDATE_STATUS</option>
            <option value="CANCEL_RESERVATION">CANCEL_RESERVATION</option>
            <option value="EMERGENCY_PREEMPT">EMERGENCY_PREEMPT</option>
          </select>

          {/* View Mode Toggle: Table vs Timeline */}
          <div className="flex rounded-xl border border-utm-border bg-utm-card p-0.5" role="group" aria-label="View toggle">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                viewMode === "table"
                  ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
              aria-pressed={viewMode === "table"}
              aria-label="Table View"
            >
              <List className="h-3.5 w-3.5" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                viewMode === "timeline"
                  ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
              aria-pressed={viewMode === "timeline"}
              aria-label="Timeline View"
            >
              <GitCommit className="h-3.5 w-3.5" />
              Timeline
            </button>
          </div>

          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-utm-border bg-utm-card px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-utm-cardHover hover:text-white disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Export filtered audit logs as CSV"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Render Table or Timeline */}
      {viewMode === "table" ? (
        <div className="overflow-hidden rounded-2xl border border-utm-border bg-utm-surface shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" aria-label="Security and Compliance Audit Log">
              <thead className="border-b border-utm-border bg-utm-card text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Log ID</th>
                  <th scope="col" className="px-5 py-3.5">Action</th>
                  <th scope="col" className="px-5 py-3.5">Entity</th>
                  <th scope="col" className="px-5 py-3.5">Entity ID</th>
                  <th scope="col" className="px-5 py-3.5">Actor</th>
                  <th scope="col" className="px-5 py-3.5 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-utm-border/60">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => {
                    const isLiveHighlighted = recentLiveIds.has(log.id);
                    return (
                      <tr
                        key={log.id}
                        className={`transition ${
                          isLiveHighlighted
                            ? "bg-brand-500/20 ring-1 ring-inset ring-brand-400"
                            : "hover:bg-utm-cardHover/50"
                        }`}
                      >
                        <td className="px-5 py-4 font-mono font-bold text-slate-400">
                          <div className="flex items-center gap-1.5">
                            {isLiveHighlighted && (
                              <Radio className="h-3 w-3 animate-pulse text-brand-400" />
                            )}
                            #{log.id}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${getActionBadge(
                              log.action
                            )}`}
                          >
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
                    );
                  })
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
      ) : (
        /* Timeline View */
        <div className="relative rounded-2xl border border-utm-border bg-utm-surface p-6 shadow-xl" aria-label="Audit Log Timeline View">
          {filteredLogs.length > 0 ? (
            <div className="relative pl-6 before:absolute before:bottom-2 before:left-2.5 before:top-2 before:w-0.5 before:bg-utm-border">
              <div className="space-y-6">
                {filteredLogs.map((log) => {
                  const isLiveHighlighted = recentLiveIds.has(log.id);
                  return (
                    <div key={log.id} className="relative">
                      {/* Timeline Node Dot */}
                      <div
                        className={`absolute -left-[30px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full border bg-utm-card shadow-sm ${
                          isLiveHighlighted
                            ? "border-brand-400 text-brand-400 ring-4 ring-brand-500/20"
                            : "border-utm-border text-slate-400"
                        }`}
                      >
                        {getActionIcon(log.action)}
                      </div>

                      {/* Timeline Card */}
                      <div
                        className={`rounded-xl border p-4 transition ${
                          isLiveHighlighted
                            ? "border-brand-500/50 bg-brand-500/10 ring-1 ring-brand-400"
                            : "border-utm-border bg-utm-card hover:border-utm-borderLight"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${getActionBadge(
                                log.action
                              )}`}
                            >
                              {log.action}
                            </span>
                            <span className="text-xs font-semibold text-white">
                              Target {log.entity} {log.entity_id ? `(#${log.entity_id})` : ""}
                            </span>
                            {isLiveHighlighted && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/20 px-2 py-0.2 text-[10px] font-bold text-brand-300">
                                <Radio className="h-2.5 w-2.5 animate-pulse" /> LIVE
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-slate-400">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                          <span>Log ID: #{log.id}</span>
                          <span>·</span>
                          <span>Initiated By: {log.actor_id ? `Operator #${log.actor_id}` : "SYSTEM"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400">
              No audit events found matching criteria.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

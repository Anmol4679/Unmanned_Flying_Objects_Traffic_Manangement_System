import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "shared";
import { OperatorTable } from "./components/OperatorTable";
import { AuditTrailTable } from "./components/AuditTrailTable";
import type { OperatorItem, AuditLogItem } from "./types";
import {
  ShieldCheck,
  Users,
  FileText,
  AlertOctagon,
  RefreshCw,
  Loader2,
} from "lucide-react";

export const RegulatorPage: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<"operators" | "audit">("operators");
  const [operators, setOperators] = useState<OperatorItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const fetchRegulatorData = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    try {
      const [opsRes, auditRes] = await Promise.all([
        fetch("/api/operators", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/audit-log", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (opsRes.ok) {
        const opsData: OperatorItem[] = await opsRes.json();
        setOperators(opsData);
      }

      if (auditRes.ok) {
        const auditData: AuditLogItem[] = await auditRes.json();
        setAuditLogs(auditData);
      }
    } catch (err) {
      console.error("Error fetching regulator data:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRegulatorData();
  }, [fetchRegulatorData, refreshKey]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-400 shadow-glow">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Regulator Airspace Console</h1>
            <p className="text-xs text-slate-400">
              Civil Aviation Authority Oversight · Operator Licensing · Immutable Audit Trails
            </p>
          </div>
        </div>

        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-utm-border bg-utm-card px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-utm-cardHover hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Console
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-utm-border bg-utm-card p-4 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Registered Operators</span>
            <Users className="h-4 w-4 text-brand-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-white">
            {operators.length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Active aviation licenses</p>
        </div>

        <div className="rounded-2xl border border-utm-border bg-utm-card p-4 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Audit Trail Records</span>
            <FileText className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-white">
            {auditLogs.length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Security & enforcement logs</p>
        </div>

        <div className="rounded-2xl border border-utm-border bg-utm-card p-4 shadow-xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Enforcement Actions</span>
            <AlertOctagon className="h-4 w-4 text-red-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-white">
            {auditLogs.filter((l) => l.action === "SUSPEND" || l.action === "EMERGENCY_PREEMPT").length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Suspensions & emergency overrides</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-utm-border">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("operators")}
            className={`pb-3 text-xs font-bold uppercase tracking-wider transition ${
              activeTab === "operators"
                ? "border-b-2 border-brand-500 text-brand-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Operator Oversight ({operators.length})
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`pb-3 text-xs font-bold uppercase tracking-wider transition ${
              activeTab === "audit"
                ? "border-b-2 border-brand-500 text-brand-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Regulatory Audit Trail ({auditLogs.length})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {loading && operators.length === 0 ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </div>
      ) : activeTab === "operators" ? (
        <OperatorTable
          operators={operators}
          token={token}
          onOperatorSuspended={() => setRefreshKey((k) => k + 1)}
        />
      ) : (
        <AuditTrailTable auditLogs={auditLogs} />
      )}
    </div>
  );
};


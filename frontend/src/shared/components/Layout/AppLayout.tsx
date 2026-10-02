import React, { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Plane,
  ShieldCheck,
  CalendarCheck,
  Radar,
  LogOut,
  Menu,
  X,
  Radio,
  UserCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import type { OperatorRole } from "../../types/auth";

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles?: OperatorRole[];
  comingSoon?: boolean;
  assignedTo?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Operator Dashboard",
    path: "/",
    icon: LayoutDashboard,
    // Visible to all authenticated roles
  },
  {
    name: "Fleet Management",
    path: "/fleet",
    icon: Plane,
    allowedRoles: ["FLEET_OPERATOR"],
  },
  {
    name: "Regulator Console",
    path: "/regulator",
    icon: ShieldCheck,
    allowedRoles: ["REGULATOR"],
  },
  {
    name: "Airspace Reservation",
    path: "/reservations",
    icon: CalendarCheck,
    assignedTo: "Shravan",
    allowedRoles: ["FLEET_OPERATOR", "DISPATCHER"],
  },
  {
    name: "Live Telemetry Map",
    path: "/telemetry",
    icon: Radar,
    comingSoon: true,
    assignedTo: "Shlok",
    // Visible to all authenticated roles
  },
];

export const AppLayout: React.FC = () => {
  const { user, operator, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const userRole = user?.role;

  // Filter items according to operator role
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!item.allowedRoles || item.allowedRoles.length === 0) return true;
    return userRole && item.allowedRoles.includes(userRole);
  });

  const getRoleBadgeColor = (role?: OperatorRole) => {
    switch (role) {
      case "REGULATOR":
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      case "FLEET_OPERATOR":
        return "bg-brand-500/10 text-brand-400 border-brand-500/30";
      case "DISPATCHER":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    }
  };

  const getPageTitle = () => {
    const active = NAV_ITEMS.find((item) => item.path === location.pathname);
    return active ? active.name : "Traffic Management";
  };

  return (
    <div className="flex min-h-screen bg-utm-bg text-slate-100">
      {/* ------------------------------------------------------------------ */}
      {/* Desktop Sidebar                                                    */}
      {/* ------------------------------------------------------------------ */}
      <aside className="hidden w-72 flex-col border-r border-utm-border bg-utm-surface lg:flex">
        {/* Brand Header */}
        <div className="flex h-16 items-center gap-3 border-b border-utm-border px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-400 shadow-glow">
            <Radio className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-wider text-white">
              UTM AEROSHIELD
            </div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
              Traffic Mgmt System
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Control Navigation
          </div>
          <nav className="space-y-1.5">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  className={({ isActive }) =>
                    `group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                      isActive
                        ? "bg-brand-500/15 text-brand-400 border border-brand-500/30 shadow-sm"
                        : "text-slate-400 hover:bg-utm-card hover:text-slate-200"
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                    <span>{item.name}</span>
                  </div>
                  {item.comingSoon && (
                    <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[9px] font-semibold text-brand-400 ring-1 ring-brand-500/20">
                      Soon
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User / Session Footer */}
        <div className="border-t border-utm-border p-4">
          <div className="rounded-xl border border-utm-border bg-utm-card p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
                <UserCheck className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-xs font-semibold text-white">
                  {operator?.name || "Operator"}
                </div>
                <div className="truncate font-mono text-[10px] text-slate-400">
                  {operator?.license_no || `ID: ${user?.operator_id}`}
                </div>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between border-t border-utm-border/60 pt-2">
              <span
                className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${getRoleBadgeColor(
                  userRole
                )}`}
              >
                {userRole || "NO ROLE"}
              </span>

              <button
                onClick={logout}
                title="Log out"
                className="flex items-center gap-1 text-[11px] text-slate-400 transition hover:text-red-400"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Exit</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Mobile Drawer                                                      */}
      {/* ------------------------------------------------------------------ */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex w-72 flex-col bg-utm-surface p-4 border-r border-utm-border z-10">
            <div className="flex items-center justify-between pb-4 border-b border-utm-border">
              <div className="font-bold text-white text-sm">UTM AEROSHIELD</div>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-4 space-y-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    end={item.path === "/"}
                    className={({ isActive }) =>
                      `flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium ${
                        isActive
                          ? "bg-brand-500/15 text-brand-400 border border-brand-500/30"
                          : "text-slate-400 hover:bg-utm-card hover:text-slate-200"
                      }`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </div>
                    {item.comingSoon && (
                      <span className="text-[9px] text-brand-400 font-semibold">
                        Soon
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-auto pt-4 border-t border-utm-border">
              <button
                onClick={logout}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-500/10 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Main Content Area                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-16 items-center justify-between border-b border-utm-border bg-utm-surface/80 px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-utm-border p-1.5 text-slate-400 hover:text-white lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-sm font-semibold text-white">{getPageTitle()}</h2>
              <p className="text-[11px] text-slate-400">
                Airspace Traffic & Fleet Operations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* System Status Pill */}
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-utm-border bg-utm-card px-3 py-1 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-slate-400 text-[11px]">System Status:</span>
              <span className="font-semibold text-emerald-400 text-[11px]">
                Normal
              </span>
            </div>

            {/* Operator Quick Pill */}
            <div className="flex items-center gap-2.5">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getRoleBadgeColor(
                  userRole
                )}`}
              >
                {userRole || "GUEST"}
              </span>
              <button
                onClick={logout}
                className="rounded-lg border border-utm-border bg-utm-card p-1.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 overflow-y-auto bg-utm-bg p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

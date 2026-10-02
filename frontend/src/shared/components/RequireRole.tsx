import React from "react";
import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Forbidden403 } from "./Forbidden403";
import type { OperatorRole } from "../types/auth";
import { Loader2 } from "lucide-react";

interface RequireRoleProps {
  roles?: OperatorRole[];
  children?: React.ReactNode;
}

/**
 * Route guard component that:
 * 1. Shows a loading spinner while session initializes.
 * 2. Redirects unauthenticated users to /login (remembering original location).
 * 3. Shows a 403 Forbidden page if user's role is not authorized.
 * 4. Renders children (or <Outlet />) when authorized.
 */
export const RequireRole: React.FC<RequireRoleProps> = ({ roles, children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-utm-bg text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          <p className="text-xs uppercase tracking-widest text-slate-400 font-mono">
            Verifying Operator Credentials...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role authorization if specific roles are defined
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return <Forbidden403 requiredRoles={roles} />;
  }

  return children ? <>{children}</> : <Outlet />;
};

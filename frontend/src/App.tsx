import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./shared/context/AuthContext";
import { RequireRole } from "./shared/components/RequireRole";
import { AppLayout } from "./shared/components/Layout/AppLayout";
import { AuthPage } from "./shared/pages/AuthPage";
import { DashboardPage } from "./shared/pages/DashboardPage";
import { ReservationsPage } from "./reservations";
import { FleetPage } from "./fleet";
import { RegulatorPage } from "./regulator";
import { TelemetryPage } from "./telemetry";

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public authentication route */}
          <Route path="/login" element={<AuthPage />} />

          {/* Protected Navigation Shell */}
          <Route
            element={
              <RequireRole>
                <AppLayout />
              </RequireRole>
            }
          >
            {/* 1. Operator Dashboard */}
            <Route path="/" element={<DashboardPage />} />

            {/* 2. Fleet Management (Fleet Operator only) */}
            <Route
              path="/fleet"
              element={
                <RequireRole roles={["FLEET_OPERATOR"]}>
                  <FleetPage />
                </RequireRole>
              }
            />

            {/* 3. Regulator Console (Regulator only) */}
            <Route
              path="/regulator"
              element={
                <RequireRole roles={["REGULATOR"]}>
                  <RegulatorPage />
                </RequireRole>
              }
            />

            {/* 4. Booking / Airspace Reservation (Shravan's page) */}
            <Route
              path="/reservations"
              element={
                <RequireRole roles={["FLEET_OPERATOR", "DISPATCHER"]}>
                  <ReservationsPage />
                </RequireRole>
              }
            />

            {/* 5. Live Telemetry Map (Shlok's page - Now Fully Active) */}
            <Route
              path="/telemetry"
              element={
                <RequireRole>
                  <TelemetryPage />
                </RequireRole>
              }
            />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;

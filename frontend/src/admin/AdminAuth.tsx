import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { clearAdminToken, getAdminToken } from "./adminApi";

type AdminAuthContextValue = {
  isAuthenticated: boolean;
  logout: () => void;
  refresh: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => getAdminToken());

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token),
      logout: () => {
        clearAdminToken();
        setToken(null);
      },
      refresh: () => setToken(getAdminToken()),
    }),
    [token]
  );

  return (
    <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAdminAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

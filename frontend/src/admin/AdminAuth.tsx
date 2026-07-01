import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  adminRefreshSession,
  adminSessionSecondsRemaining,
  clearAdminToken,
  getAdminToken,
  getAuthRole,
  type AuthRole,
} from "./adminApi";

const REFRESH_WHEN_REMAINING_SEC = 5 * 60;
const SESSION_CHECK_MS = 60_000;

type AdminAuthContextValue = {
  isAuthenticated: boolean;
  role: AuthRole | null;
  logout: () => void;
  refresh: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => getAdminToken());

  useEffect(() => {
    const tick = async () => {
      if (!getAdminToken()) {
        setToken(null);
        return;
      }
      const remaining = adminSessionSecondsRemaining();
      if (remaining <= 0) {
        clearAdminToken();
        setToken(null);
        return;
      }
      if (remaining <= REFRESH_WHEN_REMAINING_SEC) {
        const ok = await adminRefreshSession();
        setToken(ok ? getAdminToken() : null);
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), SESSION_CHECK_MS);
    return () => window.clearInterval(id);
  }, [token]);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token),
      role: token ? getAuthRole() : null,
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

export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, role } = useAdminAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }
  if (role === "owner") {
    return <Navigate to="/owner" replace />;
  }
  return <>{children}</>;
}

export function RequireOwner({ children }: { children: ReactNode }) {
  const { isAuthenticated, role } = useAdminAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/owner/login" state={{ from: location.pathname }} replace />;
  }
  if (role === "super_admin") {
    return <Navigate to="/admin" replace />;
  }
  if (role !== "owner") {
    return <Navigate to="/owner/login" replace />;
  }
  return <>{children}</>;
}

/** @deprecated Use RequireSuperAdmin */
export const RequireAdmin = RequireSuperAdmin;

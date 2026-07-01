import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import { clearRenterSession, getRenterProfile, getRenterToken } from "./renterApi";

type RenterAuthContextValue = {
  isAuthenticated: boolean;
  profile: { name: string | null; email: string | null };
  logout: () => void;
  refresh: () => void;
};

const RenterAuthContext = createContext<RenterAuthContextValue | null>(null);

export function RenterAuthProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    const bump = () => refresh();
    const interval = window.setInterval(bump, 30_000);
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", bump);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", bump);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(getRenterToken()),
      profile: getRenterProfile(),
      logout: () => {
        clearRenterSession();
        refresh();
      },
      refresh,
    }),
    [tick, refresh]
  );

  return (
    <RenterAuthContext.Provider value={value}>{children}</RenterAuthContext.Provider>
  );
}

export function useRenterAuth() {
  const ctx = useContext(RenterAuthContext);
  if (!ctx) throw new Error("useRenterAuth must be used within RenterAuthProvider");
  return ctx;
}

export function RequireRenter({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useRenterAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return (
      <Navigate to="/account/login" state={{ from: location.pathname }} replace />
    );
  }
  return <>{children}</>;
}

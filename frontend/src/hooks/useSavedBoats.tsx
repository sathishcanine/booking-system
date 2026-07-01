import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useRenterAuth } from "../renter/RenterAuth";
import { renter } from "../renter/renterApi";

type SavedBoatsContextValue = {
  isSaved: (activityId: number) => boolean;
  toggleSave: (activityId: number, returnPath?: string) => Promise<void>;
  busyId: number | null;
};

const SavedBoatsContext = createContext<SavedBoatsContextValue | null>(null);

export function SavedBoatsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useRenterAuth();
  const navigate = useNavigate();
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setSavedIds(new Set());
      return;
    }
    renter
      .savedBoats()
      .then((list) => setSavedIds(new Set(list.map((b) => b.activity_id))))
      .catch(() => {});
  }, [isAuthenticated]);

  const toggleSave = useCallback(
    async (activityId: number, returnPath?: string) => {
      if (!isAuthenticated) {
        navigate("/account/login", {
          state: { from: returnPath ?? `${window.location.pathname}${window.location.search}` },
        });
        return;
      }
      setBusyId(activityId);
      try {
        if (savedIds.has(activityId)) {
          await renter.unsaveBoat(activityId);
          setSavedIds((prev) => {
            const next = new Set(prev);
            next.delete(activityId);
            return next;
          });
        } else {
          await renter.saveBoat(activityId);
          setSavedIds((prev) => new Set(prev).add(activityId));
        }
      } finally {
        setBusyId(null);
      }
    },
    [isAuthenticated, savedIds, navigate]
  );

  const value = useMemo(
    () => ({
      isSaved: (id: number) => savedIds.has(id),
      toggleSave,
      busyId,
    }),
    [savedIds, toggleSave, busyId]
  );

  return <SavedBoatsContext.Provider value={value}>{children}</SavedBoatsContext.Provider>;
}

export function useSavedBoats() {
  const ctx = useContext(SavedBoatsContext);
  if (!ctx) throw new Error("useSavedBoats must be used within SavedBoatsProvider");
  return ctx;
}

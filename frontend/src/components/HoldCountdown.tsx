import { useEffect, useRef, useState } from "react";
import { secondsUntilUtc } from "../utils";

type Props = {
  expiresAt: string;
  /** Server-computed seconds left at checkout start (avoids client clock skew). */
  initialSeconds?: number;
  onExpired?: () => void;
  compact?: boolean;
  /** Sidebar mirror — never triggers expiry callbacks. */
  displayOnly?: boolean;
};

function formatRemaining(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function HoldCountdown({
  expiresAt,
  initialSeconds,
  onExpired,
  compact,
  displayOnly = false,
}: Props) {
  const mountMs = useRef(Date.now());
  const wasRunningRef = useRef(false);
  const expiredRef = useRef(false);

  const [remaining, setRemaining] = useState(() => {
    const fromServer =
      initialSeconds !== undefined
        ? Math.max(0, initialSeconds - Math.floor((Date.now() - mountMs.current) / 1000))
        : null;
    const fromIso = secondsUntilUtc(expiresAt);
    if (fromServer !== null) return Math.min(fromServer, fromIso);
    return fromIso;
  });

  useEffect(() => {
    mountMs.current = Date.now();
    wasRunningRef.current = false;
    expiredRef.current = false;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - mountMs.current) / 1000);
      const fromServer =
        initialSeconds !== undefined
          ? Math.max(0, initialSeconds - elapsed)
          : null;
      const fromIso = secondsUntilUtc(expiresAt);
      const next = fromServer !== null ? Math.min(fromServer, fromIso) : fromIso;

      setRemaining(next);
      if (next > 0) wasRunningRef.current = true;

      if (
        !displayOnly &&
        next <= 0 &&
        wasRunningRef.current &&
        !expiredRef.current
      ) {
        expiredRef.current = true;
        onExpired?.();
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt, initialSeconds, onExpired, displayOnly]);

  const urgent = remaining > 0 && remaining <= 60;

  if (remaining <= 0) {
    return (
      <div className="hold-countdown hold-countdown--expired">
        <strong>Your seat hold has expired</strong>
        {!compact && (
          <span>
            These seats may no longer be reserved. Return to the form to try again.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`hold-countdown${urgent ? " hold-countdown--urgent" : ""}`}>
      <strong>Complete payment in {formatRemaining(remaining)}</strong>
      {!compact && <span>Your seats are held until this timer ends.</span>}
    </div>
  );
}

import { useEffect, useState } from "react";
import { TOAST_EVENT_NAME } from "../toast";

const DISMISS_MS = 6000;

export default function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string" && detail.trim()) {
        setMessage(detail);
      }
    };
    window.addEventListener(TOAST_EVENT_NAME, onToast);
    return () => window.removeEventListener(TOAST_EVENT_NAME, onToast);
  }, []);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(null), DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [message]);

  if (!message) return null;

  return (
    <div className="toast-host" role="status" aria-live="polite">
      <p className="toast-host__message">{message}</p>
      <button
        type="button"
        className="toast-host__close"
        onClick={() => setMessage(null)}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

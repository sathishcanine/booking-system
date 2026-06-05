import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { confirmBookingPayment } from "../api";

export default function SuccessPage() {
  const { reference } = useParams();
  const [params] = useSearchParams();
  const waitlist = params.get("waitlist") === "1";
  const [confirming, setConfirming] = useState(!waitlist && Boolean(reference));

  useEffect(() => {
    if (waitlist || !reference || reference === "pending") return;
    confirmBookingPayment(reference)
      .catch(() => {})
      .finally(() => setConfirming(false));
  }, [reference, waitlist]);

  return (
    <div className="success-page card">
      <h1>
        {waitlist
          ? "You’re on the waitlist"
          : confirming
            ? "Confirming your booking…"
            : "Booking confirmed!"}
      </h1>
      <p>
        Reference: <strong>{reference}</strong>
      </p>
      {waitlist ? (
        <p>We’ll email you if a spot opens. No payment was taken.</p>
      ) : (
        <p>A confirmation email is on its way.</p>
      )}
      <Link to="/" className="btn-primary">
        Book another trip
      </Link>
    </div>
  );
}

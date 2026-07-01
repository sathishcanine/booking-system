import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { admin, connectApi, type Earnings } from "../../admin/adminApi";
import { formatDateTime, formatMoney } from "../../utils";

const PAYMENT_FLOW = [
  {
    icon: "🛥️",
    title: "Guest books",
    text: "A renter picks your boat and pays securely on the marketplace.",
  },
  {
    icon: "💳",
    title: "Card payment",
    text: "The full rental amount is charged through Stripe.",
  },
  {
    icon: "📊",
    title: "Automatic split",
    text: "Platform fee and tax are deducted; your share is calculated instantly.",
  },
  {
    icon: "🏦",
    title: "You get paid",
    text: "Your earnings transfer to your Stripe account, then deposit to your bank.",
  },
] as const;

const SETUP_STEPS = [
  {
    icon: "🔗",
    title: "Connect with Stripe",
    text: "Click the button below — you'll be sent to Stripe's secure setup (about 5 minutes).",
  },
  {
    icon: "🪪",
    title: "Verify identity",
    text: "Stripe may ask for your legal name, address, and a photo ID (standard for payouts).",
  },
  {
    icon: "🏛️",
    title: "Add your bank",
    text: "Link the checking account where you want rental income deposited.",
  },
  {
    icon: "✅",
    title: "Start earning",
    text: "Once approved, every paid booking automatically sends your share — no manual invoicing.",
  },
] as const;

export default function AdminPayoutsPage() {
  const [searchParams] = useSearchParams();
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (searchParams.get("connect") === "return") {
        await connectApi.refresh();
        setMsg("Stripe account updated — checking status…");
      }
      const data = await admin.earnings();
      setEarnings(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load earnings");
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  async function startOnboarding() {
    setOnboarding(true);
    setError("");
    try {
      const { url } = await connectApi.onboard();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start Stripe onboarding");
      setOnboarding(false);
    }
  }

  const connect = earnings?.connect;
  const ready = connect?.ready_for_payments;
  const setupStep = !connect?.stripe_configured
    ? 0
    : ready
      ? 4
      : connect?.details_submitted
        ? 3
        : connect?.account_id
          ? 2
          : 1;

  return (
    <>
      <header className="admin-topbar">
        <h1>Payouts &amp; earnings</h1>
      </header>
      {msg && <p className="admin-hint payouts-msg-ok">{msg}</p>}
      {loading && <p className="admin-hint">Loading…</p>}

      {earnings && (
        <>
          <section className="admin-card payouts-guide">
            <h2 className="payouts-section-title">How you get paid</h2>
            <p className="payouts-section-lead">
              You never chase guests for money. When someone books and pays on the platform, your
              share is routed to you automatically after Stripe Connect is set up.
            </p>
            <div className="payouts-flow" aria-label="Payment flow">
              {PAYMENT_FLOW.map((step, i) => (
                <div className="payouts-flow-item" key={step.title}>
                  <div className="payouts-flow-card">
                    <span className="payouts-flow-icon" aria-hidden>
                      {step.icon}
                    </span>
                    <strong>{step.title}</strong>
                    <p>{step.text}</p>
                  </div>
                  {i < PAYMENT_FLOW.length - 1 && (
                    <span className="payouts-flow-arrow" aria-hidden>
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="payouts-fee-note">
              <span aria-hidden>ℹ️</span>
              <p>
                <strong>Example:</strong> on a $500 rental, the platform fee (~15%) and sales tax are
                withheld automatically. The remainder is your earnings and is tracked on this page.
              </p>
            </div>
          </section>

          <section className="admin-card payouts-setup">
            <h2 className="payouts-section-title">One-time payout setup</h2>
            <p className="payouts-section-lead">
              Stripe is our secure payments partner. You only do this once before accepting paid
              bookings.
            </p>
            <ol className="payouts-steps">
              {SETUP_STEPS.map((step, i) => (
                <li
                  key={step.title}
                  className={`payouts-step${i < setupStep ? " payouts-step--done" : i === setupStep ? " payouts-step--current" : ""}`}
                >
                  <span className="payouts-step-icon" aria-hidden>
                    {step.icon}
                  </span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="admin-card payouts-connect-card">
            <h2 className="payouts-section-title" style={{ marginTop: 0 }}>
              Stripe Connect
            </h2>
            {error && (
              <div className="payouts-error-box" role="alert">
                <span className="payouts-error-icon" aria-hidden>
                  ⚠️
                </span>
                <div>
                  <strong>Could not start setup</strong>
                  <p>{error}</p>
                </div>
              </div>
            )}
            {!connect?.stripe_configured && (
              <p className="admin-hint">
                Stripe is not configured on the server. Add API keys to enable payouts.
              </p>
            )}
            {connect?.stripe_configured && !ready && (
              <>
                <p>
                  Connect your bank account to receive payouts when guests book your boats. The
                  platform fee is deducted automatically from each booking.
                </p>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary payouts-connect-btn"
                  onClick={startOnboarding}
                  disabled={onboarding}
                >
                  {onboarding ? "Redirecting to Stripe…" : "Connect with Stripe"}
                </button>
                <p className="admin-hint payouts-connect-hint">
                  You&apos;ll leave this site briefly to complete setup on Stripe&apos;s secure
                  pages, then return here automatically.
                </p>
              </>
            )}
            {ready && (
              <div className="payouts-ready-box">
                <span className="payouts-ready-icon" aria-hidden>
                  ✓
                </span>
                <div>
                  <strong>Payments enabled</strong>
                  <p>You&apos;ll receive transfers for new bookings.</p>
                  {connect.dashboard_url && (
                    <a
                      href={connect.dashboard_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-btn admin-btn-primary"
                      style={{ display: "inline-block", marginTop: "0.65rem" }}
                    >
                      Open Stripe Dashboard
                    </a>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="admin-card-grid payouts-kpis">
            <div className="admin-card payouts-kpi">
              <span className="payouts-kpi-label">Gross revenue</span>
              <strong>{formatMoney(earnings.gross_revenue_cents)}</strong>
            </div>
            <div className="admin-card payouts-kpi">
              <span className="payouts-kpi-label">Platform fees</span>
              <strong>{formatMoney(earnings.platform_fees_cents)}</strong>
            </div>
            <div className="admin-card payouts-kpi">
              <span className="payouts-kpi-label">Your earnings</span>
              <strong>{formatMoney(earnings.net_earnings_cents)}</strong>
            </div>
            <div className="admin-card payouts-kpi">
              <span className="payouts-kpi-label">Paid bookings</span>
              <strong>{earnings.paid_booking_count}</strong>
            </div>
          </section>

          <section className="admin-card">
            <h2 className="payouts-section-title" style={{ marginTop: 0 }}>
              Recent paid bookings
            </h2>
            {earnings.recent_bookings.length === 0 ? (
              <p className="admin-hint">No paid bookings yet.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Boat</th>
                    <th>Guest</th>
                    <th>Total</th>
                    <th>Your payout</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.recent_bookings.map((b) => (
                    <tr key={b.id}>
                      <td>{b.reference}</td>
                      <td>{b.activity_title}</td>
                      <td>{b.customer_name}</td>
                      <td>{formatMoney(b.total_cents)}</td>
                      <td>{formatMoney(b.owner_payout_cents)}</td>
                      <td>{formatDateTime(b.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </>
  );
}

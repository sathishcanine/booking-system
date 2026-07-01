import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ownerGoogleLogin } from "../admin/adminApi";
import { useAdminAuth } from "../admin/AdminAuth";
import GoogleSignInButton from "./GoogleSignInButton";

const OWNER_HERO_IMAGE =
  "https://www.boat-ed.com/blog/media/posts/138/sailboat-on-the-water.jpeg";

type Props = {
  mode: "login" | "register";
};

const PERKS = [
  { icon: "🛥️", text: "List your boat in minutes" },
  { icon: "📅", text: "Manage bookings & availability" },
  { icon: "💳", text: "Get paid automatically via Stripe" },
  { icon: "⭐", text: "Reach renters across the marketplace" },
] as const;

export default function OwnerGoogleAuthCard({ mode }: Props) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAdminAuth();

  const isRegister = mode === "register";

  async function handleGoogle(credential: string) {
    setError("");
    setLoading(true);
    try {
      await ownerGoogleLogin(credential);
      refresh();
      navigate("/owner");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      setError(
        msg.includes("guest renter") || msg.includes("registered as a renter")
          ? `${msg} To book trips, use Account sign-in instead.`
          : msg
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="owner-auth-page">
      <div className="owner-auth-hero">
        <div
          className="owner-auth-hero-bg"
          style={{ backgroundImage: `url(${OWNER_HERO_IMAGE})` }}
          aria-hidden
        />
        <div className="owner-auth-hero-overlay" aria-hidden />
        <div className="owner-auth-hero-content">
          <h1 className="owner-auth-brand">Alis, for Boat Owners</h1>
          <p className="owner-auth-lead">
            {isRegister
              ? "Share your boat with the world. Join owners earning from day charters, sunset cruises, and weekend rentals."
              : "Sign in to update listings, track bookings, and see your earnings — all in one place."}
          </p>
          <ul className="owner-auth-perks">
            {PERKS.map((perk) => (
              <li key={perk.text}>
                <span className="owner-auth-perk-icon" aria-hidden>
                  {perk.icon}
                </span>
                {perk.text}
              </li>
            ))}
          </ul>
          <p className="owner-auth-quote">
            &ldquo;List once, accept instant bookings, and let the platform handle payments.&rdquo;
          </p>
        </div>
      </div>

      <div className="owner-auth-panel">
        <div className="owner-auth-card">
          <Link to="/boats" className="owner-auth-back">
            ← Back to marketplace
          </Link>
          <h2>{isRegister ? "List your boat" : "Boat owner sign in"}</h2>
          <p className="owner-auth-card-lead">
            {isRegister
              ? "Create your owner account with Google to start listing."
              : "Continue with Google to manage your boats and rentals."}
          </p>

          <GoogleSignInButton
            disabled={loading}
            onSuccess={handleGoogle}
            onError={setError}
          />

          {loading && <p className="admin-hint owner-auth-status">Signing in…</p>}
          {error && <p className="admin-error">{error}</p>}

          <p className="owner-auth-switch">
            {isRegister ? (
              <>
                Already have an account? <Link to="/owner/login">Sign in</Link>
              </>
            ) : (
              <>
                New owner? <Link to="/owner/register">List your boat</Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

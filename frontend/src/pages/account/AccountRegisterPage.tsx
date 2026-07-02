import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import GoogleSignInButton from "../../components/GoogleSignInButton";
import AlisAdventureLogo from "../../components/AlisAdventureLogo";
import MarketplaceNav from "../../components/MarketplaceNav";
import { useRenterAuth } from "../../renter/RenterAuth";
import { renterGoogleLogin } from "../../renter/renterApi";

export default function AccountRegisterPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useRenterAuth();

  async function handleGoogle(credential: string) {
    setError("");
    setLoading(true);
    try {
      await renterGoogleLogin(credential);
      refresh();
      navigate("/account", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mp-page">
      <MarketplaceNav />
      <div className="account-auth-page">
        <div className="account-auth-card">
          <AlisAdventureLogo size="auth" linkTo="/" className="account-auth-logo" />
          <h1>Create account</h1>
          <p>Track bookings and save favorite boats with your Google account.</p>
          <GoogleSignInButton
            disabled={loading}
            onSuccess={handleGoogle}
            onError={setError}
          />
          {loading && <p className="account-auth-status">Creating account…</p>}
          {error && <p className="account-error">{error}</p>}
          <p className="account-auth-footer">
            Already have an account? <Link to="/account/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

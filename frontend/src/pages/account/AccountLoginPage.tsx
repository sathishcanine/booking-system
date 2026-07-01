import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import GoogleSignInButton from "../../components/GoogleSignInButton";
import MarketplaceNav from "../../components/MarketplaceNav";
import { useRenterAuth } from "../../renter/RenterAuth";
import { renterGoogleLogin } from "../../renter/renterApi";

export default function AccountLoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useRenterAuth();
  const from = (location.state as { from?: string } | null)?.from || "/account";

  async function handleGoogle(credential: string) {
    setError("");
    setLoading(true);
    try {
      await renterGoogleLogin(credential);
      refresh();
      navigate(from, { replace: true });
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
          <h1>Sign in</h1>
          <p>View your trips and saved boats.</p>
          <GoogleSignInButton
            disabled={loading}
            onSuccess={handleGoogle}
            onError={setError}
          />
          {loading && <p className="account-auth-status">Signing in…</p>}
          {error && <p className="account-error">{error}</p>}
          <p className="account-auth-footer">
            New here? <Link to="/account/register">Create an account</Link>
          </p>
          <p className="account-auth-footer">
            <Link to="/boats">Continue as guest</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

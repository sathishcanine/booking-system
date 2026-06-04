import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminLogin } from "../../admin/adminApi";
import { useAdminAuth } from "../../admin/AdminAuth";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAdminAuth();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminLogin(password);
      refresh();
      navigate("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <h1>Coastal Cruises Admin</h1>
        <p>Manage tours, departures, ticket prices, and bookings.</p>
        <form onSubmit={onSubmit}>
          <div className="admin-field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="admin-error">{error}</p>}
          <div className="admin-actions" style={{ marginTop: "1.25rem" }}>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>
        <p style={{ marginTop: "1.5rem", fontSize: "0.85rem" }}>
          <Link to="/">← Back to public calendar</Link>
        </p>
      </div>
    </div>
  );
}

import { NavLink, Outlet, Link } from "react-router-dom";
import { useAdminAuth } from "../../admin/AdminAuth";

const links = [
  { to: "/admin", end: true, label: "Dashboard" },
  { to: "/admin/activities", label: "Tours & tickets" },
  { to: "/admin/slots", label: "Departures" },
  { to: "/admin/promos", label: "Promo codes" },
  { to: "/admin/bookings", label: "Bookings" },
];

export default function AdminLayout() {
  const { logout } = useAdminAuth();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <strong>COASTAL CRUISES</strong>
          <small>Alis-Adventure — Admin</small>
        </div>
        <nav className="admin-nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: "1rem 1.25rem 0" }}>
          <Link to="/" className="admin-btn admin-btn-sm" style={{ display: "block", textAlign: "center" }}>
            View calendar
          </Link>
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            style={{ width: "100%", marginTop: "0.5rem" }}
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <Outlet />
      </div>
    </div>
  );
}

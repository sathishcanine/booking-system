import { NavLink, Outlet } from "react-router-dom";
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
          <strong>Alis-Adventure</strong>
          <small>Admin</small>
        </div>
        <nav className="admin-nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn admin-btn-sm admin-sidebar-footer-btn"
          >
            View calendar
          </a>
          <button
            type="button"
            className="admin-btn admin-btn-sm admin-sidebar-footer-btn"
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

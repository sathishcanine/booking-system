import { NavLink, Outlet } from "react-router-dom";
import { useAdminAuth } from "../../admin/AdminAuth";
import { getAuthDisplayName, getAuthOrgName } from "../../admin/adminApi";

type AdminLayoutProps = {
  basePath?: string;
  brand?: string;
  subtitle?: string;
};

export default function AdminLayout({
  basePath = "/admin",
  brand = "Alis-Adventure",
  subtitle = "Admin",
}: AdminLayoutProps) {
  const { logout } = useAdminAuth();
  const orgName = getAuthOrgName();
  const displayName = getAuthDisplayName();
  const isOwner = basePath === "/owner";
  const displayBrand = isOwner
    ? displayName || orgName || brand
    : orgName || brand;
  const brandSubtitle =
    isOwner && displayName && orgName && displayName !== orgName ? orgName : subtitle;
  const links = [
    { to: basePath, end: true, label: "Dashboard" },
    { to: `${basePath}/activities`, label: isOwner ? "My boats" : "Boats" },
    { to: `${basePath}/captains`, label: "Captains" },
    { to: `${basePath}/promos`, label: "Promo codes" },
    { to: `${basePath}/bookings`, label: "Bookings" },
    { to: `${basePath}/reviews`, label: "Reviews" },
    ...(isOwner ? [{ to: `${basePath}/payouts`, end: false, label: "Payouts" }] : []),
    ...(!isOwner ? [{ to: `${basePath}/settings`, end: false, label: "Platform" }] : []),
  ];

  return (
    <div className={`admin-shell${isOwner ? " admin-shell--owner" : ""}`}>
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <strong>{displayBrand}</strong>
          <small>{brandSubtitle}</small>
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
            href="/boats"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn admin-btn-sm admin-sidebar-footer-btn"
          >
            View marketplace
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

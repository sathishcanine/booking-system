import { Link } from "react-router-dom";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link to="/" className="logo">
        <span className="logo-mark">ESF</span>
        <span className="logo-text">
          Booking System
          <small>ESF</small>
        </span>
      </Link>
    </header>
  );
}

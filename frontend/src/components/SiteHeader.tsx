import AlisAdventureLogo from "./AlisAdventureLogo";
import { Link } from "react-router-dom";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <AlisAdventureLogo size="nav" className="site-header-logo" />
      <nav className="site-nav">
        <Link to="/boats">Browse boats</Link>
        <Link to="/">Calendar</Link>
        <Link to="/owner/register">List your boat</Link>
      </nav>
    </header>
  );
}

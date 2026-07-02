import { Link, useLocation } from "react-router-dom";
import { useRenterAuth } from "../renter/RenterAuth";
import AlisAdventureLogo from "./AlisAdventureLogo";

type Props = {
  variant?: "default" | "hero";
};

export default function MarketplaceNav({ variant = "default" }: Props) {
  const { pathname } = useLocation();
  const { isAuthenticated } = useRenterAuth();
  const onHero = variant === "hero";

  if (onHero) {
    return (
      <header className="alis-nav alis-nav--hero alis-nav--home">
        <AlisAdventureLogo size="hero" tone="onDark" className="alis-nav-brand-logo" />
        <nav className="alis-nav-links alis-nav-links--hero">
          <Link to="/boats?category=celebrating" className="alis-nav-link alis-nav-link--upper">
            Special events
          </Link>
          <Link to="/captains" className="alis-nav-link alis-nav-link--upper">
            Captain program
          </Link>
          <Link to="/owner/register" className="alis-nav-link alis-nav-link--upper">
            List your boat
          </Link>
          <Link to="/boats" className="alis-nav-book-btn">
            Book now
          </Link>
        </nav>
      </header>
    );
  }

  return (
    <header className="alis-nav">
      <AlisAdventureLogo size="nav" className="alis-nav-brand-logo" />
      <nav className="alis-nav-links">
        <Link
          to="/boats"
          className={
            pathname.startsWith("/boats") ? "alis-nav-link alis-nav-link--active" : "alis-nav-link"
          }
        >
          Experiences
        </Link>
        <Link
          to="/captains"
          className={
            pathname.startsWith("/captains")
              ? "alis-nav-link alis-nav-link--active"
              : "alis-nav-link"
          }
        >
          Captain program
        </Link>
        <Link to="/owner/register" className="alis-nav-link">
          List your boat
        </Link>
        {isAuthenticated ? (
          <Link
            to="/account"
            className={
              pathname.startsWith("/account")
                ? "alis-nav-link alis-nav-link--active"
                : "alis-nav-link"
            }
          >
            My account
          </Link>
        ) : (
          <>
            <Link to="/account/register" className="alis-nav-link">
              Sign up
            </Link>
            <Link to="/account/login" className="alis-nav-link">
              Log in
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

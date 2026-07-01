import { Link, useLocation } from "react-router-dom";
import { useRenterAuth } from "../renter/RenterAuth";

type Props = {
  variant?: "default" | "hero";
};

function SailLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      <path
        d="M6 26L16 6L26 26H6Z"
        fill="currentColor"
        opacity="0.35"
      />
      <path d="M10 26L16 10L22 26H10Z" fill="currentColor" />
      <path d="M16 6V26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function MarketplaceNav({ variant = "default" }: Props) {
  const { pathname } = useLocation();
  const { isAuthenticated } = useRenterAuth();
  const onHero = variant === "hero";

  if (onHero) {
    return (
      <header className="alis-nav alis-nav--hero alis-nav--home">
        <Link to="/" className="alis-nav-brand alis-nav-brand--full">
          <SailLogo className="alis-nav-logo" />
          <span>AlisAdventure</span>
        </Link>
        <nav className="alis-nav-links alis-nav-links--hero">
          <Link to="/boats?category=celebrating" className="alis-nav-link alis-nav-link--upper">
            Special events
          </Link>
          <Link to="/boats?captain=captained" className="alis-nav-link alis-nav-link--upper">
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
      <Link to="/" className="alis-nav-brand">
        <SailLogo className="alis-nav-logo alis-nav-logo--dark" />
        <span>AlisAdventure</span>
      </Link>
      <nav className="alis-nav-links">
        <Link
          to="/boats"
          className={
            pathname.startsWith("/boats") ? "alis-nav-link alis-nav-link--active" : "alis-nav-link"
          }
        >
          Experiences
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

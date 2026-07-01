import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** Legacy departures UI — boat rentals use instant book, not scheduled slots. */
export default function AdminSlotsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith("/owner") ? "/owner" : "/admin";

  useEffect(() => {
    navigate(`${base}/activities`, { replace: true });
  }, [base, navigate]);

  return null;
}

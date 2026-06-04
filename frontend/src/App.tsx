import { Route, Routes, useLocation } from "react-router-dom";
import CalendarPage from "./pages/CalendarPage";
import BookingPage from "./pages/BookingPage";
import SuccessPage from "./pages/SuccessPage";
import SiteHeader from "./components/SiteHeader";
import { AdminAuthProvider, RequireAdmin } from "./admin/AdminAuth";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminActivitiesPage from "./pages/admin/AdminActivitiesPage";
import AdminSlotsPage from "./pages/admin/AdminSlotsPage";
import AdminPromosPage from "./pages/admin/AdminPromosPage";
import AdminBookingsPage from "./pages/admin/AdminBookingsPage";

export default function App() {
  const { pathname } = useLocation();
  const isCalendar = pathname === "/";
  const isAdmin = pathname.startsWith("/admin");

  return (
    <AdminAuthProvider>
      <div className={`app${isCalendar ? " app--calendar" : ""}${isAdmin ? " app--admin" : ""}`}>
        {!isCalendar && !isAdmin && <SiteHeader />}
        <main className={isCalendar ? "main main--calendar" : isAdmin ? "" : "main"}>
          <Routes>
            <Route path="/" element={<CalendarPage />} />
            <Route path="/book/:slotId" element={<BookingPage />} />
            <Route path="/success/:reference" element={<SuccessPage />} />

            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminLayout />
                </RequireAdmin>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="activities" element={<AdminActivitiesPage />} />
              <Route path="slots" element={<AdminSlotsPage />} />
              <Route path="promos" element={<AdminPromosPage />} />
              <Route path="bookings" element={<AdminBookingsPage />} />
            </Route>
          </Routes>
        </main>
      </div>
    </AdminAuthProvider>
  );
}

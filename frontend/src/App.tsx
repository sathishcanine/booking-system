import { Route, Routes, useLocation } from "react-router-dom";
import CaptainProgramPage from "./pages/CaptainProgramPage";
import CaptainProfilePage from "./pages/CaptainProfilePage";
import HomePage from "./pages/HomePage";
import CalendarPage from "./pages/CalendarPage";
import BoatsBrowsePage from "./pages/BoatsBrowsePage";
import BoatDetailPage from "./pages/BoatDetailPage";
import BoatRentalBookPage from "./pages/BoatRentalBookPage";
import BoatRentalPayPage from "./pages/BoatRentalPayPage";
import BookingPage from "./pages/BookingPage";
import SuccessPage from "./pages/SuccessPage";
import SiteHeader from "./components/SiteHeader";
import { AdminAuthProvider, RequireOwner, RequireSuperAdmin } from "./admin/AdminAuth";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminLayout from "./pages/admin/AdminLayout";
import OwnerLoginPage from "./pages/owner/OwnerLoginPage";
import OwnerRegisterPage from "./pages/owner/OwnerRegisterPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminActivitiesPage from "./pages/admin/AdminActivitiesPage";
import AdminSlotsPage from "./pages/admin/AdminSlotsPage";
import AdminPromosPage from "./pages/admin/AdminPromosPage";
import AdminBookingsPage from "./pages/admin/AdminBookingsPage";
import AdminPayoutsPage from "./pages/admin/AdminPayoutsPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminReviewsPage from "./pages/admin/AdminReviewsPage";
import AdminCaptainsPage from "./pages/admin/AdminCaptainsPage";
import AdminContactInquiriesPage from "./pages/admin/AdminContactInquiriesPage";
import ToastHost from "./components/ToastHost";
import { SavedBoatsProvider } from "./hooks/useSavedBoats";
import { RenterAuthProvider, RequireRenter } from "./renter/RenterAuth";
import AccountLoginPage from "./pages/account/AccountLoginPage";
import AccountRegisterPage from "./pages/account/AccountRegisterPage";
import AccountPage from "./pages/account/AccountPage";
import SiteFooter from "./components/SiteFooter";

export default function App() {
  const { pathname } = useLocation();
  const isMarketplace =
    pathname === "/" ||
    pathname.startsWith("/boats") ||
    pathname.startsWith("/captains") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/account");
  const isCalendar = pathname === "/calendar";
  const isAdmin = pathname.startsWith("/admin") || pathname.startsWith("/owner");

  return (
    <RenterAuthProvider>
    <SavedBoatsProvider>
    <AdminAuthProvider>
      <ToastHost />
      <div
        className={`app${isCalendar ? " app--calendar" : ""}${isAdmin ? " app--admin" : ""}${isMarketplace ? " app--marketplace" : ""}`}
      >
        {!isMarketplace && !isAdmin && <SiteHeader />}
        <main className={isCalendar ? "main main--calendar" : isAdmin || isMarketplace ? "" : "main"}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/captains" element={<CaptainProgramPage />} />
            <Route path="/captains/:slug" element={<CaptainProfilePage />} />
            <Route path="/boats" element={<BoatsBrowsePage />} />
            <Route path="/boats/:slug" element={<BoatDetailPage />} />
            <Route path="/boats/:slug/book" element={<BoatRentalBookPage />} />
            <Route path="/boats/:slug/pay/:reference" element={<BoatRentalPayPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/book/:slotId" element={<BookingPage />} />
            <Route path="/success/:reference" element={<SuccessPage />} />

            <Route path="/account/login" element={<AccountLoginPage />} />
            <Route path="/account/register" element={<AccountRegisterPage />} />
            <Route
              path="/account"
              element={
                <RequireRenter>
                  <AccountPage />
                </RequireRenter>
              }
            />

            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/owner/login" element={<OwnerLoginPage />} />
            <Route path="/owner/register" element={<OwnerRegisterPage />} />
            <Route
              path="/admin"
              element={
                <RequireSuperAdmin>
                  <AdminLayout subtitle="Platform admin" />
                </RequireSuperAdmin>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="activities" element={<AdminActivitiesPage />} />
              <Route path="captains" element={<AdminCaptainsPage />} />
              <Route path="slots" element={<AdminSlotsPage />} />
              <Route path="promos" element={<AdminPromosPage />} />
              <Route path="bookings" element={<AdminBookingsPage />} />
              <Route path="reviews" element={<AdminReviewsPage />} />
              <Route path="contact-inquiries" element={<AdminContactInquiriesPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>
            <Route
              path="/owner"
              element={
                <RequireOwner>
                  <AdminLayout basePath="/owner" subtitle="Owner" />
                </RequireOwner>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="activities" element={<AdminActivitiesPage />} />
              <Route path="captains" element={<AdminCaptainsPage />} />
              <Route path="slots" element={<AdminSlotsPage />} />
              <Route path="promos" element={<AdminPromosPage />} />
              <Route path="bookings" element={<AdminBookingsPage />} />
              <Route path="reviews" element={<AdminReviewsPage />} />
              <Route path="payouts" element={<AdminPayoutsPage />} />
            </Route>
          </Routes>
        </main>
        {!isAdmin && <SiteFooter />}
      </div>
    </AdminAuthProvider>
    </SavedBoatsProvider>
    </RenterAuthProvider>
  );
}

import MarketplaceNav from "../components/MarketplaceNav";
import MonthCalendar from "../components/MonthCalendar";

export default function CalendarPage() {
  return (
    <div className="mp-page mp-page--calendar">
      <MarketplaceNav />
      <div className="calendar-month-page">
        <h1 className="calendar-hero-title">ALL DEPARTURES</h1>
        <p className="mp-calendar-sub">
          Real-time availability across every published boat. Select a time to book.
        </p>
        <MonthCalendar />
      </div>
    </div>
  );
}

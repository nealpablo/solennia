import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "../utils/toast";
import BookingAnalyticsChart from "../components/BookingAnalyticsChart";

const API =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "https://solennia.up.railway.app/api" : "/api");

const SOLENNIA = {
  bg: "#f6f0e8",
  primary: "#7a5d47",
  primaryDark: "#5b4636",
  border: "#c9bda4",
  accent: "#e8ddae",
  text: "#3b2f25",
};

export default function VenueDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("solennia_token");
  const role = Number(localStorage.getItem("solennia_role") || 0);

  const [analytics, setAnalytics] = useState(null);
  const [allBookings, setAllBookings] = useState([]);
  const [detailFilter, setDetailFilter] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }
    if (role !== 1) {
      navigate("/profile");
      return;
    }
    loadData();
  }, [token, role, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, ownerBookingsRes] = await Promise.all([
        fetch(`${API}/vendor/analytics`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/venue-bookings/owner`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data.analytics || null);
      }

      if (ownerBookingsRes.ok) {
        const data = await ownerBookingsRes.json();
        const list = Array.isArray(data.bookings) ? data.bookings : data.data?.bookings || [];
        setAllBookings(list);
      }
    } catch (error) {
      console.error("Venue dashboard load error:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "Confirmed": return "bg-green-100 text-green-700";
      case "Pending": return "bg-amber-100 text-amber-800";
      case "Completed": return "bg-[#e3f2fd] text-[#1565c0]";
      case "Cancelled": return "bg-red-100 text-red-700";
      case "Rejected": return "bg-slate-200 text-slate-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getDetailBookings = (filterKey) => {
    if (!filterKey || !allBookings.length) return [];
    const now = new Date();
    if (filterKey === "total") return [...allBookings];
    if (filterKey === "upcoming") {
      return allBookings.filter((b) => {
        const eventDate = new Date(b.EventDate || b.start_date);
        return (b.BookingStatus === "Pending" || b.BookingStatus === "Confirmed") && eventDate >= now;
      });
    }
    const statusMap = { completed: "Completed", cancelled: "Cancelled", rejected: "Rejected" };
    const status = statusMap[filterKey];
    return status ? allBookings.filter((b) => b.BookingStatus === status) : [];
  };

  const detailBookings = detailFilter ? getDetailBookings(detailFilter) : [];
  const detailLabels = {
    total: "Total Venue Bookings",
    upcoming: "Upcoming",
    completed: "Completed",
    cancelled: "Cancelled",
    rejected: "Rejected",
  };

  if (loading && !analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: SOLENNIA.bg }}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: SOLENNIA.primary, borderTopColor: "transparent" }} />
          <p className="text-gray-600">Loading venue dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8" style={{ backgroundColor: SOLENNIA.bg }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: SOLENNIA.primaryDark }}>Venue Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage your venue bookings and activity</p>
          </div>
          <button
            onClick={() => navigate("/manage-listings?venue")}
            className="px-4 py-2 rounded-lg text-white font-semibold hover:opacity-90 transition-opacity shadow-md"
            style={{ backgroundColor: SOLENNIA.primary }}
          >
            Manage Listings
          </button>
        </div>

        {analytics && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <span className="text-sm text-gray-600">
                As of {analytics.as_of ? new Date(analytics.as_of).toLocaleDateString("en-PH", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : new Date().toLocaleDateString("en-PH", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
              </span>
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="text-sm font-medium px-3 py-1.5 rounded-md border hover:bg-[#f6f0e8] disabled:opacity-50 flex items-center gap-1.5"
                style={{ borderColor: SOLENNIA.border, color: SOLENNIA.primaryDark }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <button type="button" onClick={() => setDetailFilter("total")} className="bg-white rounded-xl p-3 border shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7a5d47]/40" style={{ borderColor: SOLENNIA.border }}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: SOLENNIA.primaryDark }}>Total</h3>
                  <svg className="w-5 h-5" style={{ color: SOLENNIA.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <p className="text-2xl font-bold" style={{ color: SOLENNIA.primary }}>{analytics.total_bookings}</p>
                <p className="text-xs text-gray-500 mt-0.5">All-time</p>
              </button>
              <button type="button" onClick={() => setDetailFilter("upcoming")} className="bg-white rounded-xl p-3 border shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7a5d47]/40" style={{ borderColor: SOLENNIA.border }}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: SOLENNIA.primaryDark }}>Upcoming</h3>
                  <svg className="w-5 h-5" style={{ color: SOLENNIA.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <p className="text-2xl font-bold" style={{ color: SOLENNIA.primary }}>{analytics.upcoming_bookings}</p>
                <p className="text-xs text-gray-500 mt-0.5">Pending & Confirmed</p>
              </button>
              <button type="button" onClick={() => setDetailFilter("completed")} className="bg-white rounded-xl p-3 border shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7a5d47]/40" style={{ borderColor: SOLENNIA.border }}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: SOLENNIA.primaryDark }}>Completed</h3>
                  <svg className="w-5 h-5" style={{ color: SOLENNIA.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-2xl font-bold" style={{ color: SOLENNIA.primary }}>{analytics.completed_bookings}</p>
                <p className="text-xs text-gray-500 mt-0.5">Delivered</p>
              </button>
              <button type="button" onClick={() => setDetailFilter("cancelled")} className="bg-white rounded-xl p-3 border shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7a5d47]/40" style={{ borderColor: SOLENNIA.border }}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: SOLENNIA.primaryDark }}>Cancelled</h3>
                  <svg className="w-5 h-5" style={{ color: SOLENNIA.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-2xl font-bold" style={{ color: SOLENNIA.primary }}>{analytics.cancelled_bookings ?? 0}</p>
                <p className="text-xs text-gray-500 mt-0.5">Did not proceed</p>
              </button>
              <button type="button" onClick={() => setDetailFilter("rejected")} className="bg-white rounded-xl p-3 border shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7a5d47]/40" style={{ borderColor: SOLENNIA.border }}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: SOLENNIA.primaryDark }}>Rejected</h3>
                  <svg className="w-5 h-5" style={{ color: SOLENNIA.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <p className="text-2xl font-bold" style={{ color: SOLENNIA.primary }}>{analytics.rejected_bookings ?? 0}</p>
                <p className="text-xs text-gray-500 mt-0.5">Declined</p>
              </button>
            </div>

            <div className="mb-6">
              <BookingAnalyticsChart analytics={analytics} title="Venue bookings by status" />
            </div>
          </>
        )}

        <div className="rounded-xl border shadow-lg bg-white p-6" style={{ borderColor: SOLENNIA.border }}>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: SOLENNIA.primaryDark }}>
            <svg className="w-6 h-6" style={{ color: SOLENNIA.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Recent Venue Bookings
          </h2>
          {allBookings.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-600">No venue bookings yet</p>
              <button onClick={() => navigate("/manage-listings?venue")} className="mt-4 px-6 py-2 rounded-lg text-white font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: SOLENNIA.primary }}>
                Manage Listings
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {allBookings.slice(0, 5).map((b, i) => (
                <div key={b.ID ?? b.id ?? i} className="flex items-center justify-between p-4 rounded-lg border bg-gray-50/50 hover:shadow-md transition-shadow" style={{ borderColor: SOLENNIA.border }}>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">{b.venue_name || b.ServiceName || "Venue booking"}</h3>
                    <p className="text-sm text-gray-600 mt-1">{b.client_name || "Client"}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(b.EventDate || b.start_date)}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusClass(b.BookingStatus)}`}>{b.BookingStatus}</span>
                  <button onClick={() => navigate("/profile")} className="ml-3 text-sm font-medium hover:underline" style={{ color: SOLENNIA.primary }}>View →</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {detailFilter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDetailFilter(null)}>
          <div className="bg-[#f6f0e8] rounded-xl w-full max-w-md max-h-[85vh] overflow-hidden border shadow-xl flex flex-col" style={{ borderColor: SOLENNIA.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b bg-white" style={{ borderColor: SOLENNIA.border }}>
              <h3 className="text-lg font-bold" style={{ color: SOLENNIA.primaryDark }}>{detailLabels[detailFilter]} ({detailBookings.length})</h3>
              <button type="button" onClick={() => setDetailFilter(null)} className="p-2 rounded-lg text-gray-500 hover:bg-[#e8ddae] hover:text-[#5b4636] transition-colors" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              {detailBookings.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-6">No bookings in this category.</p>
              ) : (
                <ul className="space-y-2">
                  {detailBookings.map((b, idx) => (
                    <li key={b.ID ?? b.id ?? idx} className="bg-white rounded-lg p-3 border shadow-sm" style={{ borderColor: SOLENNIA.border }}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate" style={{ color: SOLENNIA.primaryDark }}>{b.venue_name || b.ServiceName || "Venue"}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{formatDate(b.EventDate || b.start_date)} · {b.client_name ?? "Client"}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${getStatusClass(b.BookingStatus)}`}>{b.BookingStatus}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

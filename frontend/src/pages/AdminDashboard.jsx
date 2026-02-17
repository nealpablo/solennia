import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "../utils/toast";
import AdminAnalyticsChart from "../components/AdminAnalyticsChart";
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
  cream: "#e8ddae",
  chart: ["#7a5d47", "#9a7b5c", "#c9bda4", "#5b4636", "#b8a990"],
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("solennia_token");
  const role = Number(localStorage.getItem("solennia_role") || 0);

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || role !== 2) {
      navigate("/");
      return;
    }
    loadAdminAnalytics();
  }, [token, role, navigate]);

  const loadAdminAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.analytics);
      } else if (res.status === 403) {
        toast.error("Access denied: Admin privileges required");
        navigate("/");
      } else {
        toast.error("Failed to load dashboard data");
      }
    } catch (error) {
      console.error("Failed to load admin analytics:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  // Shape for BookingAnalyticsChart: upcoming = Pending + Confirmed
  const chartAnalytics =
    analytics &&
    Object.assign(
      {},
      analytics,
      {
        upcoming_bookings: (analytics.pending_bookings ?? 0) + (analytics.confirmed_bookings ?? 0),
      }
    );

  if (loading && !analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f0e8]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#7a5d47] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f0e8] py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#5b4636] mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">System-wide statistics and overview</p>
          </div>
          {analytics?.as_of && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">
                As of {new Date(analytics.as_of).toLocaleDateString("en-PH", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <button
                type="button"
                onClick={loadAdminAnalytics}
                disabled={loading}
                className="text-sm font-medium px-3 py-1.5 rounded-md border border-[#c9bda4] text-[#5b4636] hover:bg-[#f6f0e8] disabled:opacity-50 flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          )}
        </div>

        {analytics && (
          <>
            {/* User Statistics */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[#5b4636] mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                User Statistics
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow border-[#c9bda4]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#5b4636]">Total Users</h3>
                    <svg className="w-6 h-6 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-[#7a5d47]">{analytics.total_users}</p>
                  <p className="text-xs text-gray-600 mt-1">All registered users</p>
                </div>
                <div className="bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow border-[#c9bda4]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#5b4636]">Clients</h3>
                    <svg className="w-6 h-6 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-[#7a5d47]">{analytics.total_clients}</p>
                  <p className="text-xs text-gray-600 mt-1">Role = 0</p>
                </div>
                <div className="bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow border-[#c9bda4]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#5b4636]">Service Providers</h3>
                    <svg className="w-6 h-6 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-[#7a5d47]">{analytics.total_providers}</p>
                  <p className="text-xs text-gray-600 mt-1">Role = 1</p>
                </div>
                <div className="bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow border-[#c9bda4]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#5b4636]">Approved Providers</h3>
                    <svg className="w-6 h-6 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-[#7a5d47]">{analytics.total_approved_providers}</p>
                  <p className="text-xs text-gray-600 mt-1">Active suppliers/venues</p>
                </div>
              </div>
            </div>

            {/* Applications & Listings */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[#5b4636] mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Applications & Listings
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow border-[#c9bda4]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#5b4636]">Pending Applications</h3>
                    <svg className="w-6 h-6 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-[#7a5d47]">{analytics.pending_applications}</p>
                  <p className="text-xs text-gray-600 mt-1">Awaiting review</p>
                </div>
                <div className="bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow border-[#c9bda4]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#5b4636]">Active Venue Listings</h3>
                    <svg className="w-6 h-6 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-[#7a5d47]">{analytics.total_venue_listings}</p>
                  <p className="text-xs text-gray-600 mt-1">Published venues</p>
                </div>
              </div>
            </div>

            {/* Booking Statistics (aligned with booking.BookingStatus) */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[#5b4636] mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Booking Statistics
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
                <div className="bg-white rounded-xl p-3 border shadow-sm hover:shadow-md transition-shadow border-[#c9bda4]">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-semibold text-[#5b4636] uppercase">Total</h3>
                    <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <p className="text-2xl font-bold text-[#7a5d47]">{analytics.total_bookings}</p>
                  <p className="text-xs text-gray-600 mt-0.5">All-time</p>
                </div>
                <div className="bg-white rounded-xl p-3 border shadow-sm hover:shadow-md transition-shadow border-[#c9bda4]">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-semibold text-[#5b4636] uppercase">Pending</h3>
                    <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-2xl font-bold text-[#7a5d47]">{analytics.pending_bookings}</p>
                  <p className="text-xs text-gray-600 mt-0.5">Awaiting confirmation</p>
                </div>
                <div className="bg-white rounded-xl p-3 border shadow-sm hover:shadow-md transition-shadow border-[#c9bda4]">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-semibold text-[#5b4636] uppercase">Confirmed</h3>
                    <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-2xl font-bold text-[#7a5d47]">{analytics.confirmed_bookings}</p>
                  <p className="text-xs text-gray-600 mt-0.5">Confirmed</p>
                </div>
                <div className="bg-white rounded-xl p-3 border shadow-sm hover:shadow-md transition-shadow border-[#c9bda4]">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-semibold text-[#5b4636] uppercase">Completed</h3>
                    <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-2xl font-bold text-[#7a5d47]">{analytics.completed_bookings}</p>
                  <p className="text-xs text-gray-600 mt-0.5">Delivered</p>
                </div>
                <div className="bg-white rounded-xl p-3 border shadow-sm hover:shadow-md transition-shadow border-[#c9bda4]">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-semibold text-[#5b4636] uppercase">Cancelled</h3>
                    <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-2xl font-bold text-[#7a5d47]">{analytics.cancelled_bookings ?? 0}</p>
                  <p className="text-xs text-gray-600 mt-0.5">Did not proceed</p>
                </div>
                <div className="bg-white rounded-xl p-3 border shadow-sm hover:shadow-md transition-shadow border-[#c9bda4]">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-semibold text-[#5b4636] uppercase">Rejected</h3>
                    <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
                  <p className="text-2xl font-bold text-[#7a5d47]">{analytics.rejected_bookings ?? 0}</p>
                  <p className="text-xs text-gray-600 mt-0.5">Declined</p>
                </div>
              </div>
              <AdminAnalyticsChart analytics={analytics} />
            </div>

            {/* Review Statistics */}
            <div>
              <h2 className="text-lg font-semibold text-[#5b4636] mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#7a5d47]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
                Review Statistics
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow border-[#c9bda4]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#5b4636]">Total Reviews</h3>
                    <svg className="w-6 h-6 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-[#7a5d47]">{analytics.total_reviews}</p>
                  <p className="text-xs text-gray-600 mt-1">Customer feedback</p>
                </div>
                <div className="bg-white rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow border-[#c9bda4]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#5b4636]">Average Rating</h3>
                    <svg className="w-6 h-6 text-[#7a5d47]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-[#7a5d47]">{analytics.average_rating > 0 ? Number(analytics.average_rating).toFixed(2) : "N/A"}</p>
                  <p className="text-xs text-gray-600 mt-1">Out of 5.0 stars</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

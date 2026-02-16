import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "../utils/toast";

const API =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "https://solennia.up.railway.app/api" : "/api");

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("solennia_token");
  const role = Number(localStorage.getItem("solennia_role") || 0);

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only admins can access this page
    if (!token || role !== 2) {
      navigate("/");
      return;
    }

    loadAdminAnalytics();
  }, [token, role]);

  const loadAdminAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
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
      console.error('Failed to load admin analytics:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#5b4636] mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">System-wide statistics and overview</p>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Total Users */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-blue-900">Total Users</h3>
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-blue-700">{analytics.total_users}</p>
                  <p className="text-xs text-blue-600 mt-1">All registered users</p>
                </div>

                {/* Total Clients */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-green-900">Clients</h3>
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-green-700">{analytics.total_clients}</p>
                  <p className="text-xs text-green-600 mt-1">Regular users (role = 0)</p>
                </div>

                {/* Total Providers */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-purple-900">Service Providers</h3>
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-purple-700">{analytics.total_providers}</p>
                  <p className="text-xs text-purple-600 mt-1">Vendors/Venues (role = 1)</p>
                </div>

                {/* Approved Providers */}
                <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-4 border border-teal-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-teal-900">Approved Providers</h3>
                    <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-teal-700">{analytics.total_approved_providers}</p>
                  <p className="text-xs text-teal-600 mt-1">Active service providers</p>
                </div>
              </div>
            </div>

            {/* Application & Listing Statistics */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[#5b4636] mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Applications & Listings
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pending Applications */}
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 border border-yellow-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-yellow-900">Pending Applications</h3>
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-yellow-700">{analytics.pending_applications}</p>
                  <p className="text-xs text-yellow-600 mt-1">Awaiting review</p>
                </div>

                {/* Active Venue Listings */}
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 border border-indigo-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-indigo-900">Active Venue Listings</h3>
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-indigo-700">{analytics.total_venue_listings}</p>
                  <p className="text-xs text-indigo-600 mt-1">Published venues</p>
                </div>
              </div>
            </div>

            {/* Booking Statistics */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[#5b4636] mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Booking Statistics
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Total Bookings */}
                <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-4 border border-pink-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-pink-900">Total Bookings</h3>
                    <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-pink-700">{analytics.total_bookings}</p>
                  <p className="text-xs text-pink-600 mt-1">All-time bookings</p>
                </div>

                {/* Pending Bookings */}
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-orange-900">Pending</h3>
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-orange-700">{analytics.pending_bookings}</p>
                  <p className="text-xs text-orange-600 mt-1">Awaiting confirmation</p>
                </div>

                {/* Confirmed Bookings */}
                <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl p-4 border border-cyan-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-cyan-900">Confirmed</h3>
                    <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-cyan-700">{analytics.confirmed_bookings}</p>
                  <p className="text-xs text-cyan-600 mt-1">Upcoming events</p>
                </div>

                {/* Completed Bookings */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-emerald-900">Completed</h3>
                    <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-emerald-700">{analytics.completed_bookings}</p>
                  <p className="text-xs text-emerald-600 mt-1">Successfully delivered</p>
                </div>
              </div>
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
                {/* Total Reviews */}
                <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-4 border border-violet-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-violet-900">Total Reviews</h3>
                    <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-violet-700">{analytics.total_reviews}</p>
                  <p className="text-xs text-violet-600 mt-1">Customer feedback</p>
                </div>

                {/* Average Rating */}
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-amber-900">Average Rating</h3>
                    <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  </div>
                  <p className="text-3xl font-bold text-amber-700">{analytics.average_rating > 0 ? analytics.average_rating.toFixed(2) : 'N/A'}</p>
                  <p className="text-xs text-amber-600 mt-1">Out of 5.0 stars</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

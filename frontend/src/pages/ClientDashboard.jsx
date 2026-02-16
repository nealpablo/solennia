import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "../utils/toast";

const API =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "https://solennia.up.railway.app/api" : "/api");

export default function ClientDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("solennia_token");
  const role = Number(localStorage.getItem("solennia_role") || 0);

  const [analytics, setAnalytics] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load client analytics and recent bookings
  useEffect(() => {
    if (!token || role !== 0) {
      navigate("/");
      return;
    }

    loadClientData();
  }, [token, role]);

  const loadClientData = async () => {
    setLoading(true);
    try {
      // Fetch both supplier and venue bookings
      const [supplierRes, venueRes] = await Promise.all([
        fetch(`${API}/bookings/user`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/venue-bookings/user`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const supplierData = supplierRes.ok ? await supplierRes.json() : { bookings: [] };
      const venueData = venueRes.ok ? await venueRes.json() : { bookings: [] };

      // Merge bookings
      const supplierBookings = (supplierData.bookings || []).map(b => ({
        ...b,
        booking_type: 'supplier',
        service_name: b.ServiceName || b.vendor_name
      }));

      const venueBookings = (venueData.bookings || []).map(b => ({
        ...b,
        booking_type: 'venue',
        service_name: b.venue_name || b.ServiceName
      }));

      const allBookings = [...supplierBookings, ...venueBookings];

      // Calculate analytics
      const now = new Date();
      const totalBookings = allBookings.length;
      const upcomingBookings = allBookings.filter(b => {
        const eventDate = new Date(b.EventDate || b.start_date);
        return (b.BookingStatus === 'Pending' || b.BookingStatus === 'Confirmed') && eventDate >= now;
      }).length;
      const completedBookings = allBookings.filter(b => b.BookingStatus === 'Completed').length;
      const cancelledBookings = allBookings.filter(b => b.BookingStatus === 'Cancelled').length;

      setAnalytics({
        total_bookings: totalBookings,
        upcoming_bookings: upcomingBookings,
        completed_bookings: completedBookings,
        cancelled_bookings: cancelledBookings
      });

      // Get recent 5 bookings
      const sortedBookings = allBookings.sort((a, b) => {
        const dateA = new Date(a.CreatedAt || a.BookingDate || 0);
        const dateB = new Date(b.CreatedAt || b.BookingDate || 0);
        return dateB - dateA;
      });
      setRecentBookings(sortedBookings.slice(0, 5));

    } catch (error) {
      console.error('Failed to load client data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Confirmed': return 'bg-green-100 text-green-800 border-green-300';
      case 'Pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Completed': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Cancelled': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
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
          <h1 className="text-3xl font-bold text-[#5b4636] mb-2">Client Dashboard</h1>
          <p className="text-gray-600">Overview of your bookings and activity</p>
        </div>

        {/* Analytics Cards - 2 Column Grid like Profile Dashboard */}
        {analytics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {/* Total Bookings */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-blue-900">Total Bookings</h3>
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-blue-700">{analytics.total_bookings}</p>
              <p className="text-xs text-blue-600 mt-1">All-time bookings</p>
            </div>

            {/* Upcoming Bookings */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-green-900">Upcoming</h3>
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-green-700">{analytics.upcoming_bookings}</p>
              <p className="text-xs text-green-600 mt-1">Pending & Confirmed</p>
            </div>

            {/* Completed Bookings */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-purple-900">Completed</h3>
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-purple-700">{analytics.completed_bookings}</p>
              <p className="text-xs text-purple-600 mt-1">Successfully delivered</p>
            </div>

            {/* Cancelled Bookings */}
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-red-900">Cancelled</h3>
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-red-700">{analytics.cancelled_bookings}</p>
              <p className="text-xs text-red-600 mt-1">Did not proceed</p>
            </div>
          </div>
        )}

        {/* Recent Bookings */}
        <div className="bg-white rounded-xl shadow-lg border border-[#c9bda4] p-6">
          <h2 className="text-xl font-bold text-[#5b4636] mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Recent Booking Activity
          </h2>

          {recentBookings.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-600">No bookings yet</p>
              <button
                onClick={() => navigate('/vendors')}
                className="mt-4 px-6 py-2 bg-[#7a5d47] text-white rounded-lg hover:bg-[#6a503d] transition-colors"
              >
                Browse Services
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentBookings.map((booking, index) => (
                <div
                  key={booking.ID || index}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-gray-50"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-1">
                      {booking.service_name || booking.ServiceName || 'Booking'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formatDate(booking.EventDate || booking.start_date)}
                      </span>
                      <span className="text-xs px-2 py-1 bg-gray-200 rounded-full">
                        {booking.booking_type === 'venue' ? 'Venue' : 'Service'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(booking.BookingStatus)}`}>
                      {booking.BookingStatus}
                    </span>
                    <button
                      onClick={() => navigate('/profile')}
                      className="text-[#7a5d47] hover:text-[#6a503d] font-medium text-sm"
                    >
                      View →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

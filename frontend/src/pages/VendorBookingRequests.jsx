// src/pages/MyBookings.jsx - FIXED VERSION
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "../utils/toast";

const API =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://solennia.up.railway.app/api"
    : "/api");

export default function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("solennia_token");
      
      if (!token) {
        toast.error("Please log in to view bookings");
        navigate("/login");
        return;
      }

      const response = await fetch(`${API}/bookings/user`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load bookings");
      }

      setBookings(data.bookings || []);
    } catch (error) {
      console.error("Error loading bookings:", error);
      toast.error(error.message || "Failed to load your bookings");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (bookingId) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;

    try {
      const token = localStorage.getItem("solennia_token");
      
      const response = await fetch(`${API}/bookings/${bookingId}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel booking");
      }

      toast.success("Booking cancelled successfully");
      loadBookings();
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast.error(error.message || "Failed to cancel booking");
    }
  };

  const filteredBookings = bookings.filter(booking => {
    if (filter === "all") return true;
    return booking.BookingStatus === filter;
  });

  // ✅ FIX: Updated getStatusStyle to use 'Rejected' instead of 'Declined'
  const getStatusStyle = (status) => {
    const styles = {
      Pending: { bg: "#fef3c7", text: "#92400e", border: "#fbbf24" },
      Confirmed: { bg: "#d1fae5", text: "#065f46", border: "#34d399" },
      Cancelled: { bg: "#fee2e2", text: "#991b1b", border: "#f87171" },
      Rejected: { bg: "#fee2e2", text: "#991b1b", border: "#f87171" }, // ✅ Changed from Declined
      Completed: { bg: "#e0e7ff", text: "#3730a3", border: "#818cf8" }
    };
    return styles[status] || styles.Pending;
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading your bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>My Bookings</h1>
        <button
          onClick={() => navigate("/vendors")}
          style={styles.newBookingButton}
        >
          + New Booking
        </button>
      </div>

      {/* ✅ FIX: Updated filter options to include 'Rejected' instead of 'Declined' */}
      <div style={styles.filterContainer}>
        {["all", "Pending", "Confirmed", "Rejected", "Cancelled"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              ...styles.filterButton,
              ...(filter === f ? styles.filterButtonActive : {})
            }}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {filteredBookings.length === 0 ? (
        <div style={styles.emptyState}>
          <svg style={styles.emptyIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 style={styles.emptyTitle}>No Bookings Found</h3>
          <p style={styles.emptyText}>
            {filter === "all" 
              ? "You haven't made any bookings yet."
              : `No ${filter.toLowerCase()} bookings found.`}
          </p>
          <button
            onClick={() => navigate("/vendors")}
            style={styles.browseButton}
          >
            Browse Vendors
          </button>
        </div>
      ) : (
        <div style={styles.bookingsList}>
          {filteredBookings.map((booking) => {
            const statusColors = getStatusStyle(booking.BookingStatus);
            const canCancel = booking.BookingStatus === "Pending";

            return (
              <div key={booking.ID} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <h3 style={styles.cardTitle}>{booking.ServiceName}</h3>
                    <p style={styles.cardVendor}>
                      Vendor: <strong>{booking.vendor_name || "Unknown"}</strong>
                    </p>
                  </div>
                  <span
                    style={{
                      ...styles.statusBadge,
                      backgroundColor: statusColors.bg,
                      color: statusColors.text,
                      borderColor: statusColors.border
                    }}
                  >
                    {booking.BookingStatus}
                  </span>
                </div>

                <div style={styles.cardBody}>
                  <div style={styles.infoRow}>
                    <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{new Date(booking.EventDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>

                  <div style={styles.infoRow}>
                    <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{booking.EventLocation}</span>
                  </div>

                  {booking.EventType && (
                    <div style={styles.infoRow}>
                      <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span>Type: {booking.EventType}</span>
                    </div>
                  )}

                  {booking.TotalAmount && (
                    <div style={styles.infoRow}>
                      <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>₱{parseFloat(booking.TotalAmount).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {canCancel && (
                  <div style={styles.cardActions}>
                    <button
                      onClick={() => handleCancel(booking.ID)}
                      style={styles.cancelButton}
                    >
                      Cancel Booking
                    </button>
                  </div>
                )}

                <div style={styles.cardFooter}>
                  <small style={styles.timestamp}>
                    Booked on: {new Date(booking.CreatedAt).toLocaleDateString()}
                  </small>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "2rem 1rem"
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "60vh"
  },
  spinner: {
    width: "3rem",
    height: "3rem",
    border: "4px solid #e8ddae",
    borderTopColor: "transparent",
    borderRadius: "50%",
    animation: "spin 1s linear infinite"
  },
  loadingText: {
    marginTop: "1rem",
    color: "#666",
    fontSize: "1.1rem"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "2rem",
    gap: "1rem",
    flexWrap: "wrap"
  },
  title: {
    fontSize: "2rem",
    fontWeight: "600",
    color: "#1c1b1a",
    margin: 0
  },
  newBookingButton: {
    padding: "0.75rem 1.5rem",
    background: "#8B4513",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  filterContainer: {
    display: "flex",
    gap: "0.75rem",
    marginBottom: "2rem",
    flexWrap: "wrap"
  },
  filterButton: {
    padding: "0.5rem 1.25rem",
    border: "1px solid #c9bda4",
    borderRadius: "9999px",
    background: "#f6f0e8",
    color: "#1c1b1a",
    fontSize: "0.875rem",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  filterButtonActive: {
    background: "#7a5d47",
    color: "#fff",
    borderColor: "#7a5d47"
  },
  emptyState: {
    textAlign: "center",
    padding: "4rem 2rem",
    color: "#666"
  },
  emptyIcon: {
    width: "6rem",
    height: "6rem",
    margin: "0 auto 1rem",
    color: "#ddd"
  },
  emptyTitle: {
    fontSize: "1.5rem",
    fontWeight: "600",
    marginBottom: "0.5rem",
    color: "#333"
  },
  emptyText: {
    fontSize: "1rem",
    marginBottom: "1.5rem"
  },
  browseButton: {
    padding: "0.75rem 2rem",
    background: "#8B4513",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  bookingsList: {
    display: "grid",
    gap: "1.5rem"
  },
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "1.5rem",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    border: "1px solid #e5e5e5"
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1rem",
    gap: "1rem"
  },
  cardTitle: {
    fontSize: "1.25rem",
    fontWeight: "600",
    color: "#1c1b1a",
    marginBottom: "0.25rem"
  },
  cardVendor: {
    color: "#666",
    fontSize: "0.9rem"
  },
  statusBadge: {
    padding: "0.25rem 0.75rem",
    borderRadius: "9999px",
    fontSize: "0.75rem",
    fontWeight: "600",
    border: "1px solid",
    whiteSpace: "nowrap"
  },
  cardBody: {
    marginBottom: "1rem"
  },
  infoRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "0.75rem",
    color: "#444",
    fontSize: "0.9rem"
  },
  icon: {
    width: "1.25rem",
    height: "1.25rem",
    color: "#7a5d47",
    flexShrink: 0
  },
  cardActions: {
    marginTop: "1.5rem",
    paddingTop: "1.5rem",
    borderTop: "1px solid #e5e5e5"
  },
  cancelButton: {
    padding: "0.75rem 1.5rem",
    border: "1px solid #dc2626",
    borderRadius: "8px",
    background: "#fff",
    color: "#dc2626",
    fontSize: "0.9rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  cardFooter: {
    marginTop: "1rem",
    paddingTop: "1rem",
    borderTop: "1px solid #e5e5e5"
  },
  timestamp: {
    color: "#999",
    fontSize: "0.8rem"
  }
};
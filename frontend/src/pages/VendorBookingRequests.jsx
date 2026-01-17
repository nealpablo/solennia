/**
 * ============================================
 * VENDOR BOOKING REQUESTS PAGE
 * ============================================
 * Shows all booking requests received by vendor
 * Vendor can accept or decline requests
 * ============================================
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "../utils/toast";

const API =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://solennia.up.railway.app/api"
    : "/api");

export default function VendorBookingRequests() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  // Load vendor's booking requests
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

      const response = await fetch(`${API}/bookings/vendor`, {
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
      toast.error(error.message || "Failed to load booking requests");
    } finally {
      setLoading(false);
    }
  };

  // Handle accept booking
  const handleAccept = async (bookingId) => {
    if (!confirm("Accept this booking request?")) return;

    try {
      const token = localStorage.getItem("solennia_token");
      
      const response = await fetch(`${API}/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: "Confirmed" })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to accept booking");
      }

      toast.success("Booking accepted successfully!");
      loadBookings(); // Reload the list
    } catch (error) {
      console.error("Error accepting booking:", error);
      toast.error(error.message || "Failed to accept booking");
    }
  };

  // Handle decline booking
  const handleDecline = async (bookingId) => {
    if (!confirm("Decline this booking request?")) return;

    try {
      const token = localStorage.getItem("solennia_token");
      
      const response = await fetch(`${API}/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: "Declined" })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to decline booking");
      }

      toast.success("Booking declined");
      loadBookings(); // Reload the list
    } catch (error) {
      console.error("Error declining booking:", error);
      toast.error(error.message || "Failed to decline booking");
    }
  };

  // Filter bookings
  const filteredBookings = bookings.filter(booking => {
    if (filter === "all") return true;
    return booking.status === filter;
  });

  // Get status badge style
  const getStatusStyle = (status) => {
    const styles = {
      Pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      Confirmed: "bg-green-100 text-green-800 border-green-300",
      Declined: "bg-red-100 text-red-800 border-red-300",
      Cancelled: "bg-gray-100 text-gray-800 border-gray-300"
    };
    return styles[status] || "bg-gray-100 text-gray-800 border-gray-300";
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading booking requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Booking Requests</h1>
        <p style={styles.subtitle}>
          Manage your booking requests from clients
        </p>
      </div>

      {/* Filters */}
      <div style={styles.filterContainer}>
        {["all", "Pending", "Confirmed", "Declined"].map((f) => (
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

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div style={styles.emptyState}>
          <svg style={styles.emptyIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 style={styles.emptyTitle}>No Booking Requests</h3>
          <p style={styles.emptyText}>
            {filter === "all" 
              ? "You haven't received any booking requests yet."
              : `No ${filter.toLowerCase()} bookings found.`}
          </p>
        </div>
      ) : (
        <div style={styles.bookingsList}>
          {filteredBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onAccept={handleAccept}
              onDecline={handleDecline}
              getStatusStyle={getStatusStyle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Booking Card Component
function BookingCard({ booking, onAccept, onDecline, getStatusStyle }) {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isPending = booking.status === "Pending";

  return (
    <div style={styles.card}>
      {/* Card Header */}
      <div style={styles.cardHeader}>
        <div>
          <h3 style={styles.cardTitle}>{booking.service_name}</h3>
          <p style={styles.cardClient}>
            Client: <strong>{booking.client_name || "Unknown"}</strong>
          </p>
        </div>
        <span
          style={{
            ...styles.statusBadge,
            ...getStatusStyle(booking.status)
          }}
          className={getStatusStyle(booking.status)}
        >
          {booking.status}
        </span>
      </div>

      {/* Card Body */}
      <div style={styles.cardBody}>
        <div style={styles.infoRow}>
          <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{formatDate(booking.event_date)}</span>
        </div>

        <div style={styles.infoRow}>
          <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{booking.event_location}</span>
        </div>

        {booking.event_type && (
          <div style={styles.infoRow}>
            <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span>Event Type: {booking.event_type}</span>
          </div>
        )}

        {booking.package_selected && (
          <div style={styles.infoRow}>
            <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span>Package: {booking.package_selected}</span>
          </div>
        )}

        {booking.total_amount && (
          <div style={styles.infoRow}>
            <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Amount: ₱{parseFloat(booking.total_amount).toLocaleString()}</span>
          </div>
        )}

        {booking.additional_notes && (
          <div style={styles.notesContainer}>
            <p style={styles.notesLabel}>Additional Notes:</p>
            <p style={styles.notesText}>{booking.additional_notes}</p>
          </div>
        )}
      </div>

      {/* Card Actions */}
      {isPending && (
        <div style={styles.cardActions}>
          <button
            onClick={() => onDecline(booking.id)}
            style={styles.declineButton}
          >
            Decline
          </button>
          <button
            onClick={() => onAccept(booking.id)}
            style={styles.acceptButton}
          >
            Accept Booking
          </button>
        </div>
      )}

      <div style={styles.cardFooter}>
        <small style={styles.timestamp}>
          Requested: {new Date(booking.created_at).toLocaleDateString()}
        </small>
      </div>
    </div>
  );
}

// Styles
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
    marginBottom: "2rem",
    textAlign: "center"
  },
  title: {
    fontSize: "2rem",
    fontWeight: "600",
    color: "#1c1b1a",
    marginBottom: "0.5rem"
  },
  subtitle: {
    color: "#666",
    fontSize: "1rem"
  },
  filterContainer: {
    display: "flex",
    gap: "0.75rem",
    marginBottom: "2rem",
    flexWrap: "wrap",
    justifyContent: "center"
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
    fontSize: "1rem"
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
  cardClient: {
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
  notesContainer: {
    marginTop: "1rem",
    padding: "1rem",
    background: "#f9f9f9",
    borderRadius: "8px",
    border: "1px solid #e5e5e5"
  },
  notesLabel: {
    fontSize: "0.875rem",
    fontWeight: "600",
    color: "#666",
    marginBottom: "0.5rem"
  },
  notesText: {
    fontSize: "0.9rem",
    color: "#444",
    lineHeight: "1.5"
  },
  cardActions: {
    display: "flex",
    gap: "1rem",
    marginTop: "1.5rem",
    paddingTop: "1.5rem",
    borderTop: "1px solid #e5e5e5"
  },
  declineButton: {
    flex: 1,
    padding: "0.75rem",
    border: "1px solid #dc2626",
    borderRadius: "8px",
    background: "#fff",
    color: "#dc2626",
    fontSize: "0.9rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  acceptButton: {
    flex: 1,
    padding: "0.75rem",
    border: "none",
    borderRadius: "8px",
    background: "#8B4513",
    color: "#fff",
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
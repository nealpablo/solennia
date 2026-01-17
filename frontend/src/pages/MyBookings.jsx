/**
 * ============================================
 * MY BOOKINGS PAGE
 * ============================================
 * Displays all bookings for the logged-in user
 * Developer: Ryan (01-17_Ryan_Manual-Booking)
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

export default function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("All");

  // Status options
  const statusOptions = ["All", "Pending", "Confirmed", "Cancelled", "Completed", "Rejected"];

  // Load bookings
  useEffect(() => {
    loadBookings();
  }, []);

  // Filter bookings when status changes
  useEffect(() => {
    if (selectedStatus === "All") {
      setFilteredBookings(bookings);
    } else {
      setFilteredBookings(
        bookings.filter(b => b.BookingStatus === selectedStatus)
      );
    }
  }, [selectedStatus, bookings]);

  async function loadBookings() {
    try {
      setLoading(true);
      
      const token = localStorage.getItem("solennia_token");
      if (!token) {
        toast.error("Please log in to view your bookings");
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
      setFilteredBookings(data.bookings || []);

    } catch (error) {
      console.error("Load bookings error:", error);
      toast.error(error.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }

  // Format date for display
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

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return "N/A";
    return `₱${parseFloat(amount).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  // Get status badge style
  const getStatusStyle = (status) => {
    const baseStyle = {
      display: "inline-block",
      padding: "0.25rem 0.75rem",
      borderRadius: "12px",
      fontSize: "0.875rem",
      fontWeight: "500"
    };

    switch (status) {
      case "Pending":
        return { ...baseStyle, backgroundColor: "#fef3c7", color: "#92400e" };
      case "Confirmed":
        return { ...baseStyle, backgroundColor: "#d1fae5", color: "#065f46" };
      case "Cancelled":
        return { ...baseStyle, backgroundColor: "#fee2e2", color: "#991b1b" };
      case "Completed":
        return { ...baseStyle, backgroundColor: "#e0e7ff", color: "#3730a3" };
      case "Rejected":
        return { ...baseStyle, backgroundColor: "#fce7f3", color: "#9f1239" };
      default:
        return { ...baseStyle, backgroundColor: "#f3f4f6", color: "#374151" };
    }
  };

  // Chat with vendor
  const handleChat = (vendorFirebaseUid) => {
    if (vendorFirebaseUid) {
      navigate(`/chat?to=${encodeURIComponent(vendorFirebaseUid)}`);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <p style={styles.loadingText}>Loading your bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>My Bookings</h1>
        <p style={styles.subtitle}>
          Manage and track all your event service bookings
        </p>
      </div>

      {/* Filter Buttons */}
      <div style={styles.filterContainer}>
        {statusOptions.map(status => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            style={{
              ...styles.filterButton,
              ...(selectedStatus === status ? styles.filterButtonActive : {})
            }}
          >
            {status}
            {status === "All" && ` (${bookings.length})`}
            {status !== "All" && ` (${bookings.filter(b => b.BookingStatus === status).length})`}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📅</div>
          <h2 style={styles.emptyTitle}>
            {selectedStatus === "All" ? "No bookings yet" : `No ${selectedStatus.toLowerCase()} bookings`}
          </h2>
          <p style={styles.emptyText}>
            {selectedStatus === "All" 
              ? "Start by browsing vendors and booking your first service!"
              : `You don't have any ${selectedStatus.toLowerCase()} bookings at the moment.`}
          </p>
          {selectedStatus === "All" && (
            <button
              onClick={() => navigate("/vendors")}
              style={styles.browseButton}
            >
              Browse Vendors
            </button>
          )}
        </div>
      ) : (
        <div style={styles.bookingsList}>
          {filteredBookings.map(booking => (
            <div key={booking.ID} style={styles.bookingCard}>
              
              {/* Card Header */}
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.serviceName}>{booking.ServiceName}</h3>
                  <p style={styles.vendorName}>
                    by {booking.vendor_name}
                  </p>
                </div>
                <span style={getStatusStyle(booking.BookingStatus)}>
                  {booking.BookingStatus}
                </span>
              </div>

              {/* Card Body */}
              <div style={styles.cardBody}>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>📅 Event Date:</span>
                  <span style={styles.infoValue}>{formatDate(booking.EventDate)}</span>
                </div>

                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>📍 Location:</span>
                  <span style={styles.infoValue}>{booking.EventLocation}</span>
                </div>

                {booking.EventType && (
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>🎉 Event Type:</span>
                    <span style={styles.infoValue}>{booking.EventType}</span>
                  </div>
                )}

                {booking.PackageSelected && (
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>📦 Package:</span>
                    <span style={styles.infoValue}>{booking.PackageSelected}</span>
                  </div>
                )}

                {booking.TotalAmount && (
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>💰 Amount:</span>
                    <span style={styles.infoValue}>{formatCurrency(booking.TotalAmount)}</span>
                  </div>
                )}

                {booking.AdditionalNotes && (
                  <div style={styles.notesContainer}>
                    <p style={styles.notesLabel}>📝 Additional Notes:</p>
                    <p style={styles.notesText}>{booking.AdditionalNotes}</p>
                  </div>
                )}

                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>📆 Booked On:</span>
                  <span style={styles.infoValue}>
                    {new Date(booking.CreatedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div style={styles.cardFooter}>
                <button
                  onClick={() => handleChat(booking.vendor_firebase_uid)}
                  style={styles.chatButton}
                >
                  💬 Message Vendor
                </button>

                <div style={styles.actionButtons}>
                  <span style={styles.placeholderText}>
                    More actions coming soon
                  </span>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}
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
  header: {
    textAlign: "center",
    marginBottom: "2rem"
  },
  title: {
    fontSize: "2.5rem",
    fontWeight: "700",
    color: "#1f2937",
    margin: "0 0 0.5rem 0"
  },
  subtitle: {
    fontSize: "1.1rem",
    color: "#6b7280",
    margin: 0
  },
  filterContainer: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "2rem",
    flexWrap: "wrap",
    justifyContent: "center"
  },
  filterButton: {
    padding: "0.5rem 1rem",
    border: "1px solid #d1d5db",
    borderRadius: "20px",
    backgroundColor: "#fff",
    color: "#6b7280",
    fontSize: "0.875rem",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  filterButtonActive: {
    backgroundColor: "#8B4513",
    color: "#fff",
    borderColor: "#8B4513"
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "60vh"
  },
  loadingText: {
    fontSize: "1.2rem",
    color: "#6b7280"
  },
  emptyState: {
    textAlign: "center",
    padding: "4rem 2rem",
    backgroundColor: "#fff",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
  },
  emptyIcon: {
    fontSize: "4rem",
    marginBottom: "1rem"
  },
  emptyTitle: {
    fontSize: "1.5rem",
    fontWeight: "600",
    color: "#1f2937",
    margin: "0 0 0.5rem 0"
  },
  emptyText: {
    fontSize: "1rem",
    color: "#6b7280",
    marginBottom: "1.5rem"
  },
  browseButton: {
    padding: "0.75rem 2rem",
    fontSize: "1rem",
    fontWeight: "500",
    border: "none",
    borderRadius: "6px",
    backgroundColor: "#8B4513",
    color: "#fff",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  bookingsList: {
    display: "grid",
    gap: "1.5rem",
    gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))"
  },
  bookingCard: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    overflow: "hidden",
    transition: "transform 0.2s, box-shadow 0.2s"
  },
  cardHeader: {
    padding: "1.5rem",
    backgroundColor: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "1rem"
  },
  serviceName: {
    margin: "0 0 0.25rem 0",
    fontSize: "1.25rem",
    fontWeight: "600",
    color: "#1f2937"
  },
  vendorName: {
    margin: 0,
    fontSize: "0.95rem",
    color: "#6b7280"
  },
  cardBody: {
    padding: "1.5rem"
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "0.75rem",
    fontSize: "0.95rem"
  },
  infoLabel: {
    color: "#6b7280",
    fontWeight: "500"
  },
  infoValue: {
    color: "#1f2937",
    fontWeight: "500",
    textAlign: "right"
  },
  notesContainer: {
    backgroundColor: "#f9fafb",
    padding: "1rem",
    borderRadius: "6px",
    marginTop: "1rem"
  },
  notesLabel: {
    margin: "0 0 0.5rem 0",
    fontSize: "0.875rem",
    color: "#6b7280",
    fontWeight: "500"
  },
  notesText: {
    margin: 0,
    fontSize: "0.95rem",
    color: "#1f2937",
    lineHeight: "1.5"
  },
  cardFooter: {
    padding: "1rem 1.5rem",
    backgroundColor: "#f9fafb",
    borderTop: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem"
  },
  chatButton: {
    padding: "0.5rem 1rem",
    fontSize: "0.875rem",
    fontWeight: "500",
    border: "1px solid #8B4513",
    borderRadius: "6px",
    backgroundColor: "#fff",
    color: "#8B4513",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  actionButtons: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center"
  },
  placeholderText: {
    fontSize: "0.875rem",
    color: "#9ca3af",
    fontStyle: "italic"
  }
};
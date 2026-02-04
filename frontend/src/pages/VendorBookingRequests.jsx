import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "../utils/toast";
import BookingDetailsModal from "../components/BookingDetailsModal";

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
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Check if user is a vendor
    const role = Number(localStorage.getItem("solennia_role") || 0);
    if (role !== 1) {
      toast.error("Access denied. Suppliers only.");
      navigate("/");
      return;
    }
    
    loadBookings();
  }, [navigate]);

  /**
   * Load all booking requests for the vendor
   */
  const loadBookings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("solennia_token");
      
      if (!token) {
        toast.error("Please log in to view booking requests");
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
        throw new Error(data.error || "Failed to load booking requests");
      }

      setBookings(data.bookings || []);
    } catch (error) {
      console.error("Error loading bookings:", error);
      toast.error(error.message || "Failed to load booking requests");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load complete details for a specific booking
   */
  const loadBookingDetails = async (bookingId) => {
    try {
      const token = localStorage.getItem("solennia_token");
      const response = await fetch(`${API}/bookings/${bookingId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setSelectedBooking(data.booking);
      } else {
        toast.error(data.error || "Failed to load booking details");
      }
    } catch (error) {
      console.error("Error loading booking details:", error);
      toast.error("Failed to load booking details");
    }
  };

  /**
   * Accept a booking request
   */
  const handleAccept = async (bookingId) => {
    setProcessing(true);
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
      loadBookings(); // Reload bookings
      setSelectedBooking(null); // Close modal
    } catch (error) {
      console.error("Error accepting booking:", error);
      toast.error(error.message || "Failed to accept booking");
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Reject a booking request
   */
  const handleReject = async (bookingId) => {
    setProcessing(true);
    try {
      const token = localStorage.getItem("solennia_token");
      
      const response = await fetch(`${API}/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: "Rejected" })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject booking");
      }

      toast.success("Booking rejected");
      loadBookings(); // Reload bookings
      setSelectedBooking(null); // Close modal
    } catch (error) {
      console.error("Error rejecting booking:", error);
      toast.error(error.message || "Failed to reject booking");
    } finally {
      setProcessing(false);
    }
  };

  /**
   * UC08: Mark a Confirmed booking as Completed
   * This allows the client to leave feedback
   */
  const handleComplete = async (bookingId) => {
    if (!confirm("Mark this booking as completed? The client will be able to leave feedback.")) {
      return;
    }

    setProcessing(true);
    try {
      const token = localStorage.getItem("solennia_token");
      
      const response = await fetch(`${API}/bookings/${bookingId}/complete`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to mark as completed");
      }

      toast.success("Booking marked as completed! Client can now leave feedback.", { duration: 5000 });
      await loadBookings();
    } catch (error) {
      console.error("Complete booking error:", error);
      toast.error(error.message || "Failed to mark as completed");
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Filter bookings by status
   */
  const filteredBookings = bookings.filter(booking => {
    if (filter === "all") return true;
    return booking.BookingStatus === filter;
  });

  /**
   * Get status badge styling
   */
  const getStatusStyle = (status) => {
    const statusStyles = {
      Pending: { bg: "#fef3c7", text: "#92400e", border: "#fbbf24" },
      Confirmed: { bg: "#d1fae5", text: "#065f46", border: "#34d399" },
      Cancelled: { bg: "#fee2e2", text: "#991b1b", border: "#f87171" },
      Rejected: { bg: "#fee2e2", text: "#991b1b", border: "#f87171" },
      Completed: { bg: "#e0e7ff", text: "#3730a3", border: "#818cf8" }
    };
    return statusStyles[status] || statusStyles.Pending;
  };

  /**
   * Loading state
   */
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading booking requests...</p>
        </div>
      </div>
    );
  };

  /**
   * Main render
   */
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Booking Requests</h1>
        <div style={styles.stats}>
          <span style={styles.statBadge}>
            Total: {bookings.length}
          </span>
          <span style={{...styles.statBadge, ...styles.pendingBadge}}>
            Pending: {bookings.filter(b => b.BookingStatus === 'Pending').length}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={styles.filterContainer}>
        {["all", "Pending", "Confirmed", "Rejected", "Cancelled", "Completed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              ...styles.filterButton,
              ...(filter === f ? styles.filterButtonActive : {})
            }}
          >
            {f === "all" ? "All" : f}
            {f !== "all" && (
              <span style={styles.filterCount}>
                {bookings.filter(b => b.BookingStatus === f).length}
              </span>
            )}
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
          {filteredBookings.map((booking) => {
            const statusColors = getStatusStyle(booking.BookingStatus);
            const isPending = booking.BookingStatus === "Pending";
            const isConfirmed = booking.BookingStatus === "Confirmed";

            return (
              <div key={booking.ID} style={styles.card}>
                
                {/* Card Header */}
                <div style={styles.cardHeader}>
                  <div>
                    <h3 style={styles.cardTitle}>{booking.ServiceName}</h3>
                    <p style={styles.cardClient}>
                      Client: <strong>{booking.client_name || "Unknown"}</strong>
                    </p>
                    {booking.client_email && (
                      <p style={styles.cardEmail}>{booking.client_email}</p>
                    )}
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

                {/* Card Body */}
                <div style={styles.cardBody}>
                  <div style={styles.infoGrid}>
                    <div style={styles.infoItem}>
                      <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <label style={styles.infoLabel}>Event Date</label>
                        <span style={styles.infoValue}>
                          {new Date(booking.EventDate).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                    </div>

                    <div style={styles.infoItem}>
                      <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div>
                        <label style={styles.infoLabel}>Location</label>
                        <span style={styles.infoValue}>{booking.EventLocation}</span>
                      </div>
                    </div>

                    {booking.TotalAmount && (
                      <div style={styles.infoItem}>
                        <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <label style={styles.infoLabel}>Amount</label>
                          <span style={styles.infoValue}>
                            ₱{parseFloat(booking.TotalAmount).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {booking.AdditionalNotes && (
                    <div style={styles.notesSection}>
                      <label style={styles.notesLabel}>Additional Notes:</label>
                      <p style={styles.notesText}>{booking.AdditionalNotes}</p>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div style={styles.cardActions}>
                  {isPending && (
                    <>
                      <button
                        onClick={() => loadBookingDetails(booking.ID)}
                        style={styles.viewBtn}
                      >
                        View Full Details
                      </button>
                      <button
                        onClick={() => handleAccept(booking.ID)}
                        disabled={processing}
                        style={styles.acceptBtn}
                      >
                        {processing ? 'Processing...' : 'Accept'}
                      </button>
                      <button
                        onClick={() => handleReject(booking.ID)}
                        disabled={processing}
                        style={styles.rejectBtn}
                      >
                        {processing ? 'Processing...' : 'Reject'}
                      </button>
                    </>
                  )}
                  
                  {!isPending && (
                    <button
                      onClick={() => loadBookingDetails(booking.ID)}
                      style={styles.viewBtn}
                    >
                      View Details
                    </button>
                  )}
                  
                  {/* UC08: Mark as Completed button (only for Confirmed bookings) */}
                  {isConfirmed && (
                    <button
                      onClick={() => handleComplete(booking.ID)}
                      disabled={processing}
                      style={styles.completeBtn}
                    >
                      {processing ? 'Processing...' : '✅ Mark as Completed'}
                    </button>
                  )}
                </div>

                {/* Card Footer */}
                <div style={styles.cardFooter}>
                  <small style={styles.timestamp}>
                    Requested on: {new Date(booking.CreatedAt).toLocaleDateString()}
                  </small>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Booking Details Modal */}
      <BookingDetailsModal
        booking={selectedBooking}
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        userRole={1}
        onAccept={handleAccept}
        onReject={handleReject}
        processing={processing}
      />
    </div>
  );
}

/**
 * Styles
 */
const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "2rem 1rem",
    minHeight: "100vh"
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
    flexWrap: "wrap",
    gap: "1rem"
  },
  title: {
    fontSize: "2rem",
    fontWeight: "600",
    color: "#1c1b1a",
    margin: 0
  },
  stats: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap"
  },
  statBadge: {
    padding: "0.5rem 1rem",
    backgroundColor: "#f6f0e8",
    borderRadius: "9999px",
    fontSize: "0.875rem",
    fontWeight: "600",
    color: "#1c1b1a"
  },
  pendingBadge: {
    backgroundColor: "#fef3c7",
    color: "#92400e"
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
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem"
  },
  filterButtonActive: {
    background: "#7a5d47",
    color: "#fff",
    borderColor: "#7a5d47"
  },
  filterCount: {
    fontSize: "0.75rem",
    backgroundColor: "rgba(255,255,255,0.3)",
    padding: "0.125rem 0.5rem",
    borderRadius: "9999px"
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
  bookingsList: {
    display: "grid",
    gap: "1.5rem"
  },
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "1.5rem",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    border: "1px solid #e5e5e5",
    transition: "box-shadow 0.2s"
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1.25rem",
    gap: "1rem",
    paddingBottom: "1rem",
    borderBottom: "1px solid #f0f0f0"
  },
  cardTitle: {
    fontSize: "1.25rem",
    fontWeight: "600",
    color: "#1c1b1a",
    marginBottom: "0.25rem"
  },
  cardClient: {
    color: "#666",
    fontSize: "0.95rem",
    marginTop: "0.25rem"
  },
  cardEmail: {
    color: "#888",
    fontSize: "0.85rem",
    marginTop: "0.125rem"
  },
  statusBadge: {
    padding: "0.4rem 1rem",
    borderRadius: "9999px",
    fontSize: "0.8rem",
    fontWeight: "600",
    border: "2px solid",
    whiteSpace: "nowrap",
    alignSelf: "flex-start"
  },
  cardBody: {
    marginBottom: "1.25rem"
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "1rem",
    marginBottom: "1rem"
  },
  infoItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.75rem"
  },
  icon: {
    width: "1.25rem",
    height: "1.25rem",
    color: "#7a5d47",
    flexShrink: 0,
    marginTop: "0.25rem"
  },
  infoLabel: {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "0.25rem"
  },
  infoValue: {
    fontSize: "0.95rem",
    color: "#1c1b1a",
    fontWeight: "500"
  },
  notesSection: {
    marginTop: "1rem",
    padding: "1rem",
    backgroundColor: "#f9f9f9",
    borderRadius: "8px",
    border: "1px solid #e5e5e5"
  },
  notesLabel: {
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.05em"
  },
  notesText: {
    fontSize: "0.9rem",
    color: "#333",
    marginTop: "0.5rem",
    lineHeight: "1.6",
    margin: "0.5rem 0 0 0"
  },
  cardActions: {
    display: "flex",
    gap: "0.75rem",
    paddingTop: "1.25rem",
    borderTop: "1px solid #e5e5e5",
    flexWrap: "wrap"
  },
  viewBtn: {
    flex: "1",
    minWidth: "120px",
    padding: "0.75rem 1.25rem",
    backgroundColor: "#7a5d47",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "0.9rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  acceptBtn: {
    flex: "1",
    minWidth: "100px",
    padding: "0.75rem 1.25rem",
    backgroundColor: "#16a34a",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "0.9rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  rejectBtn: {
    flex: "1",
    minWidth: "100px",
    padding: "0.75rem 1.25rem",
    backgroundColor: "#dc2626",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "0.9rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  completeBtn: {
    flex: "1",
    minWidth: "150px",
    padding: "0.75rem 1.25rem",
    backgroundColor: "#7c3aed",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
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
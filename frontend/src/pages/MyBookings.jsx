// ============================================
// MY BOOKINGS PAGE WITH SEPARATE SECTIONS
// ============================================
// FEATURES:
// 1. Original Booking Details (always visible)
// 2. Pending Reschedule Request (yellow section)
// 3. Approved Reschedules History (green section)
// 4. Rejected Reschedules History (red section)
// ============================================

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
  const [processing, setProcessing] = useState(false);

  // Reschedule modal state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    new_date: "",
    new_time: "14:00"
  });

  useEffect(() => {
    loadBookings();
  }, []);

  const formatDateTime = (dateString) => {
    if (!dateString) return { date: 'N/A', time: 'N/A', full: 'N/A' };
    
    const date = new Date(dateString);
    const dateFormatted = date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const timeFormatted = date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
    const full = `${dateFormatted} at ${timeFormatted}`;
    
    return { date: dateFormatted, time: timeFormatted, full };
  };

  const loadBookings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("solennia_token");
      
      if (!token) {
        toast.error("Please log in");
        navigate("/");
        return;
      }

      const response = await fetch(`${API}/bookings/user`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load bookings");
      }

      setBookings(data.bookings || []);
    } catch (error) {
      console.error("Load bookings error:", error);
      toast.error(error.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (bookingId) => {
    if (!confirm("Cancel this booking?")) return;

    setProcessing(true);
    try {
      const token = localStorage.getItem("solennia_token");
      
      const response = await fetch(`${API}/bookings/${bookingId}/cancel`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel");
      }

      toast.success("Booking cancelled");
      loadBookings();
    } catch (error) {
      console.error("Cancel error:", error);
      toast.error(error.message || "Failed to cancel");
    } finally {
      setProcessing(false);
    }
  };

  const openRescheduleModal = (booking) => {
    setRescheduleBooking(booking);
    
    const currentDate = new Date(booking.EventDate);
    const dateStr = currentDate.toISOString().split('T')[0];
    const timeStr = currentDate.toTimeString().slice(0, 5);
    
    setRescheduleForm({
      new_date: dateStr,
      new_time: timeStr
    });
    
    setShowRescheduleModal(true);
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    
    if (!rescheduleForm.new_date || !rescheduleForm.new_time) {
      toast.error("Please select date and time");
      return;
    }
    
    try {
      setProcessing(true);
      
      const newEventDateTime = `${rescheduleForm.new_date} ${rescheduleForm.new_time}:00`;
      const token = localStorage.getItem("solennia_token");
      
      const res = await fetch(`${API}/bookings/${rescheduleBooking.ID}/reschedule`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_event_date: newEventDateTime })
      });
      
      const data = await res.json();
      
      if (res.status === 409 && data.conflict) {
        toast.error("Vendor unavailable for that date/time", { duration: 8000 });
        return;
      }
      
      if (!data.success) {
        throw new Error(data.error || "Failed to reschedule");
      }
      
      toast.success("Reschedule request sent! Waiting for vendor approval.", { duration: 6000 });
      
      setShowRescheduleModal(false);
      setRescheduleBooking(null);
      setRescheduleForm({ new_date: "", new_time: "14:00" });
      loadBookings();
      
    } catch (error) {
      console.error("Reschedule error:", error);
      toast.error(error.message || "Failed to reschedule");
    } finally {
      setProcessing(false);
    }
  };

  const filteredBookings = bookings.filter(booking => {
    if (filter === "all") return true;
    return booking.BookingStatus === filter;
  });

  const getStatusStyle = (status) => {
    const styles = {
      Pending: { bg: "#fef3c7", text: "#92400e", border: "#fbbf24" },
      Confirmed: { bg: "#d1fae5", text: "#065f46", border: "#34d399" },
      Cancelled: { bg: "#fee2e2", text: "#991b1b", border: "#f87171" },
      Rejected: { bg: "#fee2e2", text: "#991b1b", border: "#f87171" },
      Completed: { bg: "#e0e7ff", text: "#3730a3", border: "#818cf8" }
    };
    return styles[status] || styles.Pending;
  };

  const getRescheduleStatusBadge = (status) => {
    const styles = {
      Pending: { bg: "#fef3c7", text: "#92400e", icon: "⏳" },
      Approved: { bg: "#d1fae5", text: "#065f46", icon: "✅" },
      Rejected: { bg: "#fee2e2", text: "#991b1b", icon: "❌" }
    };
    return styles[status] || styles.Pending;
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>My Bookings</h1>
        <button onClick={() => navigate("/vendors")} style={styles.newBookingButton}>
          + New Booking
        </button>
      </div>

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
            {filter === "all" ? "You haven't made any bookings yet." : `No ${filter.toLowerCase()} bookings found.`}
          </p>
          <button onClick={() => navigate("/vendors")} style={styles.browseButton}>
            Browse Vendors
          </button>
        </div>
      ) : (
        <div style={styles.bookingsList}>
          {filteredBookings.map((booking) => {
            const statusColors = getStatusStyle(booking.BookingStatus);
            const canCancel = booking.BookingStatus === "Pending" && !booking.has_pending_reschedule;
            const canReschedule = booking.BookingStatus === "Confirmed" && !booking.has_pending_reschedule;
            
            // Determine display date
            const displayDate = booking.has_pending_reschedule && booking.original_date 
              ? booking.original_date 
              : booking.EventDate;
            const display = formatDateTime(displayDate);

            // Get reschedule history
            const rescheduleHistory = booking.reschedule_history || [];
            const hasPendingReschedule = rescheduleHistory.some(r => r.Status === 'Pending');
            const hasApprovedReschedules = rescheduleHistory.filter(r => r.Status === 'Approved');
            const hasRejectedReschedules = rescheduleHistory.filter(r => r.Status === 'Rejected');

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

                {/* ============ SECTION 1: ORIGINAL BOOKING DETAILS ============ */}
                <div style={styles.sectionContainer}>
                  <div style={styles.sectionHeader}>
                    <h4 style={styles.sectionTitle}>📋 Original Booking Details</h4>
                  </div>
                  <div style={styles.sectionBody}>
                    <div style={styles.infoRow}>
                      <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span><strong>Date:</strong> {display.date}</span>
                    </div>

                    <div style={styles.infoRow}>
                      <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span><strong>Time:</strong> {display.time}</span>
                    </div>

                    <div style={styles.infoRow}>
                      <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      <span><strong>Location:</strong> {booking.EventLocation || 'Not specified'}</span>
                    </div>

                    {booking.EventType && (
                      <div style={styles.infoRow}>
                        <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span><strong>Type:</strong> {booking.EventType}</span>
                      </div>
                    )}

                    {booking.TotalAmount > 0 && (
                      <div style={styles.infoRow}>
                        <svg style={styles.icon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span><strong>Budget:</strong> ₱{parseFloat(booking.TotalAmount).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ============ SECTION 2: PENDING RESCHEDULE ============ */}
                {hasPendingReschedule && rescheduleHistory.filter(r => r.Status === 'Pending').map((reschedule) => {
                  const badgeStyle = getRescheduleStatusBadge('Pending');
                  const originalFormatted = formatDateTime(reschedule.OriginalEventDate);
                  const requestedFormatted = formatDateTime(reschedule.RequestedEventDate);
                  
                  return (
                    <div key={reschedule.ID} style={{...styles.sectionContainer, ...styles.pendingSection}}>
                      <div style={styles.sectionHeader}>
                        <h4 style={styles.sectionTitle}>
                          {badgeStyle.icon} Pending Reschedule Request
                        </h4>
                        <span style={{
                          ...styles.rescheduleStatusBadge,
                          backgroundColor: badgeStyle.bg,
                          color: badgeStyle.text
                        }}>
                          Pending Approval
                        </span>
                      </div>
                      <div style={styles.sectionBody}>
                        <div style={styles.dateComparisonContainer}>
                          <div style={styles.dateComparisonBox}>
                            <p style={styles.dateLabel}>Original Schedule:</p>
                            <p style={styles.dateValue}>{originalFormatted.full}</p>
                          </div>
                          <div style={styles.arrowContainer}>
                            <svg style={styles.arrowIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </div>
                          <div style={{...styles.dateComparisonBox, ...styles.requestedDateBox}}>
                            <p style={styles.dateLabel}>Requested New Schedule:</p>
                            <p style={styles.dateValue}>{requestedFormatted.full}</p>
                          </div>
                        </div>
                        <p style={styles.waitingMessage}>
                          ⏳ Waiting for vendor to approve your reschedule request...
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* ============ SECTION 3: APPROVED RESCHEDULES ============ */}
                {hasApprovedReschedules.length > 0 && (
                  <div style={{...styles.sectionContainer, ...styles.approvedSection}}>
                    <div style={styles.sectionHeader}>
                      <h4 style={styles.sectionTitle}>✅ Approved Reschedules</h4>
                    </div>
                    <div style={styles.sectionBody}>
                      {hasApprovedReschedules.map((reschedule) => {
                        const badgeStyle = getRescheduleStatusBadge('Approved');
                        const originalFormatted = formatDateTime(reschedule.OriginalEventDate);
                        const requestedFormatted = formatDateTime(reschedule.RequestedEventDate);
                        const processedFormatted = formatDateTime(reschedule.ProcessedAt);
                        
                        return (
                          <div key={reschedule.ID} style={styles.historyItem}>
                            <div style={styles.historyHeader}>
                              <span style={{
                                ...styles.rescheduleStatusBadge,
                                backgroundColor: badgeStyle.bg,
                                color: badgeStyle.text
                              }}>
                                {badgeStyle.icon} Approved
                              </span>
                              <span style={styles.historyDate}>
                                Approved on: {processedFormatted.date}
                              </span>
                            </div>
                            <div style={styles.historyDetails}>
                              <p style={styles.historyText}>
                                <strong>From:</strong> {originalFormatted.full}
                              </p>
                              <p style={styles.historyText}>
                                <strong>To:</strong> {requestedFormatted.full}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ============ SECTION 4: REJECTED RESCHEDULES ============ */}
                {hasRejectedReschedules.length > 0 && (
                  <div style={{...styles.sectionContainer, ...styles.rejectedSection}}>
                    <div style={styles.sectionHeader}>
                      <h4 style={styles.sectionTitle}>❌ Rejected Reschedules</h4>
                    </div>
                    <div style={styles.sectionBody}>
                      {hasRejectedReschedules.map((reschedule) => {
                        const badgeStyle = getRescheduleStatusBadge('Rejected');
                        const originalFormatted = formatDateTime(reschedule.OriginalEventDate);
                        const requestedFormatted = formatDateTime(reschedule.RequestedEventDate);
                        const processedFormatted = formatDateTime(reschedule.ProcessedAt);
                        
                        return (
                          <div key={reschedule.ID} style={styles.historyItem}>
                            <div style={styles.historyHeader}>
                              <span style={{
                                ...styles.rescheduleStatusBadge,
                                backgroundColor: badgeStyle.bg,
                                color: badgeStyle.text
                              }}>
                                {badgeStyle.icon} Rejected
                              </span>
                              <span style={styles.historyDate}>
                                Rejected on: {processedFormatted.date}
                              </span>
                            </div>
                            <div style={styles.historyDetails}>
                              <p style={styles.historyText}>
                                <strong>Requested from:</strong> {originalFormatted.full}
                              </p>
                              <p style={styles.historyText}>
                                <strong>To:</strong> {requestedFormatted.full}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ============ ADDITIONAL NOTES ============ */}
                {booking.AdditionalNotes && (
                  <div style={styles.notesContainer}>
                    <strong>📝 Additional Notes:</strong>
                    <p style={styles.notesText}>{booking.AdditionalNotes}</p>
                  </div>
                )}

                {/* ============ ACTION BUTTONS ============ */}
                <div style={styles.cardActions}>
                  {canReschedule && (
                    <button
                      onClick={() => openRescheduleModal(booking)}
                      disabled={processing}
                      style={styles.rescheduleButton}
                    >
                      📅 Reschedule
                    </button>
                  )}
                  
                  {canCancel && (
                    <button
                      onClick={() => handleCancel(booking.ID)}
                      disabled={processing}
                      style={styles.cancelButton}
                    >
                      {processing ? 'Processing...' : '❌ Cancel Booking'}
                    </button>
                  )}
                </div>

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

      {/* ============ RESCHEDULE MODAL ============ */}
      {showRescheduleModal && rescheduleBooking && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>📅 Reschedule Booking</h3>
              <button
                onClick={() => {
                  setShowRescheduleModal(false);
                  setRescheduleBooking(null);
                }}
                style={styles.modalClose}
              >
                ×
              </button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.warningBox}>
                <span style={styles.warningIcon}>⚠️</span>
                <div>
                  <p style={styles.warningTitle}>Note:</p>
                  <p style={styles.warningText}>
                    Booking status will change to "Pending" after rescheduling. 
                    Vendor must approve your new schedule.
                  </p>
                </div>
              </div>

              <div style={styles.currentDateBox}>
                <p style={styles.currentDateLabel}>Current Schedule:</p>
                <p style={styles.currentDateValue}>
                  {formatDateTime(rescheduleBooking.EventDate).full}
                </p>
              </div>

              <form onSubmit={handleReschedule}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>New Date *</label>
                  <input
                    type="date"
                    value={rescheduleForm.new_date}
                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, new_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    required
                    style={styles.formInput}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>New Time *</label>
                  <input
                    type="time"
                    value={rescheduleForm.new_time}
                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, new_time: e.target.value })}
                    required
                    style={styles.formInput}
                  />
                </div>

                <div style={styles.infoBox}>
                  <span style={styles.infoIcon}>ℹ️</span>
                  <p style={styles.infoText}>
                    Vendor will be notified and must approve the new date and time.
                  </p>
                </div>

                <div style={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRescheduleModal(false);
                      setRescheduleBooking(null);
                    }}
                    disabled={processing}
                    style={styles.modalCancelButton}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={processing}
                    style={styles.modalSubmitButton}
                  >
                    {processing ? 'Processing...' : '✓ Request Reschedule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// STYLES
// ============================================

const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "2rem 1rem",
    minHeight: "calc(100vh - 200px)"
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
    cursor: "pointer"
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
    cursor: "pointer"
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
    marginBottom: "0.5rem"
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
    cursor: "pointer"
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
    marginBottom: "1.5rem",
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
  sectionContainer: {
    marginBottom: "1rem",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
    overflow: "hidden"
  },
  pendingSection: {
    borderColor: "#fbbf24",
    backgroundColor: "#fffbeb"
  },
  approvedSection: {
    borderColor: "#34d399",
    backgroundColor: "#f0fdf4"
  },
  rejectedSection: {
    borderColor: "#f87171",
    backgroundColor: "#fef2f2"
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.75rem 1rem",
    backgroundColor: "#f9fafb",
    borderBottom: "1px solid #e5e5e5"
  },
  sectionTitle: {
    fontSize: "0.95rem",
    fontWeight: "600",
    color: "#1c1b1a",
    margin: 0
  },
  sectionBody: {
    padding: "1rem"
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
  rescheduleStatusBadge: {
    padding: "0.25rem 0.75rem",
    borderRadius: "9999px",
    fontSize: "0.75rem",
    fontWeight: "600"
  },
  dateComparisonContainer: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "1rem",
    flexWrap: "wrap"
  },
  dateComparisonBox: {
    flex: "1",
    minWidth: "200px",
    padding: "0.75rem",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e5e5",
    borderRadius: "6px"
  },
  requestedDateBox: {
    backgroundColor: "#dbeafe",
    borderColor: "#3b82f6"
  },
  dateLabel: {
    fontSize: "0.75rem",
    color: "#666",
    marginBottom: "0.25rem",
    fontWeight: "600"
  },
  dateValue: {
    fontSize: "0.9rem",
    color: "#1c1b1a",
    fontWeight: "600"
  },
  arrowContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  arrowIcon: {
    width: "2rem",
    height: "2rem",
    color: "#3b82f6"
  },
  waitingMessage: {
    fontSize: "0.85rem",
    color: "#92400e",
    fontStyle: "italic",
    textAlign: "center"
  },
  historyItem: {
    marginBottom: "0.75rem",
    padding: "0.75rem",
    backgroundColor: "#f9fafb",
    borderRadius: "6px",
    border: "1px solid #e5e5e5"
  },
  historyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.5rem",
    flexWrap: "wrap",
    gap: "0.5rem"
  },
  historyDate: {
    fontSize: "0.75rem",
    color: "#666"
  },
  historyDetails: {
    fontSize: "0.85rem",
    color: "#444"
  },
  historyText: {
    margin: "0.25rem 0",
    lineHeight: "1.5"
  },
  notesContainer: {
    marginTop: "1rem",
    padding: "1rem",
    backgroundColor: "#f0f9ff",
    border: "1px solid #bae6fd",
    borderRadius: "8px",
    fontSize: "0.9rem"
  },
  notesText: {
    marginTop: "0.5rem",
    color: "#444",
    lineHeight: "1.5"
  },
  cardActions: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "1.5rem",
    paddingTop: "1.5rem",
    borderTop: "1px solid #e5e5e5",
    flexWrap: "wrap"
  },
  rescheduleButton: {
    flex: "1",
    minWidth: "150px",
    padding: "0.75rem 1.5rem",
    background: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "0.9rem",
    fontWeight: "600",
    cursor: "pointer"
  },
  cancelButton: {
    flex: "1",
    minWidth: "150px",
    padding: "0.75rem 1.5rem",
    border: "1px solid #dc2626",
    borderRadius: "8px",
    background: "#fff",
    color: "#dc2626",
    fontSize: "0.9rem",
    fontWeight: "600",
    cursor: "pointer"
  },
  cardFooter: {
    marginTop: "1rem",
    paddingTop: "1rem",
    borderTop: "1px solid #e5e5e5"
  },
  timestamp: {
    color: "#999",
    fontSize: "0.8rem"
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "1rem"
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "500px",
    maxHeight: "90vh",
    overflow: "auto"
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1.5rem",
    borderBottom: "1px solid #e5e5e5"
  },
  modalTitle: {
    fontSize: "1.25rem",
    fontWeight: "600",
    margin: 0
  },
  modalClose: {
    background: "none",
    border: "none",
    fontSize: "2rem",
    cursor: "pointer",
    color: "#666"
  },
  modalBody: {
    padding: "1.5rem"
  },
  warningBox: {
    display: "flex",
    gap: "0.75rem",
    padding: "1rem",
    backgroundColor: "#fef3c7",
    border: "1px solid #fbbf24",
    borderRadius: "8px",
    marginBottom: "1rem"
  },
  warningIcon: {
    fontSize: "1.5rem",
    flexShrink: 0
  },
  warningTitle: {
    fontWeight: "600",
    marginBottom: "0.25rem",
    color: "#92400e"
  },
  warningText: {
    fontSize: "0.85rem",
    color: "#92400e",
    lineHeight: "1.4"
  },
  currentDateBox: {
    padding: "1rem",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
    marginBottom: "1rem"
  },
  currentDateLabel: {
    fontSize: "0.85rem",
    color: "#666",
    marginBottom: "0.5rem"
  },
  currentDateValue: {
    fontSize: "1rem",
    fontWeight: "600",
    color: "#1c1b1a"
  },
  formGroup: {
    marginBottom: "1rem"
  },
  formLabel: {
    display: "block",
    fontSize: "0.9rem",
    fontWeight: "600",
    marginBottom: "0.5rem",
    color: "#1c1b1a"
  },
  formInput: {
    width: "100%",
    padding: "0.75rem",
    border: "1px solid #e5e5e5",
    borderRadius: "6px",
    fontSize: "1rem"
  },
  infoBox: {
    display: "flex",
    gap: "0.75rem",
    padding: "1rem",
    backgroundColor: "#dbeafe",
    border: "1px solid #3b82f6",
    borderRadius: "8px",
    marginBottom: "1rem"
  },
  infoIcon: {
    fontSize: "1.25rem",
    flexShrink: 0
  },
  infoText: {
    fontSize: "0.85rem",
    color: "#1e40af",
    lineHeight: "1.4"
  },
  modalActions: {
    display: "flex",
    gap: "0.75rem"
  },
  modalCancelButton: {
    flex: "1",
    padding: "0.75rem",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
    background: "#fff",
    fontSize: "0.9rem",
    fontWeight: "600",
    cursor: "pointer"
  },
  modalSubmitButton: {
    flex: "1",
    padding: "0.75rem",
    background: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "0.9rem",
    fontWeight: "600",
    cursor: "pointer"
  }
};
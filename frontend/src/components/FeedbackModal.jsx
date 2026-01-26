import { useState } from "react";
import toast from "../utils/toast";

const API =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://solennia.up.railway.app/api"
    : "/api");

export default function FeedbackModal({ booking, isOpen, onClose, onSubmitSuccess }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen || !booking) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    if (showReportForm && (!reportReason || !reportDetails.trim())) {
      toast.error("Please provide report reason and details");
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem("solennia_token");

      const payload = {
        rating,
        comment: comment.trim() || null,
        report: showReportForm,
        report_reason: showReportForm ? reportReason : null,
        report_details: showReportForm ? reportDetails.trim() : null
      };

      const response = await fetch(`${API}/bookings/${booking.ID}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit feedback");
      }

      toast.success(
        showReportForm 
          ? "Feedback and report submitted successfully" 
          : "Feedback submitted successfully",
        { duration: 5000 }
      );

      // Reset form
      setRating(0);
      setComment("");
      setShowReportForm(false);
      setReportReason("");
      setReportDetails("");

      if (onSubmitSuccess) {
        onSubmitSuccess();
      }

      onClose();

    } catch (error) {
      console.error("Submit feedback error:", error);
      toast.error(error.message || "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const reportReasons = [
    { value: "violated_agreement", label: "Violated Agreement" },
    { value: "no_response", label: "No Response / Poor Communication" },
    { value: "poor_service", label: "Poor Service Quality" },
    { value: "unprofessional", label: "Unprofessional Behavior" },
    { value: "safety_concern", label: "Safety Concern" },
    { value: "other", label: "Other" }
  ];

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Leave Feedback</h2>
          <button
            type="button"
            onClick={onClose}
            style={styles.closeButton}
            disabled={submitting}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={styles.modalBody}>
          {/* Booking Info */}
          <div style={styles.bookingInfo}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Service:</span>
              <span style={styles.infoValue}>{booking.ServiceName}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Vendor:</span>
              <span style={styles.infoValue}>{booking.vendor_name || "Unknown"}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Event Date:</span>
              <span style={styles.infoValue}>
                {new Date(booking.EventDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Rating */}
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>
                Rating <span style={styles.required}>*</span>
              </label>
              <div style={styles.starContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    style={styles.starButton}
                    disabled={submitting}
                  >
                    <svg
                      style={{
                        ...styles.starIcon,
                        fill: star <= (hoverRating || rating) ? "#fbbf24" : "none",
                        stroke: star <= (hoverRating || rating) ? "#fbbf24" : "#d1d5db"
                      }}
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <div style={styles.ratingText}>
                  {rating === 1 && "Poor"}
                  {rating === 2 && "Fair"}
                  {rating === 3 && "Good"}
                  {rating === 4 && "Very Good"}
                  {rating === 5 && "Excellent"}
                </div>
              )}
            </div>

            {/* Comment */}
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Comment (Optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience with this vendor..."
                style={styles.textarea}
                rows="4"
                disabled={submitting}
              />
            </div>

            {/* Report Toggle */}
            <div style={styles.reportToggle}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showReportForm}
                  onChange={(e) => setShowReportForm(e.target.checked)}
                  style={styles.checkbox}
                  disabled={submitting}
                />
                <span>Report this supplier for violations or issues</span>
              </label>
            </div>

            {/* Report Form */}
            {showReportForm && (
              <div style={styles.reportForm}>
                <div style={styles.warningBox}>
                  <svg style={styles.warningIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <div style={styles.warningTitle}>Report Supplier</div>
                    <div style={styles.warningText}>
                      Your report will be reviewed by our admin team. Please provide detailed information.
                    </div>
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    Reason for Report <span style={styles.required}>*</span>
                  </label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    style={styles.select}
                    disabled={submitting}
                    required
                  >
                    <option value="">Select a reason...</option>
                    {reportReasons.map((reason) => (
                      <option key={reason.value} value={reason.value}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    Report Details <span style={styles.required}>*</span>
                  </label>
                  <textarea
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Please provide specific details about the issue..."
                    style={styles.textarea}
                    rows="5"
                    disabled={submitting}
                    required
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={onClose}
                style={styles.cancelButton}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={styles.submitButton}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Feedback"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
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
    maxWidth: "600px",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)"
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1.5rem",
    borderBottom: "2px solid #e5e5e5"
  },
  modalTitle: {
    fontSize: "1.5rem",
    fontWeight: "600",
    color: "#1c1b1a",
    margin: 0
  },
  closeButton: {
    background: "none",
    border: "none",
    fontSize: "2rem",
    cursor: "pointer",
    color: "#666",
    lineHeight: 1,
    padding: 0,
    width: "2rem",
    height: "2rem"
  },
  modalBody: {
    padding: "1.5rem"
  },
  bookingInfo: {
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
    padding: "1rem",
    marginBottom: "1.5rem"
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "0.5rem"
  },
  infoLabel: {
    fontSize: "0.9rem",
    color: "#666",
    fontWeight: "500"
  },
  infoValue: {
    fontSize: "0.9rem",
    color: "#1c1b1a",
    fontWeight: "600"
  },
  formGroup: {
    marginBottom: "1.25rem"
  },
  formLabel: {
    display: "block",
    fontSize: "0.95rem",
    fontWeight: "600",
    color: "#1c1b1a",
    marginBottom: "0.5rem"
  },
  required: {
    color: "#dc2626"
  },
  starContainer: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "0.5rem"
  },
  starButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    transition: "transform 0.2s"
  },
  starIcon: {
    width: "2.5rem",
    height: "2.5rem",
    transition: "all 0.2s"
  },
  ratingText: {
    fontSize: "0.9rem",
    color: "#74583E",
    fontWeight: "600",
    marginTop: "0.5rem"
  },
  textarea: {
    width: "100%",
    padding: "0.75rem",
    fontSize: "0.95rem",
    border: "2px solid #e5e5e5",
    borderRadius: "8px",
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
    boxSizing: "border-box"
  },
  reportToggle: {
    marginBottom: "1.25rem"
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.95rem",
    cursor: "pointer",
    userSelect: "none"
  },
  checkbox: {
    width: "1.125rem",
    height: "1.125rem",
    cursor: "pointer"
  },
  reportForm: {
    backgroundColor: "#fef3c7",
    border: "2px solid #fbbf24",
    borderRadius: "8px",
    padding: "1rem",
    marginBottom: "1.25rem"
  },
  warningBox: {
    display: "flex",
    gap: "0.75rem",
    marginBottom: "1rem",
    padding: "0.75rem",
    backgroundColor: "#fff",
    borderRadius: "6px"
  },
  warningIcon: {
    width: "1.5rem",
    height: "1.5rem",
    color: "#f59e0b",
    flexShrink: 0,
    marginTop: "0.125rem"
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
  select: {
    width: "100%",
    padding: "0.75rem",
    fontSize: "0.95rem",
    border: "2px solid #e5e5e5",
    borderRadius: "8px",
    outline: "none",
    backgroundColor: "#fff",
    boxSizing: "border-box"
  },
  modalActions: {
    display: "flex",
    gap: "0.75rem",
    paddingTop: "1rem",
    borderTop: "2px solid #e5e5e5"
  },
  cancelButton: {
    flex: "1",
    padding: "0.875rem",
    border: "2px solid #e5e5e5",
    borderRadius: "8px",
    background: "#fff",
    color: "#666",
    fontSize: "1rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  submitButton: {
    flex: "1",
    padding: "0.875rem",
    background: "#74583E",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s"
  }
};
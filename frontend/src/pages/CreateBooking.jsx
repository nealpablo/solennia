/**
 * ============================================
 * CREATE BOOKING PAGE (UC05)
 * ============================================
 * Allows clients to book services from vendors
 * Developer: Ryan (01-17_Ryan_Manual-Booking)
 * ============================================
 */

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "../utils/toast";

const API =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://solennia.up.railway.app/api"
    : "/api");

export default function CreateBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get vendor info passed from VendorProfile
  const { vendorId, vendorName, serviceName } = location.state || {};

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    service_name: serviceName || "",
    event_date: "",
    event_time: "14:00",
    event_location: "",
    event_type: "",
    package_selected: "",
    additional_notes: "",
    total_amount: ""
  });

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.error("Please log in to make a booking");
      navigate("/login");
      return;
    }

    // Check if vendor info is provided
    if (!vendorId || !vendorName) {
      toast.error("Vendor information missing");
      navigate("/vendors");
    }
  }, [vendorId, vendorName, navigate]);

  // Event types
  const eventTypes = [
    "Wedding",
    "Birthday",
    "Corporate Event",
    "Conference",
    "Product Launch",
    "Anniversary",
    "Debut",
    "Baptism",
    "Graduation",
    "Other"
  ];

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Validate form
  const validateForm = () => {
    if (!formData.service_name.trim()) {
      toast.error("Please enter a service name");
      return false;
    }

    if (!formData.event_date) {
      toast.error("Please select an event date");
      return false;
    }

    // Check if date is in the future
    const selectedDate = new Date(`${formData.event_date}T${formData.event_time}`);
    const now = new Date();
    if (selectedDate <= now) {
      toast.error("Event date must be in the future");
      return false;
    }

    if (!formData.event_location.trim()) {
      toast.error("Please enter event location");
      return false;
    }

    return true;
  };

  // Submit booking
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);

      const token = localStorage.getItem("solennia_token");
      if (!token) {
        toast.error("Please log in to make a booking");
        navigate("/login");
        return;
      }

      // Combine date and time
      const eventDateTime = `${formData.event_date} ${formData.event_time}:00`;

      const response = await fetch(`${API}/bookings/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          vendor_id: vendorId,
          service_name: formData.service_name,
          event_date: eventDateTime,
          event_location: formData.event_location,
          event_type: formData.event_type || null,
          package_selected: formData.package_selected || null,
          additional_notes: formData.additional_notes || null,
          total_amount: formData.total_amount ? parseFloat(formData.total_amount) : null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create booking");
      }

      toast.success(data.message || "Booking request sent successfully!");
      
      // Redirect to My Bookings after a short delay
      setTimeout(() => {
        navigate("/my-bookings");
      }, 1500);

    } catch (error) {
      console.error("Booking error:", error);
      toast.error(error.message || "Failed to create booking. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Cancel and go back
  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>Book a Service</h1>
          <p style={styles.subtitle}>
            Booking with: <strong>{vendorName}</strong>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          
          {/* Service Name */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Service Name <span style={styles.required}>*</span>
            </label>
            <input
              type="text"
              name="service_name"
              value={formData.service_name}
              onChange={handleChange}
              placeholder="e.g., Wedding Photography, Catering Service"
              style={styles.input}
              required
            />
          </div>

          {/* Event Date and Time */}
          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Event Date <span style={styles.required}>*</span>
              </label>
              <input
                type="date"
                name="event_date"
                value={formData.event_date}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Event Time <span style={styles.required}>*</span>
              </label>
              <input
                type="time"
                name="event_time"
                value={formData.event_time}
                onChange={handleChange}
                style={styles.input}
                required
              />
            </div>
          </div>

          {/* Event Location */}
          <div style={styles.formGroup}>
            <label style={styles.label}>
              Event Location <span style={styles.required}>*</span>
            </label>
            <input
              type="text"
              name="event_location"
              value={formData.event_location}
              onChange={handleChange}
              placeholder="e.g., Manila Hotel, Quezon City"
              style={styles.input}
              required
            />
          </div>

          {/* Event Type */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Event Type</label>
            <select
              name="event_type"
              value={formData.event_type}
              onChange={handleChange}
              style={styles.select}
            >
              <option value="">Select event type (optional)</option>
              {eventTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Package Selected */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Package/Tier</label>
            <input
              type="text"
              name="package_selected"
              value={formData.package_selected}
              onChange={handleChange}
              placeholder="e.g., Premium Package, Basic Package (optional)"
              style={styles.input}
            />
          </div>

          {/* Total Amount */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Estimated Amount (₱)</label>
            <input
              type="number"
              name="total_amount"
              value={formData.total_amount}
              onChange={handleChange}
              placeholder="e.g., 50000 (optional)"
              min="0"
              step="0.01"
              style={styles.input}
            />
          </div>

          {/* Additional Notes */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Additional Notes</label>
            <textarea
              name="additional_notes"
              value={formData.additional_notes}
              onChange={handleChange}
              placeholder="Any special requests or additional information..."
              rows="4"
              style={styles.textarea}
            />
          </div>

          {/* Info Box */}
          <div style={styles.infoBox}>
            <p style={styles.infoText}>
              ℹ️ Your booking request will be sent to the vendor for review. 
              You will be notified once they respond.
            </p>
          </div>

          {/* Buttons */}
          <div style={styles.buttonGroup}>
            <button
              type="button"
              onClick={handleCancel}
              style={styles.cancelButton}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={styles.submitButton}
              disabled={loading}
            >
              {loading ? "Sending Request..." : "Submit Booking Request"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// Styles
const styles = {
  container: {
    maxWidth: "800px",
    margin: "2rem auto",
    padding: "0 1rem"
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    overflow: "hidden"
  },
  header: {
    backgroundColor: "#8B4513",
    color: "#fff",
    padding: "2rem",
    textAlign: "center"
  },
  title: {
    margin: "0 0 0.5rem 0",
    fontSize: "2rem",
    fontWeight: "600"
  },
  subtitle: {
    margin: 0,
    fontSize: "1.1rem",
    opacity: 0.95
  },
  form: {
    padding: "2rem"
  },
  formGroup: {
    marginBottom: "1.5rem",
    flex: 1
  },
  row: {
    display: "flex",
    gap: "1rem",
    flexWrap: "wrap"
  },
  label: {
    display: "block",
    marginBottom: "0.5rem",
    fontWeight: "500",
    fontSize: "0.95rem",
    color: "#333"
  },
  required: {
    color: "#dc2626"
  },
  input: {
    width: "100%",
    padding: "0.75rem",
    fontSize: "1rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box"
  },
  select: {
    width: "100%",
    padding: "0.75rem",
    fontSize: "1rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    outline: "none",
    backgroundColor: "#fff",
    cursor: "pointer",
    boxSizing: "border-box"
  },
  textarea: {
    width: "100%",
    padding: "0.75rem",
    fontSize: "1rem",
    border: "1px solid #ddd",
    borderRadius: "6px",
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
    boxSizing: "border-box"
  },
  infoBox: {
    backgroundColor: "#eff6ff",
    border: "1px solid #93c5fd",
    borderRadius: "6px",
    padding: "1rem",
    marginBottom: "1.5rem"
  },
  infoText: {
    margin: 0,
    fontSize: "0.95rem",
    color: "#1e40af",
    lineHeight: "1.5"
  },
  buttonGroup: {
    display: "flex",
    gap: "1rem",
    justifyContent: "flex-end"
  },
  cancelButton: {
    padding: "0.75rem 1.5rem",
    fontSize: "1rem",
    fontWeight: "500",
    border: "1px solid #ddd",
    borderRadius: "6px",
    backgroundColor: "#fff",
    color: "#666",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  submitButton: {
    padding: "0.75rem 2rem",
    fontSize: "1rem",
    fontWeight: "500",
    border: "none",
    borderRadius: "6px",
    backgroundColor: "#8B4513",
    color: "#fff",
    cursor: "pointer",
    transition: "all 0.2s"
  }
};
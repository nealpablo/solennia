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
  const { vendorUserId, vendorName, serviceName } = location.state || {};

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    event_type: "",
    event_date: "",
    event_time: "14:00",
    event_location: "",
    package_selected: "",
    additional_notes: "",
    budget_amount: ""
  });

  useEffect(() => {
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.error("Please log in to make a booking");
      navigate("/login");
      return;
    }

    if (!vendorUserId || !vendorName) {
      toast.error("Vendor information missing");
      navigate("/vendors");
    }
  }, [vendorUserId, vendorName, navigate]);

  // Event types with original icon size (32px)
  const eventTypes = [
    { 
      value: "Wedding", 
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      )
    },
    { 
      value: "Birthday", 
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 6v6m0 0l-3-3m3 3l3-3"/>
          <rect x="2" y="12" width="20" height="10" rx="1"/>
          <path d="M7 12v-2a2 2 0 012-2h6a2 2 0 012 2v2"/>
          <circle cx="7" cy="17" r="1"/>
          <circle cx="12" cy="17" r="1"/>
          <circle cx="17" cy="17" r="1"/>
        </svg>
      )
    },
    { 
      value: "Corporate Event", 
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="7" width="18" height="13" rx="2"/>
          <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/>
          <path d="M12 12v4"/>
          <path d="M3 13h18"/>
        </svg>
      )
    },
    { 
      value: "Anniversary", 
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      )
    },
    { 
      value: "Debut", 
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 20v-6m0 0V8m0 6h6m-6 0H6"/>
          <circle cx="12" cy="12" r="10"/>
        </svg>
      )
    },
    { 
      value: "Graduation", 
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 14L2 9l10-5 10 5-10 5z"/>
          <path d="M12 14v7"/>
          <path d="M7 11.5v5.5a2 2 0 002 2h6a2 2 0 002-2v-5.5"/>
        </svg>
      )
    },
    { 
      value: "Other", 
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
          <circle cx="12" cy="17" r="0.5" fill="currentColor"/>
        </svg>
      )
    }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEventTypeSelect = (eventType) => {
    setFormData(prev => ({
      ...prev,
      event_type: eventType
    }));
  };

  const validateForm = () => {
    if (!formData.event_type) {
      toast.error("Please select an event type");
      return false;
    }

    if (!formData.event_date) {
      toast.error("Please select an event date");
      return false;
    }

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

  /* ============================================
   * ✅ ENHANCED handleSubmit WITH CONFLICT HANDLING
   * ============================================
   * CHANGES MADE ON LINES 207-226
   * Added detection and handling for schedule conflicts (UC05 Alternate Flow 5a-5c)
   * ============================================
   */
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

      const eventDateTime = `${formData.event_date} ${formData.event_time}:00`;

      console.log("Submitting booking with vendor_id:", vendorUserId);

      const response = await fetch(`${API}/bookings/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          vendor_id: vendorUserId,
          service_name: serviceName || formData.event_type,
          event_date: eventDateTime,
          event_location: formData.event_location,
          event_type: formData.event_type,
          package_selected: formData.package_selected || null,
          additional_notes: formData.additional_notes || null,
          total_amount: formData.budget_amount ? parseFloat(formData.budget_amount) : null
        })
      });

      const contentType = response.headers.get("content-type");
      let data;
      
      if (contentType && contentType.includes("application/json")) {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } else {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error("Server returned an invalid response. Please try again.");
      }

      /* ============================================
       * ✅ NEW CODE STARTS HERE (LINES 207-226)
       * ============================================
       * Handle schedule conflict (UC05 Alternate Flow 5a-5c)
       * ============================================
       */
      
      // UC05 Alternate Flow 5a: Check if schedule conflict detected (409 status)
      if (response.status === 409 && data.conflict) {
        // This vendor is already booked at this date/time
        console.log("Schedule conflict detected:", data);
        
        // UC05 Alternate Flow 5b: Display message informing client
        toast.error(
          data.message || 
          "This vendor is already booked for the selected date and time. Please choose a different schedule.",
          { duration: 10000 } // ✅ INCREASED: 10 seconds for better readability
        );
        
        // UC05 Alternate Flow 5c: Prompt to choose different date/time
        // Scroll to date/time fields so user can easily change them
        const dateField = document.querySelector('input[type="date"]');
        if (dateField) {
          dateField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          dateField.focus();
        }
        
        return; // Don't navigate away, let user modify the form
      }

      /* ============================================
       * ✅ NEW CODE ENDS HERE
       * ============================================
       */

      if (!response.ok) {
        throw new Error(data.error || data.message || `Server error: ${response.status}`);
      }

      toast.success(data.message || "Booking request sent successfully!");
      
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

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <div style={styles.wrapper}>
      {/* Header - Transparent, Left Aligned */}
      <div style={styles.headerContainer}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>Book a Service</h1>
          <p style={styles.subtitle}>
            with <strong>{vendorName}</strong>
          </p>
          <p style={{ margin: "0.75rem 0 0 0", fontSize: "0.95rem", color: "#666", lineHeight: "1.5" }}>
            Before we send a booking request to your supplier, let's get organized. You can edit the details until you submit your booking.
          </p>
        </div>
      </div>

      {/* Form Container */}
      <div style={styles.formContainer}>
        <form onSubmit={handleSubmit}>
          
          {/* Event Type Selection - SMALLER CONTAINERS */}
          <div style={styles.section}>
            <label style={styles.sectionLabel}>
              Select Event Type <span style={styles.required}>*</span>
            </label>
            <div style={styles.eventTypeGrid}>
              {eventTypes.map((type) => (
                <div
                  key={type.value}
                  onClick={() => handleEventTypeSelect(type.value)}
                  style={{
                    ...styles.eventBox,
                    ...(formData.event_type === type.value ? styles.selectedEventBox : {})
                  }}
                >
                  <div style={{
                    ...styles.iconContainer,
                    ...(formData.event_type === type.value ? { color: '#fff' } : { color: '#666' })
                  }}>
                    {type.icon}
                  </div>
                  <div style={{
                    ...styles.boxLabel,
                    ...(formData.event_type === type.value ? { color: '#fff' } : {})
                  }}>
                    {type.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Date and Time */}
          <div style={styles.section}>
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
          </div>

          {/* Event Location */}
          <div style={styles.section}>
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

          {/* Estimated Amount of Budget */}
          <div style={styles.section}>
            <label style={styles.label}>
              ₱ Estimated Amount of Budget
            </label>
            <input
              type="number"
              name="budget_amount"
              value={formData.budget_amount}
              onChange={handleChange}
              placeholder="Enter your budget amount"
              min="0"
              step="1000"
              style={styles.input}
            />
          </div>

          {/* Package/Tier */}
          <div style={styles.section}>
            <label style={styles.label}>Package/Tier (Optional)</label>
            <input
              type="text"
              name="package_selected"
              value={formData.package_selected}
              onChange={handleChange}
              placeholder="e.g., Premium Package, Basic Package"
              style={styles.input}
            />
          </div>

          {/* Additional Notes */}
          <div style={styles.section}>
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
            <svg style={styles.infoIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p style={styles.infoText}>
              Your booking request will be sent to the vendor for review. 
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
  wrapper: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "1.5rem 0.5rem"
  },
  
  headerContainer: {
    backgroundColor: "transparent",
    marginBottom: "1.5rem"
  },
  headerContent: {
    textAlign: "left",
    paddingLeft: "2rem"
  },
  title: {
    margin: "0 0 0.5rem 0",
    fontSize: "2.5rem",
    fontWeight: "700",
    color: "#1c1b1a",
    letterSpacing: "-0.02em"
  },
  subtitle: {
    margin: 0,
    fontSize: "1.2rem",
    color: "#666",
    fontWeight: "400"
  },
  
  formContainer: {
    backgroundColor: "#fff",
    borderRadius: "16px",
    padding: "2rem",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    border: "1px solid #e5e5e5"
  },
  
  section: {
    marginBottom: "2rem"
  },
  sectionLabel: {
    display: "block",
    marginBottom: "1rem",
    fontSize: "1.1rem",
    fontWeight: "600",
    color: "#1c1b1a"
  },
  
  // Event Type Grid - SMALLER MAX-WIDTH + MORE COLUMNS
  eventTypeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)", // 4 columns to make boxes smaller
    gap: "0.5rem",
    maxWidth: "1200px" // Constrain the total width to make boxes smaller
  },
  
  // Event Box - REDUCED PADDING (smaller container, same content)
  eventBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.75rem 0.5rem", // Smaller padding = smaller box
    backgroundColor: "#f9f9f9",
    border: "2px solid #e5e5e5",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    minHeight: "95px", // Slightly reduced
    aspectRatio: "1"
  },
  selectedEventBox: {
    backgroundColor: "#74583E",
    borderColor: "#74583E",
    transform: "scale(1.02)",
    boxShadow: "0 4px 12px rgba(116, 88, 62, 0.2)"
  },
  iconContainer: {
    marginBottom: "0.5rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 0.2s ease"
  },
  boxLabel: {
    fontSize: "0.8rem", // Keep text readable
    fontWeight: "500",
    textAlign: "center",
    lineHeight: "1.2",
    color: "#333"
  },
  
  formGroup: {
    flex: 1
  },
  row: {
    display: "flex",
    gap: "1.5rem",
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
    padding: "0.875rem",
    fontSize: "1rem",
    border: "2px solid #e5e5e5",
    borderRadius: "10px",
    outline: "none",
    transition: "all 0.2s",
    boxSizing: "border-box",
    backgroundColor: "#fff"
  },
  textarea: {
    width: "100%",
    padding: "0.875rem",
    fontSize: "1rem",
    border: "2px solid #e5e5e5",
    borderRadius: "10px",
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
    boxSizing: "border-box",
    backgroundColor: "#fff"
  },
  
  infoBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.75rem",
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "10px",
    padding: "1rem",
    marginBottom: "1.5rem"
  },
  infoIcon: {
    width: "1.5rem",
    height: "1.5rem",
    color: "#3b82f6",
    flexShrink: 0,
    marginTop: "0.125rem"
  },
  infoText: {
    margin: 0,
    fontSize: "0.95rem",
    color: "#1e40af",
    lineHeight: "1.6"
  },
  
  buttonGroup: {
    display: "flex",
    gap: "1rem",
    justifyContent: "flex-end",
    paddingTop: "1rem"
  },
  cancelButton: {
    padding: "0.875rem 2rem",
    fontSize: "1rem",
    fontWeight: "600",
    border: "2px solid #e5e5e5",
    borderRadius: "10px",
    backgroundColor: "#fff",
    color: "#666",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  submitButton: {
    padding: "0.875rem 2.5rem",
    fontSize: "1rem",
    fontWeight: "600",
    border: "none",
    borderRadius: "10px",
    backgroundColor: "#74583E",
    color: "#fff",
    cursor: "pointer",
    transition: "all 0.2s",
    boxShadow: "0 2px 8px rgba(116, 88, 62, 0.2)"
  }
};
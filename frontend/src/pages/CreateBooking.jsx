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
  const [currentStep, setCurrentStep] = useState(1);

  // STEP 1: Event Details
  const [eventData, setEventData] = useState({
    event_type: "",
    event_date: "",
    event_time: "14:00",
    event_location: "",
    package_selected: "",
    additional_notes: "",
    budget_amount: ""
  });

  // ✅ Separate time component state
  const [timeComponents, setTimeComponents] = useState({
    hour: "2",      // 1-12
    minute: "00",   // 00, 15, 30, 45
    ampm: "PM"      // AM or PM
  });

  // STEP 2: Event-Specific Data (changes based on event type)
  const [eventSpecificData, setEventSpecificData] = useState({
    // Common fields
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    number_of_guests: "",
    special_requests: "",

    // Wedding-specific
    bride_name: "",
    groom_name: "",
    wedding_theme: "",
    reception_venue: "",

    // Birthday-specific
    celebrant_name: "",
    celebrant_age: "",
    birthday_theme: "",
    cake_preference: "",

    // Corporate-specific
    company_name: "",
    department: "",
    position: "",
    event_purpose: "",

    // Anniversary-specific
    couple_names: "",
    years_together: "",
    anniversary_theme: "",

    // Debut-specific
    debutante_name: "",
    debut_theme: "",
    number_of_roses: "",
    number_of_candles: "",

    // Graduation-specific
    graduate_name: "",
    school_name: "",
    degree_program: "",
    graduation_year: "",

    // Shared optional fields
    dietary_restrictions: "",
    accessibility_requirements: "",
    emergency_contact_name: "",
    emergency_contact_phone: ""
  });

  useEffect(() => {
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.error("Please log in to make a booking");
      navigate("/login");
      return;
    }

    if (!vendorUserId || !vendorName) {
      toast.error("Supplier information missing");
      navigate("/vendors");
      return;
    }

    // Auto-fill contact info from profile
    const profileStr = localStorage.getItem("solennia_profile");
    if (profileStr) {
      try {
        const profile = JSON.parse(profileStr);
        setEventSpecificData(prev => ({
          ...prev,
          contact_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
          contact_email: profile.email || '',
          contact_phone: profile.phone || ''
        }));
      } catch (err) {
        console.error("Failed to parse profile:", err);
      }
    }
  }, [vendorUserId, vendorName, navigate]);

  // Event types with icons
  const eventTypes = [
    {
      value: "Wedding",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      )
    },
    {
      value: "Birthday",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 6v6m0 0l-3-3m3 3l3-3" />
          <rect x="2" y="12" width="20" height="10" rx="1" />
          <path d="M7 12v-2a2 2 0 012-2h6a2 2 0 012 2v2" />
          <circle cx="7" cy="17" r="1" />
          <circle cx="12" cy="17" r="1" />
          <circle cx="17" cy="17" r="1" />
        </svg>
      )
    },
    {
      value: "Corporate Event",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
          <path d="M12 12v4" />
          <path d="M3 13h18" />
        </svg>
      )
    },
    {
      value: "Anniversary",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      )
    },
    {
      value: "Debut",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 20v-6m0 0V8m0 6h6m-6 0H6" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      )
    },
    {
      value: "Graduation",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 14L2 9l10-5 10 5-10 5z" />
          <path d="M12 14v7" />
          <path d="M7 11.5v5.5a2 2 0 002 2h6a2 2 0 002-2v-5.5" />
        </svg>
      )
    },
    {
      value: "Other",
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
          <circle cx="12" cy="17" r="0.5" fill="currentColor" />
        </svg>
      )
    }
  ];

  const handleEventChange = (e) => {
    const { name, value } = e.target;
    setEventData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // ✅ Handle time component changes (hour, minute, am/pm)
  const handleTimeComponentChange = (e) => {
    const { name, value } = e.target;
    const newTimeComponents = {
      ...timeComponents,
      [name]: value
    };
    setTimeComponents(newTimeComponents);

    // Convert to 24-hour format for event_time
    let hour = parseInt(newTimeComponents.hour);
    const minute = newTimeComponents.minute;
    const ampm = newTimeComponents.ampm;

    // Convert 12-hour to 24-hour
    if (ampm === "AM") {
      if (hour === 12) hour = 0; // 12 AM = 00:00
    } else {
      if (hour !== 12) hour += 12; // PM adds 12 (except 12 PM stays 12)
    }

    // Format as HH:MM
    const formattedTime = `${String(hour).padStart(2, '0')}:${minute}`;

    // Update eventData.event_time
    setEventData(prev => ({
      ...prev,
      event_time: formattedTime
    }));
  };

  const handleEventSpecificChange = (e) => {
    const { name, value } = e.target;
    setEventSpecificData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEventTypeSelect = (eventType) => {
    setEventData(prev => ({
      ...prev,
      event_type: eventType
    }));
  };

  // Validation for Step 1
  const validateStep1 = () => {
    if (!eventData.event_type) {
      toast.error("Please select an event type");
      return false;
    }

    if (!eventData.event_date) {
      toast.error("Please select an event date");
      return false;
    }

    const selectedDate = new Date(`${eventData.event_date}T${eventData.event_time}`);
    const now = new Date();
    if (selectedDate <= now) {
      toast.error("Event date must be in the future");
      return false;
    }

    if (!eventData.event_location.trim()) {
      toast.error("Please enter event location");
      return false;
    }

    return true;
  };

  // Validation for Step 2 (event-specific)
  const validateStep2 = () => {
    // Common required fields
    if (!eventSpecificData.contact_name.trim()) {
      toast.error("Please enter your name");
      return false;
    }

    if (!eventSpecificData.contact_email.trim()) {
      toast.error("Please enter your email");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(eventSpecificData.contact_email)) {
      toast.error("Please enter a valid email address");
      return false;
    }

    if (!eventSpecificData.contact_phone.trim()) {
      toast.error("Please enter your phone number");
      return false;
    }

    // Event-specific validations
    switch (eventData.event_type) {
      case "Wedding":
        if (!eventSpecificData.bride_name.trim()) {
          toast.error("Please enter the bride's name");
          return false;
        }
        if (!eventSpecificData.groom_name.trim()) {
          toast.error("Please enter the groom's name");
          return false;
        }
        break;

      case "Birthday":
        if (!eventSpecificData.celebrant_name.trim()) {
          toast.error("Please enter the celebrant's name");
          return false;
        }
        break;

      case "Corporate Event":
        if (!eventSpecificData.company_name.trim()) {
          toast.error("Please enter the company name");
          return false;
        }
        break;

      case "Anniversary":
        if (!eventSpecificData.couple_names.trim()) {
          toast.error("Please enter the couple's names");
          return false;
        }
        break;

      case "Debut":
        if (!eventSpecificData.debutante_name.trim()) {
          toast.error("Please enter the debutante's name");
          return false;
        }
        break;

      case "Graduation":
        if (!eventSpecificData.graduate_name.trim()) {
          toast.error("Please enter the graduate's name");
          return false;
        }
        break;
    }

    return true;
  };

  // Navigation
  const goToNextStep = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Build event-specific notes
  const buildEventSpecificNotes = () => {
    let notes = `Event Type: ${eventData.event_type}\n`;

    if (eventData.additional_notes) {
      notes += `\nEvent Notes: ${eventData.additional_notes}\n`;
    }

    notes += `\n--- Contact Information ---\n`;
    notes += `Name: ${eventSpecificData.contact_name}\n`;
    notes += `Email: ${eventSpecificData.contact_email}\n`;
    notes += `Phone: ${eventSpecificData.contact_phone}\n`;

    if (eventSpecificData.number_of_guests) {
      notes += `\nNumber of Guests: ${eventSpecificData.number_of_guests}\n`;
    }

    // Add event-specific information
    switch (eventData.event_type) {
      case "Wedding":
        notes += `\n--- Wedding Details ---\n`;
        notes += `Bride: ${eventSpecificData.bride_name}\n`;
        notes += `Groom: ${eventSpecificData.groom_name}\n`;
        if (eventSpecificData.wedding_theme) notes += `Theme: ${eventSpecificData.wedding_theme}\n`;
        if (eventSpecificData.reception_venue) notes += `Reception Venue: ${eventSpecificData.reception_venue}\n`;
        break;

      case "Birthday":
        notes += `\n--- Birthday Details ---\n`;
        notes += `Celebrant: ${eventSpecificData.celebrant_name}\n`;
        if (eventSpecificData.celebrant_age) notes += `Age: ${eventSpecificData.celebrant_age}\n`;
        if (eventSpecificData.birthday_theme) notes += `Theme: ${eventSpecificData.birthday_theme}\n`;
        if (eventSpecificData.cake_preference) notes += `Cake Preference: ${eventSpecificData.cake_preference}\n`;
        break;

      case "Corporate Event":
        notes += `\n--- Corporate Event Details ---\n`;
        notes += `Company: ${eventSpecificData.company_name}\n`;
        if (eventSpecificData.department) notes += `Department: ${eventSpecificData.department}\n`;
        if (eventSpecificData.position) notes += `Position: ${eventSpecificData.position}\n`;
        if (eventSpecificData.event_purpose) notes += `Purpose: ${eventSpecificData.event_purpose}\n`;
        break;

      case "Anniversary":
        notes += `\n--- Anniversary Details ---\n`;
        notes += `Couple: ${eventSpecificData.couple_names}\n`;
        if (eventSpecificData.years_together) notes += `Years Together: ${eventSpecificData.years_together}\n`;
        if (eventSpecificData.anniversary_theme) notes += `Theme: ${eventSpecificData.anniversary_theme}\n`;
        break;

      case "Debut":
        notes += `\n--- Debut Details ---\n`;
        notes += `Debutante: ${eventSpecificData.debutante_name}\n`;
        if (eventSpecificData.debut_theme) notes += `Theme: ${eventSpecificData.debut_theme}\n`;
        if (eventSpecificData.number_of_roses) notes += `Number of Roses: ${eventSpecificData.number_of_roses}\n`;
        if (eventSpecificData.number_of_candles) notes += `Number of Candles: ${eventSpecificData.number_of_candles}\n`;
        break;

      case "Graduation":
        notes += `\n--- Graduation Details ---\n`;
        notes += `Graduate: ${eventSpecificData.graduate_name}\n`;
        if (eventSpecificData.school_name) notes += `School: ${eventSpecificData.school_name}\n`;
        if (eventSpecificData.degree_program) notes += `Degree/Program: ${eventSpecificData.degree_program}\n`;
        if (eventSpecificData.graduation_year) notes += `Year: ${eventSpecificData.graduation_year}\n`;
        break;
    }

    // Add common optional fields
    if (eventSpecificData.dietary_restrictions) {
      notes += `\nDietary Restrictions: ${eventSpecificData.dietary_restrictions}\n`;
    }
    if (eventSpecificData.accessibility_requirements) {
      notes += `Accessibility Requirements: ${eventSpecificData.accessibility_requirements}\n`;
    }
    if (eventSpecificData.emergency_contact_name) {
      notes += `\nEmergency Contact: ${eventSpecificData.emergency_contact_name}`;
      if (eventSpecificData.emergency_contact_phone) {
        notes += ` (${eventSpecificData.emergency_contact_phone})`;
      }
      notes += `\n`;
    }
    if (eventSpecificData.special_requests) {
      notes += `\nSpecial Requests: ${eventSpecificData.special_requests}\n`;
    }

    return notes.trim();
  };

  // Submit booking
  const handleSubmit = async () => {
    if (!validateStep1() || !validateStep2()) {
      toast.error("Please complete all required fields");
      return;
    }

    try {
      setLoading(true);

      const token = localStorage.getItem("solennia_token");
      if (!token) {
        toast.error("Please log in to make a booking");
        navigate("/login");
        return;
      }

      const eventDateTime = `${eventData.event_date} ${eventData.event_time}:00`;
      const combinedNotes = buildEventSpecificNotes();

      const response = await fetch(`${API}/bookings/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          vendor_id: vendorUserId,
          service_name: serviceName || eventData.event_type,
          event_date: eventDateTime,
          event_location: eventData.event_location,
          event_type: eventData.event_type,
          package_selected: eventData.package_selected || null,
          additional_notes: combinedNotes,
          total_amount: eventData.budget_amount ? parseFloat(eventData.budget_amount) : null
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

      if (response.status === 409 && data.conflict) {
        toast.error(
          data.message ||
          "This Supplier is already booked for the selected date and time. Please choose a different schedule.",
          { duration: 10000 }
        );
        setCurrentStep(1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

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

  // Progress indicator
  const steps = [
    { number: 1, title: "Event Details" },
    { number: 2, title: `${eventData.event_type || 'Event'} Information` },
    { number: 3, title: "Review & Submit" }
  ];

  // Render event-specific fields based on selected event type
  const renderEventSpecificFields = () => {
    switch (eventData.event_type) {
      case "Wedding":
        return (
          <>
            <div style={styles.subsection}>
              <h3 style={styles.subsectionTitle}>💑 Wedding Details</h3>

              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Bride's Name <span style={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    name="bride_name"
                    value={eventSpecificData.bride_name}
                    onChange={handleEventSpecificChange}
                    placeholder="Maria Santos"
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Groom's Name <span style={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    name="groom_name"
                    value={eventSpecificData.groom_name}
                    onChange={handleEventSpecificChange}
                    placeholder="Juan Dela Cruz"
                    style={styles.input}
                    required
                  />
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Wedding Theme</label>
                  <input
                    type="text"
                    name="wedding_theme"
                    value={eventSpecificData.wedding_theme}
                    onChange={handleEventSpecificChange}
                    placeholder="e.g., Rustic, Garden, Modern"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Reception Venue</label>
                  <input
                    type="text"
                    name="reception_venue"
                    value={eventSpecificData.reception_venue}
                    onChange={handleEventSpecificChange}
                    placeholder="e.g., Grand Ballroom"
                    style={styles.input}
                  />
                </div>
              </div>
            </div>
          </>
        );

      case "Birthday":
        return (
          <>
            <div style={styles.subsection}>
              <h3 style={styles.subsectionTitle}>🎂 Birthday Details</h3>

              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Celebrant's Name <span style={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    name="celebrant_name"
                    value={eventSpecificData.celebrant_name}
                    onChange={handleEventSpecificChange}
                    placeholder="Maria Dela Cruz"
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Age Turning</label>
                  <input
                    type="number"
                    name="celebrant_age"
                    value={eventSpecificData.celebrant_age}
                    onChange={handleEventSpecificChange}
                    placeholder="25"
                    min="1"
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Birthday Theme</label>
                  <input
                    type="text"
                    name="birthday_theme"
                    value={eventSpecificData.birthday_theme}
                    onChange={handleEventSpecificChange}
                    placeholder="e.g., Superhero, Princess, Vintage"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Cake Preference</label>
                  <input
                    type="text"
                    name="cake_preference"
                    value={eventSpecificData.cake_preference}
                    onChange={handleEventSpecificChange}
                    placeholder="e.g., Chocolate, Vanilla, Red Velvet"
                    style={styles.input}
                  />
                </div>
              </div>
            </div>
          </>
        );

      case "Corporate Event":
        return (
          <>
            <div style={styles.subsection}>
              <h3 style={styles.subsectionTitle}>🏢 Corporate Event Details</h3>

              <div style={styles.section}>
                <label style={styles.label}>
                  Company Name <span style={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  name="company_name"
                  value={eventSpecificData.company_name}
                  onChange={handleEventSpecificChange}
                  placeholder="ABC Corporation"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Department</label>
                  <input
                    type="text"
                    name="department"
                    value={eventSpecificData.department}
                    onChange={handleEventSpecificChange}
                    placeholder="e.g., Human Resources, IT"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Your Position</label>
                  <input
                    type="text"
                    name="position"
                    value={eventSpecificData.position}
                    onChange={handleEventSpecificChange}
                    placeholder="e.g., Events Manager"
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.section}>
                <label style={styles.label}>Event Purpose</label>
                <textarea
                  name="event_purpose"
                  value={eventSpecificData.event_purpose}
                  onChange={handleEventSpecificChange}
                  placeholder="e.g., Team building, Product launch, Year-end party..."
                  rows="3"
                  style={styles.textarea}
                />
              </div>
            </div>
          </>
        );

      case "Anniversary":
        return (
          <>
            <div style={styles.subsection}>
              <h3 style={styles.subsectionTitle}>💕 Anniversary Details</h3>

              <div style={styles.section}>
                <label style={styles.label}>
                  Couple's Names <span style={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  name="couple_names"
                  value={eventSpecificData.couple_names}
                  onChange={handleEventSpecificChange}
                  placeholder="Juan & Maria Dela Cruz"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Years Together</label>
                  <input
                    type="number"
                    name="years_together"
                    value={eventSpecificData.years_together}
                    onChange={handleEventSpecificChange}
                    placeholder="25"
                    min="1"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Anniversary Theme</label>
                  <input
                    type="text"
                    name="anniversary_theme"
                    value={eventSpecificData.anniversary_theme}
                    onChange={handleEventSpecificChange}
                    placeholder="e.g., Silver, Golden, Ruby"
                    style={styles.input}
                  />
                </div>
              </div>
            </div>
          </>
        );

      case "Debut":
        return (
          <>
            <div style={styles.subsection}>
              <h3 style={styles.subsectionTitle}>👗 Debut Details</h3>

              <div style={styles.section}>
                <label style={styles.label}>
                  Debutante's Name <span style={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  name="debutante_name"
                  value={eventSpecificData.debutante_name}
                  onChange={handleEventSpecificChange}
                  placeholder="Maria Santos"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.section}>
                <label style={styles.label}>Debut Theme</label>
                <input
                  type="text"
                  name="debut_theme"
                  value={eventSpecificData.debut_theme}
                  onChange={handleEventSpecificChange}
                  placeholder="e.g., Enchanted Garden, Masquerade, Winter Wonderland"
                  style={styles.input}
                />
              </div>

              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Number of Roses</label>
                  <input
                    type="number"
                    name="number_of_roses"
                    value={eventSpecificData.number_of_roses}
                    onChange={handleEventSpecificChange}
                    placeholder="18"
                    min="1"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Number of Candles</label>
                  <input
                    type="number"
                    name="number_of_candles"
                    value={eventSpecificData.number_of_candles}
                    onChange={handleEventSpecificChange}
                    placeholder="18"
                    min="1"
                    style={styles.input}
                  />
                </div>
              </div>
            </div>
          </>
        );

      case "Graduation":
        return (
          <>
            <div style={styles.subsection}>
              <h3 style={styles.subsectionTitle}>🎓 Graduation Details</h3>

              <div style={styles.section}>
                <label style={styles.label}>
                  Graduate's Name <span style={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  name="graduate_name"
                  value={eventSpecificData.graduate_name}
                  onChange={handleEventSpecificChange}
                  placeholder="Juan Dela Cruz"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>School/University</label>
                  <input
                    type="text"
                    name="school_name"
                    value={eventSpecificData.school_name}
                    onChange={handleEventSpecificChange}
                    placeholder="University of the Philippines"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Graduation Year</label>
                  <input
                    type="number"
                    name="graduation_year"
                    value={eventSpecificData.graduation_year}
                    onChange={handleEventSpecificChange}
                    placeholder="2026"
                    min="2020"
                    max="2030"
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.section}>
                <label style={styles.label}>Degree/Program</label>
                <input
                  type="text"
                  name="degree_program"
                  value={eventSpecificData.degree_program}
                  onChange={handleEventSpecificChange}
                  placeholder="e.g., BS Computer Science, BA Communication"
                  style={styles.input}
                />
              </div>
            </div>
          </>
        );

      case "Other":
      default:
        return (
          <>
            <div style={styles.subsection}>
              <h3 style={styles.subsectionTitle}>📝 Event Details</h3>
              <p style={styles.helpText}>
                Please provide any relevant details about your event in the fields below.
              </p>
            </div>
          </>
        );
    }
  };

  // Render summary based on event type
  const renderEventSpecificSummary = () => {
    const items = [];

    switch (eventData.event_type) {
      case "Wedding":
        if (eventSpecificData.bride_name) {
          items.push({ label: "Bride", value: eventSpecificData.bride_name });
        }
        if (eventSpecificData.groom_name) {
          items.push({ label: "Groom", value: eventSpecificData.groom_name });
        }
        if (eventSpecificData.wedding_theme) {
          items.push({ label: "Theme", value: eventSpecificData.wedding_theme });
        }
        if (eventSpecificData.reception_venue) {
          items.push({ label: "Reception", value: eventSpecificData.reception_venue });
        }
        break;

      case "Birthday":
        if (eventSpecificData.celebrant_name) {
          items.push({ label: "Celebrant", value: eventSpecificData.celebrant_name });
        }
        if (eventSpecificData.celebrant_age) {
          items.push({ label: "Age", value: eventSpecificData.celebrant_age });
        }
        if (eventSpecificData.birthday_theme) {
          items.push({ label: "Theme", value: eventSpecificData.birthday_theme });
        }
        if (eventSpecificData.cake_preference) {
          items.push({ label: "Cake", value: eventSpecificData.cake_preference });
        }
        break;

      case "Corporate Event":
        if (eventSpecificData.company_name) {
          items.push({ label: "Company", value: eventSpecificData.company_name });
        }
        if (eventSpecificData.department) {
          items.push({ label: "Department", value: eventSpecificData.department });
        }
        if (eventSpecificData.position) {
          items.push({ label: "Position", value: eventSpecificData.position });
        }
        if (eventSpecificData.event_purpose) {
          items.push({ label: "Purpose", value: eventSpecificData.event_purpose });
        }
        break;

      case "Anniversary":
        if (eventSpecificData.couple_names) {
          items.push({ label: "Couple", value: eventSpecificData.couple_names });
        }
        if (eventSpecificData.years_together) {
          items.push({ label: "Years", value: eventSpecificData.years_together });
        }
        if (eventSpecificData.anniversary_theme) {
          items.push({ label: "Theme", value: eventSpecificData.anniversary_theme });
        }
        break;

      case "Debut":
        if (eventSpecificData.debutante_name) {
          items.push({ label: "Debutante", value: eventSpecificData.debutante_name });
        }
        if (eventSpecificData.debut_theme) {
          items.push({ label: "Theme", value: eventSpecificData.debut_theme });
        }
        if (eventSpecificData.number_of_roses) {
          items.push({ label: "Roses", value: eventSpecificData.number_of_roses });
        }
        if (eventSpecificData.number_of_candles) {
          items.push({ label: "Candles", value: eventSpecificData.number_of_candles });
        }
        break;

      case "Graduation":
        if (eventSpecificData.graduate_name) {
          items.push({ label: "Graduate", value: eventSpecificData.graduate_name });
        }
        if (eventSpecificData.school_name) {
          items.push({ label: "School", value: eventSpecificData.school_name });
        }
        if (eventSpecificData.degree_program) {
          items.push({ label: "Degree", value: eventSpecificData.degree_program });
        }
        if (eventSpecificData.graduation_year) {
          items.push({ label: "Year", value: eventSpecificData.graduation_year });
        }
        break;
    }

    return items;
  };

  return (
    <div style={styles.wrapper}>
      {/* Enhanced CSS for hover and focus states */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        /* Event box hover effect (non-selected) */
        [data-event-box]:not([data-selected="true"]):hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          border-color: #A0785A;
        }
        
        /* Input focus states */
        input:focus, textarea:focus, select:focus {
          border-color: #A0785A !important;
          box-shadow: 0 0 0 3px rgba(160, 120, 90, 0.1);
        }
        
        /* Progress line animation */
        @keyframes progressGrow {
          from { width: 0; }
          to { width: 100%; }
        }
      `}</style>

      {/* Header with gradient */}
      <div style={{
        ...styles.headerContainer,
        background: 'linear-gradient(135deg, #A0785A 0%, #74583E 100%)',
        padding: '2.5rem 1rem',
        borderRadius: '16px 16px 0 0',
        marginBottom: '2rem',
        boxShadow: '0 4px 12px rgba(116, 88, 62, 0.15)'
      }}>
        <div style={styles.headerContent}>
          <h1 style={{ ...styles.title, color: '#fff', fontSize: '2rem' }}>Book a Service</h1>
          <p style={{ ...styles.subtitle, color: 'rgba(255,255,255,0.95)', fontSize: '1.1rem' }}>
            with <strong>{vendorName}</strong>
          </p>
        </div>
      </div>

      {/* Progress Indicator */}
      <div style={styles.progressContainer}>
        {steps.map((step, index) => (
          <div key={step.number} style={styles.progressStepWrapper}>
            <div style={styles.progressStep}>
              <div style={{
                ...styles.progressCircle,
                ...(currentStep >= step.number ? styles.progressCircleActive : {})
              }}>
                {currentStep > step.number ? (
                  <svg style={styles.checkIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span style={{
                ...styles.progressLabel,
                ...(currentStep >= step.number ? styles.progressLabelActive : {})
              }}>
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div style={{
                ...styles.progressLine,
                ...(currentStep > step.number ? styles.progressLineActive : {})
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Form Container */}
      <div style={styles.formContainer}>

        {/* STEP 1: EVENT DETAILS */}
        {currentStep === 1 && (
          <div style={styles.stepContent}>
            <h2 style={styles.stepTitle}>Step 1: Event Details</h2>
            <p style={styles.stepDescription}>
              Tell us about your event. This helps the supplier prepare the best service for you.
            </p>

            {/* Event Type Selection */}
            <div style={styles.section}>
              <label style={styles.sectionLabel}>
                Select Event Type <span style={styles.required}>*</span>
              </label>
              <div style={styles.eventTypeGrid}>
                {eventTypes.map((type) => (
                  <div
                    key={type.value}
                    data-event-box="true"
                    data-selected={eventData.event_type === type.value}
                    onClick={() => handleEventTypeSelect(type.value)}
                    style={{
                      ...styles.eventBox,
                      ...(eventData.event_type === type.value ? styles.selectedEventBox : {})
                    }}
                  >
                    <div style={{
                      ...styles.iconContainer,
                      ...(eventData.event_type === type.value ? { color: '#fff' } : { color: '#666' })
                    }}>
                      {type.icon}
                    </div>
                    <div style={{
                      ...styles.boxLabel,
                      ...(eventData.event_type === type.value ? { color: '#fff' } : {})
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
                    value={eventData.event_date}
                    onChange={handleEventChange}
                    min={new Date().toISOString().split('T')[0]}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Event Time <span style={styles.required}>*</span>
                  </label>

                  {/* Time selector with separate hour, minute, and AM/PM */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Hour selector */}
                    <select
                      name="hour"
                      value={timeComponents.hour}
                      onChange={handleTimeComponentChange}
                      style={{ ...styles.input, flex: 1 }}
                      required
                    >
                      {Array.from({ length: 12 }, (_, i) => {
                        const hour = i + 1;
                        return (
                          <option key={hour} value={String(hour)}>
                            {hour}
                          </option>
                        );
                      })}
                    </select>

                    {/* Minute selector - 15 minute intervals */}
                    <select
                      name="minute"
                      value={timeComponents.minute}
                      onChange={handleTimeComponentChange}
                      style={{ ...styles.input, flex: 1 }}
                      required
                    >
                      <option value="00">00</option>
                      <option value="15">15</option>
                      <option value="30">30</option>
                      <option value="45">45</option>
                    </select>

                    {/* AM/PM selector */}
                    <select
                      name="ampm"
                      value={timeComponents.ampm}
                      onChange={handleTimeComponentChange}
                      style={{ ...styles.input, flex: 1 }}
                      required
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
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
                value={eventData.event_location}
                onChange={handleEventChange}
                placeholder="e.g., Manila Hotel, Quezon City"
                style={styles.input}
                required
              />
            </div>

            {/* Budget */}
            <div style={styles.section}>
              <label style={styles.label}>
                ₱ Estimated Budget
              </label>
              <input
                type="number"
                name="budget_amount"
                value={eventData.budget_amount}
                onChange={handleEventChange}
                placeholder="Enter your budget amount"
                min="0"
                step="1000"
                style={styles.input}
              />
            </div>

            {/* Package */}
            <div style={styles.section}>
              <label style={styles.label}>Package/Tier (Optional)</label>
              <input
                type="text"
                name="package_selected"
                value={eventData.package_selected}
                onChange={handleEventChange}
                placeholder="e.g., Premium Package, Basic Package"
                style={styles.input}
              />
            </div>

            {/* Additional Notes */}
            <div style={styles.section}>
              <label style={styles.label}>Additional Notes</label>
              <textarea
                name="additional_notes"
                value={eventData.additional_notes}
                onChange={handleEventChange}
                placeholder="Any special requests or additional information about your event..."
                rows="4"
                style={styles.textarea}
              />
            </div>
          </div>
        )}

        {/* STEP 2: EVENT-SPECIFIC INFORMATION */}
        {currentStep === 2 && (
          <div style={styles.stepContent}>
            <h2 style={styles.stepTitle}>
              Step 2: {eventData.event_type} Information
            </h2>
            <p style={styles.stepDescription}>
              Provide specific details for your {eventData.event_type.toLowerCase()} so the supplier can better prepare.
            </p>

            {/* Contact Information (Common for all) */}
            <div style={styles.subsection}>
              <h3 style={styles.subsectionTitle}>📞 Contact Details</h3>

              <div style={styles.section}>
                <label style={styles.label}>
                  Full Name <span style={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  name="contact_name"
                  value={eventSpecificData.contact_name}
                  onChange={handleEventSpecificChange}
                  placeholder="Juan Dela Cruz"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Email Address <span style={styles.required}>*</span>
                  </label>
                  <input
                    type="email"
                    name="contact_email"
                    value={eventSpecificData.contact_email}
                    onChange={handleEventSpecificChange}
                    placeholder="juan@example.com"
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Phone Number <span style={styles.required}>*</span>
                  </label>
                  <input
                    type="tel"
                    name="contact_phone"
                    value={eventSpecificData.contact_phone}
                    onChange={handleEventSpecificChange}
                    placeholder="+63 912 345 6789"
                    style={styles.input}
                    required
                  />
                </div>
              </div>

              <div style={styles.section}>
                <label style={styles.label}>
                  Number of Guests (Estimated)
                </label>
                <input
                  type="number"
                  name="number_of_guests"
                  value={eventSpecificData.number_of_guests}
                  onChange={handleEventSpecificChange}
                  placeholder="100"
                  min="1"
                  style={styles.input}
                />
              </div>
            </div>

            {/* Event-Specific Fields */}
            {renderEventSpecificFields()}

            {/* Common Optional Fields */}
            <div style={styles.subsection}>
              <h3 style={styles.subsectionTitle}>ℹ️ Additional Information</h3>

              <div style={styles.section}>
                <label style={styles.label}>
                  Dietary Restrictions or Preferences
                </label>
                <textarea
                  name="dietary_restrictions"
                  value={eventSpecificData.dietary_restrictions}
                  onChange={handleEventSpecificChange}
                  placeholder="e.g., Vegetarian, No pork, Halal, Allergies to shellfish..."
                  rows="3"
                  style={styles.textarea}
                />
              </div>

              <div style={styles.section}>
                <label style={styles.label}>
                  Accessibility Requirements
                </label>
                <textarea
                  name="accessibility_requirements"
                  value={eventSpecificData.accessibility_requirements}
                  onChange={handleEventSpecificChange}
                  placeholder="e.g., Wheelchair access, Parking for elderly guests, Sign language interpreter..."
                  rows="3"
                  style={styles.textarea}
                />
              </div>

              <div style={styles.row}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    name="emergency_contact_name"
                    value={eventSpecificData.emergency_contact_name}
                    onChange={handleEventSpecificChange}
                    placeholder="Pedro Dela Cruz"
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Emergency Contact Phone
                  </label>
                  <input
                    type="tel"
                    name="emergency_contact_phone"
                    value={eventSpecificData.emergency_contact_phone}
                    onChange={handleEventSpecificChange}
                    placeholder="+63 912 345 6789"
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.section}>
                <label style={styles.label}>
                  Special Requests or Additional Information
                </label>
                <textarea
                  name="special_requests"
                  value={eventSpecificData.special_requests}
                  onChange={handleEventSpecificChange}
                  placeholder="Any other details the supplier should know..."
                  rows="4"
                  style={styles.textarea}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: SUMMARY */}
        {currentStep === 3 && (
          <div style={styles.stepContent}>
            <h2 style={styles.stepTitle}>Step 3: Review Your Booking</h2>
            <p style={styles.stepDescription}>
              Please review all the information before submitting your booking request.
            </p>

            {/* Event Details Summary */}
            <div style={styles.summarySection}>
              <div style={styles.summarySectionHeader}>
                <h3 style={styles.summarySectionTitle}>📅 Event Details</h3>
                <button
                  onClick={() => setCurrentStep(1)}
                  style={styles.editButton}
                  type="button"
                >
                  Edit
                </button>
              </div>
              <div style={styles.summaryGrid}>
                <div style={styles.summaryItem}>
                  <span style={styles.summaryLabel}>Event Type:</span>
                  <span style={styles.summaryValue}>{eventData.event_type}</span>
                </div>
                <div style={styles.summaryItem}>
                  <span style={styles.summaryLabel}>Date:</span>
                  <span style={styles.summaryValue}>
                    {new Date(eventData.event_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                <div style={styles.summaryItem}>
                  <span style={styles.summaryLabel}>Time:</span>
                  <span style={styles.summaryValue}>
                    {timeComponents.hour}:{timeComponents.minute} {timeComponents.ampm}
                  </span>
                </div>
                <div style={styles.summaryItem}>
                  <span style={styles.summaryLabel}>Location:</span>
                  <span style={styles.summaryValue}>{eventData.event_location}</span>
                </div>
                {eventData.budget_amount && (
                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Budget:</span>
                    <span style={styles.summaryValue}>₱{parseFloat(eventData.budget_amount).toLocaleString()}</span>
                  </div>
                )}
                {eventData.package_selected && (
                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Package:</span>
                    <span style={styles.summaryValue}>{eventData.package_selected}</span>
                  </div>
                )}
                {eventData.additional_notes && (
                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Notes:</span>
                    <span style={styles.summaryValue}>{eventData.additional_notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contact & Event-Specific Info Summary */}
            <div style={styles.summarySection}>
              <div style={styles.summarySectionHeader}>
                <h3 style={styles.summarySectionTitle}>👤 {eventData.event_type} Information</h3>
                <button
                  onClick={() => setCurrentStep(2)}
                  style={styles.editButton}
                  type="button"
                >
                  Edit
                </button>
              </div>
              <div style={styles.summaryGrid}>
                <div style={styles.summaryItem}>
                  <span style={styles.summaryLabel}>Contact Name:</span>
                  <span style={styles.summaryValue}>{eventSpecificData.contact_name}</span>
                </div>
                <div style={styles.summaryItem}>
                  <span style={styles.summaryLabel}>Email:</span>
                  <span style={styles.summaryValue}>{eventSpecificData.contact_email}</span>
                </div>
                <div style={styles.summaryItem}>
                  <span style={styles.summaryLabel}>Phone:</span>
                  <span style={styles.summaryValue}>{eventSpecificData.contact_phone}</span>
                </div>
                {eventSpecificData.number_of_guests && (
                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Guests:</span>
                    <span style={styles.summaryValue}>{eventSpecificData.number_of_guests}</span>
                  </div>
                )}

                {/* Event-Specific Summary Items */}
                {renderEventSpecificSummary().map((item, index) => (
                  <div key={index} style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>{item.label}:</span>
                    <span style={styles.summaryValue}>{item.value}</span>
                  </div>
                ))}

                {eventSpecificData.dietary_restrictions && (
                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Dietary:</span>
                    <span style={styles.summaryValue}>{eventSpecificData.dietary_restrictions}</span>
                  </div>
                )}
                {eventSpecificData.accessibility_requirements && (
                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Accessibility:</span>
                    <span style={styles.summaryValue}>{eventSpecificData.accessibility_requirements}</span>
                  </div>
                )}
                {eventSpecificData.emergency_contact_name && (
                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Emergency Contact:</span>
                    <span style={styles.summaryValue}>
                      {eventSpecificData.emergency_contact_name} ({eventSpecificData.emergency_contact_phone})
                    </span>
                  </div>
                )}
                {eventSpecificData.special_requests && (
                  <div style={styles.summaryItem}>
                    <span style={styles.summaryLabel}>Special Requests:</span>
                    <span style={styles.summaryValue}>{eventSpecificData.special_requests}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Info Box */}
            <div style={styles.infoBox}>
              <svg style={styles.infoIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p style={styles.infoText}>
                Your booking request will be sent to <strong>{vendorName}</strong> for review.
                You will be notified once they respond.
              </p>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={styles.buttonGroup}>
          {currentStep > 1 && (
            <button
              type="button"
              onClick={goToPreviousStep}
              style={styles.backButton}
              disabled={loading}
            >
              ← Back
            </button>
          )}

          <button
            type="button"
            onClick={handleCancel}
            style={styles.cancelButton}
            disabled={loading}
          >
            Cancel
          </button>

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={goToNextStep}
              style={styles.nextButton}
              disabled={loading}
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              style={styles.submitButton}
              disabled={loading}
            >
              {loading ? "Sending Request..." : "✓ Submit Booking Request"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// Styles (same as before - keeping consistent)
const styles = {
  wrapper: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "1.5rem 0.5rem",
    minHeight: "100vh"
  },

  headerContainer: {
    backgroundColor: "transparent",
    marginBottom: "2rem"
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

  progressContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "3rem",
    padding: "0 1rem"
  },
  progressStepWrapper: {
    display: "flex",
    alignItems: "center",
    flex: 1,
    maxWidth: "250px"
  },
  progressStep: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.5rem"
  },
  progressCircle: {
    width: "50px",
    height: "50px",
    borderRadius: "50%",
    backgroundColor: "#e5e5e5",
    color: "#999",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.2rem",
    fontWeight: "600",
    transition: "all 0.3s ease"
  },
  progressCircleActive: {
    backgroundColor: "#74583E",
    color: "#fff",
    boxShadow: "0 4px 12px rgba(116, 88, 62, 0.3)"
  },
  checkIcon: {
    width: "24px",
    height: "24px"
  },
  progressLabel: {
    fontSize: "0.85rem",
    color: "#999",
    fontWeight: "500",
    textAlign: "center",
    whiteSpace: "nowrap"
  },
  progressLabelActive: {
    color: "#74583E",
    fontWeight: "600"
  },
  progressLine: {
    flex: 1,
    height: "3px",
    backgroundColor: "#e5e5e5",
    margin: "0 0.5rem",
    transition: "all 0.3s ease"
  },
  progressLineActive: {
    backgroundColor: "#74583E"
  },

  formContainer: {
    backgroundColor: "#fff",
    borderRadius: "16px",
    padding: "2rem",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    border: "1px solid #e5e5e5",
    minHeight: "600px"
  },

  stepContent: {
    animation: "fadeIn 0.3s ease-in"
  },
  stepTitle: {
    fontSize: "1.8rem",
    fontWeight: "600",
    color: "#1c1b1a",
    marginBottom: "0.5rem"
  },
  stepDescription: {
    fontSize: "1rem",
    color: "#666",
    marginBottom: "2rem",
    lineHeight: "1.5"
  },
  helpText: {
    fontSize: "0.9rem",
    color: "#666",
    fontStyle: "italic",
    marginTop: "0.5rem"
  },

  section: {
    marginBottom: "2rem"
  },
  subsection: {
    marginBottom: "2.5rem",
    paddingBottom: "2rem",
    borderBottom: "1px solid #e5e5e5"
  },
  subsectionTitle: {
    fontSize: "1.2rem",
    fontWeight: "600",
    color: "#74583E",
    marginBottom: "1rem"
  },
  sectionLabel: {
    display: "block",
    marginBottom: "1rem",
    fontSize: "1.1rem",
    fontWeight: "600",
    color: "#1c1b1a"
  },

  eventTypeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "1rem"
  },

  eventBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem 1rem",
    backgroundColor: "linear-gradient(135deg, #fff 0%, #f9f9f9 100%)",
    border: "2px solid #e5e5e5",
    borderRadius: "16px",
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    minHeight: "130px",
    position: "relative",
    overflow: "hidden"
  },
  selectedEventBox: {
    background: "linear-gradient(135deg, #A0785A 0%, #74583E 100%)",
    borderColor: "#74583E",
    transform: "translateY(-4px) scale(1.02)",
    boxShadow: "0 8px 24px rgba(116, 88, 62, 0.25), 0 4px 8px rgba(116, 88, 62, 0.15)"
  },
  iconContainer: {
    marginBottom: "0.75rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.3s ease",
    transform: "scale(1)"
  },
  boxLabel: {
    fontSize: "0.9rem",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: "1.3",
    color: "#333",
    transition: "color 0.2s ease"
  },

  formGroup: {
    flex: 1,
    minWidth: "200px"
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
    padding: "0.875rem 1rem",
    fontSize: "1rem",
    border: "2px solid #e5e5e5",
    borderRadius: "12px",
    outline: "none",
    transition: "all 0.3s ease",
    boxSizing: "border-box",
    backgroundColor: "#fff",
    fontFamily: "inherit"
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

  summarySection: {
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e5e5",
    borderRadius: "12px",
    padding: "1.5rem",
    marginBottom: "1.5rem"
  },
  summarySectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
    paddingBottom: "1rem",
    borderBottom: "2px solid #e5e5e5"
  },
  summarySectionTitle: {
    fontSize: "1.2rem",
    fontWeight: "600",
    color: "#1c1b1a",
    margin: 0
  },
  editButton: {
    padding: "0.5rem 1rem",
    backgroundColor: "#fff",
    border: "1px solid #74583E",
    borderRadius: "6px",
    color: "#74583E",
    fontSize: "0.9rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  summaryGrid: {
    display: "grid",
    gap: "1rem"
  },
  summaryItem: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem"
  },
  summaryLabel: {
    fontSize: "0.85rem",
    color: "#666",
    fontWeight: "500"
  },
  summaryValue: {
    fontSize: "1rem",
    color: "#1c1b1a",
    fontWeight: "600"
  },

  infoBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.75rem",
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "10px",
    padding: "1rem",
    marginTop: "2rem"
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
    paddingTop: "2rem",
    marginTop: "2rem",
    borderTop: "2px solid #e5e5e5",
    flexWrap: "wrap"
  },
  backButton: {
    padding: "0.875rem 2rem",
    fontSize: "1rem",
    fontWeight: "600",
    border: "2px solid #74583E",
    borderRadius: "10px",
    backgroundColor: "#fff",
    color: "#74583E",
    cursor: "pointer",
    transition: "all 0.2s"
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
    transition: "all 0.2s",
    marginRight: "auto"
  },
  nextButton: {
    padding: "1rem 3rem",
    fontSize: "1.05rem",
    fontWeight: "600",
    border: "none",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #A0785A 0%, #74583E 100%)",
    color: "#fff",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 12px rgba(116, 88, 62, 0.25)"
  },
  submitButton: {
    padding: "1rem 3rem",
    fontSize: "1.05rem",
    fontWeight: "600",
    border: "none",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
    color: "#fff",
    cursor: "pointer",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)"
  }
};
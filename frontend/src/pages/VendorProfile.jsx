import { useEffect, useState } from "react";
import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "../utils/toast";
import "../style.css";

const API = 
  import.meta.env.VITE_API_BASE || 
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD 
    ? "https://solennia.up.railway.app/api" : "/api");

export default function VendorProfile() {
  const [params] = useSearchParams();
  const vendorId = params.get("id");
  const navigate = useNavigate();

  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightboxImg, setLightboxImg] = useState(null);

  // Calendar states
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availability, setAvailability] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [isVendorOwner, setIsVendorOwner] = useState(false);
  
  // Availability modal states
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [availabilityForm, setAvailabilityForm] = useState({
    start_time: "09:00",
    end_time: "17:00",
    is_available: true,
    notes: ""
  });
  const [editingAvailability, setEditingAvailability] = useState(null);
  const [savingAvailability, setSavingAvailability] = useState(false);

  /* =========================
     LOAD VENDOR
  ========================= */
  useEffect(() => {
    if (!vendorId) {
      toast.error("Vendor not found");
      navigate("/vendors");
      return;
    }

    async function loadVendor() {
      try {
        setLoading(true);
        const res = await fetch(`${API}/vendor/public/${vendorId}`);
        const json = await res.json();

        if (!res.ok || !json.vendor) throw new Error("Vendor not found");

        setVendor(json.vendor);

        // Check if current user is the vendor owner
        const token = localStorage.getItem("solennia_token");
        if (token) {
          const profileStr = localStorage.getItem("solennia_profile");
          if (profileStr) {
            const profile = JSON.parse(profileStr);
            const vendorUserId = json.vendor.UserID || json.vendor.user_id || json.vendor.id;
            setIsVendorOwner(profile.id === vendorUserId);
          }
        }
      } catch (err) {
        toast.error("Unable to load vendor.");
        navigate("/vendors");
      } finally {
        setLoading(false);
      }
    }

    loadVendor();
  }, [vendorId, navigate]);

  /* =========================
     LOAD AVAILABILITY
  ========================= */
  useEffect(() => {
    if (!vendorId) return;
    loadAvailability();
  }, [vendorId, currentMonth]);

  const loadAvailability = async () => {
    try {
      setLoadingAvailability(true);
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      
      const res = await fetch(`${API}/vendor/availability/${vendorId}?year=${year}&month=${month}`);
      const json = await res.json();
      
      if (json.success) {
        setAvailability(json.availability || []);
      }
    } catch (err) {
      console.error("Failed to load availability:", err);
    } finally {
      setLoadingAvailability(false);
    }
  };

  /* =========================
     CALENDAR HELPERS
  ========================= */
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getAvailabilityForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return availability.filter(a => a.date === dateStr);
  };

  const isDateBooked = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return availability.some(a => a.date === dateStr && !a.is_available);
  };

  const isDateAvailable = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return availability.some(a => a.date === dateStr && a.is_available);
  };

  /* =========================
     GET UPCOMING AVAILABILITY
  ========================= */
  const getUpcomingAvailability = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return availability
      .filter(a => {
        const availDate = new Date(a.date);
        return availDate >= today;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5); // Show next 5 entries
  };

  /* =========================
     CALENDAR NAVIGATION
  ========================= */
  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  /* =========================
     AVAILABILITY MODAL
  ========================= */
  const openAvailabilityModal = (date, existingAvailability = null) => {
    if (!isVendorOwner) return;
    
    setSelectedDate(date);
    
    if (existingAvailability) {
      setEditingAvailability(existingAvailability);
      setAvailabilityForm({
        start_time: existingAvailability.start_time ? existingAvailability.start_time.substring(0, 5) : "09:00",
        end_time: existingAvailability.end_time ? existingAvailability.end_time.substring(0, 5) : "17:00",
        is_available: existingAvailability.is_available,
        notes: existingAvailability.notes || ""
      });
    } else {
      setEditingAvailability(null);
      setAvailabilityForm({
        start_time: "09:00",
        end_time: "17:00",
        is_available: true,
        notes: ""
      });
    }
    
    setShowAvailabilityModal(true);
  };

  const closeAvailabilityModal = () => {
    setShowAvailabilityModal(false);
    setSelectedDate(null);
    setEditingAvailability(null);
    setAvailabilityForm({
      start_time: "09:00",
      end_time: "17:00",
      is_available: true,
      notes: ""
    });
  };

  /* =========================
     SAVE AVAILABILITY
  ========================= */
  const saveAvailability = async (e) => {
    e.preventDefault();
    
    if (!selectedDate || !isVendorOwner) return;
    
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.error("Please log in");
      return;
    }

    try {
      setSavingAvailability(true);
      
      const dateStr = selectedDate.toISOString().split('T')[0];
      const payload = {
        date: dateStr,
        ...availabilityForm
      };

      let url = `${API}/vendor/availability`;
      let method = "POST";

      if (editingAvailability) {
        url = `${API}/vendor/availability/${editingAvailability.id}`;
        method = "PATCH";
      }

      const res = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      
      if (json.success) {
        toast.success(editingAvailability ? "Availability updated!" : "Availability added!");
        closeAvailabilityModal();
        loadAvailability();
      } else {
        toast.error(json.error || "Failed to save availability");
      }
    } catch (err) {
      console.error("Save availability error:", err);
      toast.error("Failed to save availability");
    } finally {
      setSavingAvailability(false);
    }
  };

  /* =========================
     DELETE AVAILABILITY
  ========================= */
  const deleteAvailability = async (availabilityId) => {
    if (!isVendorOwner || !confirm("Delete this availability entry?")) return;
    
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.error("Please log in");
      return;
    }

    try {
      const res = await fetch(`${API}/vendor/availability/${availabilityId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      const json = await res.json();
      
      if (json.success) {
        toast.success("Availability deleted!");
        closeAvailabilityModal();
        loadAvailability();
      } else {
        toast.error(json.error || "Failed to delete availability");
      }
    } catch (err) {
      console.error("Delete availability error:", err);
      toast.error("Failed to delete availability");
    }
  };

  /* =========================
     FORMAT DATE
  ========================= */
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  /* =========================
     CHAT
  ========================= */
  function openChat() {
    if (!vendor) return;
    
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please log in to chat with suppliers");
      return;
    }
    
    const uid = vendor.firebase_uid || vendor.user_id || vendor.UserID;
    if (!uid) return;
    navigate(`/chat?to=${encodeURIComponent(uid)}`);
  }

  /* =========================
     BOOK NOW
  ========================= */
  function handleBookNow() {
    if (!vendor) return;
    
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please log in to book this supplier");
      return;
    }

    const vendorUserId = vendor.UserID || vendor.user_id || vendor.id;

    if (!vendorUserId) {
      toast.error("Unable to identify vendor. Please try again.");
      return;
    }

    navigate('/create-booking', {
      state: {
        vendorUserId: vendorUserId,
        vendorName: vendor.business_name || vendor.BusinessName,
        serviceName: vendor.category || vendor.Category
      }
    });
  }

  /* =========================
     LIGHTBOX
  ========================= */
  function openLightbox(src) {
    setLightboxImg(src);
  }

  function closeLightbox() {
    setLightboxImg(null);
  }

  /* =========================
     LOADING STATE
  ========================= */
  if (loading) {
    return (
      <>
        <style>{styles}</style>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '60vh',
          fontSize: '1.2rem',
          color: '#666'
        }}>
          Loading vendor...
        </div>
      </>
    );
  }

  if (!vendor) {
    return (
      <>
        <style>{styles}</style>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '60vh',
          fontSize: '1.2rem',
          color: '#666'
        }}>
          Vendor not found
        </div>
      </>
    );
  }

  const {
    business_name,
    BusinessName,
    category,
    Category,
    address,
    BusinessAddress,
    bio,
    description,
    Description,
    services,
    service_areas,
    hero_image_url,
    HeroImageUrl,
    vendor_logo,
    avatar,
    gallery = [],
    firebase_uid,
    user_id,
    UserID
  } = vendor;

  // Handle case variations
  const displayName = business_name || BusinessName || "Vendor";
  const displayCategory = category || Category || "";
  const displayAddress = address || BusinessAddress || "";
  const displayBio = bio || description || Description || "This vendor has not provided a full description yet.";
  const displayHero = hero_image_url || HeroImageUrl || "/images/default-hero.jpg";
  const displayLogo = vendor_logo || avatar || "/images/default-avatar.png";

  const chatEnabled = firebase_uid || user_id || UserID;
  const chatTitle = firebase_uid 
    ? "Open chat with vendor" 
    : (user_id || UserID)
    ? "Open chat (vendor may need Firebase link)" 
    : "Vendor has not linked a chat account";

  // Calendar data
  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  
  // Get upcoming availability
  const upcomingAvailability = getUpcomingAvailability();

  /* =========================
     RENDER
  ========================= */
  return (
    <>
      <style>{styles}</style>

      {/* HERO */}
      <div className="hero-container">
        <img
          src={displayHero}
          alt="Vendor hero"
        />
      </div>

      <main>
        <section className="profile-card">

          {/* LOGO */}
          <div className="vendor-logo">
            <img
              src={displayLogo}
              alt="Vendor logo"
            />
          </div>

          <div className="vendor-header">
            <h1 className="vendor-name">
              {displayName}
            </h1>
            <p className="vendor-meta">
              {displayCategory} • {displayAddress}
            </p>
          </div>

          <p className="vendor-bio">
            {displayBio}
          </p>

          {/* SERVICES */}
          <h3 className="section-title">Services Offered</h3>
          <p>
            {Array.isArray(services)
              ? services.join(", ")
              : services || "Not specified"}
          </p>

          {/* AREAS */}
          <h3 className="section-title">Service Areas</h3>
          <p>
            {Array.isArray(service_areas)
              ? service_areas.join(", ")
              : service_areas || "Not specified"}
          </p>

          {/* AVAILABILITY CALENDAR */}
          <h3 className="section-title">
            Availability Calendar
            {isVendorOwner && (
              <span className="vendor-badge">You can edit your availability</span>
            )}
          </h3>

          {/* UPCOMING AVAILABILITY SUMMARY */}
          {upcomingAvailability.length > 0 && (
            <div className="upcoming-availability">
              <h4 className="upcoming-title">
                {isVendorOwner ? "Your Upcoming Availability:" : "Upcoming Availability:"}
              </h4>
              <div className="upcoming-list">
                {upcomingAvailability.map((avail, index) => (
                  <div 
                    key={index} 
                    className={`upcoming-item ${avail.is_available ? 'upcoming-available' : 'upcoming-booked'}`}
                  >
                    <div className="upcoming-date">
                      <span className="upcoming-icon">
                        {avail.is_available ? '✓' : '✕'}
                      </span>
                      {formatDate(avail.date)}
                    </div>
                    <div className="upcoming-time">
                      {avail.start_time?.substring(0, 5)} - {avail.end_time?.substring(0, 5)}
                    </div>
                    <div className="upcoming-status">
                      {avail.is_available ? 'Available' : 'Booked'}
                    </div>
                    {avail.notes && (
                      <div className="upcoming-notes">{avail.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NO AVAILABILITY MESSAGE */}
          {upcomingAvailability.length === 0 && !loadingAvailability && (
            <div className="no-availability">
              {isVendorOwner ? (
                <>
                  <p>🗓️ You haven't set any availability yet.</p>
                  <p>Click on future dates in the calendar below to add your availability!</p>
                </>
              ) : (
                <p>📅 This vendor hasn't set their availability yet. Please contact them directly to check availability.</p>
              )}
            </div>
          )}
          
          <div className="calendar-container">
            {/* Calendar Header */}
            <div className="calendar-header">
              <button onClick={previousMonth} className="calendar-nav-btn">
                ←
              </button>
              <h4 className="calendar-month">
                {monthNames[month]} {year}
              </h4>
              <button onClick={nextMonth} className="calendar-nav-btn">
                →
              </button>
            </div>

            {/* Calendar Legend */}
            <div className="calendar-legend">
              <div className="legend-item">
                <span className="legend-dot legend-available"></span>
                <span>Available</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot legend-booked"></span>
                <span>Booked/Unavailable</span>
              </div>
              {isVendorOwner && (
                <div className="legend-item">
                  <span className="legend-dot legend-editable"></span>
                  <span>Click to manage</span>
                </div>
              )}
            </div>

            {/* Calendar Grid */}
            <div className="calendar-weekdays">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            <div className="calendar-grid">
              {/* Empty cells for days before month starts */}
              {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="calendar-day calendar-day-empty"></div>
              ))}

              {/* Days of the month */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const date = new Date(year, month, day);
                const isToday = date.toDateString() === new Date().toDateString();
                const isPast = date < new Date().setHours(0, 0, 0, 0);
                const availabilityData = getAvailabilityForDate(date);
                const isAvailable = isDateAvailable(date);
                const isBooked = isDateBooked(date);

                let dayClass = "calendar-day";
                if (isToday) dayClass += " calendar-day-today";
                if (isPast) dayClass += " calendar-day-past";
                if (isAvailable) dayClass += " calendar-day-available";
                if (isBooked) dayClass += " calendar-day-booked";
                if (isVendorOwner && !isPast) dayClass += " calendar-day-editable";

                return (
                  <div
                    key={day}
                    className={dayClass}
                    onClick={() => {
                      if (isVendorOwner && !isPast) {
                        if (availabilityData.length > 0) {
                          openAvailabilityModal(date, availabilityData[0]);
                        } else {
                          openAvailabilityModal(date);
                        }
                      }
                    }}
                    title={
                      availabilityData.length > 0
                        ? `${availabilityData[0].is_available ? 'Available' : 'Booked'} ${availabilityData[0].start_time} - ${availabilityData[0].end_time}${availabilityData[0].notes ? '\n' + availabilityData[0].notes : ''}`
                        : isVendorOwner && !isPast
                        ? 'Click to set availability'
                        : ''
                    }
                  >
                    <span className="calendar-day-number">{day}</span>
                    {availabilityData.length > 0 && (
                      <div className="calendar-day-indicator">
                        {availabilityData[0].is_available ? '✓' : '✕'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {loadingAvailability && (
              <div className="calendar-loading">
                Loading availability...
              </div>
            )}
          </div>

          {/* GALLERY */}
          <h3 className="section-title">Gallery</h3>
          <div className="gallery-grid">
            {gallery.length === 0 ? (
              <p style={{ gridColumn: "1 / -1", fontSize: "0.9rem", color: "#666" }}>
                No gallery images available
              </p>
            ) : (
              gallery.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  onClick={() => openLightbox(img)}
                  alt={`Gallery image ${i + 1}`}
                />
              ))
            )}
          </div>

          {/* ACTION BUTTONS */}
          <div className="action-buttons">
            <button
              className="book-btn"
              onClick={handleBookNow}
            >
              Book This Supplier
            </button>
            
            <button
              className="chat-btn"
              disabled={!chatEnabled}
              onClick={openChat}
              title={chatTitle}
            >
              Chat Supplier
            </button>
          </div>

        </section>
      </main>

      {/* AVAILABILITY MODAL */}
      {showAvailabilityModal && selectedDate && (
        <div className="modal-backdrop" onClick={closeAvailabilityModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {editingAvailability ? 'Edit' : 'Set'} Availability
              </h3>
              <button onClick={closeAvailabilityModal} className="modal-close">
                ×
              </button>
            </div>

            <div className="modal-body">
              <p className="modal-date">
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>

              <form onSubmit={saveAvailability}>
                <div className="form-group">
                  <label>Status</label>
                  <div className="radio-group">
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="is_available"
                        checked={availabilityForm.is_available === true}
                        onChange={() => setAvailabilityForm({ ...availabilityForm, is_available: true })}
                      />
                      <span>Available</span>
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="is_available"
                        checked={availabilityForm.is_available === false}
                        onChange={() => setAvailabilityForm({ ...availabilityForm, is_available: false })}
                      />
                      <span>Booked/Unavailable</span>
                    </label>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Time</label>
                    <input
                      type="time"
                      value={availabilityForm.start_time}
                      onChange={(e) => setAvailabilityForm({ ...availabilityForm, start_time: e.target.value })}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>End Time</label>
                    <input
                      type="time"
                      value={availabilityForm.end_time}
                      onChange={(e) => setAvailabilityForm({ ...availabilityForm, end_time: e.target.value })}
                      required
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes (Optional)</label>
                  <textarea
                    value={availabilityForm.notes}
                    onChange={(e) => setAvailabilityForm({ ...availabilityForm, notes: e.target.value })}
                    placeholder="Add any notes about this time slot..."
                    className="form-textarea"
                    rows="3"
                  />
                </div>

                <div className="modal-actions">
                  {editingAvailability && (
                    <button
                      type="button"
                      onClick={() => deleteAvailability(editingAvailability.id)}
                      className="btn-delete"
                    >
                      Delete
                    </button>
                  )}
                  <div style={{ flex: 1 }}></div>
                  <button
                    type="button"
                    onClick={closeAvailabilityModal}
                    className="btn-cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingAvailability}
                    className="btn-save"
                  >
                    {savingAvailability ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightboxImg && (
        <div className="lb-backdrop" onClick={closeLightbox}>
          <div className="lb-frame" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImg} alt="Gallery preview" />
          </div>
          <div className="lb-close" onClick={closeLightbox}>
            &times;
          </div>
        </div>
      )}
    </>
  );
}

/* =========================
   STYLES
========================= */
const styles = `
  body {
    font-family: "Cinzel", serif;
    background: #f6f0e8;
    color: #1c1b1a;
  }

  main {
    flex: 1;
  }

  /* HERO */
  .hero-container {
    width: 100%;
    height: 260px;
    background: #d8c7a4;
    position: relative;
    overflow: hidden;
    border-bottom: 2px solid #c9bda4;
  }

  .hero-container img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* PROFILE CARD */
  .profile-card {
    max-width: 950px;
    margin: -60px auto 2rem;
    background: #efe9dd;
    padding: 1.5rem;
    border-radius: 1rem;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    border: 1px solid #c9bda4;
    position: relative;
  }

  .vendor-logo {
    width: 130px;
    height: 130px;
    border-radius: 9999px;
    overflow: hidden;
    border: 3px solid #1c1b1a;
    background: white;
    position: absolute;
    top: -65px;
    left: 1.5rem;
  }

  .vendor-logo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .vendor-header {
    padding-left: 160px;
    padding-top: 0.5rem;
  }

  .vendor-name {
    font-size: 1.8rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin: 0;
  }

  .vendor-meta {
    margin-top: 0.2rem;
    font-size: 0.9rem;
  }

  .vendor-bio {
    margin-top: 1.2rem;
    font-size: 1rem;
    line-height: 1.6;
    max-width: 680px;
  }

  .section-title {
    margin-top: 2rem;
    margin-bottom: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .vendor-badge {
    font-size: 0.7rem;
    background: #7a5d47;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    text-transform: none;
    letter-spacing: 0.05em;
    font-weight: 500;
  }

  /* UPCOMING AVAILABILITY */
  .upcoming-availability {
    background: #fff;
    border: 1px solid #d9d0c3;
    border-radius: 10px;
    padding: 1.25rem;
    margin-top: 1rem;
    margin-bottom: 1rem;
  }

  .upcoming-title {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: #7a5d47;
  }

  .upcoming-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .upcoming-item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid #e5e5e5;
  }

  .upcoming-available {
    background: #dcfce7;
    border-color: #86efac;
  }

  .upcoming-booked {
    background: #fee2e2;
    border-color: #fca5a5;
  }

  .upcoming-date {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .upcoming-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-size: 0.75rem;
  }

  .upcoming-available .upcoming-icon {
    background: #22c55e;
    color: white;
  }

  .upcoming-booked .upcoming-icon {
    background: #ef4444;
    color: white;
  }

  .upcoming-time {
    font-size: 0.85rem;
    color: #666;
  }

  .upcoming-status {
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    white-space: nowrap;
  }

  .upcoming-available .upcoming-status {
    background: #22c55e;
    color: white;
  }

  .upcoming-booked .upcoming-status {
    background: #ef4444;
    color: white;
  }

  .upcoming-notes {
    grid-column: 1 / -1;
    font-size: 0.85rem;
    color: #666;
    font-style: italic;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(0,0,0,0.1);
  }

  /* NO AVAILABILITY */
  .no-availability {
    background: #fff9e6;
    border: 1px solid #f5e8c7;
    border-radius: 10px;
    padding: 1.5rem;
    margin-top: 1rem;
    margin-bottom: 1rem;
    text-align: center;
  }

  .no-availability p {
    margin: 0.5rem 0;
    font-size: 0.95rem;
    color: #7a5d47;
  }

  .no-availability p:first-child {
    font-weight: 600;
    font-size: 1rem;
  }

  /* CALENDAR STYLES */
  .calendar-container {
    background: white;
    border: 1px solid #d9d0c3;
    border-radius: 10px;
    padding: 1.5rem;
    margin-top: 1rem;
  }

  .calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .calendar-month {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
  }

  .calendar-nav-btn {
    background: #7a5d47;
    color: white;
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: 0.2s;
  }

  .calendar-nav-btn:hover {
    background: #6a4f3a;
    transform: scale(1.05);
  }

  .calendar-legend {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    font-size: 0.85rem;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid #d9d0c3;
  }

  .legend-available {
    background: #4ade80;
  }

  .legend-booked {
    background: #f87171;
  }

  .legend-editable {
    background: #60a5fa;
  }

  .calendar-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    margin-bottom: 4px;
  }

  .calendar-weekdays > div {
    text-align: center;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0.5rem;
    color: #666;
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .calendar-day {
    aspect-ratio: 1;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    background: #fafafa;
    transition: 0.2s;
  }

  .calendar-day-empty {
    background: transparent;
    border: none;
  }

  .calendar-day-number {
    font-size: 0.9rem;
    font-weight: 500;
  }

  .calendar-day-indicator {
    position: absolute;
    bottom: 4px;
    font-size: 0.85rem;
    font-weight: bold;
  }

  .calendar-day-today {
    border: 2px solid #7a5d47;
    font-weight: 600;
  }

  .calendar-day-past {
    opacity: 0.4;
    background: #f5f5f5;
  }

  .calendar-day-available {
    background: #dcfce7;
    border-color: #4ade80;
    font-weight: 600;
  }

  .calendar-day-available .calendar-day-indicator {
    color: #16a34a;
  }

  .calendar-day-booked {
    background: #fee2e2;
    border-color: #f87171;
    font-weight: 600;
  }

  .calendar-day-booked .calendar-day-indicator {
    color: #dc2626;
  }

  .calendar-day-editable {
    cursor: pointer;
  }

  .calendar-day-editable:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .calendar-loading {
    text-align: center;
    padding: 1rem;
    color: #666;
    font-size: 0.9rem;
  }

  /* MODAL STYLES */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e5e5;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.2rem;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: #666;
    line-height: 1;
    padding: 0;
    width: 32px;
    height: 32px;
  }

  .modal-close:hover {
    color: #000;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .modal-date {
    font-weight: 600;
    color: #7a5d47;
    margin-bottom: 1.5rem;
    font-size: 1rem;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d9d0c3;
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.95rem;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #7a5d47;
  }

  .form-textarea {
    resize: vertical;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .radio-group {
    display: flex;
    gap: 1rem;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: 400;
  }

  .radio-label input[type="radio"] {
    cursor: pointer;
  }

  .modal-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e5e5e5;
  }

  .btn-cancel,
  .btn-save,
  .btn-delete {
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    transition: 0.2s;
  }

  .btn-cancel {
    background: #e5e5e5;
    color: #333;
  }

  .btn-cancel:hover {
    background: #d4d4d4;
  }

  .btn-save {
    background: #7a5d47;
    color: white;
  }

  .btn-save:hover {
    background: #6a4f3a;
  }

  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-delete {
    background: #ef4444;
    color: white;
  }

  .btn-delete:hover {
    background: #dc2626;
  }

  /* GALLERY */
  .gallery-grid {
    margin-top: 1rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .gallery-grid img {
    width: 100%;
    height: 150px;
    object-fit: cover;
    border-radius: 10px;
    cursor: zoom-in;
    border: 1px solid #d9d0c3;
    transition: transform 0.2s;
  }

  .gallery-grid img:hover {
    transform: scale(1.02);
  }

  /* ACTION BUTTONS CONTAINER */
  .action-buttons {
    margin-top: 2rem;
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  /* BOOK BUTTON */
  .book-btn {
    flex: 1;
    min-width: 200px;
    padding: 0.75rem 2rem;
    border-radius: 9999px;
    background: #8B4513;
    color: white;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    transition: 0.2s;
    font-family: "Cinzel", serif;
    font-weight: 600;
  }

  .book-btn:hover {
    background: #704010;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(139, 69, 19, 0.3);
  }

  /* CHAT BUTTON */
  .chat-btn {
    flex: 1;
    min-width: 200px;
    padding: 0.75rem 2rem;
    border-radius: 9999px;
    background: #7a5d47;
    color: white;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    transition: 0.2s;
    font-family: "Cinzel", serif;
  }

  .chat-btn[disabled] {
    background: #e7e3da;
    color: #8b8b8b;
    cursor: not-allowed;
  }

  .chat-btn:hover:not([disabled]) {
    background: #6a4f3a;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(122, 93, 71, 0.3);
  }

  /* LIGHTBOX */
  .lb-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.65);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1.25rem;
  }

  .lb-frame {
    background: white;
    border-radius: 10px;
    max-width: 90vw;
    max-height: 90vh;
    overflow: hidden;
    box-shadow: 0 10px 40px rgba(0,0,0,.4);
  }

  .lb-frame img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: black;
    max-height: 85vh;
  }

  .lb-close {
    position: absolute;
    top: 20px;
    right: 20px;
    font-size: 2rem;
    color: white;
    cursor: pointer;
    user-select: none;
    z-index: 10000;
  }

  .lb-close:hover {
    transform: scale(1.1);
  }

  /* RESPONSIVE */
  @media (max-width: 640px) {
    .action-buttons {
      flex-direction: column;
    }

    .book-btn,
    .chat-btn {
      width: 100%;
      min-width: unset;
    }

    .calendar-weekdays > div {
      font-size: 0.7rem;
      padding: 0.3rem;
    }

    .calendar-day-number {
      font-size: 0.8rem;
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .upcoming-item {
      grid-template-columns: 1fr;
      text-align: center;
    }

    .upcoming-date {
      justify-content: center;
    }
  }
`;
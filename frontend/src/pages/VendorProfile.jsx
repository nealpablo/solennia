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

  /* =========================
     FORMAT DATE TO LOCAL TIMEZONE
  ========================= */
  const formatDateToLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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
    const dateStr = formatDateToLocal(date);
    return availability.filter(a => a.date === dateStr);
  };

  const isDateBooked = (date) => {
    const dateStr = formatDateToLocal(date);
    return availability.some(a => a.date === dateStr && !a.is_available);
  };

  const isDateAvailable = (date) => {
    const dateStr = formatDateToLocal(date);
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
          Supplier not found
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
          </h3>

          {/* UPCOMING AVAILABILITY SUMMARY */}
          {upcomingAvailability.length > 0 && (
            <div className="upcoming-availability">
              <h4 className="upcoming-title">Upcoming Availability:</h4>
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
              <p>📅 This Supplier hasn't set their availability yet. Please contact them directly to check availability.</p>
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

                return (
                  <div
                    key={day}
                    className={dayClass}
                    title={
                      availabilityData.length > 0
                        ? `${availabilityData[0].is_available ? 'Available' : 'Booked'} ${availabilityData[0].start_time} - ${availabilityData[0].end_time}${availabilityData[0].notes ? '\n' + availabilityData[0].notes : ''}`
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
    background: #22c55e;
  }

  .legend-booked {
    background: #ef4444;
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
    border: 2px solid #22c55e;
    font-weight: 600;
  }

  .calendar-day-available .calendar-day-indicator {
    color: #16a34a;
  }

  .calendar-day-booked {
    background: #fee2e2;
    border: 2px solid #ef4444;
    font-weight: 600;
  }

  .calendar-day-booked .calendar-day-indicator {
    color: #dc2626;
  }

  .calendar-loading {
    text-align: center;
    padding: 1rem;
    color: #666;
    font-size: 0.9rem;
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

    .upcoming-item {
      grid-template-columns: 1fr;
      text-align: center;
    }

    .upcoming-date {
      justify-content: center;
    }
  }
`;
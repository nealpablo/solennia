// src/pages/VenueDetail.jsx - Gallery Support + Availability Calendar
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "../utils/toast";
import "../style.css";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://solennia.up.railway.app" : "");
const API = API_BASE && !String(API_BASE).endsWith('/api') ? `${API_BASE}/api` : (API_BASE || '/api');

export default function VenueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedImage, setSelectedImage] = useState(0);

  // Calendar states (static, read-only)
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availability, setAvailability] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // ⭐ NEW - Review states
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewStats, setReviewStats] = useState({ average_rating: null, total_reviews: 0 });

  /* =========================
     FETCH VENUE DATA FROM API
  ========================= */
  useEffect(() => {
    const fetchVenue = async () => {
      try {
        const response = await fetch(`${API_BASE}/venues/${id}`);
        const data = await response.json();

        console.log("Venue detail data:", data); // Debug

        if (response.ok && data.venue) {
          //  Parse gallery properly
          let galleryImages = [];
          if (data.venue.gallery) {
            try {
              galleryImages = typeof data.venue.gallery === 'string'
                ? JSON.parse(data.venue.gallery)
                : (Array.isArray(data.venue.gallery) ? data.venue.gallery : []);
            } catch (e) {
              console.error("Error parsing gallery:", e);
              galleryImages = [];
            }
          }

          //  Get main image
          const mainImage = data.venue.logo
            || data.venue.portfolio
            || data.venue.portfolio_image
            || data.venue.HeroImageUrl
            || "https://via.placeholder.com/800?text=Venue+Image";

          // Combine main image with gallery
          const allImages = [mainImage, ...galleryImages].filter(Boolean);

          setVenue({
            id: data.venue.id,
            firebase_uid: data.venue.firebase_uid,
            owner_name: data.venue.owner_name,
            name: data.venue.venue_name || data.venue.business_name,
            location: data.venue.address,
            images: allImages.length > 0 ? allImages : [mainImage],
            capacity: data.venue.venue_capacity || "Not specified",
            venue_type: data.venue.venue_subcategory || "",
            description: data.venue.description || "No description available.",
            amenities: data.venue.venue_amenities
              ? data.venue.venue_amenities.split(',').map(a => a.trim())
              : [],
            operating_hours: data.venue.venue_operating_hours || "Contact for hours",
            parking: data.venue.venue_parking || "Contact for details",
            packages: data.venue.pricing
              ? [{
                name: "Standard Package",
                price: "Contact for pricing",
                includes: data.venue.pricing.split('\n').filter(Boolean)
              }]
              : [],
            contact: {
              email: data.venue.contact_email || "",
              phone: data.venue.phone || "",
              address: data.venue.address || ""
            }
          });
        } else {
          setVenue(null);
        }
      } catch (error) {
        console.error("Error fetching venue:", error);
        setVenue(null);
      } finally {
        setLoading(false);
      }
    };

    fetchVenue();
  }, [id]);

  /* =========================
     LOAD AVAILABILITY (static calendar)
  ========================= */
  useEffect(() => {
    if (!id) return;
    loadAvailability();
    loadReviews(); // ⭐ NEW - Load reviews
  }, [id, currentMonth]);

  const loadAvailability = async () => {
    try {
      setLoadingAvailability(true);
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const res = await fetch(`${API}/venue/availability/${id}?year=${year}&month=${month}`);
      const json = await res.json();
      if (json.success) {
        setAvailability(json.availability || []);
      }
    } catch (err) {
      console.error("Failed to load venue availability:", err);
    } finally {
      setLoadingAvailability(false);
    }
  };

  /* =========================
     ⭐ NEW - LOAD REVIEWS
  ========================= */
  const loadReviews = async () => {
    if (!id) return;

    try {
      setLoadingReviews(true);
      const res = await fetch(`${API}/venues/${id}/feedback`);
      const json = await res.json();

      if (json.success) {
        setReviews(json.feedback || []);
        setReviewStats({
          average_rating: json.average_rating,
          total_reviews: json.total_reviews || 0
        });
      }
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setLoadingReviews(false);
    }
  };

  /* =========================
     CALENDAR HELPERS
  ========================= */
  const formatDateToLocal = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getAvailabilityForDate = (date) => {
    const dateStr = formatDateToLocal(date);
    return availability.filter((a) => a.date === dateStr);
  };

  const isDateBooked = (date) => {
    const dateStr = formatDateToLocal(date);
    return availability.some((a) => a.date === dateStr && !a.is_available);
  };

  // All dates are available by default unless marked as unavailable
  const isDateAvailable = (date) => {
    const dateStr = formatDateToLocal(date);
    // Return TRUE unless there's an availability record marking it as unavailable
    return !availability.some((a) => a.date === dateStr && !a.is_available);
  };

  const getUpcomingAvailability = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return availability
      .filter((a) => new Date(a.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const handleBookNow = () => {
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login to book this venue");
      return;
    }

    navigate('/create-venue-booking', {
      state: {
        venueId: venue.id,
        venueName: venue.name,
        venueType: venue.venue_type,
        capacity: venue.capacity,
        address: venue.location,
        venueImage: venue.images[0]
      }
    });
  };

  const handleAIBooking = () => {
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login to use AI booking");
      return;
    }

    // Navigate to AI booking with venue context
    navigate('/ai-booking', {
      state: {
        initialMessage: `I want to book ${venue.name} for an event`,
        venueContext: {
          venueId: venue.id,
          venueName: venue.name,
          venueType: venue.venue_type,
          capacity: venue.capacity,
          address: venue.location
        }
      }
    });
  };

  const handleScheduleVisit = () => {
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login to schedule a visit");
      return;
    }
    // Can implement visit scheduling modal or functionality later
    toast.info("Visit scheduling coming soon! For now, please chat with the venue owner.");
  };

  const handleChatClick = () => {
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login to chat with this venue");
      return;
    }

    const firebaseUid = venue.firebase_uid
      || venue.user_firebase_uid
      || venue.owner_firebase_uid;

    if (!firebaseUid) {
      toast.error("This venue's contact information is incomplete. Please try again later or contact support.");
      return;
    }

    navigate(`/chat?to=${encodeURIComponent(firebaseUid)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#e8ddae] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading venue details...</p>
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">Venue not found</p>
          <button
            onClick={() => navigate("/venue")}
            className="px-6 py-2 bg-[#e8ddae] hover:bg-[#dbcf9f] rounded-lg"
          >
            Back to Venues
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate("/venue")}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Venues
      </button>

      {/*  Image Gallery with Multiple Images */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Main Image */}
        <div className="h-96 rounded-lg overflow-hidden">
          <img
            src={venue.images[selectedImage] || venue.images[0]}
            alt={venue.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = "https://via.placeholder.com/800?text=Venue+Image";
            }}
          />
        </div>

        {/* Thumbnail Grid */}
        <div className="grid grid-cols-2 gap-4">
          {venue.images.slice(0, 4).map((img, idx) => (
            <div
              key={idx}
              className={`h-[11.5rem] rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${selectedImage === idx ? 'border-[#7a5d47]' : 'border-transparent hover:border-gray-300'
                }`}
              onClick={() => setSelectedImage(idx)}
            >
              <img
                src={img}
                alt={`${venue.name} ${idx + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = "https://via.placeholder.com/400?text=Image";
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Image Counter */}
      {venue.images.length > 1 && (
        <div className="text-center text-sm text-gray-600 mb-4">
          Image {selectedImage + 1} of {venue.images.length}
        </div>
      )}

      {/* Profile Avatar - Facebook Style */}
      <div className="relative -mt-24 mb-6 px-4">
        <div className="w-40 h-40 rounded-full border-4 border-white bg-white shadow-lg overflow-hidden">
          <img
            src={venue.images[0] || "https://via.placeholder.com/160?text=Venue"}
            alt={`${venue.name} profile`}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = "https://via.placeholder.com/160?text=Venue";
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h1 className="text-3xl font-bold text-gray-800">{venue.name}</h1>
              {venue.venue_type && (
                <span className="px-3 py-1 bg-[#e8ddae] text-sm font-medium rounded-full">
                  {venue.venue_type}
                </span>
              )}
            </div>

            {venue.owner_name && (
              <p className="text-sm text-gray-600 mb-2">
                Managed by <span className="font-medium">{venue.owner_name}</span>
              </p>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-4 text-gray-600 flex-wrap">
                <span className="flex items-center gap-1">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" strokeWidth="2" />
                  </svg>
                  {venue.location}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Capacity: {venue.capacity} guests
                </span>
              </div>

              {(venue.operating_hours || venue.parking) && (
                <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap mt-2">
                  {venue.operating_hours && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {venue.operating_hours}
                    </span>
                  )}
                  {venue.parking && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                      </svg>
                      {venue.parking}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-300 mb-6">
            <div className="flex gap-6">
              {/* ⭐ MODIFIED - Added "review" to tabs array */}
              {["overview", "packages", "amenities", "availability", "review"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-sm font-medium uppercase transition-colors ${activeTab === tab
                    ? "border-b-2 border-[#7a5d47] text-[#7a5d47]"
                    : "text-gray-600 hover:text-gray-800"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <div className="prose max-w-none">
              <h3 className="text-lg font-semibold mb-3">About This Venue</h3>
              <p className="text-gray-700 leading-relaxed">{venue.description}</p>
            </div>
          )}

          {activeTab === "packages" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Available Packages</h3>
              {venue.packages.length > 0 ? (
                venue.packages.map((pkg, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-semibold text-gray-800">{pkg.name}</h4>
                      <span className="text-xl font-bold text-[#7a5d47]">{pkg.price}</span>
                    </div>
                    <ul className="space-y-2">
                      {pkg.includes.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="text-gray-600">Contact venue for package details.</p>
              )}
            </div>
          )}

          {activeTab === "amenities" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Venue Amenities</h3>
              {venue.amenities.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {venue.amenities.map((amenity, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-gray-700">
                      <svg className="w-5 h-5 text-[#7a5d47]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {amenity}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">Contact venue for amenities information.</p>
              )}
            </div>
          )}

          {activeTab === "availability" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Availability Calendar</h3>

              {(() => {
                const upcomingAvailability = getUpcomingAvailability();
                const { daysInMonth, startingDayOfWeek, year, month } = (() => {
                  const d = currentMonth;
                  const first = new Date(d.getFullYear(), d.getMonth(), 1);
                  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                  return {
                    daysInMonth: last.getDate(),
                    startingDayOfWeek: first.getDay(),
                    year: d.getFullYear(),
                    month: d.getMonth()
                  };
                })();
                return (
                  <>
                    {upcomingAvailability.length > 0 && (
                      <div className="upcoming-availability mb-4">
                        <h4 className="upcoming-title">Upcoming Availability</h4>
                        <div className="upcoming-list">
                          {upcomingAvailability.map((avail, idx) => (
                            <div
                              key={idx}
                              className={`upcoming-item ${avail.is_available ? 'upcoming-available' : 'upcoming-booked'}`}
                            >
                              <div className="upcoming-date">
                                <span className="upcoming-icon">{avail.is_available ? '✓' : '✕'}</span>
                                {formatDate(avail.date)}
                              </div>
                              <div className="upcoming-time">
                                {avail.start_time?.substring(0, 5)} - {avail.end_time?.substring(0, 5)}
                              </div>
                              <div className="upcoming-status">{avail.is_available ? 'Available' : 'Booked'}</div>
                              {avail.notes && <div className="upcoming-notes">{avail.notes}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {upcomingAvailability.length === 0 && !loadingAvailability && (
                      <div className="no-availability mb-4">
                        <p>This venue has not set availability yet. Contact them directly to check dates.</p>
                      </div>
                    )}

                    <div className="calendar-container">
                      <div className="calendar-header">
                        <button type="button" onClick={previousMonth} className="calendar-nav-btn">←</button>
                        <h4 className="calendar-month">{monthNames[month]} {year}</h4>
                        <button type="button" onClick={nextMonth} className="calendar-nav-btn">→</button>
                      </div>
                      <div className="calendar-legend">
                        <div className="legend-item">
                          <span className="legend-dot legend-booked"></span>
                          <span>Unavailable</span>
                        </div>
                        <div className="legend-item">
                          <span className="legend-dot legend-available"></span>
                          <span>Booked</span>
                        </div>
                      </div>
                      <div className="calendar-weekdays">
                        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                      </div>
                      <div className="calendar-grid">
                        {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                          <div key={`empty-${i}`} className="calendar-day calendar-day-empty"></div>
                        ))}
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
                          // Only highlight unavailable/booked dates (red)
                          if (isBooked) dayClass += " calendar-day-booked";
                          return (
                            <div
                              key={day}
                              className={dayClass}
                              title={
                                availabilityData.length > 0
                                  ? `${availabilityData[0].is_available ? 'Available' : 'Unavailable'} ${availabilityData[0].start_time} - ${availabilityData[0].end_time}`
                                  : 'Available'
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
                      {loadingAvailability && <div className="calendar-loading">Loading availability...</div>}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ⭐ NEW - Review Tab */}
          {activeTab === "review" && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2">Client Reviews</h3>
                {reviewStats.total_reviews > 0 ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-5 h-5 ${star <= Math.round(reviewStats.average_rating || 0)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                            }`}
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-lg font-semibold">{reviewStats.average_rating?.toFixed(1)}</span>
                    <span className="text-gray-600">({reviewStats.total_reviews} {reviewStats.total_reviews === 1 ? 'review' : 'reviews'})</span>
                  </div>
                ) : (
                  <p className="text-gray-600">No reviews yet</p>
                )}
              </div>

              {loadingReviews ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-[#e8ddae] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-gray-600 text-sm">Loading reviews...</p>
                </div>
              ) : reviews.length > 0 ? (
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <div key={review.ID} className="border-b border-gray-200 pb-6 last:border-0">
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          {review.avatar ? (
                            <img
                              src={review.avatar}
                              alt={`${review.first_name} ${review.last_name}`}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-[#e8ddae] flex items-center justify-center">
                              <span className="text-[#7a5d47] font-semibold text-lg">
                                {review.first_name?.[0]}{review.last_name?.[0]}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="font-semibold text-gray-800">
                                {review.first_name} {review.last_name}
                              </h4>
                              <p className="text-sm text-gray-500">
                                {new Date(review.CreatedAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                  key={star}
                                  className={`w-4 h-4 ${star <= review.Rating
                                    ? 'text-yellow-400 fill-current'
                                    : 'text-gray-300'
                                    }`}
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                          </div>

                          {review.ServiceName && (
                            <p className="text-sm text-gray-600 mb-2">
                              Event: <span className="font-medium">{review.ServiceName}</span>
                              {review.EventDate && ` • ${new Date(review.EventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                            </p>
                          )}

                          {review.Comment && (
                            <p className="text-gray-700 mt-2">{review.Comment}</p>
                          )}

                          {review.IsReported === 1 && (
                            <div className="mt-2 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded inline-block">
                              ⚠️ Reported to Admin
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <p className="text-gray-600">No reviews yet</p>
                  <p className="text-sm text-gray-500 mt-1">Be the first to review this venue after booking!</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-lg p-6 sticky top-4">
            <h3 className="font-semibold text-lg mb-4">Contact Venue</h3>

            <div className="space-y-4 mb-6">
              {venue.contact.email && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Email</p>
                  <a href={`mailto:${venue.contact.email}`} className="text-[#7a5d47] hover:underline break-words">
                    {venue.contact.email}
                  </a>
                </div>
              )}

              {venue.contact.phone && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Phone</p>
                  <a href={`tel:${venue.contact.phone}`} className="text-[#7a5d47] hover:underline">
                    {venue.contact.phone}
                  </a>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-600 mb-1">Address</p>
                <p className="text-gray-800">{venue.contact.address}</p>
              </div>
            </div>

            {/* Booking Options */}
            <div className="mb-3">
              {/* Primary Book Now Button */}
              <button
                onClick={handleBookNow}
                className="w-full bg-[#7a5d47] hover:bg-[#654a38] text-white font-semibold py-3 px-6 rounded-lg transition-colors mb-2 flex items-center justify-center gap-2 text-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Book Now
              </button>
            </div>

            {/* Secondary Actions Grid */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleChatClick}
                className="w-full bg-[#e8ddae] hover:bg-[#dbcf9f] text-gray-800 font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Chat
              </button>

              <button
                onClick={handleScheduleVisit}
                className="w-full border-2 border-[#7a5d47] hover:bg-[#7a5d47] hover:text-white text-gray-800 font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Visit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
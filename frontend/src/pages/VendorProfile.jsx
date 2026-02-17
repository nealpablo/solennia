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
  const listingId = params.get("listingId");
  const navigate = useNavigate();

  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightboxImg, setLightboxImg] = useState(null);

  // Tab and gallery states
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedImage, setSelectedImage] = useState(0);

  // Calendar states
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availability, setAvailability] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Review states
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewStats, setReviewStats] = useState({ average_rating: null, total_reviews: 0 });

  /* =========================
     FORMAT DATE TO LOCAL TIMEZONE
  ========================= */
  /* =========================
     FORMAT DATE TO LOCAL TIMEZONE
  ========================= */
  const toLocalISOString = (date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  const formatDateToLocal = (date) => {
    return toLocalISOString(date);
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
        const listingParam = listingId ? `?listingId=${listingId}` : '';
        const res = await fetch(`${API}/vendor/public/${vendorId}${listingParam}`);
        const json = await res.json();

        if (!res.ok || !json.vendor) throw new Error("Vendor not found");

        setVendor(json.vendor);
      } catch (err) {
        toast.error("Unable to load supplier.");
        navigate("/vendors");
      } finally {
        setLoading(false);
      }
    }

    loadVendor();
  }, [vendorId, navigate]);

  /* =========================
     LOAD AVAILABILITY & BOOKINGS
  ========================= */
  useEffect(() => {
    if (!vendorId) return;
    loadAvailability();
    loadReviews();
  }, [vendorId, currentMonth]);

  /* =========================
     LOAD REVIEWS
  ========================= */
  const loadReviews = async () => {
    if (!vendorId) return;

    try {
      setLoadingReviews(true);
      const res = await fetch(`${API}/vendors/${vendorId}/feedback`);
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
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

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

  const getAvailabilityForDate = (date) => {
    const dateStr = formatDateToLocal(date);
    return availability.filter(a => a.date === dateStr);
  };

  const hasBookingOnDate = (date) => {
    const dateStr = formatDateToLocal(date);
    return availability.some(a => a.date && a.date.startsWith(dateStr) && !a.is_available && a.source === 'booking');
  };

  const isDateAvailable = (date) => {
    const dateStr = formatDateToLocal(date);
    const entries = availability.filter(a => a.date && a.date.startsWith(dateStr));
    const hasUnavailable = entries.some(a => !a.is_available);
    if (hasUnavailable) return false;
    return entries.some(a => a.is_available);
  };

  const isDateBooked = (date) => {
    const dateStr = formatDateToLocal(date);
    return availability.some(a => a.date && a.date.startsWith(dateStr) && !a.is_available);
  };

  /* =========================
     GET UPCOMING AVAILABILITY
  ========================= */
  const getUpcomingAvailability = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return availability
      .filter(a => new Date(a.date) >= today && !a.is_available)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
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
      toast.error("Unable to identify supplier. Please try again.");
      return;
    }

    navigate('/create-booking', {
      state: {
        vendorUserId: vendorUserId,
        vendorName: vendor.business_name || vendor.BusinessName,
        serviceName: vendor.business_name || vendor.BusinessName || (vendor.category === 'Others' ? vendor.other_category_type : vendor.category) || vendor.Category,
        listingId: vendor.listing_id || listingId || null
      }
    });
  }

  function handleAIBooking() {
    if (!vendor) return;

    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please log in to use AI booking");
      return;
    }

    const vendorName = vendor.business_name || vendor.BusinessName;
    const category = vendor.category || vendor.Category;

    navigate('/ai-booking', {
      state: {
        initialMessage: `I want to book ${vendorName} for an event`,
        vendorContext: {
          vendorId: vendor.UserID || vendor.user_id,
          vendorName: vendorName,
          vendorName: vendorName,
          category: (vendor.category === 'Others' ? vendor.other_category_type : vendor.category) || vendor.Category
        }
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#e8ddae] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading supplier...</p>
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">Supplier not found</p>
          <button
            onClick={() => navigate("/vendors")}
            className="px-6 py-2 bg-[#e8ddae] hover:bg-[#dbcf9f] rounded-lg"
          >
            Back to Suppliers
          </button>
        </div>
      </div>
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
    UserID,
    other_category_type
  } = vendor;

  // Handle case variations
  const displayName = business_name || BusinessName || "Vendor";
  const rawCategory = category || Category || "";
  const displayCategory = (['Others', 'Other'].includes(rawCategory) && other_category_type) ? other_category_type : rawCategory;
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
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate("/vendors")}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Suppliers
      </button>

      {/* Hero Banner */}
      <div className="relative h-64 md:h-80 w-full rounded-xl overflow-hidden mb-6 shadow-md">
        <img
          src={displayHero}
          alt="Cover"
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.src = "/images/default-hero.jpg";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-60"></div>
      </div>

      {/* Profile Avatar & Header Info */}
      <div className="relative px-6 -mt-20 mb-8 flex flex-col md:flex-row items-end gap-6">
        {/* Avatar */}
        <div className="w-40 h-40 rounded-full border-4 border-white bg-white shadow-lg overflow-hidden flex-shrink-0 z-10 relative">
          <img
            src={displayLogo}
            alt={`${displayName} profile`}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = "/images/default-avatar.png";
            }}
          />
        </div>

        {/* Header Info (Moved up to align with avatar bottom) */}
        <div className="flex-1 pb-2 text-white md:text-gray-800 z-10 md:static relative">
          {/* This part needs to be handled carefully. 
                 The original header was further down. 
                 If we want "Facebook style", the name sits next to avatar, 
                 but if background is white below hero, text should be black.
                 If overlapping hero, text white.
                 
                 Let's stick to the plan:
                 Hero -> Avatar overlaps -> Info below or next to it.
              */}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-4">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Header Info - Re-positioned */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-800">{displayName}</h1>
              {displayCategory && (
                <span className="px-3 py-1 bg-[#e8ddae] text-sm font-medium rounded-full text-[#5d4436]">
                  {displayCategory}
                </span>
              )}
            </div>

            {displayAddress && (
              <div className="flex items-center gap-1 text-gray-600 mb-4">
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeWidth="2" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" strokeWidth="2" />
                </svg>
                <span>{displayAddress}</span>
              </div>
            )}

            {/* Action Buttons (Chat/Book) - Good place to add them if they were separate */}
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-300 mb-6">
            <div className="flex gap-6">
              {["overview", "services", "media", "availability", "review"].map((tab) => (
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
              <h3 className="text-lg font-semibold mb-3">About This Supplier</h3>
              <p className="text-gray-700 leading-relaxed">{displayBio}</p>
            </div>
          )}

          {activeTab === "services" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Services Offered</h3>
                <p className="text-gray-700">
                  {(() => {
                    if (Array.isArray(services) && services.length > 0) {
                      return services.join(", ");
                    } else if (services && typeof services === 'string' && services.trim()) {
                      return services;
                    }
                    return "Not specified";
                  })()}
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Service Areas</h3>
                <p className="text-gray-700">
                  {(() => {
                    if (Array.isArray(service_areas) && service_areas.length > 0) {
                      return service_areas.join(", ");
                    } else if (service_areas && typeof service_areas === 'string' && service_areas.trim()) {
                      return service_areas;
                    }
                    return "Not specified";
                  })()}
                </p>
              </div>
            </div>
          )}

          {activeTab === "media" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Gallery</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {gallery.length === 0 ? (
                  <p className="col-span-full text-gray-600">No gallery images available</p>
                ) : (
                  gallery.map((img, i) => (
                    <div key={i} className="h-48 rounded-lg overflow-hidden cursor-pointer">
                      <img
                        src={img}
                        onClick={() => openLightbox(img)}
                        alt={`Gallery image ${i + 1}`}
                        className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                        onError={(e) => {
                          e.target.src = "/images/placeholder.svg";
                          e.target.style.cursor = "default";
                          e.target.onclick = null;
                        }}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === "availability" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Availability Calendar</h3>

              {/* Upcoming Availability Summary */}
              {upcomingAvailability.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Upcoming Availability</h4>
                  <div className="space-y-3">
                    {upcomingAvailability.map((avail, index) => (
                      <div
                        key={index}
                        className={`grid grid-cols-[auto_1fr_auto] gap-3 items-center p-3 rounded-lg border ${avail.is_available
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                          }`}
                      >
                        <div className="flex items-center gap-2 font-medium text-sm">
                          <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs text-white ${avail.is_available ? 'bg-green-600' : 'bg-red-600'
                            }`}>
                            {avail.is_available ? '✓' : '✕'}
                          </span>
                          {formatDate(avail.date)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {avail.start_time?.substring(0, 5)} - {avail.end_time?.substring(0, 5)}
                        </div>
                        <div className={`text-xs font-semibold px-3 py-1 rounded-full text-white ${avail.is_available ? 'bg-green-600' : 'bg-red-600'
                          }`}>
                          {avail.is_available ? 'Available' : 'Booked'}
                        </div>
                        {avail.notes && (
                          <div className="col-span-3 text-sm text-gray-600 italic pt-2 border-t border-gray-200">
                            {avail.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Availability Message */}
              {upcomingAvailability.length === 0 && !loadingAvailability && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5 mb-4 text-center">
                  <p className="text-gray-700">
                    📅 This Supplier hasn't set their availability yet. Please contact them directly to check availability.
                  </p>
                </div>
              )}

              {/* Calendar - Match Venue Design */}
              <div className="calendar-container">
                <div className="calendar-header">
                  <button
                    onClick={previousMonth}
                    className="calendar-nav-btn"
                  >
                    ←
                  </button>
                  <h4 className="calendar-title">
                    {monthNames[month]} {year}
                  </h4>
                  <button
                    onClick={nextMonth}
                    className="calendar-nav-btn"
                  >
                    →
                  </button>
                </div>

                <div className="calendar-legend">
                  <div className="legend-item">
                    <span className="legend-dot legend-booked"></span>
                    <span>Unavailable/Booked</span>
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
                    const hasBooking = hasBookingOnDate(date);

                    let dayClass = "calendar-day";
                    if (isToday) dayClass += " calendar-day-today";
                    if (isPast) dayClass += " calendar-day-past";
                    // Use global styles: Booked/Unavailable = global booked style, Available = global available style
                    if (hasBooking || isBooked) dayClass += " calendar-day-booked";
                    else if (isAvailable) dayClass += " calendar-day-available";

                    return (
                      <div
                        key={day}
                        className={dayClass}
                        title={
                          hasBooking
                            ? 'Booked'
                            : availabilityData.length > 0
                              ? `${availabilityData[0].is_available ? 'Available' : 'Unavailable'} ${availabilityData[0].start_time?.substring(0, 5)} - ${availabilityData[0].end_time?.substring(0, 5)}${availabilityData[0].notes ? '\n' + availabilityData[0].notes : ''}`
                              : 'No availability set'
                        }
                      >
                        <span className="calendar-day-number">{day}</span>
                        {hasBooking ? (
                          <div className="calendar-day-indicator">✓</div>
                        ) : availabilityData.length > 0 && !availabilityData[0].is_available && (
                          <div className="calendar-day-indicator">
                            ✕
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {loadingAvailability && <div className="calendar-loading">Loading availability...</div>}
              </div>
            </div>
          )}

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
                          className={`w-5 h-5 ${star <= Math.round(reviewStats.average_rating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                          viewBox="0 0 20 20"
                          fill="currentColor"
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
                  <p className="text-sm text-gray-500 mt-1">Be the first to review this supplier after booking!</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-lg p-6 sticky top-4">
            <h3 className="font-semibold text-lg mb-4">Contact Supplier</h3>

            <div className="space-y-4 mb-6">
              {displayAddress && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Location</p>
                  <p className="text-gray-800">{displayAddress}</p>
                </div>
              )}

              {displayCategory && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Category</p>
                  <p className="text-gray-800">{displayCategory}</p>
                </div>
              )}
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

            {/* Secondary Actions */}
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={openChat}
                disabled={!chatEnabled}
                title={chatTitle}
                className="w-full bg-[#e8ddae] hover:bg-[#dbcf9f] text-gray-800 font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Chat with Supplier
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {
        lightboxImg && (
          <div
            className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
            onClick={closeLightbox}
          >
            <div className="relative max-w-5xl max-h-full" onClick={(e) => e.stopPropagation()}>
              <img src={lightboxImg} alt="Gallery preview" className="max-w-full max-h-[90vh] object-contain" />
            </div>
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 w-12 h-12 flex items-center justify-center bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full text-white text-3xl transition-colors"
            >
              ×
            </button>
          </div>
        )
      }
    </div >
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
    background: #dcfce7; /* bg-green-50 */
    border-color: #86efac; /* border-green-200 */
  }

  .upcoming-booked {
    background: #fee2e2; /* bg-red-50 */
    border-color: #fca5a5; /* border-red-200 */
  }

  .upcoming-date {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 0.9rem;
    /* text-sm */
    /* font-medium */
  }

  .upcoming-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-size: 0.75rem;
    color: white;
    /* w-6 h-6 rounded-full text-xs text-white */
  }

  .upcoming-available .upcoming-icon {
    background: #22c55e; /* bg-green-600 */
  }

  .upcoming-booked .upcoming-icon {
    background: #ef4444; /* bg-red-600 */
  }

  .upcoming-time {
    font-size: 0.85rem;
    color: #666;
    /* text-sm text-gray-600 */
  }

  .upcoming-status {
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    white-space: nowrap;
    color: white;
    /* text-xs font-semibold px-3 py-1 rounded-full text-white */
  }

  .upcoming-available .upcoming-status {
    background: #22c55e; /* bg-green-600 */
  }

  .upcoming-booked .upcoming-status {
    background: #ef4444; /* bg-red-600 */
  }

  .upcoming-notes {
    grid-column: 1 / -1;
    font-size: 0.85rem;
    color: #666;
    font-style: italic;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(0,0,0,0.1);
    /* col-span-3 text-sm text-gray-600 italic pt-2 border-t border-gray-200 */
  }

  /* NO AVAILABILITY */
  .no-availability {
    background: #fff9e6; /* bg-yellow-50 */
    border: 1px solid #f5e8c7; /* border-yellow-200 */
    border-radius: 10px; /* rounded-lg */
    padding: 1.5rem; /* p-5 */
    margin-top: 1rem; /* mb-4 */
    margin-bottom: 1rem;
    text-align: center;
  }

  .no-availability p {
    margin: 0.5rem 0;
    font-size: 0.95rem;
    color: #7a5d47; /* text-gray-700 */
  }

  /* CALENDAR STYLES - Compact, clean, platform colors */
  .calendar-container {
    background: #f6f0e8; /* bg-gray-50 */
    border: 1px solid #c9bda4; /* border-gray-200 */
    border-radius: 8px; /* rounded-lg */
    padding: 0.75rem 1rem; /* p-4 */
    margin-top: 0.75rem;
    max-width: 320px; /* max-w-md */
  }

  .calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem; /* mb-3 */
  }

  .calendar-month {
    font-size: 0.95rem;
    font-weight: 600; /* font-semibold */
    margin: 0;
    color: #7a5d47; /* text-gray-800 */
  }

  .calendar-nav-btn {
    background: #7a5d47; /* bg-[#7a5d47] */
    color: white;
    border: none;
    width: 28px; /* w-8 */
    height: 28px; /* h-8 */
    border-radius: 6px; /* rounded-md */
    cursor: pointer;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: 0.2s;
    /* hover:bg-[#654a38] transition-colors */
  }

  .calendar-nav-btn:hover {
    background: #654a38;
  }

  .calendar-legend {
    display: flex;
    gap: 1rem; /* gap-4 */
    margin-bottom: 0.5rem; /* mb-3 */
    flex-wrap: wrap;
    font-size: 0.75rem; /* text-xs */
    color: #5d4a38; /* text-gray-600 */
    justify-content: center;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.3rem; /* gap-1 */
  }

  .legend-dot {
    width: 8px; /* w-3 */
    height: 8px; /* h-3 */
    border-radius: 50%; /* rounded-full */
    border: 1px solid #c9bda4; /* Added for consistency, not in original */
  }

  .legend-available {
    background: #22c55e; /* bg-green-500 */
  }

  .legend-booked {
    background: #ef4444; /* bg-red-500 */
  }

  .calendar-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px; /* gap-1 */
    margin-bottom: 2px; /* mb-2 */
  }

  .calendar-weekdays > div {
    text-align: center;
    font-size: 0.65rem; /* text-xs */
    font-weight: 600; /* font-medium */
    padding: 0.25rem; /* py-1 */
    color: #7a5d47; /* text-gray-600 */
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px; /* gap-1 */
  }

  .calendar-day {
    aspect-ratio: 1;
    min-height: 28px;
    border: 1px solid #e8ddae; /* border-gray-300 */
    border-radius: 4px; /* rounded */
    padding: 0.2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    background: #fff; /* bg-white */
    transition: 0.15s;
    /* text-xs */
  }

  .calendar-day-empty {
    background: transparent;
    border: none;
    /* aspect-square */
  }

  .calendar-day-number {
    font-size: 0.75rem;
    font-weight: 500;
    /* span {day} */
  }

  .calendar-day-indicator {
    position: absolute;
    bottom: 1px;
    font-size: 0.65rem; /* text-[0.6rem] */
    font-weight: bold;
  }

  .calendar-day-today {
    border: 2px solid #7a5d47; /* border-[#7a5d47] border-2 */
    font-weight: 600; /* font-bold */
    background: #f6f0e8; /* Added for visual distinction, not in original */
  }

  .calendar-day-past {
    opacity: 0.5; /* Added for visual distinction */
    background: #f0ebe0; /* bg-gray-100 */
    color: #9ca3af; /* text-gray-400 */
  }


  .calendar-loading {
    text-align: center;
    padding: 0.5rem;
    color: #7a5d47; /* text-gray-600 */
    font-size: 0.8rem; /* text-sm */
    margin-top: 0.75rem; /* mt-3 */
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
    background: #7a5d47; /* bg-[#7a5d47] */
    color: white;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    transition: 0.2s;
    font-family: "Cinzel", serif;
    font-weight: 600; /* font-semibold */
    width: 100%; /* w-full */
    padding-top: 0.75rem; /* py-3 */
    padding-bottom: 0.75rem; /* py-3 */
    padding-left: 1.5rem; /* px-6 */
    padding-right: 1.5rem; /* px-6 */
    border-radius: 0.5rem; /* rounded-lg */
    margin-bottom: 0.75rem; /* mb-3 */
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem; /* gap-2 */
    font-size: 1.125rem; /* text-lg */
  }

  .book-btn:hover {
    background: #654a38; /* hover:bg-[#654a38] */
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(139, 69, 19, 0.3);
  }

  /* CHAT BUTTON */
  .chat-btn {
    flex: 1;
    min-width: 200px;
    padding: 0.75rem 2rem;
    border-radius: 9999px;
    background: #e8ddae; /* bg-[#e8ddae] */
    color: #4b5563; /* text-gray-800 */
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    transition: 0.2s;
    font-family: "Cinzel", serif;
    font-weight: 600; /* font-semibold */
    width: 100%; /* w-full */
    padding-top: 0.625rem; /* py-2.5 */
    padding-bottom: 0.625rem; /* py-2.5 */
    border-radius: 0.5rem; /* rounded-lg */
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem; /* gap-2 */
  }

  .chat-btn[disabled] {
    background: #e7e3da;
    color: #8b8b8b;
    cursor: not-allowed;
    opacity: 0.5; /* disabled:opacity-50 */
  }

  .chat-btn:hover:not([disabled]) {
    background: #dbcf9f; /* hover:bg-[#dbcf9f] */
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(122, 93, 71, 0.3);
  }

  /* LIGHTBOX */
  .lb-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.9); /* bg-black bg-opacity-90 */
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999; /* z-50 */
    padding: 1.25rem; /* p-4 */
  }

  .lb-frame {
    background: white; /* Not explicitly set, but implied by object-contain */
    border-radius: 10px;
    max-width: 90vw; /* max-w-5xl */
    max-height: 90vh; /* max-h-full, max-h-[90vh] */
    overflow: hidden;
    box-shadow: 0 10px 40px rgba(0,0,0,.4);
    position: relative; /* relative */
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
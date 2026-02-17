import React, { useEffect, useState } from "react";
import { tokenExpired } from "../utils/auth";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../firebase";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import toast from "../utils/toast";
import FeedbackModal from "../components/FeedbackModal";
import BookingAnalyticsChart from "../components/BookingAnalyticsChart";
import AdminAnalyticsChart from "../components/AdminAnalyticsChart";
import { useConfirmModal } from "../hooks/useConfirmModal";
import "../style.css";

const API =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://solennia.up.railway.app/api" : "/api");

// Utility: coerce gallery/amenities values into string arrays safely
function ensureArray(val, sep = ',') {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return val.trim() === '' ? [] : val.split(sep).map(s => s.trim()).filter(Boolean);
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch (e) { }
  return [];
}

export default function Profile() {
  const navigate = useNavigate();
  const { confirm, ConfirmModal } = useConfirmModal();
  const token = localStorage.getItem("solennia_token");

  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(
    Number(localStorage.getItem("solennia_role") || 0)
  );
  const [vendorStatus, setVendorStatus] = useState(null);

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Booking Modal States with TABS
  const [showBookingsModal, setShowBookingsModal] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [processingBooking, setProcessingBooking] = useState(false);
  const [rejectModal, setRejectModal] = useState({ show: false, bookingId: null, reason: "" });
  const [activeTab, setActiveTab] = useState("original");

  // Feedback Modal States
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackBooking, setFeedbackBooking] = useState(null);

  // Reschedule Modal States
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    new_date: "",
    new_time: "14:00"
  });

  // Edit profile state
  const [editForm, setEditForm] = useState({
    username: "",
    phone: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: "",
    color: "",
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);

  // CALENDAR MODAL STATES
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availability, setAvailability] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [availabilityForm, setAvailabilityForm] = useState({
    start_time: "09:00",
    end_time: "17:00",
    is_available: false,
    notes: ""
  });
  const [editingAvailability, setEditingAvailability] = useState(null);
  const [savingAvailability, setSavingAvailability] = useState(false);
  // 🔧 FIX: Add refresh trigger to force calendar updates
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // 🔧 FIX: Add venue tracking for dual vendor/venue support
  const [ownedVenues, setOwnedVenues] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null); // null = show vendor calendar

  // Analytics Dashboard States
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [vendorRecentBookings, setVendorRecentBookings] = useState([]);

  // Client Dashboard States
  const [clientAnalytics, setClientAnalytics] = useState(null);
  const [clientRecentBookings, setClientRecentBookings] = useState([]);
  const [clientAllBookings, setClientAllBookings] = useState([]);
  const [dashboardDetailFilter, setDashboardDetailFilter] = useState(null); // 'total' | 'upcoming' | 'completed' | 'cancelled' | 'rejected'
  const [loadingClientAnalytics, setLoadingClientAnalytics] = useState(false);

  // Admin Dashboard States
  const [adminAnalytics, setAdminAnalytics] = useState(null);
  const [loadingAdminAnalytics, setLoadingAdminAnalytics] = useState(false);
  const [adminRecentBookings, setAdminRecentBookings] = useState([]);

  // My Listings (venue CRUD in profile)
  const [showListingModal, setShowListingModal] = useState(false);
  const [editingVenueId, setEditingVenueId] = useState(null);
  const [listingForm, setListingForm] = useState({ venue_name: "", region: "", city: "", specific_address: "", venue_subcategory: "", venue_capacity: "", pricing: "", description: "", hero_image: "", amenities: "" });
  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const [listingRegion, setListingRegion] = useState("");
  const [savingListing, setSavingListing] = useState(false);

  // Vendor Service Modal
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState({ bio: "", services: "", service_areas: "", address: "", event_type: "", service_category: "", budget_range: "", base_price: "", package_price: "", ai_description: "", region: "", city: "", specific_address: "" });
  const [savingService, setSavingService] = useState(false);

  /* ================= CALENDAR: FORMAT DATE TO LOCAL TIMEZONE ================= */
  const toLocalISOString = (date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  const formatDateToLocal = (date) => {
    return toLocalISOString(date);
  };

  /* ================= HELPER TO GET PENDING RESCHEDULE DATA ================= */
  const getPendingRescheduleData = (booking) => {
    // Method 1: Check if backend provided it directly (from LEFT JOIN)
    if (booking.original_date && booking.requested_date) {
      return {
        originalDate: booking.original_date,
        requestedDate: booking.requested_date,
        hasPending: true
      };
    }

    // Method 2: Extract from reschedule_history array (fallback)
    const rescheduleHistory = booking.reschedule_history || [];
    const pendingReschedule = rescheduleHistory.find(r => r.Status === 'Pending');

    if (pendingReschedule) {
      return {
        originalDate: pendingReschedule.OriginalEventDate,
        requestedDate: pendingReschedule.RequestedEventDate,
        hasPending: true
      };
    }

    return { hasPending: false };
  };

  /* ================= PASSWORD STRENGTH CHECKER ================= */
  const checkPasswordStrength = (password) => {
    if (!password) {
      return { score: 0, label: "", color: "" };
    }

    let score = 0;

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    let label = "";
    let color = "";

    if (score <= 2) {
      label = "Weak";
      color = "#dc2626";
    } else if (score <= 4) {
      label = "Medium";
      color = "#f59e0b";
    } else {
      label = "Strong";
      color = "#16a34a";
    }

    return { score, label, color };
  };

  useEffect(() => {
    const strength = checkPasswordStrength(editForm.newPassword);
    setPasswordStrength(strength);
  }, [editForm.newPassword]);

  /* ================= LOAD PROFILE ================= */
  useEffect(() => {
    if (!token) return;

    fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.user) return;
        setProfile(j.user);
        setEditForm(prev => ({
          ...prev,
          username: j.user.username || "",
          phone: j.user.phone || "",
        }));
        localStorage.setItem("solennia_role", j.user.role ?? 0);
        setRole(j.user.role ?? 0);

        localStorage.setItem("solennia_profile", JSON.stringify(j.user));
      });
  }, [token]);

  /* ================= VENDOR STATUS  ================= */
  useEffect(() => {
    if (!token || (role !== 0 && role !== 1)) return;
    if (tokenExpired(token)) {
      setVendorStatus(null);
      return;
    }

    fetch(`${API}/vendor/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) {
          setVendorStatus(null);
          return null;
        }
        if (r.status === 404) return null;
        return r.json();
      })
      .then((j) => {
        if (j && (j.status !== undefined || j.success)) {
          setVendorStatus(j);
        }
      })
      .catch(() => { });
  }, [token, role]);

  // Populate serviceForm when vendor status/profile is loaded
  useEffect(() => {
    if (!vendorStatus) return;
    const v = vendorStatus.vendor || {};
    setServiceForm(prev => ({
      ...prev,
      bio: v.bio || prev.bio,
      services: v.services || prev.services,
      service_areas: v.service_areas || prev.service_areas,
      address: v.BusinessAddress || prev.address,
      event_type: v.service_type_tag || prev.event_type || "",
      service_category: v.service_category || prev.service_category || "",
      budget_range: vendorStatus.budget_tier || vendorStatus.price_range || prev.budget_range || "",
      base_price: v.base_price || prev.base_price || "",
      package_price: v.package_price || prev.package_price || "",
      ai_description: v.ai_description || prev.ai_description || "",
      region: vendorStatus.region || prev.region || "",
      city: vendorStatus.city || prev.city || "",
      specific_address: v.BusinessAddress || prev.specific_address || "",
    }));
  }, [vendorStatus]);

  /* ================= 🔧 FIX: LOAD OWNED VENUES ================= */
  useEffect(() => {
    if (!token || !profile?.id) return;

    // Fetch venues owned by this user
    // Try the my-listings endpoint first, with fallback to direct query
    fetch(`${API}/venue/my-listings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        // Check if response is JSON
        const contentType = r.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.log('Venue my-listings endpoint returned non-JSON, trying fallback...');
          // Fallback: fetch all venues and filter by user_id on frontend
          return fetch(`${API}/venues`, { headers: { Authorization: `Bearer ${token}` } })
            .then(fallbackR => fallbackR.json())
            .then(fallbackJ => {
              if (fallbackJ && fallbackJ.success && fallbackJ.venues) {
                // Filter venues where user_id matches profile.id
                const userVenues = fallbackJ.venues.filter(v => v.user_id === profile.id);
                return { success: true, venues: userVenues };
              }
              return { success: false, venues: [] };
            });
        }
        return r.json();
      })
      .then((j) => {
        if (j && j.success && j.venues) {
          setOwnedVenues(j.venues || []);
          if (j.venues.length > 0) {
            console.log(`Loaded ${j.venues.length} owned venue(s)`);
          }
        } else {
          setOwnedVenues([]);
        }
      })
      .catch((err) => {
        console.log('Could not load owned venues:', err.message);
        setOwnedVenues([]); // Set empty array to prevent infinite retries
      });
  }, [token, profile?.id]);

  /* ================= LOAD ANALYTICS ON MOUNT & POLL ================= */
  useEffect(() => {
    // Initial Load
    if (role === 1) loadAnalytics();
    else if (role === 0) loadClientAnalytics();
    else if (role === 2) loadAdminAnalytics();

    // Polling (every 10 seconds) for real-time updates
    const interval = setInterval(() => {
      if (role === 1) loadAnalytics(true);
      else if (role === 0) loadClientAnalytics(true);
      else if (role === 2) loadAdminAnalytics(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [token, role]);

  useEffect(() => {
    fetch(`${API}/regions`).then((r) => r.json()).then((d) => d.success && d.regions && setRegions(d.regions)).catch(() => { });
  }, []);

  // Open Manage Listings modal when navigated with ?open=listings
  const location = useLocation();
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      if (params.get("open") === "listings") {
        setShowListingModal(true);
      }
    } catch (e) { }
  }, [location.search]);

  const fetchCitiesForListing = (regionCode) => {
    if (!regionCode) return setCities([]);
    fetch(`${API}/cities/${regionCode}`).then((r) => r.json()).then((d) => d.success && d.cities && setCities(d.cities)).catch(() => setCities([]));
  };

  const openAddListing = () => {
    setEditingVenueId(null);
    setListingForm({ venue_name: "", region: "", city: "", specific_address: "", venue_subcategory: "", venue_capacity: "", pricing: "", description: "", hero_image: "", amenities: "" });
    setListingRegion("");
    setCities([]);
    setShowListingModal(true);
  };

  const openEditListing = (venue) => {
    setEditingVenueId(venue.id);
    setListingForm({
      venue_name: venue.venue_name || "",
      region: venue.region || "",
      city: venue.city || "",
      specific_address: venue.specific_address || venue.address || "",
      venue_subcategory: venue.venue_subcategory || "",
      venue_capacity: venue.venue_capacity ?? "",
      pricing: venue.pricing ?? "",
      description: venue.description || "",
      hero_image: venue.HeroImageUrl || "",
      amenities: Array.isArray(venue.amenities) ? venue.amenities.join(", ") : (typeof venue.amenities === "string" ? (() => { try { const a = JSON.parse(venue.amenities); return Array.isArray(a) ? a.join(", ") : ""; } catch { return ""; } })() : ""),
    });
    setListingRegion(venue.region || "");
    if (venue.region) fetchCitiesForListing(venue.region);
    setShowListingModal(true);
  };

  const saveVenueListing = async (e) => {
    e.preventDefault();
    if (!listingForm.venue_name.trim()) {
      toast.error("Venue name is required");
      return;
    }
    setSavingListing(true);
    try {
      const address = [listingForm.specific_address, listingForm.city, listingForm.region].filter(Boolean).join(", ") || listingForm.venue_name;
      const amenities = ensureArray(listingForm.amenities);
      const payload = { ...listingForm, address, amenities };
      const url = editingVenueId ? `${API}/venue/listings/${editingVenueId}` : `${API}/venue/listings`;
      const method = editingVenueId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editingVenueId ? "Listing updated" : "Listing created");
        setShowListingModal(false);
        const listRes = await fetch(`${API}/venue/my-listings`, { headers: { Authorization: `Bearer ${token}` } });
        const listJson = await listRes.json();
        if (listJson.success && listJson.venues) setOwnedVenues(listJson.venues);
      } else {
        toast.error(json.message || json.error || "Failed to save");
      }
    } catch (err) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSavingListing(false);
    }
  };

  const deleteVenueListing = async (id) => {
    const confirmed = await confirm({
      title: "Delete this venue listing?",
      message: "It will no longer appear on the Venues page. This action cannot be undone.",
      confirmText: "Delete",
      confirmVariant: "danger"
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`${API}/venue/listings/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        toast.success("Listing deleted");
        setOwnedVenues((prev) => prev.filter((v) => v.id !== id));
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.message || json.error || "Failed to delete");
      }
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const saveServiceDetails = async (e) => {
    e.preventDefault();
    setSavingService(true);
    try {
      const res = await fetch(`${API}/vendor/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(serviceForm),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Service details updated!");
        setShowServiceModal(false);
        // Refresh vendor status to show updated info if needed
        const statusRes = await fetch(`${API}/vendor/status`, { headers: { Authorization: `Bearer ${token}` } });
        const statusJson = await statusRes.json();
        if (statusJson && (statusJson.status !== undefined || statusJson.success)) {
          setVendorStatus(statusJson);
        }
      } else {
        toast.error(json.error || json.message || "Failed to update service");
      }
    } catch (err) {
      toast.error(err.message || "Failed to update service");
    } finally {
      setSavingService(false);
    }
  };

  /* ================= CALENDAR: LOAD AVAILABILITY ================= */
  useEffect(() => {
    if (!showCalendarModal || !profile?.id) return;

    // 🔧 FIX: Auto-select first venue if user owns venues (regardless of vendor status)
    if (ownedVenues.length > 0 && !selectedVenue) {
      setSelectedVenue(ownedVenues[0]);
      return; // Let the next useEffect iteration handle the load
    }

    // 🔧 FIX: Load availability immediately
    loadAvailability();

    // 🔧 FIX: Set up polling to detect external updates (other users, other tabs)
    const pollInterval = setInterval(() => {
      loadAvailability(true);
    }, 10000); // Poll every 10 seconds when modal is open

    // Cleanup interval when modal closes or component unmounts
    return () => clearInterval(pollInterval);
  }, [showCalendarModal, profile?.id, currentMonth, refreshTrigger, selectedVenue, ownedVenues, role]);

  const loadAvailability = async (isBackground = false) => {
    if (!profile?.id) return;

    try {
      if (!isBackground) setLoadingAvailability(true);
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;

      // 🔧 FIX: Determine which endpoint to use based on selected entity
      let endpoint;
      if (selectedVenue) {
        // Loading venue availability
        endpoint = `${API}/venue/availability/${selectedVenue.id}?year=${year}&month=${month}`;
      } else {
        // Loading vendor availability (default)
        endpoint = `${API}/vendor/availability/${profile.id}?year=${year}&month=${month}`;
      }

      const res = await fetch(endpoint);
      const json = await res.json();

      if (json.success) {
        setAvailability(json.availability || []);
      }
    } catch (err) {
      console.error("Failed to load availability:", err);
    } finally {
      if (!isBackground) setLoadingAvailability(false);
    }
  };

  /* ================= CALENDAR HELPERS ================= */
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
    // Check if ANY entry for this date is unavailable/booked
    return availability.some(a => a.date && a.date.startsWith(dateStr) && !a.is_available);
  };

  const isDateAvailable = (date) => {
    // We no longer support explicit "Available" cells. logic should just return false or checking if NOT unavailable?
    // But for now, let's keep it consistent: a date is available if it has an entry saying so AND no conflicting unavailable entry
    const dateStr = formatDateToLocal(date);
    const entries = availability.filter(a => a.date && a.date.startsWith(dateStr));
    const hasUnavailable = entries.some(a => !a.is_available);
    if (hasUnavailable) return false;
    return entries.some(a => a.is_available);
  };

  const hasBookingOnDate = (date) => {
    const dateStr = formatDateToLocal(date);
    // Check if the date has a booking (source: 'booking' from backend)
    // Note: Profile.jsx uses availability for both vendor and venue (based on endpoint loaded)
    return availability.some(a => a.date && a.date.startsWith(dateStr) && !a.is_available && a.source === 'booking');
  };

  const getUpcomingAvailability = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return availability
      .filter(a => {
        const availDate = new Date(a.date);
        return availDate >= today && !a.is_available;
      })
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
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  /* ================= CALENDAR: AVAILABILITY MODAL ================= */
  const openAvailabilityModal = (date, existingAvailability = null) => {
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
        is_available: false,
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

  /* ================= CALENDAR: SAVE AVAILABILITY ================= */
  const saveAvailability = async (e) => {
    e.preventDefault();

    if (!selectedDate) return;

    if (!token) {
      toast.error("Please log in");
      return;
    }

    try {
      setSavingAvailability(true);

      const dateStr = formatDateToLocal(selectedDate);
      const payload = {
        date: dateStr,
        ...availabilityForm
      };

      // 🔧 FIX: Use appropriate endpoint based on entity type
      let url, method;
      if (selectedVenue) {
        // Venue availability endpoint
        url = editingAvailability
          ? `${API}/venue/availability/${editingAvailability.id}`
          : `${API}/venue/availability`;
        method = editingAvailability ? "PATCH" : "POST";
        if (!editingAvailability) {
          payload.venue_id = selectedVenue.id;
        }
      } else {
        // Vendor availability endpoint (default)
        url = editingAvailability
          ? `${API}/vendor/availability/${editingAvailability.id}`
          : `${API}/vendor/availability`;
        method = editingAvailability ? "PATCH" : "POST";
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
        // 🔧 FIX: Trigger immediate refresh after saving
        setRefreshTrigger(prev => prev + 1);
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

  /* ================= CALENDAR: DELETE AVAILABILITY ================= */
  const deleteAvailability = async (availabilityId) => {
    const confirmed = await confirm({
      title: "Delete this availability entry?",
      message: "This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      confirmVariant: "danger"
    });
    if (!confirmed) return;

    if (!token) {
      toast.error("Please log in");
      return;
    }

    try {
      // 🔧 FIX: Use appropriate endpoint based on entity type
      const endpoint = selectedVenue
        ? `${API}/venue/availability/${availabilityId}`
        : `${API}/vendor/availability/${availabilityId}`;

      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      const json = await res.json();

      if (json.success) {
        toast.success("Availability deleted!");
        closeAvailabilityModal();
        // 🔧 FIX: Trigger immediate refresh after deleting
        setRefreshTrigger(prev => prev + 1);
      } else {
        toast.error(json.error || "Failed to delete availability");
      }
    } catch (err) {
      console.error("Delete availability error:", err);
      toast.error("Failed to delete availability");
    }
  };

  /* ================= HELPER: FORMAT DATE AND TIME ================= */
  const formatDateTime = (dateString) => {
    if (!dateString) return { date: 'N/A', time: 'N/A', full: 'N/A' };

    const date = new Date(dateString);
    const dateFormatted = date.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeFormatted = date.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    return { date: dateFormatted, time: timeFormatted, full: `${dateFormatted} at ${timeFormatted}` };
  };

  /* ================= HELPERS: 7-DAY CANCELLATION CUTOFF ================= */
  const isWithin7Days = (eventDate) => {
    if (!eventDate) return false;
    const now = new Date();
    const event = new Date(eventDate);
    const diffMs = event - now;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays < 7;
  };

  const getDaysUntilEvent = (eventDate) => {
    if (!eventDate) return null;
    const now = new Date();
    const event = new Date(eventDate);
    const diffMs = event - now;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  /* ================= LOAD ANALYTICS ================= */
  const loadAnalytics = async (isBackground = false) => {
    if (!token || role !== 1) return; // Only for vendors/venue owners

    if (!isBackground) setLoadingAnalytics(true);
    try {
      const res = await fetch(`${API}/vendor/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.analytics);
        setVendorRecentBookings(data.recent_bookings || []);
      } else {
        console.error('Failed to load analytics:', res.status);
      }
    } catch (err) {
      console.error('Load analytics error:', err);
    } finally {
      if (!isBackground) setLoadingAnalytics(false);
    }
  };

  /* ================= LOAD CLIENT ANALYTICS ================= */
  const loadClientAnalytics = async (isBackground = false) => {
    if (!token || role !== 0) return;

    if (!isBackground) setLoadingClientAnalytics(true);
    try {
      const [supplierRes, venueRes] = await Promise.all([
        fetch(`${API}/bookings/user`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/venue-bookings/user`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const supplierRaw = supplierRes.ok ? await supplierRes.json() : {};
      const venueRaw = venueRes.ok ? await venueRes.json() : {};
      const supplierData = Array.isArray(supplierRaw?.bookings) ? supplierRaw : { bookings: supplierRaw?.data?.bookings ?? [] };
      const venueData = Array.isArray(venueRaw?.bookings) ? venueRaw : { bookings: venueRaw?.data?.bookings ?? [] };

      const supplierBookings = (supplierData.bookings || [])
        .filter(b => !b.venue_id) // Exclude venue bookings — prevents duplicates with venue endpoint
        .map(b => ({
          ...b,
          booking_type: 'supplier',
          service_name: b.ServiceName || b.vendor_name
        }));

      const venueBookings = (venueData.bookings || []).map(b => ({
        ...b,
        booking_type: 'venue',
        service_name: b.venue_name || b.ServiceName
      }));

      const allBookings = [...supplierBookings, ...venueBookings];

      const now = new Date();
      const totalBookings = allBookings.length;
      const upcomingBookings = allBookings.filter(b => {
        const eventDate = new Date(b.EventDate || b.start_date);
        return (b.BookingStatus === 'Pending' || b.BookingStatus === 'Confirmed') && eventDate >= now;
      }).length;
      const completedBookings = allBookings.filter(b => b.BookingStatus === 'Completed').length;
      const cancelledBookings = allBookings.filter(b => b.BookingStatus === 'Cancelled').length;
      const rejectedBookings = allBookings.filter(b => b.BookingStatus === 'Rejected').length;

      const getBookingDate = (b) => new Date(b.CreatedAt || b.BookingDate || 0);
      const startOfWeek = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x; };
      const startOfMonth = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(1); return x; };
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);
      const bookingsThisWeek = allBookings.filter(b => getBookingDate(b) >= weekAgo).length;
      const bookingsThisMonth = allBookings.filter(b => getBookingDate(b) >= monthAgo).length;
      const last4Weeks = [];
      for (let i = 3; i >= 0; i--) {
        const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() - 7 * i);
        const weekStart = new Date(weekEnd); weekStart.setDate(weekStart.getDate() - 7);
        last4Weeks.push(allBookings.filter(b => {
          const t = getBookingDate(b).getTime();
          return t >= weekStart.getTime() && t < weekEnd.getTime();
        }).length);
      }

      setClientAnalytics({
        total_bookings: totalBookings,
        upcoming_bookings: upcomingBookings,
        completed_bookings: completedBookings,
        cancelled_bookings: cancelledBookings,
        rejected_bookings: rejectedBookings,
        bookings_this_week: bookingsThisWeek,
        bookings_this_month: bookingsThisMonth,
        last_4_weeks: last4Weeks,
        as_of: new Date().toISOString()
      });
      setClientAllBookings(allBookings);

      const sortedBookings = [...allBookings].sort((a, b) => {
        const dateA = new Date(a.CreatedAt || a.BookingDate || 0);
        const dateB = new Date(b.CreatedAt || b.BookingDate || 0);
        return dateB - dateA;
      });
      setClientRecentBookings(sortedBookings.slice(0, 5));
    } catch (error) {
      console.error('Failed to load client analytics:', error);
    } finally {
      if (!isBackground) setLoadingClientAnalytics(false);
    }
  };

  /* ================= LOAD ADMIN ANALYTICS ================= */
  const loadAdminAnalytics = async (isBackground = false) => {
    if (!token || role !== 2) return;

    if (!isBackground) setLoadingAdminAnalytics(true);
    try {
      const res = await fetch(`${API}/admin/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setAdminAnalytics(data.analytics);
        setAdminRecentBookings(data.recent_bookings || []);
      } else {
        console.error('Failed to load admin analytics:', res.status);
      }
    } catch (error) {
      console.error('Failed to load admin analytics:', error);
    } finally {
      if (!isBackground) setLoadingAdminAnalytics(false);
    }
  };

  /* ================= LOAD BOOKINGS ================= */
  const loadBookings = async () => {
    if (!token) return;

    setLoadingBookings(true);
    try {
      if (role === 1) {
        // VENDOR: Get booking requests
        const res = await fetch(`${API}/bookings/vendor`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();

        if (data.success) {
          setBookings(data.bookings || []);
        } else {
          toast.error(data.error || 'Failed to load bookings');
        }
      } else {
        // CLIENT: Get BOTH supplier and venue bookings
        const [supplierRes, venueRes] = await Promise.all([
          fetch(`${API}/bookings/user`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/venue-bookings/user`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        const supplierData = await supplierRes.json();
        const venueData = await venueRes.json();

        const supplierBookings = ((supplierRes.ok ? supplierData.bookings : null) || [])
          .filter(b => !b.venue_id) // Exclude venue bookings from supplier list
          .map(b => ({
            ...b,
            ID: b.ID ?? b.id,
            isVenueBooking: false,
            booking_type: 'supplier'
          }));

        const venueBookings = ((venueRes.ok ? venueData.bookings : null) || []).map(b => ({
          ...b,
          ID: b.ID ?? b.id ?? b.BookingID,
          ServiceName: b.ServiceName ?? b.venue_name,
          vendor_name: b.venue_name, // For venue bookings, show venue name
          isVenueBooking: true,
          booking_type: 'venue'
        }));

        const merged = [...supplierBookings, ...venueBookings].sort(
          (a, b) => new Date(b.CreatedAt || b.BookingDate || 0) - new Date(a.CreatedAt || a.BookingDate || 0)
        );

        setBookings(merged);
      }
      // Keep profile dashboard in sync: refresh client analytics when bookings are loaded for clients
      if (role === 0) loadClientAnalytics();
    } catch (err) {
      console.error('Load bookings error:', err);
      toast.error('Failed to load bookings');
    } finally {
      setLoadingBookings(false);
    }
  };

  /* ================= ACCEPT BOOKING (VENDOR) ================= */
  const acceptBooking = async (bookingId) => {
    const confirmed = await confirm({
      title: 'Accept this booking request?',
      message: 'This will confirm the booking for the client.',
      confirmText: 'Accept',
      confirmVariant: 'success'
    });
    if (!confirmed) return;

    setProcessingBooking(true);
    try {
      const res = await fetch(`${API}/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'Confirmed' }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Booking accepted!', { duration: 5000 });
        loadBookings();
        setSelectedBooking(null);
      } else {
        toast.error(data.error || 'Failed to accept booking');
      }
    } catch (err) {
      console.error('Accept booking error:', err);
      toast.error('Failed to accept booking');
    } finally {
      setProcessingBooking(false);
    }
  };

  /* ================= REJECT BOOKING (VENDOR) ================= */
  const rejectBooking = async (bookingId) => {
    const confirmed = await confirm({
      title: 'Reject this booking request?',
      message: 'This will decline the booking request.',
      confirmText: 'Reject',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;

    // Show custom modal for rejection reason
    setRejectModal({ show: true, bookingId, reason: "" });
  };

  /* ================= SUBMIT REJECTION WITH REASON ================= */
  const submitRejection = async () => {
    if (!rejectModal.reason || rejectModal.reason.trim() === "") {
      toast.error("Rejection reason is required");
      return;
    }

    setProcessingBooking(true);
    try {
      const res = await fetch(`${API}/bookings/${rejectModal.bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: 'Rejected',
          rejection_reason: rejectModal.reason.trim()
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Booking rejected', { duration: 5000 });
        setRejectModal({ show: false, bookingId: null, reason: "" });
        loadBookings();
        setSelectedBooking(null);
      } else {
        toast.error(data.error || 'Failed to reject booking');
      }
    } catch (err) {
      console.error('Reject booking error:', err);
      toast.error('Failed to reject booking');
    } finally {
      setProcessingBooking(false);
    }
  };

  /* =================  COMPLETE BOOKING (VENDOR) ================= */
  const completeBooking = async (bookingId) => {
    const confirmed = await confirm({
      title: 'Mark this booking as completed?',
      message: 'The client will be able to leave a review.',
      confirmText: 'Complete',
      confirmVariant: 'success'
    });
    if (!confirmed) return;

    setProcessingBooking(true);
    try {
      const res = await fetch(`${API}/bookings/${bookingId}/complete`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Booking marked as completed! Client can now leave review.', { duration: 5000 });
        loadBookings();
        setSelectedBooking(null);
      } else {
        toast.error(data.error || 'Failed to mark as completed');
      }
    } catch (err) {
      console.error('Complete booking error:', err);
      toast.error('Failed to mark as completed');
    } finally {
      setProcessingBooking(false);
    }
  };

  /* ================= CANCEL BOOKING (CLIENT) ================= */
  const cancelBooking = async (bookingId, eventDate = null, bookingStatus = null) => {
    // Block cancellation for Confirmed bookings within 7 days of the event
    if (bookingStatus === 'Confirmed' && eventDate && isWithin7Days(eventDate)) {
      const daysLeft = getDaysUntilEvent(eventDate);
      toast.error(
        `Cancellation not allowed. Your event is ${daysLeft === 0 ? 'today' : `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
        }. Cancellations must be made at least 7 days before the event.`,
        { duration: 6000 }
      );
      return;
    }

    const confirmed = await confirm({
      title: 'Cancel this booking?',
      message: 'This action cannot be undone.',
      confirmText: 'Cancel Booking',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;

    setProcessingBooking(true);
    try {
      const res = await fetch(`${API}/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Booking cancelled', { duration: 5000 });
        loadBookings();
        setSelectedBooking(null);
      } else {
        toast.error(data.error || 'Failed to cancel booking');
      }
    } catch (err) {
      console.error('Cancel booking error:', err);
      toast.error('Failed to cancel booking');
    } finally {
      setProcessingBooking(false);
    }
  };

  /* ================= OPEN FEEDBACK MODAL (CLIENT) ================= */
  const openFeedbackModal = (booking) => {
    setFeedbackBooking(booking);
    setShowFeedbackModal(true);
  };

  /* =================  HANDLE FEEDBACK SUCCESS ================= */
  const handleFeedbackSuccess = () => {
    setShowFeedbackModal(false);
    setFeedbackBooking(null);
    loadBookings(); // Reload bookings to show updated state
  };

  /* ================= OPEN RESCHEDULE MODAL ================= */
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

  /* ================= HANDLE RESCHEDULE SUBMISSION ================= */
  const handleReschedule = async (e) => {
    e.preventDefault();

    if (!rescheduleForm.new_date || !rescheduleForm.new_time) {
      toast.error("Please select both date and time");
      return;
    }

    try {
      setProcessingBooking(true);

      const newEventDateTime = `${rescheduleForm.new_date} ${rescheduleForm.new_time}:00`;

      const res = await fetch(`${API}/bookings/${rescheduleBooking.ID}/reschedule`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          new_event_date: newEventDateTime
        })
      });

      const data = await res.json();

      if (res.status === 400 && data.past_event) {
        toast.error(data.message || "Cannot reschedule. Event date has passed.", { duration: 8000 });
        setShowRescheduleModal(false);
        return;
      }

      if (res.status === 409 && data.conflict) {
        toast.error(
          data.message || "This Supplier is already booked for the selected date and time.",
          { duration: 10000 }
        );
        return;
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to reschedule booking");
      }

      toast.success(
        "Reschedule request sent successfully! Your booking status has changed to Pending. The Supplier will review and approve/reject your new schedule.",
        { duration: 8000 }
      );

      setShowRescheduleModal(false);
      setRescheduleBooking(null);
      setRescheduleForm({ new_date: "", new_time: "14:00" });
      loadBookings();

    } catch (error) {
      console.error("Reschedule error:", error);
      toast.error(error.message || "Failed to reschedule booking");
    } finally {
      setProcessingBooking(false);
    }
  };

  /* ================= GET STATUS BADGE COLOR ================= */
  const getStatusBadge = (status) => {
    const statusMap = {
      'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Confirmed': 'bg-green-100 text-green-800 border-green-300',
      'Rejected': 'bg-red-100 text-red-800 border-red-300',
      'Cancelled': 'bg-gray-100 text-gray-800 border-gray-300',
      'Completed': 'bg-purple-100 text-purple-800 border-purple-300', // ✅ CHANGED to purple
    };

    return statusMap[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  /* ================= FILTER BOOKINGS BY TAB ================= */
  const getFilteredBookings = () => {
    if (activeTab === "original") {
      return bookings.filter(booking => {
        const rescheduleHistory = booking.reschedule_history || [];
        const hasApproved = rescheduleHistory.some(r => r.Status === 'Approved');
        return !hasApproved;
      });
    } else {
      // Show bookings that have ANY reschedule history (Pending, Approved, or Rejected)
      return bookings.filter(booking => {
        const rescheduleHistory = booking.reschedule_history || [];
        return rescheduleHistory.length > 0; // Show if there's any reschedule activity
      });
    }
  };

  /* ================= AVATAR PREVIEW ================= */
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  /* ================= AVATAR UPLOAD ================= */
  async function uploadAvatar(e) {
    e.preventDefault();
    if (!avatarFile) {
      toast.warning("Please select an image first");
      return;
    }

    setUploadingAvatar(true);

    try {
      const fd = new FormData();
      fd.append("avatar", avatarFile);

      const res = await fetch(`${API}/user/update`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");

      const newAvatar = json.avatar;
      setProfile((p) => ({ ...p, avatar: newAvatar }));

      const existingProfile = JSON.parse(localStorage.getItem("solennia_profile") || "{}");
      localStorage.setItem(
        "solennia_profile",
        JSON.stringify({
          ...existingProfile,
          avatar: newAvatar,
        })
      );

      window.dispatchEvent(new CustomEvent("profileUpdated", {
        detail: { avatar: newAvatar }
      }));

      toast.success("Profile picture updated successfully!");
      setShowAvatarModal(false);
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (err) {
      toast.error(err.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  }

  /* ================= REQUEST USERNAME CHANGE ================= */
  function requestUsernameChange() {
    toast.info("To change your username, please contact support at solenniainquires@gmail.com with your current username and desired new username.");
  }

  /* ================= EDIT PROFILE ================= */
  async function saveProfileChanges(e) {
    e.preventDefault();
    setSavingChanges(true);

    try {
      let updatedFields = {};
      let passwordChanged = false;

      // Detect if any changes were made
      const usernameChanged = editForm.username !== (profile.username || "");
      const phoneChanged = editForm.phone !== (profile.phone || "");
      const passwordChanging = editForm.newPassword.trim().length > 0;
      const hasAnyChanges = usernameChanged || phoneChanged || passwordChanging;

      if (!hasAnyChanges) {
        toast.info("No changes to save");
        setSavingChanges(false);
        return;
      }

      // Require current password for any profile changes
      if (!editForm.currentPassword.trim()) {
        throw new Error("Current password is required to save changes");
      }

      // Verify current password via Firebase reauthentication
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Firebase authentication session expired. Please log out and log in again.");
      }

      const userEmail = user.email || profile?.email;
      if (!userEmail) {
        throw new Error("Cannot verify account email. Please contact support.");
      }

      try {
        const credential = EmailAuthProvider.credential(
          userEmail,
          editForm.currentPassword
        );
        await reauthenticateWithCredential(user, credential);
      } catch (firebaseError) {
        console.error("Password verification error:", firebaseError);
        if (firebaseError.code === 'auth/invalid-credential' || firebaseError.code === 'auth/wrong-password') {
          throw new Error("Current password is incorrect. Please try again.");
        } else if (firebaseError.code === 'auth/requires-recent-login') {
          throw new Error("For security, please log out and log back in before making changes.");
        } else {
          throw new Error("Password verification failed. Please try again.");
        }
      }

      // Update username if changed
      if (editForm.username !== (profile.username || "")) {
        const usernameRes = await fetch(`${API}/user/update-username`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ username: editForm.username }),
        });

        const usernameData = await usernameRes.json();
        if (!usernameRes.ok) throw new Error(usernameData.message || "Failed to update username");

        updatedFields.username = editForm.username;

      }

      if (editForm.phone !== (profile.phone || "")) {
        const phoneRes = await fetch(`${API}/user/update-phone`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ phone: editForm.phone }),
        });

        const phoneData = await phoneRes.json();
        if (!phoneRes.ok) throw new Error(phoneData.message || "Failed to update phone");

        updatedFields.phone = editForm.phone;

      }

      if (editForm.newPassword.trim()) {
        // Validate password requirements: 8+ chars with letters, numbers & symbols
        const password = editForm.newPassword;
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters long");
        }
        if (!/[a-zA-Z]/.test(password)) {
          throw new Error("Password must contain at least one letter");
        }
        if (!/[0-9]/.test(password)) {
          throw new Error("Password must contain at least one number");
        }
        if (!/[^a-zA-Z0-9]/.test(password)) {
          throw new Error("Password must contain at least one symbol (e.g., !@#$%^&*)");
        }

        if (passwordStrength.score <= 2) {
          throw new Error("Please use a stronger password");
        }

        if (editForm.newPassword !== editForm.confirmPassword) {
          throw new Error("New passwords do not match");
        }

        // Password already verified via reauthentication above
        await updatePassword(user, editForm.newPassword);

        passwordChanged = true;


        setEditForm(prev => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        }));
      }

      if (Object.keys(updatedFields).length > 0) {
        setProfile(prev => ({ ...prev, ...updatedFields }));

        const existingProfile = JSON.parse(localStorage.getItem("solennia_profile") || "{}");
        localStorage.setItem(
          "solennia_profile",
          JSON.stringify({
            ...existingProfile,
            ...updatedFields
          })
        );

        window.dispatchEvent(new Event("profileUpdated"));
      }

      toast.success("Profile updated");
      setTimeout(() => setShowEditModal(false), 1000);

    } catch (err) {
      console.error("Profile update error:", err);
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSavingChanges(false);
      setEditForm(prev => ({ ...prev, currentPassword: "", newPassword: "", confirmPassword: "" }));
    }
  }

  /* ================= JOIN AS VENDOR ================= */
  function joinVendor() {
    if (!token) {
      toast.warning("Please login first.");
      return;
    }
    if (role !== 0) {
      toast.warning("You cannot apply as Supplier.");
      return;
    }
    document.getElementById("vendorTerms")?.classList.remove("hidden");
  }

  /* ================= DASHBOARD ================= */
  function dashboardHref() {
    if (role === 2) return "/admin";
    if (role === 1) {
      const isVenue = vendorStatus?.category?.toLowerCase() === "venue";

      // Always redirect to manage-listings, whether creating first listing or using existing
      return isVenue ? "/manage-listings?venue" : "/manage-listings?vendor";
    }
    return null;
  }

  function dashboardLabel() {
    if (role === 2) return "Admin Panel";
    if (role === 1) {
      const isVenue = vendorStatus?.category?.toLowerCase() === "venue";
      return isVenue ? "Manage Service" : "Manage Service";
    }
    return null;
  }

  const name = profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
    : "Guest";

  const filteredBookings = getFilteredBookings();

  const getClientBookingStatusClass = (status) => {
    switch (status) {
      case 'Confirmed': return 'bg-green-100 text-green-700';
      case 'Pending': return 'bg-amber-100 text-amber-800';
      case 'Completed': return 'bg-[#e3f2fd] text-[#1565c0]';
      case 'Cancelled': return 'bg-red-100 text-red-700';
      case 'Rejected': return 'bg-slate-200 text-slate-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getDashboardDetailBookings = (filterKey) => {
    if (!filterKey || !clientAllBookings.length) return [];
    const now = new Date();
    if (filterKey === 'total') return [...clientAllBookings];
    if (filterKey === 'upcoming') {
      return clientAllBookings.filter(b => {
        const eventDate = new Date(b.EventDate || b.start_date);
        return (b.BookingStatus === 'Pending' || b.BookingStatus === 'Confirmed') && eventDate >= now;
      });
    }
    const statusMap = { completed: 'Completed', cancelled: 'Cancelled', rejected: 'Rejected' };
    const status = statusMap[filterKey];
    return status ? clientAllBookings.filter(b => b.BookingStatus === status) : [];
  };

  const dashboardDetailBookings = dashboardDetailFilter ? getDashboardDetailBookings(dashboardDetailFilter) : [];
  const dashboardDetailLabels = {
    total: 'Total Bookings',
    upcoming: 'Upcoming',
    completed: 'Completed',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
  };

  return (
    <>
      <main className="pb-24 bg-[#f6f0e8] text-[#1c1b1a] min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">

            {/* LEFT COLUMN - PROFILE INFO */}
            <div className="lg:col-span-2">
              <div className="flex flex-col items-center justify-center" style={{ height: 'calc(100vh - 180px)' }}>
                <div className="relative mb-6">
                  <div
                    onClick={() => token && setShowAvatarModal(true)}
                    className="w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 rounded-full border-6 sm:border-8 border-white overflow-hidden bg-white flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity shadow-2xl"
                  >
                    {profile?.avatar ? (
                      <img
                        src={profile.avatar}
                        className="w-full h-full object-cover"
                        alt="Profile avatar"
                      />
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        className="w-32 h-32 text-[#7a5d47]"
                        fill="currentColor"
                      >
                        <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5 0-9 2.5-9 5.5V21h18v-1.5C21 16.5 17 14 12 14Z" />
                      </svg>
                    )}
                  </div>
                  <button
                    onClick={() => token && setShowAvatarModal(true)}
                    className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-[#7a5d47] text-white rounded-full p-3 sm:p-4 hover:opacity-90 shadow-xl border-4 border-white"
                    title="Change profile picture"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>

                {/* Profile Info - Premium Card */}
                <div className="mb-6 w-full max-w-xs">
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(253,250,245,0.92) 100%)',
                    border: '1px solid #e8ddae',
                    borderRadius: '16px',
                    padding: '1.25rem 1.5rem',
                    boxShadow: '0 4px 24px rgba(122,93,71,0.08), 0 1.5px 6px rgba(122,93,71,0.04)',
                    backdropFilter: 'blur(8px)',
                  }}>
                    {/* Full Name Row */}
                    {name && name !== "Guest" && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.65rem 0',
                        transition: 'background 0.2s',
                        borderRadius: '8px',
                      }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #5d4436 0%, #7a5d47 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: '0 2px 8px rgba(93,68,54,0.2)',
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                          </svg>
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: '#9a8b7a',
                            marginBottom: '2px',
                            fontFamily: "'Cinzel', serif",
                          }}>Full Name</p>
                          <p style={{
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            color: '#3b2f25',
                            fontFamily: "'Libre Baskerville', serif",
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>{name}</p>
                        </div>
                      </div>
                    )}

                    {name && name !== "Guest" && profile?.username && (
                      <div style={{
                        height: '1px',
                        background: 'linear-gradient(90deg, transparent, #e8ddae, transparent)',
                        margin: '0.15rem 0',
                      }} />
                    )}

                    {profile?.username && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.65rem 0',
                        transition: 'background 0.2s',
                        borderRadius: '8px',
                      }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #7a5d47 0%, #9a7b63 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: '0 2px 8px rgba(122,93,71,0.18)',
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: '#9a8b7a',
                            marginBottom: '2px',
                            fontFamily: "'Cinzel', serif",
                          }}>Username</p>
                          <p style={{
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            color: '#3b2f25',
                            fontFamily: "'Libre Baskerville', serif",
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>@{profile.username}</p>
                        </div>
                      </div>
                    )}

                    {profile?.username && profile?.email && (
                      <div style={{
                        height: '1px',
                        background: 'linear-gradient(90deg, transparent, #e8ddae, transparent)',
                        margin: '0.15rem 0',
                      }} />
                    )}

                    {profile?.email && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.65rem 0',
                        transition: 'background 0.2s',
                        borderRadius: '8px',
                      }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #c9bda4 0%, #e8ddae 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: '0 2px 8px rgba(201,189,164,0.25)',
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5d4a38" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <path d="M22 7l-10 6L2 7" />
                          </svg>
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: '#9a8b7a',
                            marginBottom: '2px',
                            fontFamily: "'Cinzel', serif",
                          }}>Email</p>
                          <p style={{
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            color: '#3b2f25',
                            fontFamily: "'Libre Baskerville', serif",
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>{profile.email}</p>
                        </div>
                      </div>
                    )}

                    {profile?.email && profile?.phone && (
                      <div style={{
                        height: '1px',
                        background: 'linear-gradient(90deg, transparent, #e8ddae, transparent)',
                        margin: '0.15rem 0',
                      }} />
                    )}

                    {profile?.phone && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.65rem 0',
                        transition: 'background 0.2s',
                        borderRadius: '8px',
                      }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #e8ddae 0%, #f6f0e8 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: '0 2px 8px rgba(232,221,174,0.3)',
                          border: '1px solid #d9d0c3',
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7a5d47" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: '#9a8b7a',
                            marginBottom: '2px',
                            fontFamily: "'Cinzel', serif",
                          }}>Phone</p>
                          <p style={{
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            color: '#3b2f25',
                            fontFamily: "'Libre Baskerville', serif",
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>{profile.phone}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 w-full max-w-xs">
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="w-full bg-[#7a5d47] text-white px-4 py-3 rounded-lg text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-2 shadow-md"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Profile
                  </button>

                  {role === 0 && (
                    <button
                      onClick={() => {
                        setShowBookingsModal(true);
                        setActiveTab("original");
                        loadBookings();
                      }}
                      className="w-full bg-[#e8ddae] text-[#3b2f25] px-3 py-2 rounded-md text-xs font-semibold hover:bg-[#dbcf9f] flex items-center justify-center gap-1.5 transition-colors border border-[#c9bda4]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      My Bookings
                    </button>
                  )}

                  {role === 1 && (
                    <button
                      onClick={() => {
                        setShowBookingsModal(true);
                        setActiveTab("original");
                        loadBookings();
                      }}
                      className="w-full bg-[#e8ddae] text-[#3b2f25] px-3 py-2 rounded-md text-xs font-semibold hover:bg-[#dbcf9f] flex items-center justify-center gap-1.5 transition-colors border border-[#c9bda4]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Booking Requests
                    </button>
                  )}

                  {/* 🔧 FIX: Show calendar button for vendors OR venue owners */}
                  {(role === 1 || ownedVenues.length > 0) && (
                    <button
                      onClick={() => setShowCalendarModal(true)}
                      className="w-full bg-[#e8ddae] text-[#3b2f25] px-3 py-2 rounded-md text-xs font-semibold hover:bg-[#dbcf9f] flex items-center justify-center gap-1.5 transition-colors border border-[#c9bda4]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Manage Calendar
                    </button>
                  )}

                  {dashboardHref() && dashboardLabel() && (
                    <a
                      href={dashboardHref()}
                      className="w-full bg-[#e8ddae] text-[#3b2f25] px-3 py-2 rounded-md text-xs font-semibold hover:bg-[#dbcf9f] flex items-center justify-center gap-1.5 transition-colors border border-[#c9bda4]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                      {dashboardLabel()}
                    </a>
                  )}

                  {role === 0 && (
                    <button
                      onClick={joinVendor}
                      disabled={vendorStatus && vendorStatus.status === "pending"}
                      className={`w-full bg-gradient-to-r from-[#7a5d47] to-[#5d4436] text-white px-4 py-3 rounded-lg text-sm font-semibold hover:opacity-90 shadow-md ${vendorStatus && vendorStatus.status === "pending" ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                    >
                      {vendorStatus && vendorStatus.status === "pending" ? "Application Pending" : "Join as Event Service Provider"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN - ANALYTICS DASHBOARD (for vendors) OR FAVORITES (for clients) */}
            <div className="lg:col-span-3 mt-4 lg:mt-0">
              <div className="bg-white rounded-2xl shadow-lg border border-[#c9bda4] overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>

                {/* ANALYTICS DASHBOARD FOR VENDORS/VENUE OWNERS */}
                {role === 1 ? (
                  <>
                    <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 flex-shrink-0">
                      <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                        <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Dashboard Analytics
                      </h2>
                      {loadingAnalytics && (
                        <div className="w-4 h-4 border-2 border-[#7a5d47] border-t-transparent rounded-full animate-spin"></div>
                      )}
                    </div>
                    <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-gray-600">
                        As of {analytics?.as_of ? new Date(analytics.as_of).toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => loadAnalytics()}
                        disabled={loadingAnalytics}
                        className="text-sm font-medium px-3 py-1.5 rounded-md border border-[#c9bda4] text-[#5b4636] hover:bg-[#f6f0e8] disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Refresh
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                      {loadingAnalytics ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <div className="w-12 h-12 border-4 border-[#e8ddae] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading analytics...</p>
                          </div>
                        </div>
                      ) : analytics ? (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {/* Total Bookings */}
                            <div className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Total</h3>
                                <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                              </div>
                              <p className="text-2xl font-bold text-[#7a5d47]">{analytics.total_bookings}</p>
                              <p className="text-xs text-gray-600 mt-0.5">All-time bookings</p>
                            </div>

                            {/* Upcoming Bookings */}
                            <div className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Upcoming</h3>
                                <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <p className="text-2xl font-bold text-[#7a5d47]">{analytics.upcoming_bookings}</p>
                              <p className="text-xs text-gray-600 mt-0.5">Pending & Confirmed</p>
                            </div>

                            {/* Completed Bookings */}
                            <div className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Completed</h3>
                                <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <p className="text-2xl font-bold text-[#7a5d47]">{analytics.completed_bookings}</p>
                              <p className="text-xs text-gray-600 mt-0.5">Successfully delivered</p>
                            </div>

                            {/* Cancelled Bookings */}
                            <div className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Cancelled</h3>
                                <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <p className="text-2xl font-bold text-[#7a5d47]">{analytics.cancelled_bookings}</p>
                              <p className="text-xs text-gray-600 mt-0.5">Did not proceed</p>
                            </div>

                            {/* Average Rating */}
                            <div className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Rating</h3>
                                <svg className="w-5 h-5 text-[#7a5d47]" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                                </svg>
                              </div>
                              <p className="text-2xl font-bold text-[#7a5d47]">{analytics.average_rating > 0 ? analytics.average_rating.toFixed(1) : 'N/A'}</p>
                              <p className="text-xs text-gray-600 mt-0.5">Out of 5.0 stars</p>
                            </div>

                            {/* Total Reviews */}
                            <div className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Reviews</h3>
                                <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                </svg>
                              </div>
                              <p className="text-2xl font-bold text-[#7a5d47]">{analytics.total_reviews}</p>
                              <p className="text-xs text-gray-600 mt-0.5">Customer feedback</p>
                            </div>
                          </div>

                          {/* Booking Analytics Chart - same as client */}
                          <div className="mt-4">
                            <BookingAnalyticsChart analytics={analytics} />
                          </div>

                          {/* Recent Booking Activity - aligned with Client Dashboard */}
                          <div className="mt-6">
                            <div className="bg-white rounded-xl shadow-sm border border-[#c9bda4] p-6">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-[#5b4636]">Recent Booking Activity</h3>
                                <span className="text-xs text-gray-500">Last 5 bookings</span>
                              </div>

                              {!vendorRecentBookings || vendorRecentBookings.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                  <p>No recent booking activity</p>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {vendorRecentBookings.map((booking, idx) => {
                                    const statusColors = {
                                      Pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
                                      Confirmed: "bg-green-100 text-green-800 border-green-200",
                                      Completed: "bg-blue-100 text-blue-800 border-blue-200",
                                      Cancelled: "bg-red-100 text-red-800 border-red-200",
                                      Rejected: "bg-gray-100 text-gray-800 border-gray-200",
                                    };
                                    const statusColor = statusColors[booking.BookingStatus] || "bg-gray-100 text-gray-800 border-gray-200";

                                    return (
                                      <div key={idx} className="flex flex-col gap-2 p-3 rounded-lg border border-gray-100 hover:border-[#e8ddae] hover:bg-[#fdfaf5] transition-colors">
                                        <div className="flex items-start justify-between">
                                          <div className="flex items-start gap-3">
                                            <div className={`w-2 h-2 mt-2 rounded-full ${booking.BookingStatus === 'Confirmed' ? 'bg-green-500' :
                                              booking.BookingStatus === 'Pending' ? 'bg-yellow-500' :
                                                booking.BookingStatus === 'Cancelled' ? 'bg-red-500' : 'bg-gray-400'
                                              }`}></div>
                                            <div>
                                              <p className="font-medium text-[#5b4636] text-sm">
                                                {booking.client_name || "Client"}
                                              </p>
                                              <p className="text-xs text-[#7a5d47] font-medium mt-0.5">
                                                {booking.ServiceName || "Service"}
                                              </p>
                                              <p className="text-xs text-gray-500 mt-0.5">
                                                Event: {formatDateTime(booking.EventDate).full}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusColor}`}>
                                              {booking.BookingStatus}
                                            </span>
                                            <p className="text-sm font-bold text-[#5b4636] mt-1">
                                              ₱{parseFloat(booking.TotalAmount || 0).toLocaleString()}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-[10px] text-gray-400">
                                            Booked: {formatDateTime(booking.CreatedAt).date}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      ) : role === 0 ? (
                        /* CLIENT DASHBOARD ANALYTICS */
                        <>
                          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 flex-shrink-0">
                            <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                              <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              My Dashboard
                            </h2>
                            {loadingClientAnalytics && (
                              <div className="w-4 h-4 border-2 border-[#7a5d47] border-t-transparent rounded-full animate-spin"></div>
                            )}
                          </div>
                          <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm text-gray-600">
                              As of {clientAnalytics?.as_of ? new Date(clientAnalytics.as_of).toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                            <button
                              type="button"
                              onClick={() => loadClientAnalytics()}
                              disabled={loadingClientAnalytics}
                              className="text-sm font-medium px-3 py-1.5 rounded-md border border-[#c9bda4] text-[#5b4636] hover:bg-[#f6f0e8] disabled:opacity-50 flex items-center gap-1.5"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              Refresh
                            </button>
                          </div>

                          <div className="flex-1 overflow-y-auto p-4">
                            {loadingClientAnalytics ? (
                              <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                  <div className="w-12 h-12 border-4 border-[#e8ddae] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                  <p className="text-gray-600">Loading dashboard...</p>
                                </div>
                              </div>
                            ) : clientAnalytics ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                <button type="button" onClick={() => setDashboardDetailFilter('total')} className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7a5d47]/40">
                                  <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Total</h3>
                                    <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                  </div>
                                  <p className="text-2xl font-bold text-[#7a5d47]">{clientAnalytics.total_bookings}</p>
                                  <p className="text-xs text-gray-600 mt-0.5">All-time bookings</p>
                                </button>
                                <button type="button" onClick={() => setDashboardDetailFilter('upcoming')} className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7a5d47]/40">
                                  <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Upcoming</h3>
                                    <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                  </div>
                                  <p className="text-2xl font-bold text-[#7a5d47]">{clientAnalytics.upcoming_bookings}</p>
                                  <p className="text-xs text-gray-600 mt-0.5">Pending & Confirmed</p>
                                </button>
                                <button type="button" onClick={() => setDashboardDetailFilter('completed')} className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7a5d47]/40">
                                  <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Completed</h3>
                                    <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  </div>
                                  <p className="text-2xl font-bold text-[#7a5d47]">{clientAnalytics.completed_bookings}</p>
                                  <p className="text-xs text-gray-600 mt-0.5">Successfully delivered</p>
                                </button>
                                <button type="button" onClick={() => setDashboardDetailFilter('cancelled')} className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7a5d47]/40">
                                  <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Cancelled</h3>
                                    <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  </div>
                                  <p className="text-2xl font-bold text-[#7a5d47]">{clientAnalytics.cancelled_bookings}</p>
                                  <p className="text-xs text-gray-600 mt-0.5">Did not proceed</p>
                                </button>
                                {typeof (clientAnalytics.rejected_bookings) === 'number' && (
                                  <button type="button" onClick={() => setDashboardDetailFilter('rejected')} className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7a5d47]/40">
                                    <div className="flex items-center justify-between mb-1">
                                      <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Rejected</h3>
                                      <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </div>
                                    <p className="text-2xl font-bold text-[#7a5d47]">{clientAnalytics.rejected_bookings}</p>
                                    <p className="text-xs text-gray-600 mt-0.5">Declined by provider</p>
                                  </button>
                                )}
                                <div className="col-span-2 sm:col-span-3 lg:col-span-5">
                                  <BookingAnalyticsChart analytics={clientAnalytics} />
                                </div>

                                {/* Recent Activity */}
                                {clientRecentBookings.length > 0 && (
                                  <div className="col-span-2 sm:col-span-3 lg:col-span-5 mt-4">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                      <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      Recent Booking Activity
                                    </h3>
                                    <div className="space-y-2">
                                      {clientRecentBookings.slice(0, 5).map((booking, idx) => (
                                        <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                          <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                              <p className="font-semibold text-gray-900 text-sm">{booking.service_name || 'N/A'}</p>
                                              <p className="text-xs text-gray-600 mt-1">
                                                {formatDateTime(booking.EventDate || booking.start_date).full}
                                              </p>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getClientBookingStatusClass(booking.BookingStatus)}`}>
                                              {booking.BookingStatus}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                  </svg>
                                  <p className="text-gray-600">No dashboard data available</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      ) : role === 2 ? (
                        /* ADMIN DASHBOARD ANALYTICS */
                        <>
                          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 flex-shrink-0">
                            <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                              <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                              Admin Dashboard
                            </h2>
                            {loadingAdminAnalytics && (
                              <div className="w-4 h-4 border-2 border-[#7a5d47] border-t-transparent rounded-full animate-spin"></div>
                            )}
                          </div>

                          <div className="flex-1 overflow-y-auto p-4">
                            {loadingAdminAnalytics ? (
                              <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                  <div className="w-12 h-12 border-4 border-[#e8ddae] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                  <p className="text-gray-600">Loading dashboard...</p>
                                </div>
                              </div>
                            ) : adminAnalytics ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-semibold text-blue-900">Total Users</h3>
                                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                  </div>
                                  <p className="text-3xl font-bold text-blue-700">{adminAnalytics.total_users}</p>
                                  <p className="text-xs text-blue-600 mt-1">All registered users</p>
                                </div>

                                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-semibold text-green-900">Event Service Providers</h3>
                                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                  <p className="text-3xl font-bold text-green-700">{adminAnalytics.total_providers}</p>
                                  <p className="text-xs text-green-600 mt-1">Active service providers</p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                  </svg>
                                  <p className="text-gray-600">No dashboard data available</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <p className="text-gray-600">No analytics data available</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : role === 0 ? (
                  /* CLIENT DASHBOARD ANALYTICS */
                  <>
                    <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 flex-shrink-0">
                      <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                        <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        My Dashboard
                      </h2>
                      {loadingClientAnalytics && (
                        <div className="w-4 h-4 border-2 border-[#7a5d47] border-t-transparent rounded-full animate-spin"></div>
                      )}
                    </div>
                    <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-gray-600">
                        As of {clientAnalytics?.as_of ? new Date(clientAnalytics.as_of).toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => loadClientAnalytics()}
                        disabled={loadingClientAnalytics}
                        className="text-sm font-medium px-3 py-1.5 rounded-md border border-[#c9bda4] text-[#5b4636] hover:bg-[#f6f0e8] disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Refresh
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      {loadingClientAnalytics ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <div className="w-12 h-12 border-4 border-[#e8ddae] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading dashboard...</p>
                          </div>
                        </div>
                      ) : clientAnalytics ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          <button type="button" onClick={() => setDashboardDetailFilter('total')} className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7a5d47]/40">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Total</h3>
                              <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                            </div>
                            <p className="text-2xl font-bold text-[#7a5d47]">{clientAnalytics.total_bookings}</p>
                            <p className="text-xs text-gray-600 mt-0.5">All-time bookings</p>
                          </button>
                          <button type="button" onClick={() => setDashboardDetailFilter('upcoming')} className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7a5d47]/40">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Upcoming</h3>
                              <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <p className="text-2xl font-bold text-[#7a5d47]">{clientAnalytics.upcoming_bookings}</p>
                            <p className="text-xs text-gray-600 mt-0.5">Pending & Confirmed</p>
                          </button>
                          <button type="button" onClick={() => setDashboardDetailFilter('completed')} className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7a5d47]/40">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Completed</h3>
                              <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <p className="text-2xl font-bold text-[#7a5d47]">{clientAnalytics.completed_bookings}</p>
                            <p className="text-xs text-gray-600 mt-0.5">Successfully delivered</p>
                          </button>
                          <button type="button" onClick={() => setDashboardDetailFilter('cancelled')} className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7a5d47]/40">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Cancelled</h3>
                              <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <p className="text-2xl font-bold text-[#7a5d47]">{clientAnalytics.cancelled_bookings}</p>
                            <p className="text-xs text-gray-600 mt-0.5">Did not proceed</p>
                          </button>
                          {typeof (clientAnalytics.rejected_bookings) === 'number' && (
                            <button type="button" onClick={() => setDashboardDetailFilter('rejected')} className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7a5d47]/40">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Rejected</h3>
                                <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </div>
                              <p className="text-2xl font-bold text-[#7a5d47]">{clientAnalytics.rejected_bookings}</p>
                              <p className="text-xs text-gray-600 mt-0.5">Declined by provider</p>
                            </button>
                          )}
                          <div className="col-span-2 sm:col-span-3 lg:col-span-5">
                            <BookingAnalyticsChart analytics={clientAnalytics} />
                          </div>

                          {/* Recent Activity */}
                          {clientRecentBookings.length > 0 && (
                            <div className="col-span-2 sm:col-span-3 lg:col-span-5 mt-4">
                              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Recent Booking Activity
                              </h3>
                              <div className="space-y-2">
                                {clientRecentBookings.slice(0, 5).map((booking, idx) => (
                                  <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <p className="font-semibold text-gray-900 text-sm">{booking.service_name || 'N/A'}</p>
                                        <p className="text-xs text-gray-600 mt-1">
                                          {new Date(booking.EventDate || booking.start_date).toLocaleDateString()}
                                        </p>
                                      </div>
                                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getClientBookingStatusClass(booking.BookingStatus)}`}>
                                        {booking.BookingStatus}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <p className="text-gray-600">No dashboard data available</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : role === 2 ? (
                  /* ADMIN DASHBOARD ANALYTICS */
                  <>
                    <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 flex-shrink-0">
                      <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                        <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Admin Dashboard
                      </h2>
                      {loadingAdminAnalytics && (
                        <div className="w-4 h-4 border-2 border-[#7a5d47] border-t-transparent rounded-full animate-spin"></div>
                      )}
                    </div>
                    <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-gray-600">
                        As of {adminAnalytics?.as_of ? new Date(adminAnalytics.as_of).toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => loadAdminAnalytics()}
                        disabled={loadingAdminAnalytics}
                        className="text-sm font-medium px-3 py-1.5 rounded-md border border-[#c9bda4] text-[#5b4636] hover:bg-[#f6f0e8] disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Refresh
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                      {loadingAdminAnalytics ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <div className="w-12 h-12 border-4 border-[#e8ddae] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading dashboard...</p>
                          </div>
                        </div>
                      ) : adminAnalytics ? (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Users</h3>
                                <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                              </div>
                              <p className="text-2xl font-bold text-[#7a5d47]">{adminAnalytics.total_users}</p>
                              <p className="text-xs text-gray-600 mt-0.5">Registered users</p>
                            </div>

                            <div className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Suppliers</h3>
                                <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <p className="text-2xl font-bold text-[#7a5d47]">{adminAnalytics.total_vendors || 0}</p>
                              <p className="text-xs text-gray-600 mt-0.5">Service providers</p>
                            </div>

                            <div className="bg-white rounded-xl p-3 border border-[#c9bda4] shadow-sm hover:shadow-md hover:border-[#7a5d47] transition-all">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="text-xs font-semibold text-[#5b4636] uppercase tracking-wide">Venues</h3>
                                <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                              </div>
                              <p className="text-2xl font-bold text-[#7a5d47]">{adminAnalytics.total_venues || 0}</p>
                              <p className="text-xs text-gray-600 mt-0.5">Listed venues</p>
                            </div>
                          </div>

                          {/* Platform Overview Chart */}
                          <div className="mb-6">
                            <AdminAnalyticsChart analytics={adminAnalytics} />
                          </div>

                          {/* Recent System Activity - Admin */}
                          <div className="mt-6">
                            <div className="bg-white rounded-xl shadow-sm border border-[#c9bda4] p-6">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-[#5b4636]">Recent System Activity</h3>
                                <span className="text-xs text-gray-500">Last 5 bookings system-wide</span>
                              </div>

                              {!adminRecentBookings || adminRecentBookings.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                  <p>No recent activity</p>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {adminRecentBookings.map((booking, idx) => {
                                    const statusColors = {
                                      Pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
                                      Confirmed: "bg-green-100 text-green-800 border-green-200",
                                      Completed: "bg-blue-100 text-blue-800 border-blue-200",
                                      Cancelled: "bg-red-100 text-red-800 border-red-200",
                                      Rejected: "bg-gray-100 text-gray-800 border-gray-200",
                                    };
                                    const statusColor = statusColors[booking.BookingStatus] || "bg-gray-100 text-gray-800 border-gray-200";

                                    return (
                                      <div key={idx} className="flex flex-col gap-2 p-3 rounded-lg border border-gray-100 hover:border-[#e8ddae] hover:bg-[#fdfaf5] transition-colors">
                                        <div className="flex items-start justify-between">
                                          <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#f6f0e8] flex items-center justify-center text-[#7a5d47] text-xs font-bold">
                                              {(booking.client_name || "U")[0]}
                                            </div>
                                            <div>
                                              <p className="font-medium text-[#5b4636] text-sm">
                                                {booking.client_name || "User"}
                                              </p>
                                              <p className="text-xs text-[#7a5d47] font-medium mt-0.5">
                                                {booking.ServiceName || "Service"}
                                              </p>
                                              <p className="text-xs text-gray-500">
                                                Event: {formatDateTime(booking.EventDate).full}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusColor}`}>
                                              {booking.BookingStatus}
                                            </span>
                                            <p className="text-sm font-bold text-[#5b4636] mt-1">
                                              ₱{parseFloat(booking.TotalAmount || 0).toLocaleString()}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-[10px] text-gray-400">
                                            Booked: {formatDateTime(booking.CreatedAt).date}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <p className="text-gray-600">No dashboard data available</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* FALLBACK - Should not reach here */
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-600">Dashboard not available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ================= DASHBOARD ANALYTIC DETAIL MODAL ================= */}
      {dashboardDetailFilter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDashboardDetailFilter(null)}>
          <div className="bg-[#f6f0e8] rounded-xl w-full max-w-md max-h-[85vh] overflow-hidden border border-[#c9bda4] shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#c9bda4] bg-white">
              <h3 className="text-lg font-bold text-[#5b4636]">
                {dashboardDetailLabels[dashboardDetailFilter]} ({dashboardDetailBookings.length})
              </h3>
              <button type="button" onClick={() => setDashboardDetailFilter(null)} className="p-2 rounded-lg text-gray-500 hover:bg-[#e8ddae] hover:text-[#5b4636] transition-colors" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              {dashboardDetailBookings.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-6">No bookings in this category.</p>
              ) : (
                <ul className="space-y-2">
                  {dashboardDetailBookings.map((booking, idx) => (
                    <li key={idx} className="bg-white rounded-lg p-3 border border-[#c9bda4] shadow-sm">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#5b4636] text-sm truncate">{booking.service_name || "N/A"}</p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            {new Date(booking.EventDate || booking.start_date).toLocaleDateString("en-PH", { dateStyle: "medium" })}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${getClientBookingStatusClass(booking.BookingStatus)}`}>
                          {booking.BookingStatus}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= VENUE LISTING MODAL (Profile) ================= */}
      {showListingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !savingListing && setShowListingModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">{editingVenueId ? "Edit venue listing" : "Add venue listing"}</h2>
            <p className="text-sm text-gray-600 mb-4">This listing will appear on the Venues page.</p>
            <form onSubmit={saveVenueListing} className="space-y-3">
              <input
                placeholder="Venue name *"
                className="w-full p-2 border rounded"
                value={listingForm.venue_name}
                onChange={(e) => setListingForm((f) => ({ ...f, venue_name: e.target.value }))}
                required
              />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Region</label>
                <select
                  className="w-full p-2 border rounded"
                  value={listingForm.region}
                  onChange={(e) => {
                    const v = e.target.value;
                    setListingForm((f) => ({ ...f, region: v, city: "" }));
                    setListingRegion(v);
                    if (v) fetchCitiesForListing(v);
                  }}
                >
                  <option value="">Select region</option>
                  {regions.map((r) => (
                    <option key={r.region_code} value={r.region_code}>{r.region_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                <select
                  className="w-full p-2 border rounded"
                  value={listingForm.city}
                  onChange={(e) => setListingForm((f) => ({ ...f, city: e.target.value }))}
                  disabled={!listingRegion}
                >
                  <option value="">Select city</option>
                  {cities.map((c) => (
                    <option key={c.city_code} value={c.city_name}>{c.city_name}</option>
                  ))}
                </select>
              </div>
              <input
                placeholder="Specific address (street, barangay)"
                className="w-full p-2 border rounded"
                value={listingForm.specific_address}
                onChange={(e) => setListingForm((f) => ({ ...f, specific_address: e.target.value }))}
              />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Venue type</label>
                <select
                  className="w-full p-2 border rounded"
                  value={listingForm.venue_subcategory}
                  onChange={(e) => setListingForm((f) => ({ ...f, venue_subcategory: e.target.value }))}
                >
                  <option value="">Select type</option>
                  <option value="Church">Church</option>
                  <option value="Garden">Garden</option>
                  <option value="Resort">Resort</option>
                  <option value="Conference">Conference</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Capacity"
                  type="number"
                  className="w-full p-2 border rounded"
                  value={listingForm.venue_capacity}
                  onChange={(e) => setListingForm((f) => ({ ...f, venue_capacity: e.target.value }))}
                />
                <input
                  placeholder="Pricing"
                  className="w-full p-2 border rounded"
                  value={listingForm.pricing}
                  onChange={(e) => setListingForm((f) => ({ ...f, pricing: e.target.value }))}
                />
              </div>
              <textarea
                placeholder="Description"
                className="w-full p-2 border rounded h-20"
                value={listingForm.description}
                onChange={(e) => setListingForm((f) => ({ ...f, description: e.target.value }))}
              />
              <input
                placeholder="Amenities (comma-separated)"
                className="w-full p-2 border rounded"
                value={listingForm.amenities}
                onChange={(e) => setListingForm((f) => ({ ...f, amenities: e.target.value }))}
              />
              <input
                placeholder="Image URL (hero)"
                className="w-full p-2 border rounded"
                value={listingForm.hero_image}
                onChange={(e) => setListingForm((f) => ({ ...f, hero_image: e.target.value }))}
              />
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setShowListingModal(false)} disabled={savingListing} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
                  Cancel
                </button>
                <button type="submit" disabled={savingListing} className="px-6 py-2 bg-[#7a5d47] text-white rounded hover:bg-[#6a503d] disabled:opacity-50">
                  {savingListing ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT SERVICE MODAL (For Non-Venue Vendors) ================= */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !savingService && setShowServiceModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">Edit Service Details</h2>
            <p className="text-sm text-gray-600 mb-4">Update your service information presented to clients.</p>
            <form onSubmit={saveServiceDetails} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">About your service (Bio)</label>
                <textarea
                  placeholder="Tell clients about what you do..."
                  className="w-full p-2 border rounded h-24"
                  value={serviceForm.bio}
                  onChange={(e) => setServiceForm(f => ({ ...f, bio: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Services Offered</label>
                <textarea
                  placeholder="List your specific services..."
                  className="w-full p-2 border rounded h-16"
                  value={serviceForm.services}
                  onChange={(e) => setServiceForm(f => ({ ...f, services: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Service Areas</label>
                  <input
                    placeholder="e.g. Metro Manila, Cavite"
                    className="w-full p-2 border rounded"
                    value={serviceForm.service_areas}
                    onChange={(e) => setServiceForm(f => ({ ...f, service_areas: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Business Address</label>
                  <input
                    placeholder="Your office or base location"
                    className="w-full p-2 border rounded"
                    value={serviceForm.address}
                    onChange={(e) => setServiceForm(f => ({ ...f, address: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowServiceModal(false)} disabled={savingService} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
                  Cancel
                </button>
                <button type="submit" disabled={savingService} className="px-6 py-2 bg-[#7a5d47] text-white rounded hover:bg-[#6a503d] disabled:opacity-50">
                  {savingService ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= BOOKINGS MODAL WITH TABS ================= */}
      {showBookingsModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="bg-[#7a5d47] text-white p-6 flex justify-between items-center">
              <h2 className="text-xl font-bold">
                {role === 1 ? 'Booking Requests' : 'My Bookings'}
              </h2>
              <button
                onClick={() => {
                  setShowBookingsModal(false);
                  setSelectedBooking(null);
                }}
                className="text-white hover:text-gray-200 text-3xl font-light"
              >
                ×
              </button>
            </div>

            <div className="flex border-b border-gray-200 bg-gray-50">
              <button
                onClick={() => setActiveTab("original")}
                className={`flex-1 px-6 py-3 font-semibold text-sm transition-colors ${activeTab === "original"
                  ? "bg-white text-[#7a5d47] border-b-2 border-[#7a5d47]"
                  : "text-gray-600 hover:text-gray-900"
                  }`}
              >
                📋 Original Bookings
              </button>
              <button
                onClick={() => setActiveTab("rescheduled")}
                className={`flex-1 px-6 py-3 font-semibold text-sm transition-colors ${activeTab === "rescheduled"
                  ? "bg-white text-[#7a5d47] border-b-2 border-[#7a5d47]"
                  : "text-gray-600 hover:text-gray-900"
                  }`}
              >
                🔄 Rescheduled Bookings
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingBookings ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7a5d47]"></div>
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-500">
                    {activeTab === "original"
                      ? "No original bookings found"
                      : "No rescheduled bookings found"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredBookings.map((booking) => {
                    const pendingData = getPendingRescheduleData(booking);
                    const displayDate = pendingData.hasPending
                      ? pendingData.originalDate
                      : booking.EventDate;
                    const { date, time } = formatDateTime(displayDate);

                    const canReschedule = role === 0 && booking.BookingStatus === 'Confirmed' && !pendingData.hasPending;
                    const canComplete = role === 1 && booking.BookingStatus === 'Confirmed'; // ✅ NEW
                    const canLeaveFeedback = role === 0 && booking.BookingStatus === 'Completed'; // ✅ NEW

                    const rescheduleHistory = booking.reschedule_history || [];

                    return (
                      <div
                        key={booking.ID}
                        className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                      >
                        {activeTab === "original" && (
                          <>
                            {pendingData.hasPending && (
                              <div className="mb-3 bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
                                <div className="flex items-start gap-2">
                                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-yellow-900 mb-1">
                                      {role === 1 ? '⏳ Pending Reschedule Request' : '⏳ Awaiting Reschedule Approval'}
                                    </p>
                                    <p className="text-xs text-yellow-700 mb-2">
                                      {role === 1
                                        ? 'Client has requested a new schedule. Review below.'
                                        : 'Supplier is reviewing your reschedule request.'}
                                    </p>
                                    <div className="bg-white border border-yellow-200 rounded p-2 mt-2">
                                      <p className="text-xs text-gray-700">
                                        <span className="font-semibold">Original:</span>{' '}
                                        {formatDateTime(pendingData.originalDate).full}
                                      </p>
                                      <p className="text-xs text-yellow-800 mt-1">
                                        <span className="font-semibold">Requested:</span>{' '}
                                        {formatDateTime(pendingData.requestedDate).full}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h3 className="font-semibold text-lg">{booking.ServiceName}</h3>
                                <p className="text-sm text-gray-600">
                                  {role === 1 ? `Client: ${booking.client_name}` : (booking.isVenueBooking || booking.booking_type === "venue" ? `Venue: ${booking.venue_name || booking.ServiceName}` : `Vendor: ${booking.vendor_name}`)}
                                </p>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(booking.BookingStatus)}`}>
                                {booking.BookingStatus}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                              <div>
                                <span className="text-gray-600">{pendingData.hasPending ? 'Original' : 'Event'} Date:</span>
                                <p className="font-medium">{date}</p>
                              </div>
                              <div>
                                <span className="text-gray-600">{pendingData.hasPending ? 'Original' : 'Event'} Time:</span>
                                <p className="font-medium">{time}</p>
                              </div>
                              <div>
                                <span className="text-gray-600">Location:</span>
                                <p className="font-medium">{booking.EventLocation || 'Not specified'}</p>
                              </div>
                              <div>
                                <span className="text-gray-600">Budget:</span>
                                <p className="font-medium">₱{parseFloat(booking.TotalAmount || 0).toLocaleString()}</p>
                              </div>
                            </div>

                            <div className="flex gap-1.5 mt-3 flex-wrap">
                              {role === 0 && booking.BookingStatus === 'Pending' && !pendingData.hasPending && (
                                <button
                                  onClick={() => cancelBooking(booking.ID, booking.EventDate, booking.BookingStatus)}
                                  disabled={processingBooking}
                                  className="px-3 py-1.5 bg-[#c9bda4] text-[#3b2f25] rounded-md hover:bg-[#b8ab95] disabled:opacity-50 text-xs font-semibold transition-colors"
                                >
                                  Cancel
                                </button>
                              )}

                              {/* Cancel for Confirmed bookings — only if event is more than 7 days away */}
                              {role === 0 && booking.BookingStatus === 'Confirmed' && !isWithin7Days(booking.EventDate) && (
                                <button
                                  onClick={() => cancelBooking(booking.ID, booking.EventDate, booking.BookingStatus)}
                                  disabled={processingBooking}
                                  className="px-3 py-1.5 bg-red-100 text-red-700 border border-red-300 rounded-md hover:bg-red-200 disabled:opacity-50 text-xs font-semibold transition-colors"
                                >
                                  Cancel
                                </button>
                              )}

                              {/* Locked notice for Confirmed bookings within 7 days */}
                              {role === 0 && booking.BookingStatus === 'Confirmed' && isWithin7Days(booking.EventDate) && (
                                <span className="px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-md text-xs font-semibold flex items-center gap-1">
                                  🔒 {(() => {
                                    const d = getDaysUntilEvent(booking.EventDate);
                                    return d === 0 ? 'Event is today' : `${d}d until event — no cancellation`;
                                  })()}
                                </span>
                              )}

                              {canReschedule && (
                                <button
                                  onClick={() => openRescheduleModal(booking)}
                                  disabled={processingBooking}
                                  className="px-3 py-1.5 bg-[#e8ddae] text-[#3b2f25] rounded-md hover:bg-[#dbcf9f] disabled:opacity-50 text-xs font-semibold transition-colors"
                                >
                                  📅 Reschedule
                                </button>
                              )}

                              {canComplete && (
                                <button
                                  onClick={() => completeBooking(booking.ID)}
                                  disabled={processingBooking}
                                  className="px-3 py-1.5 bg-[#7a5d47] text-white rounded-md hover:bg-[#654a38] disabled:opacity-50 text-xs font-semibold transition-colors"
                                >
                                  Mark Completed
                                </button>
                              )}

                              {canLeaveFeedback && (
                                <button
                                  onClick={() => openFeedbackModal(booking)}
                                  className="px-3 py-1.5 bg-[#e8ddae] text-[#3b2f25] rounded-md hover:bg-[#dbcf9f] text-xs font-semibold transition-colors"
                                >
                                  ⭐ Leave Review
                                </button>
                              )}

                              {role === 1 && booking.BookingStatus === 'Pending' && (
                                <>
                                  <button
                                    onClick={() => acceptBooking(booking.ID)}
                                    disabled={processingBooking}
                                    className="px-3 py-1.5 bg-[#7a5d47] text-white rounded-md hover:bg-[#654a38] disabled:opacity-50 text-xs font-semibold transition-colors"
                                  >
                                    {pendingData.hasPending ? '✓ Approve' : 'Accept'}
                                  </button>
                                  <button
                                    onClick={() => rejectBooking(booking.ID)}
                                    disabled={processingBooking}
                                    className="px-3 py-1.5 bg-[#c9bda4] text-[#3b2f25] rounded-md hover:bg-[#b8ab95] disabled:opacity-50 text-xs font-semibold transition-colors"
                                  >
                                    {pendingData.hasPending ? '✗ Reject' : 'Reject'}
                                  </button>
                                </>
                              )}

                              <button
                                onClick={() => setSelectedBooking(booking)}
                                className="px-3 py-1.5 bg-[#f6f0e8] text-[#7a5d47] rounded-md hover:bg-[#e8ddae] text-xs font-semibold transition-colors border border-[#c9bda4]"
                              >
                                View
                              </button>
                            </div>
                          </>
                        )}

                        {activeTab === "rescheduled" && (
                          <>
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h3 className="font-semibold text-lg">{booking.ServiceName}</h3>
                                <p className="text-sm text-gray-600">
                                  {role === 1 ? `Client: ${booking.client_name}` : (booking.isVenueBooking || booking.booking_type === "venue" ? `Venue: ${booking.venue_name || booking.ServiceName}` : `Vendor: ${booking.vendor_name}`)}
                                </p>
                              </div>
                              {(() => {
                                let displayStatus = booking.BookingStatus;
                                if (rescheduleHistory && rescheduleHistory.length > 0) {
                                  const latest = [...rescheduleHistory].sort((a, b) => b.ID - a.ID)[0];
                                  if (latest && latest.Status === 'Rejected') displayStatus = 'Rejected';
                                }
                                return (
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(displayStatus)}`}>
                                    {displayStatus}
                                  </span>
                                );
                              })()}
                            </div>

                            {rescheduleHistory.map((reschedule) => (
                              <div
                                key={reschedule.ID}
                                className={`mb-3 p-3 rounded border-l-4 ${reschedule.Status === 'Approved'
                                  ? 'bg-green-50 border-green-500'
                                  : reschedule.Status === 'Pending'
                                    ? 'bg-yellow-50 border-yellow-500'
                                    : 'bg-red-50 border-red-500'
                                  }`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold mb-2">
                                      {reschedule.Status === 'Approved'
                                        ? '✅ Approved Reschedule'
                                        : reschedule.Status === 'Pending'
                                          ? '⏳ Awaiting Approval'
                                          : '❌ Rejected Reschedule'}
                                    </p>
                                    <div className="bg-white border rounded p-2 space-y-1">
                                      <p className="text-xs text-gray-700">
                                        <span className="font-semibold">Original:</span>{' '}
                                        {formatDateTime(reschedule.OriginalEventDate).full}
                                      </p>
                                      <p className="text-xs text-blue-800">
                                        <span className="font-semibold">Requested:</span>{' '}
                                        {formatDateTime(reschedule.RequestedEventDate).full}
                                      </p>
                                      {reschedule.Status === 'Pending' && (
                                        <p className="text-xs text-yellow-700 mt-1 pt-1 border-t">
                                          <span className="font-semibold">Requested on:</span>{' '}
                                          {formatDateTime(reschedule.CreatedAt || reschedule.RequestedAt).full}
                                        </p>
                                      )}
                                      {reschedule.Status === 'Approved' && (
                                        <p className="text-xs text-green-700 mt-1 pt-1 border-t">
                                          <span className="font-semibold">Approved on:</span>{' '}
                                          {formatDateTime(reschedule.ProcessedAt).full}
                                        </p>
                                      )}
                                      {reschedule.Status === 'Rejected' && (
                                        <p className="text-xs text-red-700 mt-1 pt-1 border-t">
                                          <span className="font-semibold">Rejected on:</span>{' '}
                                          {formatDateTime(reschedule.ProcessedAt).full}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}

                            <div className="grid grid-cols-2 gap-3 text-sm mb-3 mt-3 pt-3 border-t">
                              <div>
                                <span className="text-gray-600">Current Date:</span>
                                <p className="font-medium">{formatDateTime(booking.EventDate).date}</p>
                              </div>
                              <div>
                                <span className="text-gray-600">Current Time:</span>
                                <p className="font-medium">{formatDateTime(booking.EventDate).time}</p>
                              </div>
                              <div>
                                <span className="text-gray-600">Location:</span>
                                <p className="font-medium">{booking.EventLocation || 'Not specified'}</p>
                              </div>
                              <div>
                                <span className="text-gray-600">Budget:</span>
                                <p className="font-medium">₱{parseFloat(booking.TotalAmount || 0).toLocaleString()}</p>
                              </div>
                            </div>

                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => setSelectedBooking(booking)}
                                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-semibold"
                              >
                                View Full Details
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <button
                onClick={() => {
                  setShowBookingsModal(false);
                  setSelectedBooking(null);
                }}
                className="w-full bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= BOOKING DETAILS MODAL ================= */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="bg-[#7a5d47] text-white p-6 flex justify-between items-center">
              <h2 className="text-xl font-bold">Booking Details</h2>
              <button
                onClick={() => setSelectedBooking(null)}
                className="text-white hover:text-gray-200 text-3xl font-light"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                const pendingData = getPendingRescheduleData(selectedBooking);
                return pendingData.hasPending ? (
                  <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                    <p className="font-semibold text-yellow-900 mb-2">
                      {role === 1 ? '⏳ Pending Reschedule Request' : '⏳ Awaiting Approval'}
                    </p>
                    <div className="bg-white border border-yellow-200 rounded p-3">
                      <p className="text-sm text-gray-800 mb-2">
                        <span className="font-semibold">Original:</span><br />
                        {formatDateTime(pendingData.originalDate).full}
                      </p>
                      <p className="text-sm text-yellow-800">
                        <span className="font-semibold">Requested:</span><br />
                        {formatDateTime(pendingData.requestedDate).full}
                      </p>
                    </div>
                  </div>
                ) : null;
              })()}

              {selectedBooking.reschedule_history && selectedBooking.reschedule_history.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-700 mb-3">🔄 Reschedule History</h3>
                  {selectedBooking.reschedule_history.map((reschedule) => (
                    <div
                      key={reschedule.ID}
                      className={`mb-3 p-3 rounded border-l-4 ${reschedule.Status === 'Pending' ? 'bg-yellow-50 border-yellow-500' :
                        reschedule.Status === 'Approved' ? 'bg-green-50 border-green-500' :
                          'bg-red-50 border-red-500'
                        }`}
                    >
                      <p className="text-sm font-semibold mb-2">
                        {reschedule.Status === 'Pending' && '⏳ Pending'}
                        {reschedule.Status === 'Approved' && '✅ Approved'}
                        {reschedule.Status === 'Rejected' && '❌ Rejected'}
                      </p>
                      <div className="bg-white border rounded p-2 space-y-1">
                        <p className="text-xs">
                          <strong>From:</strong> {formatDateTime(reschedule.OriginalEventDate).full}
                        </p>
                        <p className="text-xs">
                          <strong>To:</strong> {formatDateTime(reschedule.RequestedEventDate).full}
                        </p>
                        {reschedule.ProcessedAt && (
                          <p className="text-xs text-gray-600 mt-1 pt-1 border-t">
                            <strong>Processed:</strong> {formatDateTime(reschedule.ProcessedAt).full}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-600">Service Name</label>
                  <p className="text-lg font-semibold">{selectedBooking.ServiceName}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600">Status</label>
                  <p>
                    {(() => {
                      let displayStatus = selectedBooking.BookingStatus;

                      // Check if the latest reschedule request was rejected
                      if (selectedBooking.reschedule_history?.length > 0) {
                        // Sort by ID descending to get the latest
                        const sortedHistory = [...selectedBooking.reschedule_history].sort((a, b) => b.ID - a.ID);
                        const latestReschedule = sortedHistory[0];

                        if (latestReschedule?.Status === 'Rejected') {
                          displayStatus = 'Rejected';
                        }
                      }

                      return (
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${getStatusBadge(displayStatus)}`}>
                          {displayStatus}
                        </span>
                      );
                    })()}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Current Date</label>
                    <p className="text-base">{formatDateTime(selectedBooking.EventDate).date}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Current Time</label>
                    <p className="text-base">{formatDateTime(selectedBooking.EventDate).time}</p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-600">Location</label>
                    <p className="text-base">{selectedBooking.EventLocation || 'Not specified'}</p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-600">Event Type</label>
                    <p className="text-base">{selectedBooking.EventType || 'Not specified'}</p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-600">Budget</label>
                    <p className="text-base font-semibold text-green-600">
                      ₱{parseFloat(selectedBooking.TotalAmount || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                {role === 1 && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Client</label>
                    <p>{selectedBooking.client_name}</p>
                  </div>
                )}

                {role === 0 && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600">
                      {(selectedBooking.isVenueBooking || selectedBooking.booking_type === 'venue') ? 'Venue' : 'Supplier'}
                    </label>
                    <p>
                      {(selectedBooking.isVenueBooking || selectedBooking.booking_type === 'venue')
                        ? (selectedBooking.venue_name || selectedBooking.vendor_name || selectedBooking.ServiceName)
                        : selectedBooking.vendor_name}
                    </p>
                  </div>
                )}

                {selectedBooking.AdditionalNotes && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                    <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                      <span>📝</span> Booking Details & Notes
                    </h4>
                    <div className="space-y-3 text-sm text-gray-600">
                      {selectedBooking.AdditionalNotes.split('---').map((section, idx) => {
                        const trimmed = section.trim();
                        if (!trimmed) return null;

                        // Check for section headers
                        if (trimmed === 'Contact Information') {
                          return <h5 key={idx} className="font-semibold text-gray-800 mt-2 border-b pb-1">Contact Information</h5>;
                        }

                        // Split by key-value pairs using a heuristic regex
                        // Matches "Key Name:"
                        const parts = trimmed.split(/([A-Z][a-zA-Z\s/-]+:)/g);

                        return (
                          <div key={idx} className="leading-relaxed">
                            {parts.map((part, pIdx) => {
                              // If it looks like a key (ends in :)
                              if (part.match(/^[A-Z][a-zA-Z\s/-]+:$/)) {
                                // Don't put a newline on the very first item if it's just a key
                                return <span key={pIdx} className="font-semibold text-gray-800 block mt-1">{part} </span>;
                              }
                              return <span key={pIdx}>{part}</span>;
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {selectedBooking.BookingStatus === 'Pending' && (
                <div className="flex gap-2 mt-6 pt-6 border-t">
                  {role === 0 && !getPendingRescheduleData(selectedBooking).hasPending && (
                    <>
                      {selectedBooking.BookingStatus === 'Confirmed' && isWithin7Days(selectedBooking.EventDate) ? (
                        <div className="flex-1 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-700 font-semibold text-center">
                          🔒 Cancellation not available — event is {(() => {
                            const d = getDaysUntilEvent(selectedBooking.EventDate);
                            return d === 0 ? 'today' : `in ${d} day${d === 1 ? '' : 's'}`;
                          })()} (7-day cutoff applies)
                        </div>
                      ) : (
                        <button
                          onClick={() => cancelBooking(selectedBooking.ID, selectedBooking.EventDate, selectedBooking.BookingStatus)}
                          disabled={processingBooking}
                          className="flex-1 bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold"
                        >
                          Cancel
                        </button>
                      )}
                    </>
                  )}

                  {role === 1 && (
                    <>
                      <button
                        onClick={() => acceptBooking(selectedBooking.ID)}
                        disabled={processingBooking}
                        className="flex-1 bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 disabled:opacity-50 font-semibold"
                      >
                        {getPendingRescheduleData(selectedBooking).hasPending ? 'Approve Reschedule' : 'Accept'}
                      </button>
                      <button
                        onClick={() => rejectBooking(selectedBooking.ID)}
                        disabled={processingBooking}
                        className="flex-1 bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold"
                      >
                        {getPendingRescheduleData(selectedBooking).hasPending ? 'Reject Reschedule' : 'Reject'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {role === 0 && selectedBooking.BookingStatus === 'Confirmed' && !getPendingRescheduleData(selectedBooking).hasPending && (
                <div className="flex gap-2 mt-6 pt-6 border-t">
                  <button
                    onClick={() => {
                      setSelectedBooking(null);
                      openRescheduleModal(selectedBooking);
                    }}
                    disabled={processingBooking}
                    className="flex-1 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 font-semibold"
                  >
                    📅 Reschedule Booking
                  </button>
                </div>
              )}

              {/*  NEW: COMPLETE BUTTON IN DETAILS MODAL */}
              {role === 1 && selectedBooking.BookingStatus === 'Confirmed' && (
                <div className="flex gap-2 mt-6 pt-6 border-t">
                  <button
                    onClick={() => completeBooking(selectedBooking.ID)}
                    disabled={processingBooking}
                    className="flex-1 bg-[#7a5d47] text-white px-4 py-2 rounded-lg hover:bg-[#5d4436] disabled:opacity-50 text-sm font-semibold"

                  >
                    Mark as Completed
                  </button>
                </div>
              )}

              {/*  NEW: FEEDBACK BUTTON IN DETAILS MODAL */}
              {role === 0 && selectedBooking.BookingStatus === 'Completed' && (
                <div className="flex gap-2 mt-6 pt-6 border-t">
                  <button
                    onClick={() => {
                      setSelectedBooking(null);
                      openFeedbackModal(selectedBooking);
                    }}
                    className="flex-1 bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600 font-semibold"
                  >
                    ⭐ Leave Review
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <button
                onClick={() => setSelectedBooking(null)}
                className="w-full bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}



      {/* FEEDBACK MODAL ================= */}
      {showFeedbackModal && feedbackBooking && (
        <FeedbackModal
          booking={feedbackBooking}
          isOpen={showFeedbackModal}
          onClose={() => {
            setShowFeedbackModal(false);
            setFeedbackBooking(null);
          }}
          onSuccess={handleFeedbackSuccess}
        />
      )}

      {/* ================= RESCHEDULE MODAL ================= */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[10001] p-4 sm:p-6">
          <div className="bg-[#f6f0e8] p-8 rounded-xl w-full max-w-md border border-[#c9bda4] shadow-2xl relative">
            <h2 className="text-xl font-bold mb-2 text-[#5d4436] uppercase tracking-wide">Request Reschedule</h2>
            <p className="text-sm text-gray-600 mb-6">
              Propose a new date and time for your booking with <span className="font-semibold text-gray-800">{rescheduleBooking?.ServiceName}</span>.
            </p>

            <form onSubmit={handleReschedule} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-[#5d4436] uppercase mb-2 tracking-wider">New Date</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={rescheduleForm.new_date}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, new_date: e.target.value })}
                  className="w-full p-3 bg-white border border-[#e0d6c6] rounded-lg focus:ring-1 focus:ring-[#7a5d47] focus:border-[#7a5d47] outline-none text-gray-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5d4436] uppercase mb-2 tracking-wider">New Time</label>
                <div className="flex gap-2">
                  {/* Hour Select */}
                  <div className="relative flex-1">
                    <select
                      required
                      value={(() => {
                        const [h] = rescheduleForm.new_time.split(':');
                        const hours = parseInt(h);
                        return (hours % 12 || 12).toString();
                      })()}
                      onChange={(e) => {
                        const newHour12 = parseInt(e.target.value);
                        const [h, m] = rescheduleForm.new_time.split(':');
                        const currentHour24 = parseInt(h);
                        const isPM = currentHour24 >= 12;

                        let newHour24 = newHour12;
                        if (isPM && newHour12 !== 12) newHour24 += 12;
                        if (!isPM && newHour12 === 12) newHour24 = 0;

                        const timeString = `${newHour24.toString().padStart(2, '0')}:${m}`;
                        setRescheduleForm({ ...rescheduleForm, new_time: timeString });
                      }}
                      className="w-full p-3 bg-white border border-[#e0d6c6] rounded-lg focus:ring-1 focus:ring-[#7a5d47] focus:border-[#7a5d47] outline-none text-gray-800 appearance-none"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </div>

                  {/* Minute Select */}
                  <div className="relative flex-1">
                    <select
                      required
                      value={rescheduleForm.new_time.split(':')[1]}
                      onChange={(e) => {
                        const [h] = rescheduleForm.new_time.split(':');
                        const newM = e.target.value;
                        const timeString = `${h}:${newM}`;
                        setRescheduleForm({ ...rescheduleForm, new_time: timeString });
                      }}
                      className="w-full p-3 bg-white border border-[#e0d6c6] rounded-lg focus:ring-1 focus:ring-[#7a5d47] focus:border-[#7a5d47] outline-none text-gray-800 appearance-none"
                    >
                      {['00', '15', '30', '45'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </div>

                  {/* AM/PM Select */}
                  <div className="relative flex-1">
                    <select
                      required
                      value={parseInt(rescheduleForm.new_time.split(':')[0]) >= 12 ? 'PM' : 'AM'}
                      onChange={(e) => {
                        const newAmpm = e.target.value;
                        const [h, m] = rescheduleForm.new_time.split(':');
                        let hour24 = parseInt(h);

                        if (newAmpm === 'PM' && hour24 < 12) hour24 += 12;
                        if (newAmpm === 'AM' && hour24 >= 12) hour24 -= 12;

                        const timeString = `${hour24.toString().padStart(2, '0')}:${m}`;
                        setRescheduleForm({ ...rescheduleForm, new_time: timeString });
                      }}
                      className="w-full p-3 bg-white border border-[#e0d6c6] rounded-lg focus:ring-1 focus:ring-[#7a5d47] focus:border-[#7a5d47] outline-none text-gray-800 appearance-none"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="flex-1 px-4 py-3 bg-[#e8e4dc] text-[#5d4436] rounded-lg hover:bg-[#dcd6cc] font-bold transition-colors"
                  disabled={processingBooking}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingBooking}
                  className="flex-1 px-4 py-3 bg-[#7a5d47] text-white rounded-lg hover:bg-[#654a38] font-bold transition-colors disabled:opacity-50 flex items-center justify-center shadow-md"
                >
                  {processingBooking ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    "Submit Request"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= AVATAR MODAL ================= */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4 sm:p-6">
          <div className="bg-[#f6f0e8] p-4 sm:p-6 rounded-2xl w-full max-w-md border border-[#c9bda4] shadow-lg">
            <h2 className="text-lg font-semibold mb-4">
              Update Profile Picture
            </h2>

            {avatarPreview && (
              <div className="mb-4 flex justify-center">
                <img
                  src={avatarPreview}
                  alt="Preview"
                  className="w-32 h-32 rounded-full object-cover border-2 border-gray-300"
                />
              </div>
            )}

            <form onSubmit={uploadAvatar}>
              <input
                type="file"
                accept="image/*"
                required
                onChange={(e) => setAvatarFile(e.target.files[0])}
                className="border border-gray-400 rounded-lg p-2 w-full bg-white text-sm"
              />
              <p className="text-xs text-gray-600 mt-2">
                Recommended: Square image, max 5MB
              </p>

              <button
                type="submit"
                disabled={uploadingAvatar}
                className="bg-[#7a5d47] text-white w-full py-2 rounded-lg mt-4 disabled:opacity-50"
              >
                {uploadingAvatar ? "Uploading..." : "Upload"}
              </button>
            </form>

            <button
              className="bg-[#e0d6c6] text-[#3b2f25] w-full py-2 rounded-lg mt-3"
              onClick={() => {
                setShowAvatarModal(false);
                setAvatarFile(null);
                setAvatarPreview(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ================= EDIT PROFILE MODAL ================= */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 sm:p-6">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-hidden border border-gray-200">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-[#7a5d47] to-[#5d4436] p-6 border-b border-gray-200 flex justify-between items-center z-10">
              <div>
                <h2 className="text-2xl font-bold text-white">Edit Profile</h2>
                <p className="text-sm text-white/80 mt-1">Update your personal information</p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditForm(prev => ({ ...prev, currentPassword: "", newPassword: "", confirmPassword: "" }));
                }}
                className="text-white hover:text-gray-200 text-3xl font-light transition-colors"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <form onSubmit={saveProfileChanges} className="p-8 space-y-8 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 100px)' }}>
              {/* Current Password Verification - Required for all changes */}
              <div className="bg-amber-50 rounded-xl p-6 border border-amber-200">
                <label className="block text-sm font-bold uppercase mb-3 text-amber-900 tracking-wide">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={editForm.currentPassword}
                    onChange={(e) => setEditForm({ ...editForm, currentPassword: e.target.value })}
                    placeholder="Enter your current password to save changes"
                    required
                    className="w-full rounded-lg bg-white border-2 border-amber-300 p-3 pl-12 pr-12 focus:border-[#7a5d47] focus:ring-2 focus:ring-[#7a5d47]/20 outline-none transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showCurrentPassword ? "👁️" : "👁️\u200D🗨️"}
                  </button>
                </div>
                <p className="text-xs text-amber-800 mt-2 font-medium">
                  Your current password is required to verify your identity before saving any changes.
                </p>
              </div>

              {/* Username Section */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <label className="block text-sm font-bold uppercase mb-3 text-gray-700 tracking-wide">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    placeholder="Enter username"
                    className="w-full rounded-lg bg-white border-2 border-gray-300 p-3 pl-12 focus:border-[#7a5d47] focus:ring-2 focus:ring-[#7a5d47]/20 outline-none transition-all font-medium"
                  />
                </div>
              </div>

              {/* Phone Number Section */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <label className="block text-sm font-bold uppercase mb-3 text-gray-700 tracking-wide">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => {
                      const input = e.target.value;

                      // Extract only digits
                      let digits = input.replace(/\D/g, "");

                      // Handle different input scenarios
                      if (digits.startsWith("63")) {
                        digits = digits.slice(2); // Remove country code if user types it
                      } else if (digits.startsWith("0")) {
                        digits = digits.slice(1); // Remove leading 0 if user types it
                      }

                      // Limit to 10 digits (PH mobile number length)
                      digits = digits.slice(0, 10);

                      // Validate first digit must be 9 for PH mobile
                      if (digits.length > 0 && digits[0] !== "9") {
                        return; // Don't update if first digit is not 9
                      }

                      // Format with country code (no space to match backend validation)
                      const formatted = digits ? `+63${digits}` : "";
                      setEditForm({ ...editForm, phone: formatted });
                    }}
                    placeholder="+63 9XXXXXXXXX"
                    inputMode="numeric"
                    className="w-full rounded-lg bg-white border-2 border-gray-300 p-3 pl-12 focus:border-[#7a5d47] focus:ring-2 focus:ring-[#7a5d47]/20 outline-none transition-all font-medium"
                  />
                </div>
                <p className="text-xs text-gray-600 mt-2 font-medium">
                  {profile?.phone ? (
                    <>Current: <span className="text-[#7a5d47]">{profile.phone}</span></>
                  ) : (
                    <span className="text-gray-400">Not set</span>
                  )}
                </p>
                <div className="flex items-start gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>Enter your Philippine mobile number starting with 9 (e.g., 9123456789)</span>
                </div>
              </div>

              <div className="border-t border-gray-300 pt-6">
                <h3 className="text-base font-semibold mb-4">Change Password</h3>

                <div className="mb-4">
                  <label className="block text-sm font-semibold uppercase mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={editForm.newPassword}
                      onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                      placeholder="Enter new password"
                      className="w-full rounded-md bg-gray-100 border border-gray-300 p-2 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600"
                    >
                      {showNewPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>

                  {editForm.newPassword && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-300"
                            style={{
                              width: `${(passwordStrength.score / 6) * 100}%`,
                              backgroundColor: passwordStrength.color
                            }}
                          />
                        </div>
                        <span
                          className="text-xs font-semibold"
                          style={{ color: passwordStrength.color }}
                        >
                          {passwordStrength.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Use 8+ characters with a mix of letters, numbers & symbols
                      </p>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-semibold uppercase mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={editForm.confirmPassword}
                      onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                      className="w-full rounded-md bg-gray-100 border border-gray-300 p-2 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600"
                    >
                      {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>

                  {editForm.confirmPassword && (
                    <div className="mt-1">
                      {editForm.newPassword === editForm.confirmPassword ? (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <span>✓</span> Passwords match
                        </p>
                      ) : (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <span>✗</span> Passwords do not match
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-2">
                  ⚠️ Leave the new password fields empty if you only want to update your username or phone number
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg bg-white text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingChanges}
                  className="flex-1 px-6 py-3 bg-[#7a5d47] text-white rounded-lg font-semibold hover:bg-[#5d4436] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingChanges ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CALENDAR MODAL ================= */}
      {showCalendarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10002] p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden shadow-2xl">
            <div className="bg-[#7a5d47] text-white p-6">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-2xl font-bold">Manage Your Calendar</h2>
                  <p className="text-sm text-white/80 mt-1">Set your availability and manage bookings</p>
                </div>
                <button
                  onClick={() => {
                    setShowCalendarModal(false);
                    // Reset venue selection when modal closes for clean state
                    setSelectedVenue(null);
                  }}
                  className="text-white hover:text-gray-200 text-3xl font-light"
                >
                  ×
                </button>
              </div>

              {/* 🔧 FIX: Venue Selector - Show venues when available */}
              {ownedVenues.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {/* Only show venue buttons - no vendor calendar option */}
                  {ownedVenues.map(venue => (
                    <button
                      key={venue.id}
                      onClick={() => setSelectedVenue(venue)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${selectedVenue?.id === venue.id
                        ? 'bg-white text-[#7a5d47]'
                        : 'bg-[#654a38] text-white hover:bg-[#5a4133]'
                        }`}
                    >
                      🏛️ {venue.venue_name || `Venue ${venue.id}`}
                    </button>
                  ))}
                </div>
              ) : role === 1 ? (
                <div className="text-sm text-white/80">
                  Managing your vendor availability calendar
                </div>
              ) : null}
            </div>

            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 100px)' }}>
              {/* Upcoming Availability Summary */}
              {(() => {
                const upcomingAvailability = getUpcomingAvailability();
                return upcomingAvailability.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                    <h4 className="font-semibold text-gray-700 mb-3">Upcoming Bookings & Unavailable Dates:</h4>
                    <div className="space-y-2">
                      {upcomingAvailability.map((avail, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border ${avail.source === 'booking'
                            ? 'bg-green-50 border-green-200'
                            : avail.is_available
                              ? 'bg-white border-gray-200'
                              : 'bg-red-50 border-red-200'
                            }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium flex items-center gap-2">
                                {/* Icon: Check for Booking, X for Unavailable */}
                                <span className={avail.source === 'booking' ? 'text-green-600' : 'text-red-600'}>
                                  {avail.source === 'booking' ? '✓' : '✕'}
                                </span>
                                {formatDate(avail.date)}
                              </p>
                              <p className="text-sm text-gray-600 pl-6">
                                {avail.start_time
                                  ? `${avail.start_time.substring(0, 5)} - ${avail.end_time ? avail.end_time.substring(0, 5) : ''}`
                                  : (avail.event_time || avail.EventTime || 'All Day')}
                              </p>
                              {avail.notes && (
                                <p className="text-xs text-gray-500 mt-1 pl-6">{avail.notes}</p>
                              )}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${avail.source === 'booking'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                              }`}>
                              {avail.source === 'booking' ? 'Booked' : 'Unavailable'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Calendar */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                {/* Calendar Header */}
                <div className="flex justify-between items-center mb-6">
                  <button
                    onClick={previousMonth}
                    className="bg-[#7a5d47] text-white px-4 py-2 rounded-lg hover:opacity-90"
                  >
                    ← Previous
                  </button>
                  <h4 className="text-xl font-bold">
                    {new Date(currentMonth).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric'
                    })}
                  </h4>
                  <button
                    onClick={nextMonth}
                    className="bg-[#7a5d47] text-white px-4 py-2 rounded-lg hover:opacity-90"
                  >
                    Next →
                  </button>
                </div>



                {/* Calendar Legend */}
                <div className="flex gap-6 mb-4 text-xs justify-center flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#e5e0d5] border border-[#c9bda4]"></div>
                    <span>Unavailable/Booked</span>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {/* Weekday headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center font-semibold text-gray-600 py-2">
                      {day}
                    </div>
                  ))}

                  {/* Calendar days */}
                  {(() => {
                    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
                    const days = [];

                    // Empty cells before month starts
                    for (let i = 0; i < startingDayOfWeek; i++) {
                      days.push(<div key={`empty-${i}`} className="aspect-square"></div>);
                    }

                    // Days of month
                    for (let day = 1; day <= daysInMonth; day++) {
                      const date = new Date(year, month, day);
                      const isToday = date.toDateString() === new Date().toDateString();
                      const isPast = date < new Date().setHours(0, 0, 0, 0);
                      const availabilityData = getAvailabilityForDate(date);
                      const isAvailable = isDateAvailable(date);
                      const isBooked = isDateBooked(date);
                      const isBooking = hasBookingOnDate(date);

                      days.push(
                        <div
                          key={day}
                          onClick={() => {
                            if (!isPast) {
                              if (availabilityData.length > 0) {
                                openAvailabilityModal(date, availabilityData[0]);
                              } else {
                                openAvailabilityModal(date);
                              }
                            }
                          }}
                          className={`aspect-square p-2 rounded-lg border flex flex-col items-center justify-center cursor-pointer transition-all ${isPast
                            ? 'bg-[#f0ebe0] opacity-50 cursor-not-allowed border-transparent'
                            : isBooking || isBooked
                              ? 'bg-[#e5e0d5] border-[#c9bda4] text-[#7a5d47]'
                              : 'bg-white border-[#e8ddae] hover:border-[#7a5d47] hover:bg-[#fcfbf9]'
                            } ${isToday ? 'ring-2 ring-[#7a5d47]' : ''}`}
                          title={isBooking ? 'Booked' : isBooked ? 'Unavailable' : 'Click to set unavailable'}
                        >
                          <span className="font-semibold">{day}</span>
                          {availabilityData.length > 0 && (hasBookingOnDate(date) || !availabilityData[0].is_available) && (
                            <span className="text-xs mt-1 font-bold">
                              {isBooking ? '✓' : '✕'}
                            </span>
                          )}
                        </div>
                      );
                    }

                    return days;
                  })()}
                </div>

                {loadingAvailability && (
                  <div className="text-center py-4 text-gray-500">
                    Loading availability...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AVAILABILITY EDIT MODAL (inside Calendar Modal) ================= */}
      {showAvailabilityModal && selectedDate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10003] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-[#7a5d47] text-white p-6">
              <h3 className="text-xl font-bold">
                {editingAvailability ? 'Edit' : 'Set'} Availability
              </h3>
              <p className="text-sm text-white/80 mt-1">
                {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>

            <form onSubmit={saveAvailability} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Status</label>
                <div className="p-3 bg-gray-100 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  Unavailable / Booked
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Start Time</label>
                  <input
                    type="time"
                    value={availabilityForm.start_time}
                    onChange={(e) => setAvailabilityForm({ ...availabilityForm, start_time: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">End Time</label>
                  <input
                    type="time"
                    value={availabilityForm.end_time}
                    onChange={(e) => setAvailabilityForm({ ...availabilityForm, end_time: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Notes (Optional)</label>
                <textarea
                  value={availabilityForm.notes}
                  onChange={(e) => setAvailabilityForm({ ...availabilityForm, notes: e.target.value })}
                  placeholder="Add any notes about this time slot..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="3"
                />
              </div>

              <div className="flex gap-3">
                {editingAvailability && (
                  <button
                    type="button"
                    onClick={() => deleteAvailability(editingAvailability.id)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    Delete
                  </button>
                )}
                <div className="flex-1"></div>
                <button
                  type="button"
                  onClick={closeAvailabilityModal}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAvailability}
                  className="px-6 py-2 bg-[#7a5d47] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {savingAvailability ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal />

      {/* Rejection Reason Modal */}
      {rejectModal.show && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setRejectModal({ show: false, bookingId: null, reason: "" })}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#1c1b1a' }}>
              Reject this booking request?
            </h3>
            <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Please provide a reason for rejecting this booking request:
            </p>

            <textarea
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
              placeholder="Enter rejection reason..."
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '0.75rem',
                border: '2px solid #e5e5e5',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: '1.5rem',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#7a5d47'}
              onBlur={(e) => e.target.style.borderColor = '#e5e5e5'}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRejectModal({ show: false, bookingId: null, reason: "" })}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontSize: '0.95rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitRejection}
                disabled={processingBooking}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  fontWeight: 600,
                  cursor: processingBooking ? 'not-allowed' : 'pointer',
                  fontSize: '0.95rem',
                  opacity: processingBooking ? 0.6 : 1
                }}
              >
                {processingBooking ? 'Rejecting...' : 'Reject Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
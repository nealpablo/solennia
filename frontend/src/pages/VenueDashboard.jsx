import { useEffect, useState } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import toast from "../utils/toast";
import "../style.css";

const API = 
  import.meta.env.VITE_API_BASE || 
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD 
    ? "https://solennia.up.railway.app/api" : "/api");

export default function VenueDashboard() {
  const token = localStorage.getItem("solennia_token");
  const navigate = useNavigate();

  const [vendorStatus, setVendorStatus] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateListing, setShowCreateListing] = useState(false);
  const [editingListing, setEditingListing] = useState(null);

  // Availability Calendar (per venue)
  const [selectedVenueForCalendar, setSelectedVenueForCalendar] = useState(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availability, setAvailability] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
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

  // Form state 
  const [listingForm, setListingForm] = useState({
    venue_name: "",
    venue_subcategory: "",
    venue_capacity: "",
    venue_amenities: "",
    venue_operating_hours: "",
    venue_parking: "",
    description: "",
    pricing: "",
    address: "",
    contact_email: "",
    logo: null,          // Main logo image
    gallery_1: null,     // Gallery image 1
    gallery_2: null,     // Gallery image 2
    gallery_3: null,     // Gallery image 3
  });

  const [imagePreviews, setImagePreviews] = useState({
    logo: null,
    gallery_1: null,
    gallery_2: null,
    gallery_3: null,
  });

  /* ================= CHECK VENUE VENDOR STATUS ================= */
  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }
    checkVenueVendorStatus();
  }, [token, navigate]);

  const checkVenueVendorStatus = async () => {
    try {
      const res = await fetch(`${API}/vendor/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (!data.success) {
        toast.warning("Please apply as a supplier first");
        navigate("/profile");
        return;
      }

      if (data.category?.toLowerCase() !== "venue") {
        toast.error("Access denied - This page is for venue suppliers only");
        navigate("/vendor-dashboard");
        return;
      }

      if (data.status !== "approved") {
        toast.warning("Your venue supplier application is still pending approval");
        navigate("/profile");
        return;
      }

      setVendorStatus(data);
      loadMyListings();
      
    } catch (err) {
      console.error("Failed to check supplier status:", err);
      toast.error("Error checking supplier status");
      navigate("/");
    }
  };

  /* ================= AVAILABILITY: LOAD ================= */
  useEffect(() => {
    if (!showCalendarModal || !selectedVenueForCalendar?.id) return;
    loadVenueAvailability();
  }, [showCalendarModal, selectedVenueForCalendar?.id, currentMonth]);

  const loadVenueAvailability = async () => {
    if (!selectedVenueForCalendar?.id) return;
    try {
      setLoadingAvailability(true);
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const res = await fetch(`${API}/venue/availability/${selectedVenueForCalendar.id}?year=${year}&month=${month}`);
      const json = await res.json();
      if (json.success) setAvailability(json.availability || []);
    } catch (err) {
      console.error("Failed to load venue availability:", err);
    } finally {
      setLoadingAvailability(false);
    }
  };

  const formatDateToLocal = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
      daysInMonth: lastDay.getDate(),
      startingDayOfWeek: firstDay.getDay(),
      year,
      month
    };
  };

  const getAvailabilityForDate = (date) => {
    const dateStr = formatDateToLocal(date);
    return availability.filter((a) => a.date === dateStr);
  };

  const isDateBooked = (date) => {
    const dateStr = formatDateToLocal(date);
    return availability.some((a) => a.date === dateStr && !a.is_available);
  };

  const isDateAvailable = (date) => {
    const dateStr = formatDateToLocal(date);
    return availability.some((a) => a.date === dateStr && a.is_available);
  };

  const getUpcomingAvailability = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return availability
      .filter((a) => new Date(a.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
  };

  const previousMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const openAvailabilityModal = (date, existingAvailability = null) => {
    setSelectedDate(date);
    if (existingAvailability) {
      setEditingAvailability(existingAvailability);
      setAvailabilityForm({
        start_time: existingAvailability.start_time ? String(existingAvailability.start_time).substring(0, 5) : "09:00",
        end_time: existingAvailability.end_time ? String(existingAvailability.end_time).substring(0, 5) : "17:00",
        is_available: existingAvailability.is_available,
        notes: existingAvailability.notes || ""
      });
    } else {
      setEditingAvailability(null);
      setAvailabilityForm({ start_time: "09:00", end_time: "17:00", is_available: true, notes: "" });
    }
    setShowAvailabilityModal(true);
  };

  const closeAvailabilityModal = () => {
    setShowAvailabilityModal(false);
    setSelectedDate(null);
    setEditingAvailability(null);
    setAvailabilityForm({ start_time: "09:00", end_time: "17:00", is_available: true, notes: "" });
  };

  const saveAvailability = async (e) => {
    e.preventDefault();
    if (!selectedDate || !selectedVenueForCalendar?.id) return;
    if (!token) {
      toast.error("Please log in");
      return;
    }
    try {
      setSavingAvailability(true);
      const dateStr = formatDateToLocal(selectedDate);
      const payload = editingAvailability
        ? {
            start_time: availabilityForm.start_time,
            end_time: availabilityForm.end_time,
            is_available: availabilityForm.is_available,
            notes: availabilityForm.notes || ""
          }
        : {
            venue_id: selectedVenueForCalendar.id,
            date: dateStr,
            start_time: availabilityForm.start_time,
            end_time: availabilityForm.end_time,
            is_available: availabilityForm.is_available,
            notes: availabilityForm.notes || ""
          };
      const url = editingAvailability
        ? `${API}/venue/availability/${editingAvailability.id}`
        : `${API}/venue/availability`;
      const method = editingAvailability ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editingAvailability ? "Availability updated!" : "Availability added!");
        closeAvailabilityModal();
        loadVenueAvailability();
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

  const deleteAvailability = async (availabilityId) => {
    if (!confirm("Delete this availability entry?")) return;
    if (!token) {
      toast.error("Please log in");
      return;
    }
    try {
      const res = await fetch(`${API}/venue/availability/${availabilityId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Availability deleted!");
        closeAvailabilityModal();
        loadVenueAvailability();
      } else {
        toast.error(json.error || "Failed to delete availability");
      }
    } catch (err) {
      console.error("Delete availability error:", err);
      toast.error("Failed to delete availability");
    }
  };

  const openCalendarModal = (listing) => {
    setSelectedVenueForCalendar(listing);
    setCurrentMonth(new Date());
    setShowCalendarModal(true);
  };

  const closeCalendarModal = () => {
    setShowCalendarModal(false);
    setSelectedVenueForCalendar(null);
  };

  /* ================= LOAD VENUE LISTINGS ================= */
  const loadMyListings = async () => {
    try {
      const res = await fetch(`${API}/venue/my-listings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (data.success) {
        setListings(data.listings || []);
      }
      
    } catch (err) {
      console.error("Failed to load venue listings:", err);
    } finally {
      setLoading(false);
    }
  };

  /* =================  HANDLE INDIVIDUAL IMAGE UPLOADS ================= */
  const handleImageChange = (imageType, file) => {
    if (!file) return;

    setListingForm({ ...listingForm, [imageType]: file });

    // Generate preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreviews(prev => ({ ...prev, [imageType]: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  /* ================= CREATE/UPDATE LISTING ================= */
  const handleSubmitListing = async (e) => {
    e.preventDefault();

    if (!listingForm.venue_name.trim() || !listingForm.address.trim() || !listingForm.pricing.trim()) {
      toast.warning("Please fill in venue name, address, and pricing");
      return;
    }

    if (!editingListing && !listingForm.logo) {
      toast.warning("Please upload a logo image");
      return;
    }

    try {
      const formData = new FormData();
      
      // Add text fields
      const textFields = ['venue_name', 'venue_subcategory', 'venue_capacity', 
                         'venue_amenities', 'venue_operating_hours', 'venue_parking',
                         'description', 'pricing', 'address', 'contact_email'];
      
      textFields.forEach(field => {
        if (listingForm[field]) {
          formData.append(field, listingForm[field]);
        }
      });

      //  Add images (individually)
      if (listingForm.logo) {
        formData.append('logo', listingForm.logo);
      }
      if (listingForm.gallery_1) {
        formData.append('gallery_1', listingForm.gallery_1);
      }
      if (listingForm.gallery_2) {
        formData.append('gallery_2', listingForm.gallery_2);
      }
      if (listingForm.gallery_3) {
        formData.append('gallery_3', listingForm.gallery_3);
      }

      const endpoint = editingListing 
        ? `${API}/venue/listings/${editingListing.id}`
        : `${API}/venue/listings`;
        
      const method = editingListing ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save listing");
      }

      toast.success(editingListing ? "Listing updated successfully!" : "Listing created successfully!");
      
      resetForm();
      setShowCreateListing(false);
      setEditingListing(null);
      loadMyListings();
      
    } catch (err) {
      console.error("Error submitting listing:", err);
      toast.error(err.message);
    }
  };

  /* ================= DELETE LISTING ================= */
  const handleDeleteListing = async (listingId) => {
    if (!confirm("Are you sure you want to delete this listing?")) {
      return;
    }

    try {
      const res = await fetch(`${API}/venue/listings/${listingId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete listing");
      }

      toast.success("Listing deleted successfully!");
      loadMyListings();
      
    } catch (err) {
      console.error("Error deleting listing:", err);
      toast.error(err.message);
    }
  };

  /* ================= EDIT LISTING ================= */
  const handleEditListing = (listing) => {
    setEditingListing(listing);
    setListingForm({
      venue_name: listing.venue_name || "",
      venue_subcategory: listing.venue_subcategory || "",
      venue_capacity: listing.venue_capacity || "",
      venue_amenities: listing.venue_amenities || "",
      venue_operating_hours: listing.venue_operating_hours || "",
      venue_parking: listing.venue_parking || "",
      description: listing.description || "",
      pricing: listing.pricing || "",
      address: listing.address || "",
      contact_email: listing.contact_email || "",
      logo: null,
      gallery_1: null,
      gallery_2: null,
      gallery_3: null,
    });
    
    // Set existing images for preview
    const gallery = Array.isArray(listing.gallery) ? listing.gallery : [];
    setImagePreviews({
      logo: listing.portfolio || listing.HeroImageUrl || null,
      gallery_1: gallery[0] || null,
      gallery_2: gallery[1] || null,
      gallery_3: gallery[2] || null,
    });
    
    setShowCreateListing(true);
  };

  /* ================= RESET FORM ================= */
  const resetForm = () => {
    setListingForm({
      venue_name: "",
      venue_subcategory: "",
      venue_capacity: "",
      venue_amenities: "",
      venue_operating_hours: "",
      venue_parking: "",
      description: "",
      pricing: "",
      address: "",
      contact_email: "",
      logo: null,
      gallery_1: null,
      gallery_2: null,
      gallery_3: null,
    });
    setImagePreviews({
      logo: null,
      gallery_1: null,
      gallery_2: null,
      gallery_3: null,
    });
    setEditingListing(null);
  };

  /* ================= LOADING STATE ================= */
  if (loading) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh" 
      }}>
        <p>Loading venue dashboard...</p>
      </div>
    );
  }

  /* ================= RENDER ================= */
  return (
    <div className="venue-dashboard">
      <style>{`
        .venue-dashboard {
          padding: 80px 20px 40px;
          max-width: 1200px;
          margin: 0 auto;
          font-family: 'Poppins', sans-serif;
        }
        .venue-dashboard h1 {
          color: #7a5d47;
          margin-bottom: 30px;
          font-size: 32px;
        }
        .welcome-card {
          background: #f6f0e8;
          padding: 30px;
          border-radius: 12px;
          margin-bottom: 30px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .welcome-card h2 {
          margin: 0 0 10px 0;
          color: #333;
        }
        .welcome-card p {
          margin: 0 0 20px 0;
          color: #666;
        }
        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.3s;
        }
        .btn-primary {
          background: #7a5d47;
          color: white;
        }
        .btn-primary:hover {
          background: #6a503d;
        }
        .btn-secondary {
          background: #e8ddae;
          color: #333;
        }
        .btn-secondary:hover {
          background: #d8cdae;
        }
        .btn-danger {
          background: #d32f2f;
          color: white;
        }
        .btn-danger:hover {
          background: #b71c1c;
        }
        .listings-section h2 {
          color: #7a5d47;
          margin-bottom: 20px;
        }
        .listings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        .listing-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: transform 0.3s;
        }
        .listing-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }
        .listing-logo-container {
          width: 100%;
          height: 220px;
          overflow: hidden;
          background: #e8ddae;
          position: relative;
        }
        .listing-logo {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }
        .listing-gallery-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
          padding: 10px;
          background: #f9f9f9;
        }
        .listing-gallery-item {
          aspect-ratio: 1;
          overflow: hidden;
          border-radius: 4px;
          background: #e8ddae;
        }
        .listing-gallery-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .listing-image-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #e8ddae 0%, #d8cdae 100%);
          color: #7a5d47;
          font-size: 14px;
          font-weight: 600;
        }
        .listing-content {
          padding: 20px;
        }
        .listing-content h3 {
          margin: 0 0 10px 0;
          color: #333;
          font-size: 20px;
        }
        .listing-content p {
          margin: 5px 0;
          color: #666;
          font-size: 14px;
        }
        .listing-actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
        .no-listings {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .no-listings h3 {
          color: #7a5d47;
          margin-bottom: 15px;
        }
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          overflow-y: auto;
          padding: 20px;
        }
        .modal-content {
          background: white;
          padding: 30px;
          border-radius: 12px;
          max-width: 700px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-content h2 {
          margin-top: 0;
          color: #7a5d47;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
        }
        .form-group label .required {
          color: #d32f2f;
        }
        .form-group input,
        .form-group textarea,
        .form-group select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
        }
        .form-group textarea {
          min-height: 100px;
          resize: vertical;
        }
        /*  Individual Image Upload Boxes */
        .image-upload-box {
          border: 2px dashed #ddd;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          background: #f9f9f9;
          cursor: pointer;
          transition: all 0.3s;
        }
        .image-upload-box:hover {
          border-color: #7a5d47;
          background: #f0f0f0;
        }
        .image-upload-box.has-image {
          border-color: #4caf50;
          background: #f1f8f4;
        }
        .image-upload-box input[type="file"] {
          display: none;
        }
        .upload-icon {
          font-size: 40px;
          color: #7a5d47;
          margin-bottom: 10px;
        }
        .image-preview-container {
          margin-top: 15px;
        }
        .image-preview {
          max-width: 100%;
          border-radius: 8px;
          overflow: hidden;
        }
        .image-preview img {
          width: 100%;
          height: auto;
          display: block;
        }
        .gallery-upload-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-top: 10px;
        }
        .modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 20px;
        }
      `}</style>

      <h1>🏛️ Venue Dashboard</h1>

      {/* Welcome Card */}
      <div className="welcome-card">
        <h2>Welcome, Venue Supplier!</h2>
        <p>Create stunning venue listings with a logo and gallery images to showcase your space.</p>
        <button onClick={() => setShowCreateListing(true)} className="btn btn-primary">
          ➕ Create New Venue Listing
        </button>
      </div>

      {/* Listings Section */}
      <div className="listings-section">
        <h2>Your Venue Listings ({listings.length})</h2>
        
        {listings.length === 0 ? (
          <div className="no-listings">
            <h3>No venue listings yet</h3>
            <p>Create your first venue listing with beautiful images!</p>
            <button onClick={() => setShowCreateListing(true)} className="btn btn-primary">
              Create First Listing
            </button>
          </div>
        ) : (
          <div className="listings-grid">
            {listings.map((listing) => {
              const gallery = Array.isArray(listing.gallery) ? listing.gallery : [];

              return (
                <div key={listing.id} className="listing-card">
                  {/* Logo */}
                  <div className="listing-logo-container">
                    {(listing.portfolio || listing.HeroImageUrl) ? (
                      <img 
                        src={listing.portfolio || listing.HeroImageUrl} 
                        alt={listing.venue_name} 
                        className="listing-logo"
                      />
                    ) : (
                      <div className="listing-image-placeholder">
                        📷 No Logo
                      </div>
                    )}
                  </div>

                  {/* Gallery */}
                  {gallery.length > 0 && (
                    <div className="listing-gallery-grid">
                      {gallery.slice(0, 3).map((img, idx) => (
                        <div key={idx} className="listing-gallery-item">
                          <img src={img} alt={`Gallery ${idx + 1}`} />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="listing-content">
                    <h3>{listing.venue_name}</h3>
                    <p><strong>Type:</strong> {listing.venue_subcategory || "Not specified"}</p>
                    <p><strong>Address:</strong> {listing.address}</p>
                    <p><strong>Capacity:</strong> {listing.venue_capacity || "Not specified"}</p>
                    <p><strong>Pricing:</strong> {listing.pricing}</p>
                    <p><strong>Images:</strong> {gallery.length} gallery photos</p>
                    
                    <div className="listing-actions">
                      <button onClick={() => openCalendarModal(listing)} className="btn btn-secondary">
                        📅 Manage Availability
                      </button>
                      <button onClick={() => handleEditListing(listing)} className="btn btn-secondary">
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDeleteListing(listing.id)} className="btn btn-danger">
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Listing Modal */}
      {showCreateListing && (
        <div className="modal-backdrop" onClick={() => {
          setShowCreateListing(false);
          resetForm();
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingListing ? "✏️ Edit Venue Listing" : "➕ Create New Venue Listing"}</h2>
            
            <form onSubmit={handleSubmitListing}>
              {/* Basic Info */}
              <div className="form-group">
                <label>Venue Name <span className="required">*</span></label>
                <input
                  type="text"
                  value={listingForm.venue_name}
                  onChange={(e) => setListingForm({ ...listingForm, venue_name: e.target.value })}
                  placeholder="Grand Ballroom, Garden Paradise, etc."
                  required
                />
              </div>

              <div className="form-group">
                <label>Venue Type</label>
                <select
                  value={listingForm.venue_subcategory}
                  onChange={(e) => setListingForm({ ...listingForm, venue_subcategory: e.target.value })}
                >
                  <option value="">Select type...</option>
                  <option value="Church">Church</option>
                  <option value="Garden">Garden</option>
                  <option value="Resort">Resort</option>
                  <option value="Conference">Conference</option>
                  <option value="Other">Other</option>
                  <option value="Ballroom">Ballroom</option>
                  <option value="Beach">Beach</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Hotel">Hotel</option>
                </select>
              </div>

              <div className="form-group">
                <label>Capacity</label>
                <input
                  type="text"
                  value={listingForm.venue_capacity}
                  onChange={(e) => setListingForm({ ...listingForm, venue_capacity: e.target.value })}
                  placeholder="e.g., 200 guests"
                />
              </div>

              <div className="form-group">
                <label>Address <span className="required">*</span></label>
                <input
                  type="text"
                  value={listingForm.address}
                  onChange={(e) => setListingForm({ ...listingForm, address: e.target.value })}
                  placeholder="Complete address"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={listingForm.description}
                  onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })}
                  placeholder="Describe your venue..."
                />
              </div>

              <div className="form-group">
                <label>Pricing <span className="required">*</span></label>
                <input
                  type="text"
                  value={listingForm.pricing}
                  onChange={(e) => setListingForm({ ...listingForm, pricing: e.target.value })}
                  placeholder="e.g., ₱50,000 - ₱100,000"
                  required
                />
              </div>

              <div className="form-group">
                <label>Amenities</label>
                <textarea
                  value={listingForm.venue_amenities}
                  onChange={(e) => setListingForm({ ...listingForm, venue_amenities: e.target.value })}
                  placeholder="Air conditioning, Sound system, etc."
                />
              </div>

              <div className="form-group">
                <label>Operating Hours</label>
                <input
                  type="text"
                  value={listingForm.venue_operating_hours}
                  onChange={(e) => setListingForm({ ...listingForm, venue_operating_hours: e.target.value })}
                  placeholder="e.g., 8:00 AM - 12:00 AM"
                />
              </div>

              <div className="form-group">
                <label>Parking</label>
                <input
                  type="text"
                  value={listingForm.venue_parking}
                  onChange={(e) => setListingForm({ ...listingForm, venue_parking: e.target.value })}
                  placeholder="e.g., Free parking for 100 cars"
                />
              </div>

              <div className="form-group">
                <label>Contact Email</label>
                <input
                  type="email"
                  value={listingForm.contact_email}
                  onChange={(e) => setListingForm({ ...listingForm, contact_email: e.target.value })}
                  placeholder="venue@example.com"
                />
              </div>

              {/*  LOGO IMAGE UPLOAD */}
              <div className="form-group">
                <label>
                  Venue Logo {!editingListing && <span className="required">*</span>}
                </label>
                <div 
                  className={`image-upload-box ${imagePreviews.logo ? 'has-image' : ''}`}
                  onClick={() => document.getElementById('logo-input').click()}
                >
                  <input
                    id="logo-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange('logo', e.target.files[0])}
                  />
                  {imagePreviews.logo ? (
                    <div className="image-preview">
                      <img src={imagePreviews.logo} alt="Logo preview" />
                      <p style={{ marginTop: '10px', color: '#4caf50', fontWeight: 'bold' }}>✓ Logo Selected</p>
                    </div>
                  ) : (
                    <>
                      <div className="upload-icon">📸</div>
                      <p><strong>Click to upload logo</strong></p>
                      <small>Main image for your venue (1200x800px recommended)</small>
                    </>
                  )}
                </div>
              </div>

              {/*  GALLERY IMAGES (3 INDIVIDUAL UPLOADS) */}
              <div className="form-group">
                <label>Gallery Images (up to 3 photos)</label>
                <div className="gallery-upload-grid">
                  {/* Gallery 1 */}
                  <div 
                    className={`image-upload-box ${imagePreviews.gallery_1 ? 'has-image' : ''}`}
                    onClick={() => document.getElementById('gallery-1-input').click()}
                  >
                    <input
                      id="gallery-1-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageChange('gallery_1', e.target.files[0])}
                    />
                    {imagePreviews.gallery_1 ? (
                      <div className="image-preview">
                        <img src={imagePreviews.gallery_1} alt="Gallery 1" />
                      </div>
                    ) : (
                      <>
                        <div className="upload-icon" style={{ fontSize: '30px' }}>📷</div>
                        <small>Photo 1</small>
                      </>
                    )}
                  </div>

                  {/* Gallery 2 */}
                  <div 
                    className={`image-upload-box ${imagePreviews.gallery_2 ? 'has-image' : ''}`}
                    onClick={() => document.getElementById('gallery-2-input').click()}
                  >
                    <input
                      id="gallery-2-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageChange('gallery_2', e.target.files[0])}
                    />
                    {imagePreviews.gallery_2 ? (
                      <div className="image-preview">
                        <img src={imagePreviews.gallery_2} alt="Gallery 2" />
                      </div>
                    ) : (
                      <>
                        <div className="upload-icon" style={{ fontSize: '30px' }}>📷</div>
                        <small>Photo 2</small>
                      </>
                    )}
                  </div>

                  {/* Gallery 3 */}
                  <div 
                    className={`image-upload-box ${imagePreviews.gallery_3 ? 'has-image' : ''}`}
                    onClick={() => document.getElementById('gallery-3-input').click()}
                  >
                    <input
                      id="gallery-3-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageChange('gallery_3', e.target.files[0])}
                    />
                    {imagePreviews.gallery_3 ? (
                      <div className="image-preview">
                        <img src={imagePreviews.gallery_3} alt="Gallery 3" />
                      </div>
                    ) : (
                      <>
                        <div className="upload-icon" style={{ fontSize: '30px' }}>📷</div>
                        <small>Photo 3</small>
                      </>
                    )}
                  </div>
                </div>
                <small style={{ color: '#666', fontSize: '12px', marginTop: '8px', display: 'block' }}>
                  Click each box to upload individual images showcasing your venue
                </small>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => {
                  setShowCreateListing(false);
                  resetForm();
                }} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingListing ? "💾 Update Listing" : "✨ Create Listing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CALENDAR MODAL - Manage Venue Availability */}
      {showCalendarModal && selectedVenueForCalendar && (
        <div className="modal-backdrop" style={{ zIndex: 10002 }} onClick={closeCalendarModal}>
          <div className="modal-content" style={{ maxWidth: 800 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #ddd' }}>
              <div>
                <h2 style={{ margin: 0, color: '#7a5d47' }}>📅 Manage Availability</h2>
                <p style={{ margin: '4px 0 0', fontSize: 14, color: '#666' }}>{selectedVenueForCalendar.venue_name}</p>
              </div>
              <button onClick={closeCalendarModal} className="btn btn-secondary">✕ Close</button>
            </div>

            {getUpcomingAvailability().length > 0 && (
              <div style={{ background: '#f9f9f9', padding: 16, borderRadius: 8, marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#7a5d47' }}>Upcoming Availability</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {getUpcomingAvailability().map((avail, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: avail.is_available ? '#dcfce7' : '#fee2e2',
                        border: `1px solid ${avail.is_available ? '#86efac' : '#fca5a5'}`
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{avail.is_available ? '✓' : '✕'} {formatDate(avail.date)}</span>
                      <span style={{ marginLeft: 12, fontSize: 13 }}>{avail.start_time?.substring(0, 5)} - {avail.end_time?.substring(0, 5)}</span>
                      <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600 }}>{avail.is_available ? 'Available' : 'Booked'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <button type="button" onClick={previousMonth} className="btn btn-secondary">← Previous</button>
                <h4 style={{ margin: 0 }}>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h4>
                <button type="button" onClick={nextMonth} className="btn btn-secondary">Next →</button>
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13 }}>
                <span><span style={{ display: 'inline-block', width: 14, height: 14, background: '#22c55e', borderRadius: 2, marginRight: 6 }}></span>Available</span>
                <span><span style={{ display: 'inline-block', width: 14, height: 14, background: '#ef4444', borderRadius: 2, marginRight: 6 }}></span>Booked</span>
                <span><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #3b82f6', borderRadius: 2, marginRight: 6 }}></span>Click to manage</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} style={{ textAlign: 'center', fontWeight: 600, fontSize: 12, padding: 8 }}>{d}</div>
                ))}
                {(() => {
                  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
                  const cells = [];
                  for (let i = 0; i < startingDayOfWeek; i++) cells.push(<div key={`e-${i}`} />);
                  for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(year, month, day);
                    const isPast = date < new Date().setHours(0, 0, 0, 0);
                    const availabilityData = getAvailabilityForDate(date);
                    const isAvailable = isDateAvailable(date);
                    const isBooked = isDateBooked(date);
                    const isToday = date.toDateString() === new Date().toDateString();
                    cells.push(
                      <div
                        key={day}
                        onClick={() => {
                          if (!isPast) {
                            if (availabilityData.length > 0) openAvailabilityModal(date, availabilityData[0]);
                            else openAvailabilityModal(date);
                          }
                        }}
                        style={{
                          aspectRatio: 1,
                          padding: 8,
                          borderRadius: 8,
                          border: `2px solid ${isPast ? '#ddd' : isAvailable ? '#22c55e' : isBooked ? '#ef4444' : '#e5e7eb'}`,
                          background: isPast ? '#f3f4f6' : isAvailable ? '#dcfce7' : isBooked ? '#fee2e2' : '#fff',
                          cursor: isPast ? 'not-allowed' : 'pointer',
                          opacity: isPast ? 0.6 : 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{day}</span>
                        {availabilityData.length > 0 && (
                          <span style={{ fontSize: 11 }}>{availabilityData[0].is_available ? '✓' : '✕'}</span>
                        )}
                      </div>
                    );
                  }
                  return cells;
                })()}
              </div>
              {loadingAvailability && <p style={{ textAlign: 'center', marginTop: 12, color: '#666' }}>Loading...</p>}
            </div>
          </div>
        </div>
      )}

      {/* AVAILABILITY EDIT MODAL */}
      {showAvailabilityModal && selectedDate && (
        <div className="modal-backdrop" style={{ zIndex: 10003 }} onClick={closeAvailabilityModal}>
          <div className="modal-content" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, color: '#7a5d47' }}>{editingAvailability ? 'Edit' : 'Set'} Availability</h2>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <form onSubmit={saveAvailability}>
              <div className="form-group">
                <label>Status</label>
                <div style={{ display: 'flex', gap: 24 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="radio" checked={availabilityForm.is_available === true} onChange={() => setAvailabilityForm({ ...availabilityForm, is_available: true })} />
                    Available
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="radio" checked={availabilityForm.is_available === false} onChange={() => setAvailabilityForm({ ...availabilityForm, is_available: false })} />
                    Booked/Unavailable
                  </label>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="form-group">
                <div>
                  <label>Start Time</label>
                  <input type="time" value={availabilityForm.start_time} onChange={(e) => setAvailabilityForm({ ...availabilityForm, start_time: e.target.value })} required className="form-group input" style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6 }} />
                </div>
                <div>
                  <label>End Time</label>
                  <input type="time" value={availabilityForm.end_time} onChange={(e) => setAvailabilityForm({ ...availabilityForm, end_time: e.target.value })} required className="form-group input" style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6 }} />
                </div>
              </div>
              <div className="form-group">
                <label>Notes (optional)</label>
                <input type="text" value={availabilityForm.notes} onChange={(e) => setAvailabilityForm({ ...availabilityForm, notes: e.target.value })} placeholder="e.g. Blocked for private event" style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6 }} />
              </div>
              <div className="modal-actions" style={{ marginTop: 20 }}>
                {editingAvailability && (
                  <button type="button" onClick={() => deleteAvailability(editingAvailability.id)} className="btn btn-danger" style={{ marginRight: 'auto' }}>
                    Delete
                  </button>
                )}
                <button type="button" onClick={closeAvailabilityModal} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingAvailability}>
                  {savingAvailability ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
import { useEffect, useRef, useState } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import Chart from "chart.js/auto";
import toast from "../utils/toast";
import "../style.css";

const API = 
  import.meta.env.VITE_API_BASE || 
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD 
    ? "https://solennia.up.railway.app/api" : "/api");

export default function VendorDashboard() {
  const token = localStorage.getItem("solennia_token");
  const navigate = useNavigate();

  // Status tracking
  const [loading, setLoading] = useState(true);

  // Dashboard data
  const [vendor, setVendor] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [gallery, setGallery] = useState([]);

  // Modals
  const [showEdit, setShowEdit] = useState(false);
  const [showHero, setShowHero] = useState(false);
  const [showLogo, setShowLogo] = useState(false);

  // Edit form
  const [form, setForm] = useState({
    bio: "",
    services: "",
    service_areas: "",
  });

  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  /* ================= SAFE FETCH ================= */
  async function safeFetch(url, opts = {}) {
    const headers = opts.headers || {};
    if (!opts.body || opts.body instanceof FormData) {
      // Don't add Content-Type for FormData
    } else {
      headers["Content-Type"] = "application/json";
    }
    headers["Authorization"] = `Bearer ${token}`;
    
    const res = await fetch(url, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) throw new Error(data.error || data.message || "Error");
    return data;
  }

  /* ================= ✅ FIXED: LOAD DASHBOARD DIRECTLY ================= */
  useEffect(() => {
    async function init() {
      if (!token) {
        navigate("/");
        return;
      }

      try {
        await loadDashboard();
        setLoading(false);
      } catch (err) {
        console.error("Failed to load vendor dashboard:", err);
        toast.error("Failed to load dashboard");
        setLoading(false);
      }
    }

    init();

    return () => chartInstance.current?.destroy();
  }, [token, navigate]);

  /* ================= ✅ FIXED: LOAD DASHBOARD & BOOKINGS ================= */
  async function loadDashboard() {
    try {
      // Load vendor dashboard
      const dashData = await safeFetch(`${API}/vendor/dashboard`);
      console.log("Dashboard data:", dashData);
      
      setVendor(dashData.vendor);
      setGallery(dashData.gallery || []);

      // ✅ NEW: Load vendor bookings
      const bookingsData = await safeFetch(`${API}/bookings/vendor`);
      console.log("Bookings data:", bookingsData);
      
      if (bookingsData.success && bookingsData.bookings) {
        setBookings(bookingsData.bookings);
      }

      // Chart (if available)
      if (dashData.insights && chartRef.current) {
        chartInstance.current?.destroy();
        
        try {
          chartInstance.current = new Chart(chartRef.current, {
            type: "line",
            data: dashData.insights || { labels: [], datasets: [] },
          });
        } catch (e) {
          console.error("Chart error:", e);
        }
      }
    } catch (err) {
      console.error("Load dashboard error:", err);
      toast.error(err.message);
    }
  }

  /* ================= EDIT PROFILE ================= */
  function openEdit() {
    setForm({
      bio: vendor.bio || "",
      services: Array.isArray(vendor.services)
        ? vendor.services.join(", ")
        : vendor.services || "",
      service_areas: Array.isArray(vendor.service_areas)
        ? vendor.service_areas.join(", ")
        : vendor.service_areas || "",
    });
    setShowEdit(true);
  }

  async function submitEdit(e) {
    e.preventDefault();
    
    try {
      await safeFetch(`${API}/vendor/info`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      
      setShowEdit(false);
      loadDashboard();
      toast.success("Profile updated!");
    } catch (err) {
      toast.error(err.message);
    }
  }

  /* ================= UPLOAD HANDLERS ================= */
  async function uploadHero(file) {
    const fd = new FormData();
    fd.append("hero", file);
    
    try {
      await safeFetch(`${API}/vendor/hero`, { 
        method: "POST", 
        body: fd 
      });
      
      setShowHero(false);
      loadDashboard();
      toast.success("Hero image uploaded!");
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function uploadLogo(file) {
    const fd = new FormData();
    fd.append("logo", file);
    
    try {
      await safeFetch(`${API}/vendor/logo`, { 
        method: "POST", 
        body: fd 
      });
      
      setShowLogo(false);
      loadDashboard();
      toast.success("Logo uploaded!");
    } catch (err) {
      toast.error(err.message);
    }
  }

  /* ================= UPLOAD GALLERY ================= */
  async function uploadGallery(files) {
    if (files.length > 10) {
      toast.error("Maximum 10 images per upload");
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    for (let file of files) {
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large. Maximum size is 10MB.`);
        return;
      }
    }

    const fd = new FormData();
    Array.from(files).forEach((f) => {
      fd.append("gallery[]", f);
    });
    
    try {
      toast.info(`Uploading ${files.length} image(s)...`);
      
      const result = await safeFetch(`${API}/vendor/gallery`, {
        method: "POST",
        body: fd,
      });
      
      loadDashboard();
      
      if (result.errors && result.errors.length > 0) {
        toast.warning(`${result.images?.length || 0} image(s) uploaded. ${result.errors.length} failed.`);
      } else {
        toast.success(`Gallery updated! ${result.images?.length || 0} image(s) uploaded.`);
      }
    } catch (err) {
      toast.error(err.message);
    }
  }

  /* ================= ✅ NEW: BOOKING STATUS BADGE ================= */
  const getStatusBadge = (status) => {
    const statusMap = {
      'Pending': 'background: #fef3c7; color: #92400e; border: 1px solid #fbbf24',
      'Confirmed': 'background: #d1fae5; color: #065f46; border: 1px solid #10b981',
      'Rejected': 'background: #fee2e2; color: #991b1b; border: 1px solid #ef4444',
      'Cancelled': 'background: #f3f4f6; color: #374151; border: 1px solid #9ca3af',
      'Completed': 'background: #dbeafe; color: #1e40af; border: 1px solid #3b82f6',
    };
    
    return statusMap[status] || statusMap['Pending'];
  };

  /* ================= LOADING STATE ================= */
  if (loading) {
    return (
      <div className="vendor-dashboard" style={{ textAlign: "center", padding: "100px 20px" }}>
        <div style={{ display: "inline-block", width: "50px", height: "50px", border: "5px solid #f3f3f3", borderTop: "5px solid #7a5d47", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <h2 style={{ marginTop: "20px", color: "#7a5d47" }}>Loading dashboard...</h2>
      </div>
    );
  }

  /* ================= MAIN DASHBOARD ================= */
  if (!vendor) {
    return (
      <div className="vendor-dashboard" style={{ textAlign: "center", padding: "100px 20px" }}>
        <h2>Vendor profile not found</h2>
        <p>Please make sure you're logged in as an approved vendor.</p>
        <button 
          onClick={() => navigate("/profile")}
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            background: "#7a5d47",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          Go to Profile
        </button>
      </div>
    );
  }

  return (
    <div className="vendor-dashboard">
      <style>{`
        .vendor-dashboard {
          max-width: 1200px;
          margin: 80px auto 40px;
          padding: 20px;
        }
        .vendor-dashboard h2 {
          color: #7a5d47;
          margin-bottom: 20px;
        }
        .profile-card {
          background: white;
          padding: 30px;
          border-radius: 12px;
          margin-bottom: 30px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .profile-header {
          display: flex;
          gap: 30px;
          align-items: start;
        }
        .profile-logo {
          width: 120px;
          height: 120px;
          border-radius: 12px;
          object-fit: cover;
          border: 3px solid #7a5d47;
        }
        .profile-info {
          flex: 1;
        }
        .profile-info h3 {
          margin: 0 0 15px 0;
          color: #7a5d47;
          font-size: 28px;
        }
        .profile-info p {
          margin: 8px 0;
          color: #666;
        }
        .profile-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
          flex-wrap: wrap;
        }
        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }
        .btn-primary {
          background: #7a5d47;
          color: white;
        }
        .btn-primary:hover {
          background: #5d4436;
        }
        .btn-secondary {
          background: #e5e5e5;
          color: #333;
        }
        .btn-secondary:hover {
          background: #d0d0d0;
        }
        .bookings-section {
          background: white;
          padding: 30px;
          border-radius: 12px;
          margin-bottom: 30px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .booking-card {
          background: #f9fafb;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 15px;
          border: 1px solid #e5e7eb;
        }
        .booking-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 15px;
        }
        .booking-title {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          margin: 0 0 5px 0;
        }
        .booking-client {
          font-size: 14px;
          color: #6b7280;
        }
        .status-badge {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .booking-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
          font-size: 14px;
        }
        .booking-detail {
          display: flex;
          flex-direction: column;
        }
        .booking-label {
          color: #6b7280;
          font-size: 12px;
          margin-bottom: 4px;
        }
        .booking-value {
          color: #1f2937;
          font-weight: 500;
        }
        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 15px;
          margin-top: 20px;
        }
        .gallery-item {
          aspect-ratio: 1;
          border-radius: 8px;
          overflow: hidden;
        }
        .gallery-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
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
        }
        .modal-content {
          background: white;
          padding: 30px;
          border-radius: 12px;
          max-width: 500px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-content h3 {
          margin-top: 0;
          color: #7a5d47;
        }
        .modal-content form {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        .modal-content label {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .modal-content input,
        .modal-content textarea {
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-family: inherit;
        }
        .modal-content textarea {
          min-height: 100px;
          resize: vertical;
        }
        .modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 20px;
        }
      `}</style>

      {/* Profile Card */}
      <div className="profile-card">
        <div className="profile-header">
          <img 
            src={vendor.portfolio || "/default-logo.png"} 
            alt="Business Logo"
            className="profile-logo"
          />
          <div className="profile-info">
            <h3>{vendor.business_name}</h3>
            <p><strong>Category:</strong> {vendor.category}</p>
            <p><strong>Email:</strong> {vendor.contact_email}</p>
            <p><strong>Address:</strong> {vendor.address}</p>
            
            <div className="profile-actions">
              <button onClick={openEdit} className="btn btn-primary">
                Edit Profile Info
              </button>
              <button onClick={() => setShowLogo(true)} className="btn btn-secondary">
                Update Logo
              </button>
              <button onClick={() => setShowHero(true)} className="btn btn-secondary">
                Update Hero Image
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ NEW: Bookings Section */}
      <div className="bookings-section">
        <h2>Booking Requests ({bookings.length})</h2>
        
        {bookings.length === 0 ? (
          <p style={{ color: "#6b7280", textAlign: "center", padding: "40px 0" }}>
            No booking requests yet. Bookings will appear here when clients book your services.
          </p>
        ) : (
          <>
            {bookings.map((booking) => (
              <div key={booking.ID} className="booking-card">
                <div className="booking-header">
                  <div>
                    <h3 className="booking-title">{booking.ServiceName}</h3>
                    <p className="booking-client">Client: {booking.client_name}</p>
                  </div>
                  <span 
                    className="status-badge" 
                    style={getStatusBadge(booking.BookingStatus)}
                  >
                    {booking.BookingStatus}
                  </span>
                </div>
                
                <div className="booking-details">
                  <div className="booking-detail">
                    <span className="booking-label">Event Date</span>
                    <span className="booking-value">
                      {new Date(booking.EventDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="booking-detail">
                    <span className="booking-label">Event Type</span>
                    <span className="booking-value">{booking.EventType}</span>
                  </div>
                  <div className="booking-detail">
                    <span className="booking-label">Venue</span>
                    <span className="booking-value">{booking.Venue}</span>
                  </div>
                  <div className="booking-detail">
                    <span className="booking-label">Guests</span>
                    <span className="booking-value">{booking.NumberOfGuests}</span>
                  </div>
                </div>

                {booking.SpecialRequests && (
                  <div style={{ marginTop: "15px", paddingTop: "15px", borderTop: "1px solid #e5e7eb" }}>
                    <span className="booking-label">Special Requests:</span>
                    <p style={{ margin: "5px 0 0 0", color: "#374151" }}>{booking.SpecialRequests}</p>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Gallery */}
      <h2>Gallery ({gallery.length} images)</h2>
      <button 
        onClick={() => document.getElementById("gallery-input").click()} 
        className="btn btn-primary"
        style={{ marginBottom: "20px" }}
      >
        Add Images to Gallery
      </button>
      <input
        id="gallery-input"
        type="file"
        multiple
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            uploadGallery(e.target.files);
          }
        }}
      />
      
      {gallery && gallery.length > 0 ? (
        <div className="gallery-grid">
          {gallery.map((img, i) => (
            <div key={i} className="gallery-item">
              <img src={img} alt={`Gallery ${i + 1}`} />
            </div>
          ))}
        </div>
      ) : (
        <p>No gallery images yet. Add some to showcase your work!</p>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <div className="modal-backdrop" onClick={() => setShowEdit(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Profile Information</h3>
            <form onSubmit={submitEdit}>
              <label>
                Bio
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Tell clients about your business..."
                />
              </label>
              
              <label>
                Services
                <textarea
                  value={form.services}
                  onChange={(e) => setForm({ ...form, services: e.target.value })}
                  placeholder="List your services..."
                />
              </label>
              
              <label>
                Service Areas
                <input
                  type="text"
                  value={form.service_areas}
                  onChange={(e) => setForm({ ...form, service_areas: e.target.value })}
                  placeholder="Where do you serve?"
                />
              </label>
              
              <div className="modal-actions">
                <button type="button" onClick={() => setShowEdit(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logo Modal */}
      {showLogo && (
        <div className="modal-backdrop" onClick={() => setShowLogo(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Update Business Logo</h3>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files[0]) {
                  uploadLogo(e.target.files[0]);
                }
              }}
            />
            <div className="modal-actions">
              <button onClick={() => setShowLogo(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Modal */}
      {showHero && (
        <div className="modal-backdrop" onClick={() => setShowHero(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Update Hero Image</h3>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files[0]) {
                  uploadHero(e.target.files[0]);
                }
              }}
            />
            <div className="modal-actions">
              <button onClick={() => setShowHero(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
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
  const [error, setError] = useState(null); // ✅ Added error state

  // Dashboard data
  const [vendor, setVendor] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [gallery, setGallery] = useState([]);

  // Modals
  const [showEdit, setShowEdit] = useState(false);
  const [showHero, setShowHero] = useState(false);
  const [showLogo, setShowLogo] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null); // For gallery lightbox
  const [isUploading, setIsUploading] = useState({ logo: false, hero: false, gallery: false });

  // Edit form
  const [form, setForm] = useState({
    bio: "",
    services: "",
    service_areas: "",
    address: "", // ✅ Added address field
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

    try {
      const res = await fetch(url, { ...opts, headers });

      // Handle HTML or non-JSON responses gracefully
      const contentType = res.headers.get("content-type");
      let data = {};

      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await res.json().catch(() => ({}));
      } else {
        // If not JSON, probably an error page or 404
        if (!res.ok) throw new Error(`Server returned ${res.status} ${res.statusText}`);
      }

      // Check if profile setup is needed
      if (!res.ok && data.needs_setup) {
        navigate("/vendor-profile-setup");
        return null; // Return null to indicate handled
      }

      if (!res.ok) throw new Error(data.error || data.message || `Error ${res.status}`);
      return data;
    } catch (err) {
      console.error("Fetch error:", err);
      throw err;
    }
  }

  /* ================= CLOUDINARY SIGNED UPLOADS ================= */
  async function uploadToCloudinary(file, fileType) {
    if (!token) throw new Error("User not authenticated");
    try {
      const sigRes = await fetch(`${API}/vendor/get-upload-signature`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ file_type: fileType })
      });
      if (!sigRes.ok) throw new Error("Failed to get upload signature");
      const { upload_url, params } = await sigRes.json();

      const fd = new FormData();
      fd.append("file", file);
      Object.entries(params).forEach(([k, v]) => fd.append(k, v));

      const upRes = await fetch(upload_url, { method: "POST", body: fd });
      if (!upRes.ok) throw new Error("Cloudinary upload failed");

      const upData = await upRes.json();
      return upData.secure_url;
    } catch (err) {
      console.error(`Cloudinary upload error (${fileType}):`, err);
      throw err;
    }
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
        setError(err.message || "Failed to load dashboard");
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

      // If safeFetch return null (redirected), stop
      if (!dashData && dashData !== 0) return; // (check falsy but not 0 just in case)

      console.log("Dashboard data:", dashData);

      if (!dashData.vendor) {
        // If we got success=false but no specific error thrown, throw now
        throw new Error("Local vendor profile missing");
      }

      setVendor(dashData.vendor);
      setGallery(Array.isArray(dashData.gallery) ? dashData.gallery : []);

      // ✅ NEW: Load vendor bookings - handle error gracefully
      try {
        const bookingsData = await safeFetch(`${API}/bookings/vendor`);
        console.log("Bookings data:", bookingsData);

        if (bookingsData && bookingsData.success && Array.isArray(bookingsData.bookings)) {
          setBookings(bookingsData.bookings);
        } else {
          console.warn("Bookings format invalid:", bookingsData);
          setBookings([]);
        }
      } catch (e) {
        console.warn("Failed to load bookings:", e);
        // Don't crash dashboard if bookings fail
        setBookings([]);
      }

      // Chart (if available) - Defer to next tick to ensure canvas is rendered
      setTimeout(() => {
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
      }, 100);

    } catch (err) {
      console.error("Load dashboard error:", err);
      if (err.message.includes("Local vendor profile missing")) {
        // Handled in render by setVendor(null) which is default
        setVendor(null);
      } else {
        throw err;
      }
    }
  }

  /* ================= EDIT PROFILE ================= */
  function openEdit() {
    if (!vendor) return;
    setForm({
      bio: vendor.bio || "",
      services: (vendor.services && typeof vendor.services === 'string') ? vendor.services : (Array.isArray(vendor.services) ? vendor.services.join(", ") : ""),
      service_areas: (vendor.service_areas && typeof vendor.service_areas === 'string') ? vendor.service_areas : (Array.isArray(vendor.service_areas) ? vendor.service_areas.join(", ") : ""),
      address: vendor.BusinessAddress || "", // ✅ Added address
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
    try {
      setIsUploading(prev => ({ ...prev, hero: true }));
      toast.info("Uploading banner...");
      const url = await uploadToCloudinary(file, "hero");
      await safeFetch(`${API}/vendor/hero`, {
        method: "POST",
        body: JSON.stringify({ hero_url: url })
      });
      setShowHero(false);
      loadDashboard();
      toast.success("Banner updated! 🖼️");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsUploading(prev => ({ ...prev, hero: false }));
    }
  }

  async function uploadLogo(file) {
    try {
      setIsUploading(prev => ({ ...prev, logo: true }));
      toast.info("Uploading logo...");
      const url = await uploadToCloudinary(file, "logo");
      await safeFetch(`${API}/vendor/logo`, {
        method: "POST",
        body: JSON.stringify({ logo_url: url })
      });
      setShowLogo(false);
      loadDashboard();
      toast.success("Logo updated! 🎉");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsUploading(prev => ({ ...prev, logo: false }));
    }
  }

  /* ================= UPLOAD GALLERY ================= */
  async function uploadGallery(files) {
    const fileList = Array.from(files);
    if (fileList.length > 10) {
      toast.error("Maximum 10 images at once");
      return;
    }

    try {
      setIsUploading(prev => ({ ...prev, gallery: true }));
      toast.info(`Uploading ${fileList.length} images...`);

      const urls = await Promise.all(
        fileList.map(file => uploadToCloudinary(file, "gallery"))
      );

      await safeFetch(`${API}/vendor/gallery`, {
        method: "POST",
        body: JSON.stringify({ gallery_urls: urls })
      });

      loadDashboard();
      toast.success("Gallery updated! 📸");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsUploading(prev => ({ ...prev, gallery: false }));
    }
  }

  function handleGalleryUpload(e) {
    if (e.target.files && e.target.files.length > 0) {
      uploadGallery(e.target.files);
    }
  }

  function handleLogoUpload(e) {
    if (e.target.files && e.target.files[0]) {
      uploadLogo(e.target.files[0]);
    }
  }

  function handleHeroUpload(e) {
    if (e.target.files && e.target.files[0]) {
      uploadHero(e.target.files[0]);
    }
  }

  /* ================= ✅ NEW: BOOKING STATUS BADGE ================= */
  const getStatusBadge = (status) => {
    const statusMap = {
      'Pending': { background: '#fef3c7', color: '#92400e', border: '1px solid #fbbf24' },
      'Confirmed': { background: '#d1fae5', color: '#065f46', border: '1px solid #10b981' },
      'Rejected': { background: '#fee2e2', color: '#991b1b', border: '1px solid #ef4444' },
      'Cancelled': { background: '#f3f4f6', color: '#374151', border: '1px solid #9ca3af' },
      'Completed': { background: '#dbeafe', color: '#1e40af', border: '1px solid #3b82f6' },
    };

    return statusMap[status] || statusMap['Pending'];
  };

  /* ================= LOADING STATE ================= */
  if (loading) {
    return (
      <div className="vendor-dashboard-loading" style={{ textAlign: "center", padding: "100px 20px" }}>
        <div className="spinner"></div>
        <h2 style={{ marginTop: "20px", color: "#7a5d47" }}>Synchronizing Dashboard...</h2>
        <style>{`
          .vendor-dashboard-loading { min-height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .spinner { width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #7a5d47; border-radius: 50%; animation: spin 1s linear infinite; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  /* ================= ERROR STATE ================= */
  if (error) {
    return (
      <div className="vendor-dashboard-error" style={{ textAlign: "center", padding: "100px 20px", color: "#333", background: "white", borderRadius: "20px", margin: "40px auto", maxWidth: "600px", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}>
        <h2 style={{ color: "#ef4444", marginBottom: "15px" }}>Unable to load dashboard</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ marginTop: "20px", background: "#7a5d47", color: "white", padding: "10px 20px", border: "none", borderRadius: "8px", cursor: "pointer" }}>
          Retry
        </button>
      </div>
    );
  }

  /* ================= EMPTY STATE (NO VENDOR PROFILE) ================= */
  if (!vendor) {
    return (
      <div className="vendor-dashboard-empty" style={{ textAlign: "center", padding: "100px 20px", background: "white", borderRadius: "20px", margin: "40px auto", maxWidth: "600px" }}>
        <h2 style={{ color: "#7a5d47" }}>Supplier profile not found</h2>
        <p style={{ margin: "15px 0", color: "#666" }}>We couldn't find your supplier profile details.</p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button onClick={() => navigate("/profile")} className="btn btn-secondary" style={{ padding: "10px 20px", cursor: "pointer", background: '#f3f0ec', border: "none", borderRadius: "8px" }}>
            My Profile
          </button>
          <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ padding: "10px 20px", background: "#7a5d47", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ================= MAIN DASHBOARD ================= */
  return (
    <div className="vendor-dashboard">
      <style>{`
        .vendor-dashboard { max-width: 1200px; margin: 80px auto 40px; padding: 20px; font-family: 'Outfit', 'Inter', sans-serif; }
        .dashboard-header { margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
        .dashboard-header h1 { color: #5d4436; font-size: 32px; font-weight: 800; margin: 0; }
        
        .profile-card { background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05); margin-bottom: 30px; border: 1px solid #f0f0f0; }
        .hero-banner { height: 260px; background: #7a5d47; position: relative; overflow: hidden; }
        .hero-banner img { width: 100%; height: 100%; object-fit: cover; }
        .hero-overlay { position: absolute; top: 15px; right: 15px; z-index: 10; }
        
        .profile-content { padding: 0 30px 40px; position: relative; margin-top: -80px; z-index: 20; }
        .profile-main { display: flex; gap: 25px; align-items: flex-end; }
        .profile-logo-container { position: relative; z-index: 20; }
        .profile-logo { width: 160px; height: 160px; border-radius: 30px; border: 6px solid white; box-shadow: 0 10px 25px rgba(0,0,0,0.1); object-fit: cover; background: white; }
        .profile-basics { padding-bottom: 5px; }
        .profile-basics h3 { font-size: 32px; color: #2d2d2d; margin: 0 0 8px 0; font-weight: 800; text-shadow: 0 2px 10px rgba(255,255,255,0.8); }
        .category-tag { background: #f3f0ec; color: #7a5d47; padding: 5px 15px; border-radius: 25px; font-size: 14px; font-weight: 700; display: inline-block; }
        
        .profile-details-grid { margin-top: 35px; display: grid; grid-template-columns: 2fr 1fr; gap: 40px; }
        .detail-card { background: #fafafa; border-radius: 16px; padding: 25px; border: 1px solid #f0f0f0; }
        .detail-item { margin-bottom: 25px; }
        .detail-item:last-child { margin-bottom: 0; }
        .detail-label { font-size: 11px; color: #a1a1a1; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800; margin-bottom: 8px; display: block; }
        .detail-value { color: #333; line-height: 1.7; font-size: 15px; }
        
        .profile-actions { display: flex; gap: 12px; margin-top: 35px; padding-top: 30px; border-top: 1px solid #f0f0f0; flex-wrap: wrap; }
        
        .section-title { font-size: 24px; color: #5d4436; margin: 50px 0 25px; font-weight: 800; display: flex; align-items: center; gap: 12px; }
        
        .bookings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 25px; }
        .booking-card { background: white; border-radius: 20px; padding: 25px; border: 1px solid #f0f0f0; transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1); box-shadow: 0 4px 15px rgba(0,0,0,0.02); }
        .booking-card:hover { transform: translateY(-5px); box-shadow: 0 15px 35px rgba(0,0,0,0.08); }
        .booking-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .booking-client-info h4 { margin: 0; color: #2d2d2d; font-size: 19px; font-weight: 700; }
        .booking-client-info p { margin: 4px 0 0 0; color: #999; font-size: 14px; }
        .booking-mid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; padding: 20px; background: #fbfbfb; border-radius: 16px; border: 1px solid #f5f5f5; }
        
        .gallery-section { margin-top: 60px; }
        .gallery-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }
        .gallery-item { aspect-ratio: 1; border-radius: 20px; overflow: hidden; position: relative; cursor: zoom-in; box-shadow: 0 8px 20px rgba(0,0,0,0.04); transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1); background: #eee; }
        .gallery-item:hover { transform: scale(1.04); box-shadow: 0 15px 40px rgba(0,0,0,0.15); z-index: 10; }
        .gallery-item img { width: 100%; height: 100%; object-fit: cover; }
        
        .btn { padding: 12px 24px; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.25s; font-size: 14px; display: flex; align-items: center; gap: 10px; }
        .btn-primary { background: #7a5d47; color: white; box-shadow: 0 4px 15px rgba(122, 93, 71, 0.3); }
        .btn-primary:hover { background: #5d4436; transform: translateY(-2px); box-shadow: 0 8px 25px rgba(122, 93, 71, 0.4); }
        .btn-primary:active { transform: translateY(0); }
        .btn-secondary { background: #f3f0ec; color: #7a5d47; }
        .btn-secondary:hover { background: #e8e2db; transform: translateY(-1px); }
        .btn-ghost { background: rgba(255,255,255,0.2); color: white; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3); }
        .btn-ghost:hover { background: rgba(255,255,255,0.4); }
        
        .status-badge { padding: 6px 14px; border-radius: 30px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }

        /* Modal styling */
        .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(20, 15, 10, 0.7); display: flex; justify-content: center; align-items: center; z-index: 3000; backdrop-filter: blur(8px); animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        .modal-content { background: white; padding: 40px; border-radius: 32px; max-width: 600px; width: 95%; box-shadow: 0 30px 60px rgba(0,0,0,0.3); animation: slideUp 0.4s cubic-bezier(0.165, 0.84, 0.44, 1); }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        
        .upload-zone { border: 2px dashed #e0e0e0; border-radius: 24px; padding: 60px 40px; text-align: center; cursor: pointer; transition: all 0.3s; background: #fafafa; display: block; }
        .upload-zone:hover { border-color: #7a5d47; background: #fff; transform: scale(1.02); }
        .upload-icon { font-size: 48px; margin-bottom: 20px; }
        .upload-text h4 { margin: 0 0 8px 0; color: #333; font-size: 18px; }
        .upload-text p { margin: 0; color: #888; font-size: 14px; }
        
        .spinner { width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #7a5d47; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>

      {/* Profile Card */}
      <div className="profile-card">
        <div className="hero-banner">
          <img src={vendor.HeroImageUrl || "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&q=80"} alt="Banner" onError={(e) => e.target.src = "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&q=80"} />
          <div className="hero-overlay">
            <button onClick={() => setShowHero(true)} className="btn btn-ghost">
              <span>📷</span> Update Banner
            </button>
          </div>
        </div>

        <div className="profile-content">
          <div className="profile-main">
            <div className="profile-logo-container">
              <img src={vendor.avatar || "/default-logo.png"} alt="Logo" className="profile-logo" onError={(e) => e.target.src = "/default-logo.png"} />
              <button
                onClick={() => setShowLogo(true)}
                style={{ position: 'absolute', bottom: '15px', right: '15px', width: '42px', height: '42px', borderRadius: '50%', background: '#7a5d47', color: 'white', border: '4px solid white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 15px rgba(0,0,0,0.2)', transition: 'all 0.3s' }}
                onMouseOver={(e) => e.target.style.transform = 'scale(1.1)'}
                onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
              >
                ✏️
              </button>
            </div>
            <div className="profile-basics">
              <h3>{vendor.BusinessName || "Your Business"}</h3>
              <span className="category-tag">{vendor.Category || "Vendor"}</span>
            </div>
          </div>

          <div className="profile-details-grid">
            <div className="left-side">
              <div className="detail-item">
                <span className="detail-label">Business Bio</span>
                <p className="detail-value">{vendor.bio || "Crafting experiences and memories. Add your business bio to tell clients your story."}</p>
              </div>
              <div className="detail-item">
                <span className="detail-label">Services</span>
                <p className="detail-value">{vendor.services || "List the specific services you specialize in."}</p>
              </div>
            </div>
            <div className="right-side">
              <div className="detail-card">
                <div className="detail-item">
                  <span className="detail-label">Coverage</span>
                  <p className="detail-value">{vendor.service_areas || "Locations not set"}</p>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Address</span>
                  <p className="detail-value">{vendor.BusinessAddress || "No address provided"}</p>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Primary Contact</span>
                  <p className="detail-value" style={{ fontWeight: 600 }}>{vendor.BusinessEmail || vendor.email}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="profile-actions">
            <button onClick={openEdit} className="btn btn-primary">
              <span>📝</span> Profile Settings
            </button>
            <button onClick={() => setShowLogo(true)} className="btn btn-secondary">
              <span>🖼️</span> Update Logo
            </button>
            <button onClick={() => setShowHero(true)} className="btn btn-secondary">
              <span>🌄</span> Update Hero
            </button>
          </div>
        </div>
      </div>

      {/* Performance Insights Section */}
      <h2 className="section-title"><span>📊</span> Performance Insights</h2>
      <div className="insights-card" style={{ background: 'white', padding: '30px', borderRadius: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', marginBottom: '40px', border: '1px solid #f0f0f0' }}>
        <div className="chart-container" style={{ position: 'relative', height: '300px', width: '100%' }}>
          <canvas ref={chartRef}></canvas>
        </div>
      </div>

      {/* Bookings */}
      <h2 className="section-title"><span>🗓️</span> Booking Requests</h2>
      <div className="bookings-section">
        {!Array.isArray(bookings) || bookings.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '25px', padding: '60px', textAlign: 'center', border: '1px dashed #e0e0e0', color: '#888' }}>
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>🍃</div>
            <p>Your booking calendar is currently quiet. Good things take time!</p>
          </div>
        ) : (
          <div className="bookings-grid">
            {bookings.slice(0, 6).map((b) => (
              <div key={b.ID || Math.random()} className="booking-card">
                <div className="booking-top">
                  <div className="booking-client-info">
                    <h4>{b.ServiceName || "Service"}</h4>
                    <p>Client: {b.client_name || "Unknown"}</p>
                  </div>
                  {b.BookingStatus && (
                    <span className="status-badge" style={getStatusBadge(b.BookingStatus)}>
                      {b.BookingStatus}
                    </span>
                  )}
                </div>
                <div className="booking-mid">
                  <div className="b-item">
                    <span className="detail-label">Event Date</span>
                    <span className="detail-value" style={{ fontWeight: 700 }}>
                      {b.EventDate ? new Date(b.EventDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "TBD"}
                    </span>
                  </div>
                  <div className="b-item">
                    <span className="detail-label">Event Type</span>
                    <span className="detail-value">{b.EventType || "Event"}</span>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/vendor-bookings")}
                  className="btn btn-ghost"
                  style={{ width: '100%', color: '#7a5d47', border: '1px solid #7a5d47' }}
                >
                  Manage Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gallery Section */}
      <div className="gallery-section">
        <div className="gallery-header">
          <h2 className="section-title" style={{ margin: 0 }}><span>📸</span> Gallery</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => document.getElementById('gallery-input').click()}
              className="btn btn-primary"
              disabled={isUploading.gallery}
            >
              {isUploading.gallery ? "Processing..." : "✨ Upload Services"}
            </button>
          </div>
        </div>

        <input id="gallery-input" type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={handleGalleryUpload} />

        {gallery.length > 0 ? (
          <div className="gallery-grid">
            {gallery.map((img, i) => (
              <div key={i} className="gallery-item" onClick={() => setLightboxImage(img)}>
                <img src={img} alt="Portfolio" loading="lazy" onError={(e) => e.target.style.display = 'none'} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '25px', padding: '60px', textAlign: 'center', border: '1px dashed #e0e0e0', color: '#888' }}>
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>🖼️</div>
            <p>Ready to shine? Upload your best work to showcase your talent!</p>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showEdit && (
        <div className="modal-backdrop" onClick={() => setShowEdit(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Refine Your Profile</h3></div>
            <form onSubmit={submitEdit}>
              <div className="form-group">
                <label>Professional Bio</label>
                <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Shared with clients..." />
              </div>
              <div className="form-group">
                <label>Services Offered</label>
                <textarea value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} placeholder="E.g. Full catering, Lighting, etc." />
              </div>
              <div className="form-group">
                <label>Operational Areas</label>
                <input type="text" value={form.service_areas} onChange={(e) => setForm({ ...form, service_areas: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Business Address</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowEdit(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLogo && (
        <div className="modal-backdrop" onClick={() => setShowLogo(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Identify Your Brand</h3></div>
            <div className="upload-section">
              <input type="file" id="logo-file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} disabled={isUploading.logo} />
              <label htmlFor="logo-file" className="upload-zone">
                {isUploading.logo ? <div className="spinner"></div> : <div className="upload-icon">🏛️</div>}
                <div className="upload-text">
                  <h4>{isUploading.logo ? "Uploading..." : "Click to select logo"}</h4>
                  <p>Recommended: High-quality PNG or JPG</p>
                </div>
              </label>
            </div>
            <div className="modal-actions"><button onClick={() => setShowLogo(false)} className="btn btn-secondary">Close</button></div>
          </div>
        </div>
      )}

      {showHero && (
        <div className="modal-backdrop" onClick={() => setShowHero(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Captivate Your Audience</h3></div>
            <div className="upload-section">
              <input type="file" id="hero-file" accept="image/*" style={{ display: 'none' }} onChange={handleHeroUpload} disabled={isUploading.hero} />
              <label htmlFor="hero-file" className="upload-zone">
                {isUploading.hero ? <div className="spinner"></div> : <div className="upload-icon">🌅</div>}
                <div className="upload-text">
                  <h4>{isUploading.hero ? "Creating Magic..." : "Choose spectacular banner"}</h4>
                  <p>Best for landscape shots (16:9)</p>
                </div>
              </label>
            </div>
            <div className="modal-actions"><button onClick={() => setShowHero(false)} className="btn btn-secondary">Close</button></div>
          </div>
        </div>
      )}

      {lightboxImage && (
        <div className="modal-backdrop" onClick={() => setLightboxImage(null)} style={{ background: 'rgba(0,0,0,0.95)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
            <img src={lightboxImage} alt="Fullscreen" style={{ maxWidth: '95vw', maxHeight: 'max-content', borderRadius: '15px', boxShadow: '0 0 50px rgba(0,0,0,0.5)' }} />
            <button onClick={() => setLightboxImage(null)} style={{ position: 'absolute', top: '10px', right: '10px', width: '40px', height: '40px', borderRadius: '50%', background: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
          </div>
        </div>
      )}
    </div>
  );
}
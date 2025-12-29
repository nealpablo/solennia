import { useEffect, useRef, useState } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import Chart from "chart.js/auto";
import toast from "../utils/toast";
import "../style.css";

const API = "/api";

export default function VendorDashboard() {
  const token = localStorage.getItem("solennia_token");
  const navigate = useNavigate();

  // Status tracking
  const [vendorStatus, setVendorStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  // Dashboard data
  const [vendor, setVendor] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [gallery, setGallery] = useState([]);

  // Modals
  const [showEdit, setShowEdit] = useState(false);
  const [showHero, setShowHero] = useState(false);
  const [showLogo, setShowLogo] = useState(false);

  // Profile setup form
  const [setupForm, setSetupForm] = useState({
    bio: "",
    services: "",
    service_areas: "",
    logo: null,
    hero: null,
  });
  const [submittingSetup, setSubmittingSetup] = useState(false);

  // Edit form
  const [form, setForm] = useState({
    business_name: "",
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

  /* ================= ✅ NEW: CHECK VENDOR STATUS ================= */
  useEffect(() => {
    async function checkStatus() {
      try {
        const data = await safeFetch(`${API}/vendor/status`);
        
        setVendorStatus(data);

        // Check if this is a venue vendor
        if (data.category && data.category.toLowerCase() === "venue") {
          navigate("/venue-dashboard");
          return;
        }

        // ✅ NEW: Check if needs profile setup
        if (data.needs_setup) {
          setNeedsSetup(true);
          setLoading(false);
          return;
        }

        // ✅ Check if has profile
        if (data.has_profile) {
          setNeedsSetup(false);
          setLoading(false);
          loadDashboard();
          return;
        }

        // Not approved yet
        if (data.status === "pending") {
          toast.warning("Your vendor application is pending approval.");
          navigate("/profile");
          return;
        }

        // No application
        if (data.status === "none") {
          toast.warning("Please apply as a vendor first.");
          navigate("/profile");
          return;
        }

      } catch (err) {
        console.error("Failed to check vendor status:", err);
        toast.error(err.message);
        navigate("/profile");
      }
    }

    if (token) {
      checkStatus();
    } else {
      navigate("/");
    }

    return () => chartInstance.current?.destroy();
  }, [token, navigate]);

  /* ================= ✅ NEW: CREATE VENDOR PROFILE ================= */
  async function handleProfileSetup(e) {
    e.preventDefault();
    setSubmittingSetup(true);

    try {
      // Validate
      if (!setupForm.bio || !setupForm.services || !setupForm.service_areas) {
        toast.warning("Please fill in all required fields");
        setSubmittingSetup(false);
        return;
      }

      if (!setupForm.logo) {
        toast.warning("Please upload a business logo");
        setSubmittingSetup(false);
        return;
      }

      // Create FormData
      const fd = new FormData();
      fd.append("bio", setupForm.bio);
      fd.append("services", setupForm.services);
      fd.append("service_areas", setupForm.service_areas);
      fd.append("logo", setupForm.logo);
      if (setupForm.hero) {
        fd.append("hero", setupForm.hero);
      }

      // Submit
      const data = await safeFetch(`${API}/vendor/profile/create`, {
        method: "POST",
        body: fd,
      });

      toast.success("Profile created successfully! You're now visible to clients.");
      
      // Reload page to show dashboard
      setNeedsSetup(false);
      loadDashboard();

    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingSetup(false);
    }
  }

  /* ================= LOAD DASHBOARD ================= */
  async function loadDashboard() {
    try {
      const body = await safeFetch(`${API}/vendor/dashboard`);
      setVendor(body.vendor);
      setBookings(body.bookings || [{ title: "No bookings", count: 0 }]);
      setGallery(body.gallery || []);

      // Chart
      if (body.insights && chartRef.current) {
        chartInstance.current?.destroy();
        
        try {
          chartInstance.current = new Chart(chartRef.current, {
            type: "line",
            data: body.insights || { labels: [], datasets: [] },
          });
        } catch (e) {
          console.error("Chart error:", e);
        }
      }
    } catch (err) {
      toast.error(err.message);
    }
  }

  /* ================= EDIT PROFILE ================= */
  function openEdit() {
    setForm({
      business_name: vendor.business_name || "",
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
      const body = await safeFetch(`${API}/vendor/logo`, { 
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

  async function uploadGallery(files) {
    const fd = new FormData();
    [...files].forEach((f) => fd.append("gallery[]", f));
    
    try {
      await safeFetch(`${API}/vendor/gallery`, {
        method: "POST",
        body: fd,
      });
      
      loadDashboard();
      toast.success("Gallery updated!");
    } catch (err) {
      toast.error(err.message);
    }
  }

  /* ================= ✅ RENDER: PROFILE SETUP FORM ================= */
  if (needsSetup) {
    return (
      <div className="vendor-dashboard">
        <style>{`
          .setup-container {
            max-width: 800px;
            margin: 80px auto 40px;
            padding: 40px;
            background: #f6f0e8;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          .setup-header {
            text-align: center;
            margin-bottom: 30px;
          }
          .setup-header h1 {
            color: #7a5d47;
            font-size: 32px;
            margin-bottom: 10px;
          }
          .setup-header p {
            color: #666;
            font-size: 16px;
          }
          .setup-form {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .form-group {
            display: flex;
            flex-direction: column;
          }
          .form-group label {
            font-weight: 600;
            margin-bottom: 8px;
            color: #333;
          }
          .form-group label .required {
            color: #d32f2f;
          }
          .form-group input,
          .form-group textarea {
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            font-family: inherit;
          }
          .form-group textarea {
            min-height: 100px;
            resize: vertical;
          }
          .form-group small {
            margin-top: 4px;
            color: #666;
            font-size: 13px;
          }
          .image-preview {
            margin-top: 10px;
            max-width: 200px;
          }
          .image-preview img {
            width: 100%;
            border-radius: 6px;
            border: 2px solid #ddd;
          }
          .submit-btn {
            background: #7a5d47;
            color: white;
            padding: 14px 28px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
          }
          .submit-btn:hover {
            background: #6a503d;
          }
          .submit-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
          }
        `}</style>

        <div className="setup-container">
          <div className="setup-header">
            <h1>🎉 Congratulations!</h1>
            <p>Your vendor application has been approved. Complete your profile to appear on our vendors page.</p>
          </div>

          <form onSubmit={handleProfileSetup} className="setup-form">
            {/* Business Bio */}
            <div className="form-group">
              <label>
                Business Bio <span className="required">*</span>
              </label>
              <textarea
                value={setupForm.bio}
                onChange={(e) => setSetupForm({ ...setupForm, bio: e.target.value })}
                placeholder="Tell clients about your business, experience, and what makes you unique..."
                required
              />
              <small>Describe your business in 2-3 paragraphs</small>
            </div>

            {/* Services */}
            <div className="form-group">
              <label>
                Services Offered <span className="required">*</span>
              </label>
              <textarea
                value={setupForm.services}
                onChange={(e) => setSetupForm({ ...setupForm, services: e.target.value })}
                placeholder="Full catering, Event planning, Venue setup, etc."
                required
              />
              <small>List the services you provide (comma-separated)</small>
            </div>

            {/* Service Areas */}
            <div className="form-group">
              <label>
                Service Areas <span className="required">*</span>
              </label>
              <input
                type="text"
                value={setupForm.service_areas}
                onChange={(e) => setSetupForm({ ...setupForm, service_areas: e.target.value })}
                placeholder="Metro Manila, Quezon City, Makati, etc."
                required
              />
              <small>Where do you provide your services?</small>
            </div>

            {/* Logo */}
            <div className="form-group">
              <label>
                Business Logo <span className="required">*</span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSetupForm({ ...setupForm, logo: e.target.files[0] })}
                required
              />
              <small>Square image recommended (300x300px). This will appear on the vendors page.</small>
              {setupForm.logo && (
                <div className="image-preview">
                  <img src={URL.createObjectURL(setupForm.logo)} alt="Logo preview" />
                </div>
              )}
            </div>

            {/* Hero Image */}
            <div className="form-group">
              <label>Hero/Banner Image (Optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSetupForm({ ...setupForm, hero: e.target.files[0] })}
              />
              <small>Wide image recommended (1920x1080px). This will appear at the top of your profile.</small>
              {setupForm.hero && (
                <div className="image-preview">
                  <img src={URL.createObjectURL(setupForm.hero)} alt="Hero preview" />
                </div>
              )}
            </div>

            <button 
              type="submit" 
              className="submit-btn"
              disabled={submittingSetup}
            >
              {submittingSetup ? "Creating Profile..." : "Publish Profile & Go Live"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ================= RENDER: LOADING ================= */
  if (loading) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh" 
      }}>
        <p>Loading vendor dashboard...</p>
      </div>
    );
  }

  /* ================= RENDER: DASHBOARD ================= */
  if (!vendor) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh",
        flexDirection: "column",
        gap: "20px"
      }}>
        <p>Loading vendor data...</p>
      </div>
    );
  }

  return (
    <div className="vendor-dashboard">
      <style>{`
        .vendor-dashboard { 
          padding: 80px 20px 40px; 
          max-width: 1200px; 
          margin: 0 auto; 
          font-family: 'Poppins', sans-serif;
        }
        .vendor-dashboard h2 { 
          margin-bottom: 20px; 
          color: #7a5d47; 
        }
        .vendor-dashboard .profile-card {
          background: #f6f0e8;
          padding: 30px;
          border-radius: 12px;
          margin-bottom: 30px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .vendor-dashboard .profile-header {
          display: flex;
          gap: 20px;
          align-items: flex-start;
        }
        .vendor-dashboard .profile-logo {
          width: 120px;
          height: 120px;
          border-radius: 8px;
          object-fit: cover;
          border: 3px solid #7a5d47;
        }
        .vendor-dashboard .profile-info {
          flex: 1;
        }
        .vendor-dashboard .profile-info h3 {
          margin: 0 0 10px 0;
          color: #333;
        }
        .vendor-dashboard .profile-actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
          flex-wrap: wrap;
        }
        .vendor-dashboard .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s;
        }
        .vendor-dashboard .btn-primary {
          background: #7a5d47;
          color: white;
        }
        .vendor-dashboard .btn-primary:hover {
          background: #6a503d;
        }
        .vendor-dashboard .btn-secondary {
          background: #e8ddae;
          color: #333;
        }
        .vendor-dashboard .btn-secondary:hover {
          background: #d8cdae;
        }
        .vendor-dashboard .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .vendor-dashboard .stat-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .vendor-dashboard .stat-card h4 {
          margin: 0 0 10px 0;
          color: #666;
          font-size: 14px;
        }
        .vendor-dashboard .stat-card p {
          margin: 0;
          font-size: 32px;
          font-weight: bold;
          color: #7a5d47;
        }
        .vendor-dashboard .chart-container {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .vendor-dashboard .gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 15px;
          margin-top: 20px;
        }
        .vendor-dashboard .gallery-item {
          aspect-ratio: 1;
          border-radius: 8px;
          overflow: hidden;
        }
        .vendor-dashboard .gallery-item img {
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
            src={vendor.vendor_logo || "/default-logo.png"} 
            alt="Business Logo"
            className="profile-logo"
          />
          <div className="profile-info">
            <h3>{vendor.business_name}</h3>
            <p><strong>Category:</strong> {vendor.category}</p>
            <p><strong>Email:</strong> {vendor.business_email}</p>
            <p><strong>Address:</strong> {vendor.business_address}</p>
            
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

      {/* Stats */}
      <h2>Dashboard Overview</h2>
      <div className="stats-grid">
        {bookings.map((b, i) => (
          <div key={i} className="stat-card">
            <h4>{b.title}</h4>
            <p>{b.count}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="chart-container">
        <h3>Profile Analytics</h3>
        <canvas ref={chartRef}></canvas>
      </div>

      {/* Gallery */}
      <h2>Gallery</h2>
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
        onChange={(e) => uploadGallery(e.target.files)}
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
                Business Name
                <input
                  type="text"
                  value={form.business_name}
                  onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                />
              </label>
              
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
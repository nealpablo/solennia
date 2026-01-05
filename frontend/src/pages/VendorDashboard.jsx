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
      
      // ✅ FIXED: Set gallery from response
      console.log("Gallery data:", body.gallery); // Debug log
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

  /* ================= ✅ FIXED: UPLOAD GALLERY ================= */
  async function uploadGallery(files) {
    // ✅ Validate file count
    if (files.length > 10) {
      toast.error("Maximum 10 images per upload");
      return;
    }

    // ✅ Validate file sizes
    const maxSize = 10 * 1024 * 1024; // 10MB
    for (let file of files) {
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large. Maximum size is 10MB.`);
        return;
      }
    }

    const fd = new FormData();
    
    // ✅ FIXED: Use "gallery" instead of "gallery[]"
    // Backend expects: $files = $request->getUploadedFiles()['gallery'] ?? [];
    Array.from(files).forEach((f) => {
      fd.append("gallery[]", f); // PHP will parse this as an array
    });
    
    try {
      toast.info(`Uploading ${files.length} image(s)...`);
      
      const result = await safeFetch(`${API}/vendor/gallery`, {
        method: "POST",
        body: fd,
      });
      
      console.log("Upload result:", result); // Debug log
      
      // Reload dashboard to show new images
      loadDashboard();
      
      if (result.errors && result.errors.length > 0) {
        toast.warning(`${result.images?.length || 0} image(s) uploaded. ${result.errors.length} failed.`);
      } else {
        toast.success(`Gallery updated! ${result.images?.length || 0} image(s) uploaded.`);
      }
    } catch (err) {
      console.error("Gallery upload error:", err); // Debug log
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
            gap: 8px;
          }
          .form-group label {
            font-weight: 600;
            color: #7a5d47;
          }
          .form-group label .required {
            color: #dc2626;
          }
          .form-group input,
          .form-group textarea {
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-family: inherit;
            font-size: 14px;
          }
          .form-group textarea {
            min-height: 100px;
            resize: vertical;
          }
          .file-upload {
            border: 2px dashed #ddd;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s;
          }
          .file-upload:hover {
            border-color: #7a5d47;
            background: #fff;
          }
          .file-upload input {
            display: none;
          }
          .file-name {
            margin-top: 10px;
            font-size: 14px;
            color: #666;
          }
          .btn-submit {
            background: #7a5d47;
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
          }
          .btn-submit:hover:not(:disabled) {
            background: #5d4436;
            transform: translateY(-2px);
          }
          .btn-submit:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
        `}</style>

        <div className="setup-container">
          <div className="setup-header">
            <h1>🎉 Complete Your Vendor Profile</h1>
            <p>Your vendor application has been approved! Please fill in the details below to activate your profile.</p>
          </div>

          <form className="setup-form" onSubmit={handleProfileSetup}>
            <div className="form-group">
              <label>
                Business Bio <span className="required">*</span>
              </label>
              <textarea
                value={setupForm.bio}
                onChange={(e) => setSetupForm({ ...setupForm, bio: e.target.value })}
                placeholder="Tell clients about your business, experience, and what makes you special..."
                required
              />
            </div>

            <div className="form-group">
              <label>
                Services Offered <span className="required">*</span>
              </label>
              <textarea
                value={setupForm.services}
                onChange={(e) => setSetupForm({ ...setupForm, services: e.target.value })}
                placeholder="List your services (e.g., Wedding Photography, Event Catering, Floral Arrangements)"
                required
              />
            </div>

            <div className="form-group">
              <label>
                Service Areas <span className="required">*</span>
              </label>
              <input
                type="text"
                value={setupForm.service_areas}
                onChange={(e) => setSetupForm({ ...setupForm, service_areas: e.target.value })}
                placeholder="Where do you serve? (e.g., Metro Manila, Quezon City, NCR)"
                required
              />
            </div>

            <div className="form-group">
              <label>
                Business Logo <span className="required">*</span>
              </label>
              <label className="file-upload">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSetupForm({ ...setupForm, logo: e.target.files[0] })}
                  required
                />
                <div>📸 Click to upload your business logo</div>
                {setupForm.logo && (
                  <div className="file-name">Selected: {setupForm.logo.name}</div>
                )}
              </label>
            </div>

            <div className="form-group">
              <label>
                Hero Image (Optional)
              </label>
              <label className="file-upload">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSetupForm({ ...setupForm, hero: e.target.files[0] })}
                />
                <div>🖼️ Click to upload a hero/banner image</div>
                {setupForm.hero && (
                  <div className="file-name">Selected: {setupForm.hero.name}</div>
                )}
              </label>
            </div>

            <button
              type="submit"
              className="btn-submit"
              disabled={submittingSetup}
            >
              {submittingSetup ? "Creating Profile..." : "Activate My Profile"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ================= LOADING STATE ================= */
  if (loading) {
    return (
      <div className="vendor-dashboard" style={{ textAlign: "center", padding: "100px 20px" }}>
        <h2>Loading vendor dashboard...</h2>
      </div>
    );
  }

  /* ================= MAIN DASHBOARD ================= */
  if (!vendor) {
    return (
      <div className="vendor-dashboard" style={{ textAlign: "center", padding: "100px 20px" }}>
        <h2>Vendor profile not found</h2>
        <p>Please contact support if this issue persists.</p>
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
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stat-card h4 {
          margin: 0 0 10px 0;
          color: #666;
          font-size: 14px;
        }
        .stat-card p {
          margin: 0;
          font-size: 32px;
          font-weight: bold;
          color: #7a5d47;
        }
        .chart-container {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
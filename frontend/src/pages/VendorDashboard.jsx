import { useEffect, useRef, useState } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import Chart from "chart.js/auto";
import "../style.css";

const API = "/api";

export default function VendorDashboard() {
  const token = localStorage.getItem("solennia_token");
  const navigate = useNavigate();

  const [vendor, setVendor] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [checkingVendorType, setCheckingVendorType] = useState(true);

  const [showEdit, setShowEdit] = useState(false);
  const [showHero, setShowHero] = useState(false);
  const [showLogo, setShowLogo] = useState(false);

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
    headers["Authorization"] = `Bearer ${token}`;
    
    const res = await fetch(url, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    
    if (!res.ok) throw new Error(data.error || data.message || "Error");
    return data;
  }

  /* ================= TOAST ================= */
  function toast(msg) {
    alert(msg);
  }

  /* ================= CHECK IF VENUE VENDOR - ✅ FIXED TO CHECK BOTH ================= */
  useEffect(() => {
    async function checkVendorType() {
      try {
        const res = await fetch(`${API}/vendor/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const data = await res.json();
        
        // ✅ FIXED: Check both Category AND ServiceType for venue vendors
        if (data.vendor && (data.vendor.Category === "Venue" || data.vendor.ServiceType === "Venue")) {
          navigate("/venue-dashboard");
          return;
        }
        
        setCheckingVendorType(false);
      } catch (err) {
        console.error("Failed to check vendor type:", err);
        setCheckingVendorType(false);
      }
    }

    checkVendorType();
  }, [token, navigate]);

  /* ================= LOAD DASHBOARD ================= */
  async function loadDashboard() {
    try {
      const body = await safeFetch(`${API}/vendor/dashboard`);
      setVendor(body.vendor);
      setBookings(body.bookings || [{ title: "No bookings", count: 0 }]);
      setGallery(body.vendor?.gallery || []);

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
      toast(err.message);
      if (err.message.toLowerCase().includes("unauthorized")) {
        window.location.href = "/profile";
      }
    }
  }

  useEffect(() => {
    if (!checkingVendorType) {
      loadDashboard();
    }
    return () => chartInstance.current?.destroy();
  }, [checkingVendorType]);

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
      await safeFetch(`${API}/vendor/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      
      setShowEdit(false);
      loadDashboard();
      toast("Profile updated!");
    } catch (err) {
      toast(err.message);
    }
  }

  /* ================= UPLOAD HANDLERS ================= */
  async function uploadHero(file) {
    const fd = new FormData();
    fd.append("hero", file);
    
    try {
      await safeFetch(`${API}/vendor/upload-hero`, { 
        method: "POST", 
        body: fd 
      });
      
      setShowHero(false);
      toast("Hero image uploaded!");
    } catch (err) {
      toast(err.message);
    }
  }

  async function uploadLogo(file) {
    const fd = new FormData();
    fd.append("logo", file);
    
    try {
      const body = await safeFetch(`${API}/vendor/upload-logo`, { 
        method: "POST", 
        body: fd 
      });
      
      setShowLogo(false);
      if (body.url) {
        setVendor({ ...vendor, avatar: body.url });
      }
      toast("Logo uploaded!");
    } catch (err) {
      toast(err.message);
    }
  }

  async function uploadGallery(files) {
    const fd = new FormData();
    [...files].forEach((f) => fd.append("images[]", f));
    
    try {
      const body = await safeFetch(`${API}/vendor/upload-gallery`, {
        method: "POST",
        body: fd,
      });
      
      setGallery(body.gallery || []);
      toast("Gallery updated!");
    } catch (err) {
      toast(err.message);
    }
  }

  // Show loading while checking vendor type
  if (checkingVendorType) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh',
        fontFamily: 'Cinzel, serif'
      }}>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (!vendor) return null;

  return (
    <>
      <style>{`
        body {
          font-family: 'Cinzel', serif;
          background: #f6f0e8;
          color: #1c1b1a;
          min-height: 100vh;
        }

        main {
          max-width: 1100px;
          margin: 1.5rem auto;
          padding: 1rem;
          width: 100%;
        }

        .card {
          background: #ece8e1;
          border-radius: 12px;
          padding: 1rem;
          box-shadow: 0 6px 18px rgba(0,0,0,0.05);
        }

        .profile-hero {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .avatar {
          width: 96px;
          height: 96px;
          border-radius: 9999px;
          overflow: hidden;
          border: 2px solid #1c1b1a;
          background: #fff;
          object-fit: cover;
        }

        .btn-ghost {
          background: #e0d6c6;
          color: #3b2f25;
          border-radius: 8px;
          padding: .5rem .9rem;
          border: 1px solid #c9bda9;
          cursor: pointer;
        }

        .btn-brown {
          background: #7a5d47;
          color: #fff;
          border-radius: 8px;
          padding: .55rem 1rem;
          border: none;
          cursor: pointer;
        }

        .small {
          font-size: 0.85rem;
          color: #344;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.45);
          z-index: 9999;
        }

        .modal {
          background: #f6f0e8;
          border-radius: 0.75rem;
          padding: 1rem;
          width: 100%;
          max-width: 720px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        }

        label.field {
          display: block;
          font-size: 0.85rem;
          margin-bottom: 0.25rem;
          font-weight: 600;
        }

        input, textarea {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #c9bda9;
          border-radius: 6px;
          background: #fff;
        }
      `}</style>

      <main>
        {/* PROFILE */}
        <section className="card profile-hero">
          <img
            src={vendor.avatar || "/images/default-avatar.png"}
            className="avatar"
            alt="Vendor logo"
          />

          <div style={{ flex: 1 }}>
            <h2 className="text-xl font-semibold">{vendor.business_name || "Vendor"}</h2>
            <p className="small">{vendor.address || ""}</p>
            <p className="small mt-2">{vendor.bio || ""}</p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div>
                <b>Services:</b>{" "}
                <span className="small">
                  {Array.isArray(vendor.services)
                    ? vendor.services.join(", ")
                    : vendor.services || ""}
                </span>
              </div>
              <div>
                <b>Areas:</b>{" "}
                <span className="small">
                  {Array.isArray(vendor.service_areas)
                    ? vendor.service_areas.join(", ")
                    : vendor.service_areas || ""}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
            <button className="btn-ghost" onClick={openEdit}>
              Edit Profile
            </button>
            <button className="btn-ghost" onClick={() => setShowHero(true)}>
              Upload Banner
            </button>
            <button className="btn-ghost" onClick={() => setShowLogo(true)}>
              Upload Logo
            </button>
          </div>
        </section>

        {/* DASHBOARD */}
        <section className="card mt-6">
          <h3 className="font-semibold mb-3">Dashboard</h3>

          <div className="grid-2">
            <div>
              <h4 className="text-sm font-semibold">Bookings Summary</h4>
              <div className="small mt-2">
                {bookings.map((b, i) => (
                  <div key={i}>
                    {b.title}: <b>{b.count}</b>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold">Visitor Insights</h4>
              <canvas ref={chartRef} style={{ maxWidth: "100%" }} />
            </div>
          </div>
        </section>

        {/* GALLERY */}
        <section className="card mt-6">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 className="font-semibold">Listings & Gallery</h3>

            <label className="btn-ghost" style={{ cursor: "pointer" }}>
              Upload Gallery
              <input
                type="file"
                multiple
                accept="image/*"
                hidden
                onChange={(e) => uploadGallery(e.target.files)}
              />
            </label>
          </div>

          <div
            className="mt-3"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "12px",
            }}
          >
            {gallery.map((url, i) => (
              <img
                key={i}
                src={url}
                style={{
                  width: "100%",
                  height: "120px",
                  objectFit: "cover",
                  borderRadius: "8px",
                }}
                alt=""
              />
            ))}
          </div>
        </section>
      </main>

      {/* EDIT MODAL */}
      {showEdit && (
        <div className="modal-backdrop" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Vendor Profile</h3>
            <form onSubmit={submitEdit}>
              <label className="field">Business Name</label>
              <input
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                required
              />

              <label className="field mt-3">Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows="3"
              />

              <label className="field mt-3">Services (comma separated)</label>
              <input
                value={form.services}
                onChange={(e) => setForm({ ...form, services: e.target.value })}
              />

              <label className="field mt-3">Service Areas (comma separated)</label>
              <input
                value={form.service_areas}
                onChange={(e) => setForm({ ...form, service_areas: e.target.value })}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: ".5rem", marginTop: "1rem" }}>
                <button type="button" className="btn-ghost" onClick={() => setShowEdit(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-brown">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HERO UPLOAD MODAL */}
      {showHero && (
        <div className="modal-backdrop" onClick={() => setShowHero(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Upload Hero Image</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fileInput = e.target.querySelector('input[type="file"]');
                if (fileInput.files[0]) {
                  uploadHero(fileInput.files[0]);
                }
              }}
            >
              <label className="field">Choose hero image</label>
              <input type="file" name="hero" accept="image/*" required />
              
              <div style={{ display: "flex", justifyContent: "flex-end", gap: ".5rem", marginTop: "1rem" }}>
                <button type="button" className="btn-ghost" onClick={() => setShowHero(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-brown">
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOGO UPLOAD MODAL */}
      {showLogo && (
        <div className="modal-backdrop" onClick={() => setShowLogo(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Upload Vendor Logo</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fileInput = e.target.querySelector('input[type="file"]');
                if (fileInput.files[0]) {
                  uploadLogo(fileInput.files[0]);
                }
              }}
            >
              <label className="field">Choose logo image</label>
              <input type="file" name="logo" accept="image/*" required />
              
              <div style={{ display: "flex", justifyContent: "flex-end", gap: ".5rem", marginTop: "1rem" }}>
                <button type="button" className="btn-ghost" onClick={() => setShowLogo(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-brown">
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
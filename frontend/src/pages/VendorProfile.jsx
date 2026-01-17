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

        console.log("Vendor data loaded:", json.vendor); // Debug log
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
     CHAT
  ========================= */
  function openChat() {
    if (!vendor) return;
    
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please log in to chat with vendors");
      return;
    }
    
    const uid = vendor.firebase_uid || vendor.user_id || vendor.UserID;
    if (!uid) return;
    navigate(`/chat?to=${encodeURIComponent(uid)}`);
  }

  /* =========================
     BOOK NOW - FIXED
  ========================= */
  function handleBookNow() {
    if (!vendor) return;
    
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please log in to book this vendor");
      return;
    }

    // ✅ FIX: Get the correct UserID from the vendor object
    // Try multiple possible field names (case-sensitive)
    const vendorUserId = vendor.UserID || vendor.user_id || vendor.id;
    
    console.log("Booking with vendor UserID:", vendorUserId); // Debug log
    console.log("Full vendor object:", vendor); // Debug log

    if (!vendorUserId) {
      toast.error("Unable to identify vendor. Please try again.");
      console.error("Vendor object is missing UserID:", vendor);
      return;
    }

    navigate('/create-booking', {
      state: {
        vendorUserId: vendorUserId,  // ✅ This should be UserID from credential table
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
          Vendor not found
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
              Book This Vendor
            </button>
            
            <button
              className="chat-btn"
              disabled={!chatEnabled}
              onClick={openChat}
              title={chatTitle}
            >
              Chat Vendor
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
  }
`;
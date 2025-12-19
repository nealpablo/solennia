import { useEffect, useState } from "react";
import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "../partials/Header";
import Footer from "../partials/Footer";
import Modals from "../partials/Modals";
import "../style.css";

const API = "/api";

export default function VendorProfile() {
  const [params] = useSearchParams();
  const vendorId = params.get("id");
  const navigate = useNavigate();

  const [vendor, setVendor] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);

  /* =========================
     LOAD VENDOR
  ========================= */
  useEffect(() => {
    if (!vendorId) {
      navigate("/vendors");
      return;
    }

    async function loadVendor() {
      try {
        const res = await fetch(`${API}/vendor/public/${vendorId}`);
        const json = await res.json();

        if (!res.ok || !json.vendor) throw new Error("Not found");

        setVendor(json.vendor);
      } catch (err) {
        alert("Unable to load vendor.");
        navigate("/vendors");
      }
    }

    loadVendor();
  }, [vendorId, navigate]);

  if (!vendor) return null;

  const {
    business_name,
    category,
    address,
    bio,
    description,
    services,
    service_areas,
    hero_image_url,
    vendor_logo,
    gallery = [],
    firebase_uid,
    user_id
  } = vendor;

  /* =========================
     CHAT
  ========================= */
  function openChat() {
    const uid = firebase_uid || user_id;
    if (!uid) return;
    navigate(`/chat?to=${encodeURIComponent(uid)}`);
  }

  /* =========================
     RENDER
  ========================= */
  return (
    <>
      <Header />

      {/* HERO */}
      <div className="hero-container">
        <img
          src={hero_image_url || "/images/default-hero.jpg"}
          alt=""
        />
      </div>

      <main className="flex-1">
        <section className="profile-card">

          {/* LOGO */}
          <div className="vendor-logo">
            <img
              src={vendor_logo || "/images/default-avatar.png"}
              alt=""
            />
          </div>

          <div className="vendor-header">
            <h1 className="vendor-name">
              {business_name || "Vendor"}
            </h1>
            <p className="vendor-meta">
              {category || ""} • {address || ""}
            </p>
          </div>

          <p className="vendor-bio">
            {bio || description || "This vendor has not provided a full description yet."}
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
            {gallery.map((img, i) => (
              <img
                key={i}
                src={img}
                onClick={() => setLightboxImg(img)}
                alt=""
              />
            ))}
          </div>

          {/* CHAT */}
          <button
            className="chat-btn"
            disabled={!firebase_uid && !user_id}
            onClick={openChat}
          >
            Chat Vendor
          </button>

        </section>
      </main>

      <Footer />
      <Modals />

      {/* LIGHTBOX */}
      {lightboxImg && (
        <div className="lb-backdrop open" onClick={() => setLightboxImg(null)}>
          <div className="lb-frame">
            <img src={lightboxImg} alt="" />
          </div>
          <div className="lb-close">&times;</div>
        </div>
      )}
    </>
  );
}

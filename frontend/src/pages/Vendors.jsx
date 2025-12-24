import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "../utils/toast";

import "../style.css";
import "../vendors.css";

const API = "/api";

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState("Loading vendors…");
  const navigate = useNavigate();

  /* =========================
     LOAD VENDORS (EXCLUDE VENUE VENDORS)
  ========================= */
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/vendors/public`);

        if (!res.ok) {
          const text = await res.text();
          console.error("Vendors API error:", res.status, text);
          setStatus("Unable to load vendors.");
          return;
        }

        const json = await res.json();
        // ✅ FILTER OUT VENUE VENDORS - They should not appear here
        const nonVenueVendors = (json.vendors || []).filter(v => v.category !== "Venue");
        setVendors(Array.isArray(nonVenueVendors) ? nonVenueVendors : []);
        setStatus("");
      } catch (err) {
        console.error(err);
        setStatus("Unable to load vendors.");
      }
    }
    load();
  }, []);

  /* =========================
     FILTERED LIST (NO VENUE CATEGORY)
  ========================= */
  const visible =
    filter === "all"
      ? vendors
      : vendors.filter(
          (v) =>
            (v.category || "").toLowerCase() === filter.toLowerCase()
        );

  /* =========================
     HELPERS
  ========================= */
  function getDescription(v) {
    return (
      v.description ||
      v.bio ||
      "This vendor has not added a full description yet."
    );
  }

  function openProfile(v) {
    navigate(`/vendor-profile?id=${encodeURIComponent(v.user_id || v.id)}`);
  }

  /* ================= ✅ FIXED: CHAT VENDOR ================= */
  function openChat(v) {
    // Check if user is logged in
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login to chat with vendors");
      return;
    }

    // Get firebase_uid from vendor
    const firebaseUid = v.firebase_uid || v.user_firebase_uid;
    
    if (!firebaseUid) {
      console.error("Vendor missing firebase_uid:", v);
      toast.error("Unable to start chat with this vendor");
      return;
    }

    // Navigate to chat with ?to= parameter
    navigate(`/chat?to=${encodeURIComponent(firebaseUid)}`);
  }

  /* =========================
     RENDER (NO "Venue" IN FILTERS)
  ========================= */
  return (
    <main className="flex-1 bg-[#f6f0e8] text-[#1c1b1a]">
      <section className="max-w-5xl mx-auto px-4 md:px-0 pt-10 pb-20">
        <h1 className="text-3xl md:text-4xl tracking-[0.25em] text-center md:text-left mb-8">
          MEET OUR VENDORS
        </h1>

        {/* FILTERS - NO "Venue" FILTER */}
        <div className="flex flex-wrap gap-3 text-[0.75rem] tracking-[0.2em] uppercase mb-6">
          {[
            "all",
            "Catering",
            "Photography & Videography",
            "Decoration",
            "Entertainment",
            "Others",
          ].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 border border-[#c9bda4] rounded-full transition-colors ${
                filter === f 
                  ? 'bg-[#7a5d47] text-white border-[#7a5d47]' 
                  : 'bg-[#f6f0e8] hover:bg-[#e8ddae]'
              }`}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>

        {/* STATUS */}
        {status && (
          <p className="mt-10 text-center text-xs tracking-[0.18em] uppercase text-gray-500">
            {status}
          </p>
        )}

        {/* LIST */}
        {visible.map((v) => {
          const logo =
            v.vendor_logo ||
            v.hero_image_url ||
            v.user_avatar ||
            null;

          return (
            <article key={v.id || v.user_id} className="vendor-row">
              <div className="vendor-avatar">
                {logo ? (
                  <img src={logo} alt={v.business_name || "Vendor"} />
                ) : (
                  <span className="text-xs tracking-[0.2em] uppercase text-gray-500 px-2 text-center">
                    {(v.business_name || "Vendor").slice(0, 10)}
                  </span>
                )}
              </div>

              <div>
                <h2 className="vendor-name">
                  {v.business_name || "Vendor"}
                </h2>

                <p className="vendor-meta">
                  {(v.category || "Vendor")} • {(v.address || "Philippines")}
                </p>

                <p className="vendor-desc">{getDescription(v)}</p>

                <div className="vendor-actions">
                  <button
                    className="vendor-view-btn"
                    onClick={() => openProfile(v)}
                  >
                    VIEW PROFILE
                  </button>

                  <button
                    className="vendor-chat-btn"
                    onClick={() => openChat(v)}
                  >
                    CHAT VENDOR
                  </button>

                  <button className="vendor-heart">♡</button>
                </div>
              </div>
            </article>
          );
        })}

        {!status && visible.length === 0 && (
          <p className="mt-10 text-center text-xs tracking-[0.18em] uppercase text-gray-500">
            No vendors found.
          </p>
        )}
      </section>
    </main>
  );
}
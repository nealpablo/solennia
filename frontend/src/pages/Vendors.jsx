import { useEffect, useState } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import Header from "../partials/Header";
import Footer from "../partials/Footer";
import Modals from "../partials/Modals";
import "../style.css";

const API = "/api";

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState("Loading vendors…");
  const navigate = useNavigate();

  /* =========================
     LOAD VENDORS
  ========================= */
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/vendors/public`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed loading vendors");

        setVendors(Array.isArray(json.vendors) ? json.vendors : []);
        setStatus("");
      } catch (err) {
        console.error(err);
        setStatus("Unable to load vendors.");
      }
    }
    load();
  }, []);

  /* =========================
     FILTERED LIST
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

  function openChat(v) {
    const uid = v.firebase_uid || v.user_id || v.id;
    if (!uid) return;
    navigate(`/chat?to=${encodeURIComponent(uid)}`);
  }

  /* =========================
     RENDER
  ========================= */
  return (
    <>
      <Header />

      <main className="flex-1 bg-[#f6f0e8] text-[#1c1b1a]">
        <section className="max-w-5xl mx-auto px-4 md:px-0 pt-10 pb-20">
          <h1 className="text-3xl md:text-4xl tracking-[0.25em] text-center md:text-left mb-8">
            MEET OUR VENDORS
          </h1>

          {/* FILTERS */}
          <div className="flex flex-wrap gap-3 text-[0.75rem] tracking-[0.2em] uppercase mb-6">
            {[
              "all",
              "Venue",
              "Catering",
              "Photography & Videography",
              "Decoration",
              "Entertainment",
            ].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-4 py-2 border border-[#c9bda4] rounded-full bg-[#f6f0e8]"
              >
                {f === "all" ? "All" : f.replace("&", "&")}
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
              <article
                key={v.id || v.user_id}
                className="vendor-row"
              >
                {/* AVATAR */}
                <div className="vendor-avatar">
                  {logo ? (
                    <img src={logo} alt={v.business_name || "Vendor"} />
                  ) : (
                    <span className="text-xs tracking-[0.2em] uppercase text-gray-500 px-2 text-center">
                      {(v.business_name || "Vendor").slice(0, 10)}
                    </span>
                  )}
                </div>

                {/* CONTENT */}
                <div>
                  <h2 className="vendor-name">
                    {v.business_name || "Vendor"}
                  </h2>

                  <p className="vendor-meta">
                    {(v.category || "Vendor")} •{" "}
                    {(v.address || "Philippines")}
                  </p>

                  <p className="vendor-desc">
                    {getDescription(v)}
                  </p>

                  <div className="vendor-actions">
                    <button
                      className="vendor-view-btn"
                      onClick={() => openProfile(v)}
                    >
                      VIEW PROFILE
                    </button>

                    <button
                      className="vendor-chat-btn"
                      disabled={!v.firebase_uid && !v.user_id}
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

      <Footer />
      <Modals />
    </>
  );
}

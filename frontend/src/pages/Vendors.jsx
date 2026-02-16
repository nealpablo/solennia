import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "../utils/toast";

import "../style.css";

const API =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://solennia.up.railway.app/api" : "/api");

const PER_PAGE = 8;

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  /* =========================
     LOAD ALL VENDORS (NO FILTER)
  ========================= */
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/vendors/public`);

        if (!res.ok) {
          const text = await res.text();
          console.error("Vendors API error:", res.status, text);
          setLoading(false);
          return;
        }

        const json = await res.json();
        setVendors(Array.isArray(json.vendors) ? json.vendors : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Filter vendors by category and search query
  const filteredVendors = vendors.filter(v => {
    // Category filter
    if (filter !== "all") {
      if ((v.Category || "").toLowerCase() !== filter.toLowerCase()) return false;
    }
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const name = (v.BusinessName || "").toLowerCase();
      const category = (v.Category || "").toLowerCase();
      const description = (v.Description || "").toLowerCase();
      if (!name.includes(q) && !category.includes(q) && !description.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredVendors.length / PER_PAGE));
  const startIdx = (currentPage - 1) * PER_PAGE;
  const visibleVendors = filteredVendors.slice(startIdx, startIdx + PER_PAGE);

  const handlePageChange = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#e8ddae] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading Suppliers...</p>
        </div>
      </div>
    );
  }

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page Header - Centered */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl tracking-[0.25em] text-center mb-2">
          MEET OUR SUPPLIERS
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Find the perfect professionals for your special day
        </p>

        {/* Search Bar */}
        <div className="max-w-md mx-auto relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search suppliers by name, category..."
            className="w-full pl-10 pr-10 py-2.5 border border-[#c9bda4] rounded-full bg-white focus:outline-none focus:border-[#7a5d47] focus:ring-1 focus:ring-[#7a5d47] text-sm transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* FILTERS - NO "Venue" FILTER */}
      <div className="flex flex-wrap gap-3 text-[0.75rem] tracking-[0.2em] uppercase mb-6 justify-center">
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
            className={`px-4 py-2 border border-[#c9bda4] rounded-full transition-colors ${filter === f
              ? 'bg-[#7a5d47] text-white border-[#7a5d47]'
              : 'bg-[#f6f0e8] hover:bg-[#e8ddae]'
              }`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {/* Empty State or Vendor Grid */}
      {filteredVendors.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-24 h-24 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            {filter === "all" ? "No Suppliers Available Yet" : `No ${filter} Supplier Available`}
          </h3>
          <p className="text-gray-500">Check back soon for amazing Supplier listings.</p>
        </div>
      ) : (
        <>
          {/* Vendor Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {visibleVendors.map((vendor) => (
              <VendorCard key={vendor.unique_key || vendor.ID || vendor.UserID} vendor={vendor} navigate={navigate} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-4 py-2 border border-[#c9bda4] rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#e8ddae] transition-colors"
              >
                ← Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-2 text-gray-400">…</span>
                      )}
                      <button
                        onClick={() => handlePageChange(p)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${currentPage === p
                          ? "bg-[#7a5d47] text-white border border-[#7a5d47]"
                          : "border border-[#c9bda4] hover:bg-[#e8ddae]"
                          }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
              </div>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="px-4 py-2 border border-[#c9bda4] rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#e8ddae] transition-colors"
              >
                Next →
              </button>
              <span className="text-sm text-gray-600 ml-2">
                Page {currentPage} of {totalPages} ({filteredVendors.length} suppliers)
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* =========================
   VENDOR CARD COMPONENT
========================= */
function VendorCard({ vendor, navigate }) {
  const [isFavorite, setIsFavorite] = useState(false);

  const toggleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  };

  const handleChatClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login to chat with suppliers");
      return;
    }

    const firebaseUid = vendor.firebase_uid || vendor.user_firebase_uid;

    if (!firebaseUid) {
      console.error("Supplier missing firebase_uid:", vendor);
      toast.error("Unable to start chat with this Supplier");
      return;
    }

    navigate(`/chat?to=${encodeURIComponent(firebaseUid)}`);
  };

  const handleBookNow = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login to book suppliers");
      return;
    }

    const vendorUserId = vendor.UserID || vendor.ID;
    navigate('/create-booking', {
      state: {
        vendorUserId,
        vendorName: vendor.BusinessName,
        serviceName: vendor.BusinessName
      }
    });
  };

  // Use vendor.avatar (business logo) instead of user_avatar (personal picture)
  const vendorImage = vendor.avatar || vendor.HeroImageUrl || "/images/placeholder.svg";

  // Parse gallery if it's a JSON string (matching venue logic)
  let galleryImages = [];
  if (vendor.gallery) {
    try {
      galleryImages = typeof vendor.gallery === 'string'
        ? JSON.parse(vendor.gallery)
        : (Array.isArray(vendor.gallery) ? vendor.gallery : []);
    } catch (e) {
      console.error("Error parsing vendor gallery:", e);
      galleryImages = [];
    }
  }

  return (
    <Link
      to={`/vendor-profile?id=${encodeURIComponent(vendor.UserID || vendor.ID)}&listingId=${encodeURIComponent(vendor.id)}`}
      className="group bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col h-full"
    >
      {/* Image Container - Match Venue styling */}
      <div className="relative h-48 overflow-hidden bg-gray-200">
        <img
          src={vendorImage}
          alt={vendor.BusinessName || "Vendor"}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          onError={(e) => {
            e.target.src = "/images/placeholder.svg";
          }}
        />

        {/* Overlay Icons - Match Venue positioning */}
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            onClick={toggleFavorite}
            className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
            title="Add to favorites"
          >
            <svg
              className={`w-5 h-5 transition-colors ${isFavorite ? "fill-red-500 stroke-red-500" : "fill-none stroke-gray-700"}`}
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>

          <button
            onClick={handleChatClick}
            className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
            title="Chat with supplier"
          >
            <svg
              className="w-5 h-5 stroke-gray-700"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2"
            >
              <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Gallery Preview Strip - Match Venue layout */}
      {galleryImages.length > 0 && (
        <div className="flex gap-1 p-2 bg-gray-50">
          {galleryImages.slice(0, 3).map((img, idx) => (
            <div key={idx} className="flex-1 h-16 rounded overflow-hidden">
              <img
                src={img}
                alt={`Gallery ${idx + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Card Content - Match Venue structure */}
      <div className="p-4 flex flex-col flex-1" style={{ minHeight: '180px' }}>
        <h3 className="font-semibold text-gray-800 mb-1 line-clamp-1 group-hover:text-[#7a5d47] transition-colors">
          {vendor.BusinessName || "Unnamed Supplier"}
        </h3>

        {/* Location - Match Venue styling */}
        {vendor.BusinessAddress && (
          <p className="text-sm text-gray-600 flex items-center gap-1 mb-2 line-clamp-1">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {vendor.BusinessAddress}
          </p>
        )}

        {/* Category Badge - Inline like Venue subcategory */}
        {vendor.Category && (
          <div className="mb-2">
            <span className="inline-block px-2 py-1 bg-[#e8ddae]/50 text-xs rounded-full">
              {vendor.Category}
            </span>
          </div>
        )}

        {/* Description - Truncated to 2 lines for context */}
        <div className="mb-3" style={{ minHeight: '40px' }}>
          {(vendor.Description || vendor.bio) && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {vendor.Description || vendor.bio}
            </p>
          )}
        </div>

        {/* Action Buttons - Two button layout */}
        <div className="mt-auto flex gap-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.location.href = `/vendor-profile?id=${encodeURIComponent(vendor.UserID || vendor.ID)}&listingId=${encodeURIComponent(vendor.id)}`;
            }}
            className="flex-1 px-3 py-2 bg-[#7a5d47] hover:bg-[#654a38] text-white text-sm font-medium rounded-lg transition-colors"
          >
            View Profile
          </button>
          <button
            onClick={handleChatClick}
            className="flex-1 px-3 py-2 border-2 border-[#7a5d47] text-[#7a5d47] hover:bg-[#7a5d47] hover:text-white text-sm font-medium rounded-lg transition-colors"
          >
            Message
          </button>
        </div>
      </div>
    </Link>
  );
}
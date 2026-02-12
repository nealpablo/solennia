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
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
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
          setLoading(false);
          return;
        }

        const json = await res.json();
        //  FILTER OUT VENUE VENDORS
        const nonVenueVendors = (json.vendors || []).filter(v => v.Category !== "Venue");
        setVendors(Array.isArray(nonVenueVendors) ? nonVenueVendors : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredVendors = filter === "all"
    ? vendors
    : vendors.filter(v => 
        (v.Category || "").toLowerCase() === filter.toLowerCase()
      );

  const totalPages = Math.max(1, Math.ceil(filteredVendors.length / PER_PAGE));
  const startIdx = (currentPage - 1) * PER_PAGE;
  const visibleVendors = filteredVendors.slice(startIdx, startIdx + PER_PAGE);

  const handlePageChange = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

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
              <VendorCard key={vendor.ID || vendor.UserID} vendor={vendor} navigate={navigate} />
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
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === p
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

  const handleViewProfile = (e) => {
    e.preventDefault();
    navigate(`/vendor-profile?id=${encodeURIComponent(vendor.UserID || vendor.ID)}`);
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
  const vendorImage = vendor.avatar || vendor.HeroImageUrl || "https://via.placeholder.com/400x300?text=Vendor+Image";

  return (
    <div 
      className="vendor-card group cursor-pointer flex flex-col h-full"
      onClick={handleViewProfile}
    >
      {/* Vendor Image */}
      <div className="relative overflow-hidden rounded-t-lg aspect-[4/3]">
        <img
          src={vendorImage}
          alt={vendor.BusinessName || "Vendor"}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          onError={(e) => {
            e.target.src = "https://via.placeholder.com/400x300?text=No+Image";
          }}
        />
        
        {/* Overlay Icons */}
        <div className="absolute top-3 right-3 flex gap-2">
        <button
          onClick={toggleFavorite}
          className="w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-md"
        >
          <svg
            className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'fill-none text-gray-600'}`}
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
        <button
          onClick={handleChatClick}
          className="w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-md"
          title="Chat with supplier"
        >
          <svg className="w-5 h-5 stroke-gray-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a4 4 0 01-4 4H7l-4 3V7a4 4 0 014-4h10a4 4 0 014 4z" />
          </svg>
        </button>
        </div>

        {/* Category Badge */}
        <div className="absolute bottom-3 left-3">
          <span className="px-3 py-1 bg-[#7a5d47] text-white text-xs font-semibold rounded-full">
            {vendor.Category || "General"}
          </span>
        </div>
      </div>

      {/* Vendor Info */}
      <div className="p-4 bg-white rounded-b-lg flex-1 flex flex-col">
        <h3 className="font-bold text-lg mb-1 text-gray-800 line-clamp-1">
          {vendor.BusinessName || "Unnamed Supplier"}
        </h3>
        
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {vendor.Description || vendor.bio || "No description available"}
        </p>

        {/* Location */}
        {vendor.BusinessAddress && (
          <div className="flex items-center text-sm text-gray-500 mb-3">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="line-clamp-1">{vendor.BusinessAddress}</span>
          </div>
        )}

        {/* Action Buttons - Pushed to bottom */}
        <div className="flex gap-2 mt-auto">
          <button
            onClick={handleViewProfile}
            className="flex-1 px-4 py-2 bg-[#7a5d47] text-white text-sm font-semibold rounded-lg hover:bg-[#5d4436] transition-colors"
          >
            View Profile
          </button>
          <button
            onClick={handleChatClick}
            className="px-4 py-2 bg-[#e8ddae] text-gray-800 text-sm font-semibold rounded-lg hover:bg-[#dbcf9f] transition-colors"
            title="Chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
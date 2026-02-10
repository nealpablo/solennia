import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "../utils/toast";

import "../style.css";

const API = 
  import.meta.env.VITE_API_BASE || 
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD 
    ? "https://solennia.up.railway.app/api" : "/api");

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(12);
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

  /* =========================
     FILTERED LIST (NO VENUE CATEGORY)
  ========================= */
  const filteredVendors = filter === "all"
    ? vendors
    : vendors.filter(v => 
        (v.Category || "").toLowerCase() === filter.toLowerCase()
      );

  const visibleVendors = filteredVendors.slice(0, visibleCount);

  const handleShowMore = () => {
    setVisibleCount(prev => prev + 12);
  };

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
            onClick={() => {
              setFilter(f);
              setVisibleCount(12);
            }}
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

          {/* Show More Button */}
          {visibleCount < filteredVendors.length && (
            <div className="text-center">
              <button
                onClick={handleShowMore}
                className="px-8 py-3 bg-[#e8ddae] hover:bg-[#dbcf9f] text-sm font-semibold uppercase rounded-lg transition-colors"
              >
                Show More
              </button>
            </div>
          )}

          {/* End of Results */}
          {visibleCount >= filteredVendors.length && filteredVendors.length > 12 && (
            <div className="text-center text-gray-500 text-sm">
              You've reached the end of the list
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

  // Book Now Handler
  const handleBookNow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login to book suppliers");
      return;
    }

    navigate(`/create-booking?vendor=${encodeURIComponent(vendor.UserID || vendor.ID)}`);
  };

  // ✅ FIX: Use vendor.avatar (business logo) instead of user_avatar (personal picture)
  const vendorImage = vendor.avatar || vendor.HeroImageUrl || "https://via.placeholder.com/400x300?text=Vendor+Image";

  return (
    <div 
      className="vendor-card group cursor-pointer"
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
        
        {/* Favorite Button */}
        <button
          onClick={toggleFavorite}
          className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors shadow-md"
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

        {/* Category Badge */}
        <div className="absolute bottom-3 left-3">
          <span className="px-3 py-1 bg-[#7a5d47] text-white text-xs font-semibold rounded-full">
            {vendor.Category || "General"}
          </span>
        </div>
      </div>

      {/* Vendor Info */}
      <div className="p-4 bg-white rounded-b-lg">
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

        {/* Action Buttons */}
        <div className="flex gap-2">
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
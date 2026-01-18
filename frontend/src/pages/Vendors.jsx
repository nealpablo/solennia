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
        // ✅ FILTER OUT VENUE VENDORS - They should not appear here
        const nonVenueVendors = (json.vendors || []).filter(v => v.category !== "Venue");
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
        (v.category || "").toLowerCase() === filter.toLowerCase()
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
          <p className="text-gray-600">Loading vendors...</p>
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
            {filter === "all" ? "No Vendors Available Yet" : `No ${filter} Vendors Available`}
          </h3>
          <p className="text-gray-500">Check back soon for amazing vendor listings.</p>
        </div>
      ) : (
        <>
          {/* Vendor Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {visibleVendors.map((vendor) => (
              <VendorCard key={vendor.id || vendor.user_id} vendor={vendor} navigate={navigate} />
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
      console.error("Vendor missing firebase_uid:", vendor);
      toast.error("Unable to start chat with this vendor");
      return;
    }

    navigate(`/chat?to=${encodeURIComponent(firebaseUid)}`);
  };

  const handleViewProfile = (e) => {
    e.preventDefault();
    navigate(`/vendor-profile?id=${encodeURIComponent(vendor.user_id || vendor.id)}`);
  };

  // ✅ FIXED: Book Now Handler
  const handleBookNow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login to book this supplier");
      return;
    }

    // ✅ Get the UserID - try multiple field names (case-sensitive)
    const vendorUserId = vendor.UserID || vendor.user_id || vendor.id;
    const vendorName = vendor.business_name || vendor.BusinessName || "Vendor";
    const serviceName = vendor.category || vendor.Category || "";

    console.log("Booking vendor - UserID:", vendorUserId, "Name:", vendorName); // Debug log

    if (!vendorUserId) {
      toast.error("Unable to identify vendor. Please try again.");
      console.error("Vendor missing UserID:", vendor);
      return;
    }

    navigate('/create-booking', {
      state: {
        vendorUserId: vendorUserId,  // ✅ Changed from vendorId to vendorUserId
        vendorName: vendorName,
        serviceName: serviceName
      }
    });
  };

  // Get vendor image
  const vendorImage = vendor.vendor_logo || vendor.hero_image_url || vendor.user_avatar || "https://via.placeholder.com/400x300?text=Vendor+Image";

  // Get description
  const description = vendor.description || vendor.bio || "This vendor has not added a full description yet.";

  return (
    <div className="group bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer">
      {/* Image Container */}
      <div className="relative h-48 overflow-hidden bg-gray-200">
        <img
          src={vendorImage}
          alt={vendor.business_name || "Vendor"}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          onError={(e) => {
            e.target.src = "https://via.placeholder.com/400x300?text=Vendor+Image";
          }}
        />
        
        {/* Heart icon in top right */}
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            onClick={toggleFavorite}
            className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
            title="Add to favorites"
          >
            <svg
              className={`w-5 h-5 transition-colors ${
                isFavorite ? "fill-red-500 stroke-red-500" : "fill-none stroke-gray-700"
              }`}
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2 group-hover:text-[#7a5d47] transition-colors">
          {vendor.business_name || "Vendor"}
        </h3>
        
        <p className="text-sm text-gray-600 flex items-center gap-1 mb-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {vendor.address || "Philippines"}
        </p>

        {vendor.category && (
          <div className="mb-2">
            <span className="inline-block px-2 py-1 bg-[#e8ddae]/50 text-xs rounded-full">
              {vendor.category}
            </span>
          </div>
        )}

        <p className="text-xs text-gray-600 line-clamp-2 mb-3">
          {description}
        </p>

        {/* Three buttons - View Profile, Book Now, Chat */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={handleViewProfile}
            className="flex-1 px-3 py-2 bg-[#7a5d47] hover:bg-[#654a38] text-white text-xs font-medium rounded-lg transition-colors"
          >
            View Profile
          </button>
          
          <button
            onClick={handleBookNow}
            className="flex-1 px-3 py-2 bg-[#8B4513] hover:bg-[#704010] text-white text-xs font-medium rounded-lg transition-colors"
          >
            Book Now
          </button>
        </div>

        {/* Chat button - full width below */}
        <button
          onClick={handleChatClick}
          className="w-full px-3 py-2 bg-[#e8ddae] hover:bg-[#dbcf9f] text-gray-800 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Chat Vendor
        </button>
      </div>
    </div>
  );
}
// src/pages/Venue.jsx - ✅ FIXED VERSION
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import toast from "../utils/toast";

export default function Venue() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(12);
  const [isVenueVendor, setIsVenueVendor] = useState(false);
  const [checkingVendor, setCheckingVendor] = useState(true);

  /* =========================
     FETCH VENUES FROM API
  ========================= */
  useEffect(() => {
    fetchVenues();
    checkVenueVendorStatus();
  }, []);

  const fetchVenues = async () => {
    try {
      const res = await fetch("/api/venues");
      const data = await res.json();
      
      if (res.ok) {
        setVenues(data.venues || []);
      }
    } catch (err) {
      console.error("Failed to fetch venues:", err);
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     ✅ FIXED: CHECK VENUE VENDOR STATUS
  ========================= */
  const checkVenueVendorStatus = async () => {
    const token = localStorage.getItem("solennia_token");
    
    if (!token) {
      setCheckingVendor(false);
      return;
    }

    try {
      const res = await fetch("/api/vendor/status", {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      console.log("Vendor Status Response:", data); // Debug log
      
      // ✅ FIXED: Check vendor.ServiceType and vendor.VerificationStatus
      // OLD (WRONG): data.category === "Venue"
      // NEW (CORRECT): data.vendor?.ServiceType === "Venue"
      if (data.success && 
          data.vendor?.ServiceType === "Venue" && 
          data.vendor?.VerificationStatus === "approved") {
        setIsVenueVendor(true);
        console.log("✅ User is an approved venue vendor!");
      } else {
        console.log("❌ Not a venue vendor:", {
          hasVendor: !!data.vendor,
          serviceType: data.vendor?.ServiceType,
          verificationStatus: data.vendor?.VerificationStatus
        });
      }
    } catch (err) {
      console.error("Failed to check vendor status:", err);
    } finally {
      setCheckingVendor(false);
    }
  };

  const handleCreateListing = () => {
    if (!localStorage.getItem("solennia_token")) {
      toast.warning("Please login first");
      return;
    }

    if (!isVenueVendor) {
      toast.warning("Only approved venue vendors can create listings");
      return;
    }

    // Open the venue listing modal from Modals.jsx
    if (window.openCreateVenueListing) {
      window.openCreateVenueListing();
    } else {
      toast.error("Listing modal not available");
    }
  };

  const handleShowMore = () => {
    setVisibleCount(prev => prev + 12);
  };

  const visibleVenues = venues.slice(0, visibleCount);

  if (loading || checkingVendor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#e8ddae] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading venues...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Venues</h1>
          <p className="text-gray-600">Discover the perfect venue for your special day</p>
        </div>

        {/* Create Venue Listing Button - Only for Approved Venue Vendors */}
        {isVenueVendor && (
          <button
            onClick={handleCreateListing}
            className="px-6 py-3 bg-[#7a5d47] hover:bg-[#654a38] text-white font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Make a Listing
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button className="px-4 py-2 bg-[#e8ddae] rounded-lg text-sm font-medium hover:bg-[#dbcf9f]">
          All Venues
        </button>
        <button className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">
          Churches
        </button>
        <button className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">
          Gardens
        </button>
        <button className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">
          Resorts
        </button>
        <button className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200">
          Conference
        </button>
      </div>

      {/* Empty State or Venue Grid */}
      {venues.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-24 h-24 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Venues Available Yet</h3>
          <p className="text-gray-500 mb-6">
            {isVenueVendor 
              ? "Be the first to add your venue to the platform!"
              : "Check back soon for amazing venue listings."}
          </p>
          {isVenueVendor && (
            <button
              onClick={handleCreateListing}
              className="px-6 py-3 bg-[#e8ddae] hover:bg-[#dbcf9f] text-gray-800 font-semibold rounded-lg transition-colors"
            >
              Create Your First Venue Listing
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Venue Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {visibleVenues.map((venue) => (
              <VenueCard key={venue.id} venue={venue} />
            ))}
          </div>

          {/* Show More Button */}
          {visibleCount < venues.length && (
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
          {visibleCount >= venues.length && venues.length > 12 && (
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
   VENUE CARD COMPONENT
========================= */
function VenueCard({ venue }) {
  const [isFavorite, setIsFavorite] = useState(false);

  const toggleFavorite = (e) => {
    e.preventDefault();
    setIsFavorite(!isFavorite);
    // TODO: Add API call to save favorite
  };

  // Extract image from portfolio or use placeholder
  const venueImage = venue.portfolio || "https://via.placeholder.com/400x300?text=Venue+Image";

  return (
    <Link
      to={`/venue/${venue.id}`}
      className="group bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
    >
      {/* Image Container */}
      <div className="relative h-48 overflow-hidden bg-gray-200">
        <img
          src={venueImage}
          alt={venue.business_name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          onError={(e) => {
            e.target.src = "https://via.placeholder.com/400x300?text=Venue+Image";
          }}
        />
        
        {/* Overlay Icons */}
        <div className="absolute top-3 right-3 flex gap-2">
          {/* Favorite Icon */}
          <button
            onClick={toggleFavorite}
            className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
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

          {/* Info Icon */}
          <button
            onClick={(e) => {
              e.preventDefault();
              // TODO: Show quick info modal
            }}
            className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
          >
            <svg
              className="w-5 h-5 stroke-gray-700"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </button>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2 group-hover:text-[#7a5d47] transition-colors">
          {venue.business_name}
        </h3>
        <p className="text-sm text-gray-600 flex items-center gap-1 mb-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {venue.address}
        </p>

        {/* Venue Type Badge */}
        {venue.venue_subcategory && (
          <div className="mb-2">
            <span className="inline-block px-2 py-1 bg-[#e8ddae]/50 text-xs rounded-full">
              {venue.venue_subcategory}
            </span>
          </div>
        )}

        {/* Additional Info */}
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          {venue.venue_capacity && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {venue.venue_capacity} guests
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
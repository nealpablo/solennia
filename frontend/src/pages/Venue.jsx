import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "../utils/toast";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://solennia.up.railway.app/api" : "/api");

const VENUE_CATEGORIES = [
  { value: "all", label: "All Venues" },
  { value: "Church", label: "Churches" },
  { value: "Garden", label: "Gardens" },
  { value: "Resort", label: "Resorts" },
  { value: "Conference", label: "Conference" },
  { value: "Other", label: "Others" }
];

const PER_PAGE = 8;

export default function Venue() {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isVenueVendor, setIsVenueVendor] = useState(false);
  const [checkingVendor, setCheckingVendor] = useState(true);
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const navigate = useNavigate();

  /* =========================
     FETCH VENUES FROM API
  ========================= */
  useEffect(() => {
    fetchVenues();
    checkVenueVendorStatus();
  }, []);

  const fetchVenues = async () => {
    try {
      const res = await fetch(`${API_BASE}/venues`);
      const data = await res.json();

      if (res.ok) {
        console.log("Venues fetched:", data.venues); // Debug
        setVenues(data.venues || []);
      }
    } catch (err) {
      console.error("Failed to fetch venues:", err);
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     CHECK VENUE  VENDOR STATUS
  ========================= */
  const checkVenueVendorStatus = async () => {
    const token = localStorage.getItem("solennia_token");

    if (!token) {
      setCheckingVendor(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/vendor/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      // Check if venue vendor based on category
      if (data.success && data.category?.toLowerCase() === "venue" && data.status === "approved") {
        setIsVenueVendor(true);
      }
    } catch (err) {
      console.error("Failed to check supplier status:", err);
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
      toast.warning("Only approved venue Suppliers can create listings");
      return;
    }

    navigate("/venue-dashboard");
  };

  // Filter venues by category (DB values: Church, Garden, Resort, Conference, Other)
  const filteredVenues = filter === "all"
    ? venues
    : venues.filter(v => {
      const sub = (v.venue_subcategory || "").trim().toLowerCase();
      const f = filter.toLowerCase();
      if (!sub) return false;
      if (sub === f) return true;
      if (f === "conference" && (sub === "conference" || sub === "conference center")) return true;
      return false;
    });

  const totalPages = Math.max(1, Math.ceil(filteredVenues.length / PER_PAGE));
  const startIdx = (currentPage - 1) * PER_PAGE;
  const visibleVenues = filteredVenues.slice(startIdx, startIdx + PER_PAGE);

  const handlePageChange = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

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
      {/* Page Header - Centered like Vendors.jsx */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl tracking-[0.25em] text-center mb-2">
          VENUES
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Discover the perfect venue for your special day
        </p>

        {/* Create Venue Listing Button - Only for Approved Venue Vendors */}
        {isVenueVendor && (
          <div className="flex justify-center">
            <button
              onClick={handleCreateListing}
              className="px-6 py-3 bg-[#7a5d47] hover:bg-[#654a38] text-white font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Make a Listing
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar - Uses DB values (Church, Garden, etc.) for filtering */}
      <div className="flex flex-wrap gap-3 text-[0.75rem] tracking-[0.2em] uppercase mb-6 justify-center">
        {VENUE_CATEGORIES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-4 py-2 border border-[#c9bda4] rounded-full transition-colors ${filter === value
              ? "bg-[#7a5d47] text-white border-[#7a5d47]"
              : "bg-[#f6f0e8] hover:bg-[#e8ddae]"
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Empty State or Venue Grid */}
      {filteredVenues.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-24 h-24 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            {filter === "all" ? "No Venues Available Yet" : `No ${VENUE_CATEGORIES.find(c => c.value === filter)?.label || filter} Available`}
          </h3>
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
              <VenueCard key={venue.id} venue={venue} navigate={navigate} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-4 py-2 border border-[#c9bda4] rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#e8ddae]"
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
                          ? "bg-[#7a5d47] text-white"
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
                className="px-4 py-2 border border-[#c9bda4] rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#e8ddae]"
              >
                Next →
              </button>
              <span className="text-sm text-gray-600 ml-2">
                Page {currentPage} of {totalPages} ({filteredVenues.length} venues)
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* =========================
   VENUE CARD COMPONENT - 
========================= */
function VenueCard({ venue, navigate }) {
  const [isFavorite, setIsFavorite] = useState(false);

  const toggleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  };

  // Handle booking navigation
  const handleBookNow = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login to book this venue");
      return;
    }

    navigate('/create-venue-booking', {
      state: {
        venueId: venue.id,
        venueName: venue.venue_name || venue.business_name,
        venueType: venue.venue_subcategory,
        capacity: venue.venue_capacity,
        address: venue.address,
        venueImage: venue.logo || venue.portfolio
      }
    });
  };

  const handleChatClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login to chat with venue suppliers");
      return;
    }

    // Check multiple possible firebase_uid fields
    const firebaseUid = venue.firebase_uid
      || venue.user_firebase_uid
      || venue.owner_firebase_uid;

    if (!firebaseUid) {
      toast.error("This venue's contact information is incomplete. Please try again later or contact support.");
      return;
    }

    navigate(`/chat?to=${encodeURIComponent(firebaseUid)}`);
  };

  //  Get image from logo field or portfolio
  const venueImage = venue.logo || venue.portfolio || venue.portfolio_image || venue.HeroImageUrl || "https://via.placeholder.com/400x300?text=Venue+Image";

  // Parse gallery if it's a JSON string
  let galleryImages = [];
  if (venue.gallery) {
    try {
      galleryImages = typeof venue.gallery === 'string'
        ? JSON.parse(venue.gallery)
        : (Array.isArray(venue.gallery) ? venue.gallery : []);
    } catch (e) {
      console.error("Error parsing gallery:", e);
      galleryImages = [];
    }
  }

  return (
    <Link
      to={`/venue/${venue.id}`}
      className="group bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
    >
      {/* Image Container */}
      <div className="relative h-48 overflow-hidden bg-gray-200">
        <img
          src={venueImage}
          alt={venue.venue_name || venue.business_name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          onError={(e) => {
            e.target.src = "https://via.placeholder.com/400x300?text=Venue+Image";
          }}
        />

        {/* Overlay Icons */}
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            onClick={toggleFavorite}
            className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
            title="Add to favorites"
          >
            <svg
              className={`w-5 h-5 transition-colors ${isFavorite ? "fill-red-500 stroke-red-500" : "fill-none stroke-gray-700"
                }`}
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>

          <button
            onClick={handleChatClick}
            className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
            title="Chat with venue"
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

      {/* Gallery Preview Strip */}
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

      {/* Card Content */}
      <div className="p-4 flex flex-col" style={{ minHeight: '180px' }}>
        <h3 className="font-semibold text-gray-800 mb-1 line-clamp-1 group-hover:text-[#7a5d47] transition-colors">
          {venue.venue_name || venue.business_name}
        </h3>
        <p className="text-sm text-gray-600 flex items-center gap-1 mb-2 line-clamp-1">
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {venue.address}
        </p>

        {venue.venue_subcategory && (
          <div className="mb-2">
            <span className="inline-block px-2 py-1 bg-[#e8ddae]/50 text-xs rounded-full">
              {venue.venue_subcategory}
            </span>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between text-xs text-gray-500">
          {venue.venue_capacity && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {venue.venue_capacity} guests
            </span>
          )}
          {galleryImages.length > 0 && (
            <span className="text-[#7a5d47] font-medium">
              📷 {galleryImages.length} photos
            </span>
          )}
        </div>

        <button
          onClick={handleBookNow}
          className="mt-3 w-full px-4 py-2 bg-[#7a5d47] hover:bg-[#654a38] text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Book Now
        </button>
      </div>
    </Link>
  );
}
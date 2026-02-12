// src/pages/VenueDetail.jsx -  Gallery Support
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "../utils/toast";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://solennia.up.railway.app" : "");

export default function VenueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [venue, setVenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedImage, setSelectedImage] = useState(0);

  /* =========================
     FETCH VENUE DATA FROM API
  ========================= */
  useEffect(() => {
    const fetchVenue = async () => {
      try {
        const response = await fetch(`${API_BASE}/venues/${id}`);
        const data = await response.json();

        console.log("Venue detail data:", data); // Debug

        if (response.ok && data.venue) {
          //  Parse gallery properly
          let galleryImages = [];
          if (data.venue.gallery) {
            try {
              galleryImages = typeof data.venue.gallery === 'string'
                ? JSON.parse(data.venue.gallery)
                : (Array.isArray(data.venue.gallery) ? data.venue.gallery : []);
            } catch (e) {
              console.error("Error parsing gallery:", e);
              galleryImages = [];
            }
          }

          //  Get main image
          const mainImage = data.venue.logo
            || data.venue.portfolio
            || data.venue.portfolio_image
            || data.venue.HeroImageUrl
            || "https://via.placeholder.com/800?text=Venue+Image";

          // Combine main image with gallery
          const allImages = [mainImage, ...galleryImages].filter(Boolean);

          setVenue({
            id: data.venue.id,
            firebase_uid: data.venue.firebase_uid,
            owner_name: data.venue.owner_name,
            name: data.venue.venue_name || data.venue.business_name,
            location: data.venue.address,
            images: allImages.length > 0 ? allImages : [mainImage],
            capacity: data.venue.venue_capacity || "Not specified",
            venue_type: data.venue.venue_subcategory || "",
            description: data.venue.description || "No description available.",
            amenities: data.venue.venue_amenities
              ? data.venue.venue_amenities.split(',').map(a => a.trim())
              : [],
            operating_hours: data.venue.venue_operating_hours || "Contact for hours",
            parking: data.venue.venue_parking || "Contact for details",
            packages: data.venue.pricing
              ? [{
                name: "Standard Package",
                price: "Contact for pricing",
                includes: data.venue.pricing.split('\n').filter(Boolean)
              }]
              : [],
            contact: {
              email: data.venue.contact_email || "",
              phone: data.venue.phone || "",
              address: data.venue.address || ""
            }
          });
        } else {
          setVenue(null);
        }
      } catch (error) {
        console.error("Error fetching venue:", error);
        setVenue(null);
      } finally {
        setLoading(false);
      }
    };

    fetchVenue();
  }, [id]);

  const handleBookNow = () => {
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login to book this venue");
      return;
    }

    navigate('/create-venue-booking', {
      state: {
        venueId: venue.id,
        venueName: venue.name,
        venueType: venue.venue_type,
        capacity: venue.capacity,
        address: venue.location,
        venueImage: venue.images[0]
      }
    });
  };

  const handleScheduleVisit = () => {
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login to schedule a visit");
      return;
    }
    // Can implement visit scheduling modal or functionality later
    toast.info("Visit scheduling coming soon! For now, please chat with the venue owner.");
  };

  const handleChatClick = () => {
    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login to chat with this venue");
      return;
    }

    const firebaseUid = venue.firebase_uid
      || venue.user_firebase_uid
      || venue.owner_firebase_uid;

    if (!firebaseUid) {
      toast.error("This venue's contact information is incomplete. Please try again later or contact support.");
      return;
    }

    navigate(`/chat?to=${encodeURIComponent(firebaseUid)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#e8ddae] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading venue details...</p>
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">Venue not found</p>
          <button
            onClick={() => navigate("/venue")}
            className="px-6 py-2 bg-[#e8ddae] hover:bg-[#dbcf9f] rounded-lg"
          >
            Back to Venues
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate("/venue")}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Venues
      </button>

      {/*  Image Gallery with Multiple Images */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Main Image */}
        <div className="h-96 rounded-lg overflow-hidden">
          <img
            src={venue.images[selectedImage] || venue.images[0]}
            alt={venue.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = "https://via.placeholder.com/800?text=Venue+Image";
            }}
          />
        </div>

        {/* Thumbnail Grid */}
        <div className="grid grid-cols-2 gap-4">
          {venue.images.slice(0, 4).map((img, idx) => (
            <div
              key={idx}
              className={`h-[11.5rem] rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${selectedImage === idx ? 'border-[#7a5d47]' : 'border-transparent hover:border-gray-300'
                }`}
              onClick={() => setSelectedImage(idx)}
            >
              <img
                src={img}
                alt={`${venue.name} ${idx + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = "https://via.placeholder.com/400?text=Image";
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Image Counter */}
      {venue.images.length > 1 && (
        <div className="text-center text-sm text-gray-600 mb-4">
          Image {selectedImage + 1} of {venue.images.length}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h1 className="text-3xl font-bold text-gray-800">{venue.name}</h1>
              {venue.venue_type && (
                <span className="px-3 py-1 bg-[#e8ddae] text-sm font-medium rounded-full">
                  {venue.venue_type}
                </span>
              )}
            </div>

            {venue.owner_name && (
              <p className="text-sm text-gray-600 mb-2">
                Managed by <span className="font-medium">{venue.owner_name}</span>
              </p>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-4 text-gray-600 flex-wrap">
                <span className="flex items-center gap-1">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" strokeWidth="2" />
                  </svg>
                  {venue.location}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Capacity: {venue.capacity} guests
                </span>
              </div>

              {(venue.operating_hours || venue.parking) && (
                <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap mt-2">
                  {venue.operating_hours && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {venue.operating_hours}
                    </span>
                  )}
                  {venue.parking && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                      </svg>
                      {venue.parking}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-300 mb-6">
            <div className="flex gap-6">
              {["overview", "packages", "amenities"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-sm font-medium uppercase transition-colors ${activeTab === tab
                      ? "border-b-2 border-[#7a5d47] text-[#7a5d47]"
                      : "text-gray-600 hover:text-gray-800"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <div className="prose max-w-none">
              <h3 className="text-lg font-semibold mb-3">About This Venue</h3>
              <p className="text-gray-700 leading-relaxed">{venue.description}</p>
            </div>
          )}

          {activeTab === "packages" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Available Packages</h3>
              {venue.packages.length > 0 ? (
                venue.packages.map((pkg, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-semibold text-gray-800">{pkg.name}</h4>
                      <span className="text-xl font-bold text-[#7a5d47]">{pkg.price}</span>
                    </div>
                    <ul className="space-y-2">
                      {pkg.includes.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="text-gray-600">Contact venue for package details.</p>
              )}
            </div>
          )}

          {activeTab === "amenities" && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Venue Amenities</h3>
              {venue.amenities.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {venue.amenities.map((amenity, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-gray-700">
                      <svg className="w-5 h-5 text-[#7a5d47]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {amenity}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">Contact venue for amenities information.</p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-lg p-6 sticky top-4">
            <h3 className="font-semibold text-lg mb-4">Contact Venue</h3>

            <div className="space-y-4 mb-6">
              {venue.contact.email && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Email</p>
                  <a href={`mailto:${venue.contact.email}`} className="text-[#7a5d47] hover:underline break-words">
                    {venue.contact.email}
                  </a>
                </div>
              )}

              {venue.contact.phone && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Phone</p>
                  <a href={`tel:${venue.contact.phone}`} className="text-[#7a5d47] hover:underline">
                    {venue.contact.phone}
                  </a>
                </div>
              )}

              <div>
                <p className="text-sm text-gray-600 mb-1">Address</p>
                <p className="text-gray-800">{venue.contact.address}</p>
              </div>
            </div>

            {/* Prominent Book Now Button */}
            <button
              onClick={handleBookNow}
              className="w-full bg-[#7a5d47] hover:bg-[#654a38] text-white font-semibold py-3 px-6 rounded-lg transition-colors mb-3 flex items-center justify-center gap-2 text-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Book This Venue
            </button>

            {/* Secondary Actions Grid */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleChatClick}
                className="w-full bg-[#e8ddae] hover:bg-[#dbcf9f] text-gray-800 font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Chat
              </button>

              <button
                onClick={handleScheduleVisit}
                className="w-full border-2 border-[#7a5d47] hover:bg-[#7a5d47] hover:text-white text-gray-800 font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Visit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
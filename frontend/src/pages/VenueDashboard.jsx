// src/pages/VenueDashboard.jsx - Dashboard for Venue Vendors
import { useEffect, useState } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import "../style.css";

const API = "/api";

export default function VenueDashboard() {
  const token = localStorage.getItem("solennia_token");
  const navigate = useNavigate();

  const [vendor, setVendor] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingVendor, setCheckingVendor] = useState(true);

  // Modals
  const [showCreateListing, setShowCreateListing] = useState(false);
  const [editingListing, setEditingListing] = useState(null);

  // Form state
  const [listingForm, setListingForm] = useState({
    venue_name: "",
    venue_subcategory: "",
    venue_capacity: "",
    venue_amenities: "",
    venue_operating_hours: "",
    venue_parking: "",
    description: "",
    pricing: "",
    address: "",
    contact_email: "",
    portfolio: null,
  });

  const [imagePreview, setImagePreview] = useState(null);

  /* ================= CHECK IF VENUE VENDOR ================= */
  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }
    checkVenueVendorStatus();
  }, [token, navigate]);

  const checkVenueVendorStatus = async () => {
    try {
      const res = await fetch(`${API}/vendor/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      console.log("Venue Vendor Check:", data);
      
      // Check if user is approved venue vendor
      const isVenueVendor = data.success &&
                           (data.category === "Venue" || 
                            data.vendor?.ServiceType === "Venue" || 
                            data.vendor?.Category === "Venue") &&
                           (data.vendor?.VerificationStatus === "approved" || data.status === "approved");
      
      if (!isVenueVendor) {
        alert("Access denied - Only approved venue vendors can access this page");
        navigate("/");
        return;
      }

      setCheckingVendor(false);
      loadVenueData();
    } catch (err) {
      console.error("Failed to check vendor status:", err);
      navigate("/");
    }
  };

  /* ================= LOAD VENUE DATA ================= */
  const loadVenueData = async () => {
    try {
      // Get vendor info
      const vendorRes = await fetch(`${API}/vendor/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const vendorData = await vendorRes.json();
      setVendor(vendorData.vendor);

      // Get all venue listings for this vendor
      const listingsRes = await fetch(`${API}/venues`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const listingsData = await listingsRes.json();
      
      // Filter to only show this vendor's listings
      // Note: You may need to add an endpoint to get only user's venues
      setListings(listingsData.venues || []);
      
    } catch (err) {
      console.error("Failed to load venue data:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ================= HANDLE IMAGE UPLOAD ================= */
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setListingForm({ ...listingForm, portfolio: file });

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  /* ================= CREATE/UPDATE LISTING ================= */
  const handleSubmitListing = async (e) => {
    e.preventDefault();

    if (!listingForm.venue_name.trim() || !listingForm.address.trim() || !listingForm.pricing.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const formData = new FormData();
      
      Object.keys(listingForm).forEach(key => {
        if (listingForm[key]) {
          formData.append(key, listingForm[key]);
        }
      });

      const endpoint = editingListing 
        ? `/api/venue/listings/${editingListing.id}`
        : "/api/venue/listings";
        
      const method = editingListing ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();

      if (data.success) {
        alert(editingListing ? "Listing updated!" : "Listing created!");
        setShowCreateListing(false);
        setEditingListing(null);
        resetForm();
        loadVenueData();
      } else {
        alert(data.error || "Failed to save listing");
      }
    } catch (err) {
      console.error("Submit error:", err);
      alert("Failed to save listing");
    }
  };

  /* ================= EDIT LISTING ================= */
  const handleEditListing = (listing) => {
    setEditingListing(listing);
    setListingForm({
      venue_name: listing.business_name || "",
      venue_subcategory: listing.venue_subcategory || "",
      venue_capacity: listing.venue_capacity || "",
      venue_amenities: listing.venue_amenities || "",
      venue_operating_hours: listing.venue_operating_hours || "",
      venue_parking: listing.venue_parking || "",
      description: listing.description || "",
      pricing: listing.pricing || "",
      address: listing.address || "",
      contact_email: listing.contact_email || "",
      portfolio: null,
    });
    setImagePreview(listing.portfolio);
    setShowCreateListing(true);
  };

  /* ================= DELETE LISTING ================= */
  const handleDeleteListing = async (id) => {
    if (!confirm("Are you sure you want to delete this listing?")) return;

    try {
      const res = await fetch(`/api/venue/listings/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      if (data.success) {
        alert("Listing deleted!");
        loadVenueData();
      } else {
        alert(data.error || "Failed to delete listing");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete listing");
    }
  };

  /* ================= RESET FORM ================= */
  const resetForm = () => {
    setListingForm({
      venue_name: "",
      venue_subcategory: "",
      venue_capacity: "",
      venue_amenities: "",
      venue_operating_hours: "",
      venue_parking: "",
      description: "",
      pricing: "",
      address: "",
      contact_email: "",
      portfolio: null,
    });
    setImagePreview(null);
  };

  if (checkingVendor || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#e8ddae] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading venue dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Venue Dashboard</h1>
        <p className="text-gray-600">Manage your venue listings and bookings</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Listings</p>
              <p className="text-3xl font-bold text-[#7a5d47]">{listings.length}</p>
            </div>
            <div className="w-12 h-12 bg-[#e8ddae] rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Bookings</p>
              <p className="text-3xl font-bold text-[#7a5d47]">0</p>
            </div>
            <div className="w-12 h-12 bg-[#e8ddae] rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Revenue (This Month)</p>
              <p className="text-3xl font-bold text-[#7a5d47]">₱0</p>
            </div>
            <div className="w-12 h-12 bg-[#e8ddae] rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-[#7a5d47]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Create Listing Button */}
      <div className="mb-6">
        <button
          onClick={() => {
            setEditingListing(null);
            resetForm();
            setShowCreateListing(true);
          }}
          className="px-6 py-3 bg-[#7a5d47] hover:bg-[#654a38] text-white font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-md"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Create New Listing
        </button>
      </div>

      {/* Listings Grid */}
      {listings.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <svg className="w-24 h-24 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Venue Listings Yet</h3>
          <p className="text-gray-500 mb-6">Create your first venue listing to start receiving bookings</p>
          <button
            onClick={() => setShowCreateListing(true)}
            className="px-6 py-3 bg-[#e8ddae] hover:bg-[#dbcf9f] text-gray-800 font-semibold rounded-lg transition-colors"
          >
            Create Your First Listing
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <div key={listing.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow">
              {/* Image */}
              <div className="relative h-48 bg-gray-200">
                <img
                  src={listing.portfolio || "https://via.placeholder.com/400x300?text=No+Image"}
                  alt={listing.business_name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = "https://via.placeholder.com/400x300?text=No+Image";
                  }}
                />
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold text-lg text-gray-800 mb-2 line-clamp-1">
                  {listing.business_name}
                </h3>
                
                {listing.venue_subcategory && (
                  <span className="inline-block px-2 py-1 bg-[#e8ddae]/50 text-xs rounded-full mb-2">
                    {listing.venue_subcategory}
                  </span>
                )}

                <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {listing.venue_capacity || "Capacity not specified"}
                </p>

                <p className="text-sm text-gray-600 mb-3 flex items-center gap-1">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {listing.address}
                </p>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleEditListing(listing)}
                    className="flex-1 px-3 py-2 bg-[#e8ddae] hover:bg-[#dbcf9f] text-sm font-medium rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteListing(listing.id)}
                    className="flex-1 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 text-sm font-medium rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Listing Modal */}
      {showCreateListing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full my-8">
            <div className="p-6 border-b sticky top-0 bg-white rounded-t-lg">
              <h2 className="text-2xl font-bold text-gray-800">
                {editingListing ? "Edit Venue Listing" : "Create New Venue Listing"}
              </h2>
            </div>

            <form onSubmit={handleSubmitListing} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Venue Name */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Venue Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={listingForm.venue_name}
                    onChange={(e) => setListingForm({ ...listingForm, venue_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e8ddae] focus:border-transparent"
                    placeholder="e.g., Grand Ballroom"
                    required
                  />
                </div>

                {/* Venue Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Venue Type</label>
                  <select
                    value={listingForm.venue_subcategory}
                    onChange={(e) => setListingForm({ ...listingForm, venue_subcategory: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e8ddae] focus:border-transparent"
                  >
                    <option value="">Select type</option>
                    <option value="Church">Church</option>
                    <option value="Garden">Garden</option>
                    <option value="Beach">Beach</option>
                    <option value="Resort">Resort</option>
                    <option value="Hotel Ballroom">Hotel Ballroom</option>
                    <option value="Event Hall">Event Hall</option>
                    <option value="Conference Center">Conference Center</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Capacity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Capacity</label>
                  <input
                    type="text"
                    value={listingForm.venue_capacity}
                    onChange={(e) => setListingForm({ ...listingForm, venue_capacity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e8ddae] focus:border-transparent"
                    placeholder="e.g., 200 guests"
                  />
                </div>

                {/* Operating Hours */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Operating Hours</label>
                  <input
                    type="text"
                    value={listingForm.venue_operating_hours}
                    onChange={(e) => setListingForm({ ...listingForm, venue_operating_hours: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e8ddae] focus:border-transparent"
                    placeholder="e.g., 8:00 AM - 10:00 PM"
                  />
                </div>

                {/* Parking */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Parking</label>
                  <input
                    type="text"
                    value={listingForm.venue_parking}
                    onChange={(e) => setListingForm({ ...listingForm, venue_parking: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e8ddae] focus:border-transparent"
                    placeholder="e.g., Free parking for 50 cars"
                  />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={listingForm.address}
                    onChange={(e) => setListingForm({ ...listingForm, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e8ddae] focus:border-transparent"
                    placeholder="Full address"
                    required
                  />
                </div>

                {/* Contact Email */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
                  <input
                    type="email"
                    value={listingForm.contact_email}
                    onChange={(e) => setListingForm({ ...listingForm, contact_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e8ddae] focus:border-transparent"
                    placeholder="contact@venue.com"
                  />
                </div>

                {/* Amenities */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Amenities</label>
                  <textarea
                    value={listingForm.venue_amenities}
                    onChange={(e) => setListingForm({ ...listingForm, venue_amenities: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e8ddae] focus:border-transparent"
                    rows="3"
                    placeholder="e.g., Air conditioning, Sound system, Stage, Dressing rooms"
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={listingForm.description}
                    onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e8ddae] focus:border-transparent"
                    rows="4"
                    placeholder="Describe your venue..."
                  />
                </div>

                {/* Pricing */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pricing <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={listingForm.pricing}
                    onChange={(e) => setListingForm({ ...listingForm, pricing: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e8ddae] focus:border-transparent"
                    placeholder="e.g., ₱50,000 - ₱100,000"
                    required
                  />
                </div>

                {/* Image Upload */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Venue Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e8ddae] focus:border-transparent"
                  />
                  {imagePreview && (
                    <div className="mt-3">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 mt-6 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateListing(false);
                    setEditingListing(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#7a5d47] hover:bg-[#654a38] text-white font-medium rounded-lg transition-colors"
                >
                  {editingListing ? "Update Listing" : "Create Listing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
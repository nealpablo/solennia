// src/pages/VenueListingManagement.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function VenueListingManagement() {
  const navigate = useNavigate();
  const token = localStorage.getItem("solennia_token");
  
  const [isVenueVendor, setIsVenueVendor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  
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

  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  /* =============================================
     CHECK IF USER IS APPROVED VENUE VENDOR
  ============================================= */
  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }

    checkVenueVendorStatus();
    fetchMyListings();
  }, [token]);

  const checkVenueVendorStatus = async () => {
    try {
      const res = await fetch("/api/vendor/status", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      // Check if vendor is approved and category is "Venue"
      if (data.status === "approved" && data.category === "Venue") {
        setIsVenueVendor(true);
      } else {
        setIsVenueVendor(false);
      }
    } catch (error) {
      console.error("Error checking vendor status:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyListings = async () => {
    try {
      const res = await fetch("/api/venue/my-listings", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.success) {
        setListings(data.listings || []);
      }
    } catch (error) {
      console.error("Error fetching listings:", error);
    }
  };

  /* =============================================
     HANDLE IMAGE UPLOAD
  ============================================= */
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setListingForm({ ...listingForm, portfolio: file });
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  /* =============================================
     CREATE/UPDATE LISTING
  ============================================= */
  const handleSubmitListing = async (e) => {
    e.preventDefault();
    setUploadingImage(true);

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
        // Show success message
        alert(editingListing ? "Listing updated!" : "Listing created!");
        
        // Refresh listings
        fetchMyListings();
        
        // Close modal and reset form
        setShowCreateModal(false);
        setEditingListing(null);
        resetForm();
      } else {
        alert(data.message || "Failed to save listing");
      }
    } catch (error) {
      console.error("Error saving listing:", error);
      alert("Failed to save listing");
    } finally {
      setUploadingImage(false);
    }
  };

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

  /* =============================================
     EDIT LISTING
  ============================================= */
  const handleEditListing = (listing) => {
    setEditingListing(listing);
    setListingForm({
      venue_name: listing.venue_name || "",
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
    setShowCreateModal(true);
  };

  /* =============================================
     DELETE LISTING
  ============================================= */
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
        fetchMyListings();
      } else {
        alert(data.message || "Failed to delete listing");
      }
    } catch (error) {
      console.error("Error deleting listing:", error);
      alert("Failed to delete listing");
    }
  };

  /* =============================================
     LOADING STATE
  ============================================= */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f0e8]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#e8ddae] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  /* =============================================
     NOT AUTHORIZED
  ============================================= */
  if (!isVenueVendor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f0e8]">
        <div className="text-center max-w-md p-8">
          <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Restricted</h2>
          <p className="text-gray-600 mb-4">
            This page is only accessible to approved venue vendors.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2 bg-[#7a5d47] text-white rounded-lg hover:opacity-90"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  /* =============================================
     MAIN CONTENT
  ============================================= */
  return (
    <div className="min-h-screen bg-[#f6f0e8] py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">My Venue Listings</h1>
            <p className="text-gray-600">Manage your venue listings and availability</p>
          </div>
          <button
            onClick={() => {
              setEditingListing(null);
              resetForm();
              setShowCreateModal(true);
            }}
            className="px-6 py-3 bg-[#7a5d47] text-white rounded-lg hover:opacity-90 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Listing
          </button>
        </div>

        {/* Listings Grid */}
        {listings.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No listings yet</h3>
            <p className="text-gray-500 mb-4">Create your first venue listing to get started!</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 bg-[#7a5d47] text-white rounded-lg hover:opacity-90"
            >
              Create Listing
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <div key={listing.id} className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                {/* Image */}
                <div className="h-48 bg-gray-200">
                  {listing.portfolio ? (
                    <img
                      src={listing.portfolio}
                      alt={listing.venue_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-lg text-gray-800 mb-1">{listing.venue_name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{listing.address}</p>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                    <span className="px-2 py-1 bg-[#e8ddae]/50 rounded-full">
                      {listing.venue_subcategory}
                    </span>
                    {listing.venue_capacity && (
                      <span>Capacity: {listing.venue_capacity}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditListing(listing)}
                      className="flex-1 px-3 py-2 bg-[#e8ddae] hover:bg-[#dbcf9f] text-sm font-medium rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteListing(listing.id)}
                      className="flex-1 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Listing Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4 overflow-y-auto">
          <div className="bg-[#f6f0e8] rounded-2xl w-full max-w-2xl my-8">
            <div className="sticky top-0 bg-[#e8ddae] p-6 border-b border-gray-300 flex justify-between items-center z-10 rounded-t-2xl">
              <h2 className="text-lg font-semibold">
                {editingListing ? "Edit Listing" : "Create New Listing"}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingListing(null);
                  resetForm();
                }}
                className="text-2xl font-light hover:text-gray-600"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitListing} className="p-6 space-y-4 max-h-[calc(90vh-100px)] overflow-y-auto">
              {/* Venue Name */}
              <div>
                <label className="block text-sm font-semibold uppercase mb-2">
                  Venue Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={listingForm.venue_name}
                  onChange={(e) => setListingForm({ ...listingForm, venue_name: e.target.value })}
                  className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                  placeholder="e.g., Sunset Garden Venue"
                />
              </div>

              {/* Venue Type */}
              <div>
                <label className="block text-sm font-semibold uppercase mb-2">
                  Venue Type <span className="text-red-600">*</span>
                </label>
                <select
                  required
                  value={listingForm.venue_subcategory}
                  onChange={(e) => setListingForm({ ...listingForm, venue_subcategory: e.target.value })}
                  className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                >
                  <option value="">Select venue type</option>
                  <option value="Church">Church / Chapel</option>
                  <option value="Garden">Garden / Outdoor</option>
                  <option value="Resort">Resort / Hotel</option>
                  <option value="Conference">Conference Hall</option>
                  <option value="Ballroom">Ballroom</option>
                  <option value="Restaurant">Restaurant / Private Dining</option>
                  <option value="Beach">Beach / Coastal</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-semibold uppercase mb-2">
                  Address <span className="text-red-600">*</span>
                </label>
                <textarea
                  required
                  value={listingForm.address}
                  onChange={(e) => setListingForm({ ...listingForm, address: e.target.value })}
                  className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                  rows="2"
                  placeholder="Full venue address"
                />
              </div>

              {/* Capacity & Parking */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold uppercase mb-2">
                    Max Capacity <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={listingForm.venue_capacity}
                    onChange={(e) => setListingForm({ ...listingForm, venue_capacity: e.target.value })}
                    className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                    placeholder="200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold uppercase mb-2">
                    Parking Capacity <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={listingForm.venue_parking}
                    onChange={(e) => setListingForm({ ...listingForm, venue_parking: e.target.value })}
                    className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                    placeholder="50 cars"
                  />
                </div>
              </div>

              {/* Operating Hours */}
              <div>
                <label className="block text-sm font-semibold uppercase mb-2">
                  Operating Hours <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={listingForm.venue_operating_hours}
                  onChange={(e) => setListingForm({ ...listingForm, venue_operating_hours: e.target.value })}
                  className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                  placeholder="8:00 AM - 10:00 PM daily"
                />
              </div>

              {/* Amenities */}
              <div>
                <label className="block text-sm font-semibold uppercase mb-2">
                  Amenities <span className="text-red-600">*</span>
                </label>
                <textarea
                  required
                  value={listingForm.venue_amenities}
                  onChange={(e) => setListingForm({ ...listingForm, venue_amenities: e.target.value })}
                  className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                  rows="3"
                  placeholder="Air conditioning, Sound system, Stage, Tables and chairs, etc."
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold uppercase mb-2">
                  Description <span className="text-red-600">*</span>
                </label>
                <textarea
                  required
                  value={listingForm.description}
                  onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })}
                  className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                  rows="4"
                  placeholder="Describe your venue..."
                />
              </div>

              {/* Pricing */}
              <div>
                <label className="block text-sm font-semibold uppercase mb-2">
                  Pricing / Packages <span className="text-red-600">*</span>
                </label>
                <textarea
                  required
                  value={listingForm.pricing}
                  onChange={(e) => setListingForm({ ...listingForm, pricing: e.target.value })}
                  className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                  rows="3"
                  placeholder="Basic Package: ₱50,000&#10;Premium Package: ₱80,000"
                />
              </div>

              {/* Contact Email */}
              <div>
                <label className="block text-sm font-semibold uppercase mb-2">
                  Contact Email <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={listingForm.contact_email}
                  onChange={(e) => setListingForm({ ...listingForm, contact_email: e.target.value })}
                  className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                  placeholder="venue@email.com"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-semibold uppercase mb-2">
                  Venue Image {!editingListing && <span className="text-red-600">*</span>}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  required={!editingListing}
                  onChange={handleImageChange}
                  className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                />
                {imagePreview && (
                  <div className="mt-2">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingListing(null);
                    resetForm();
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingImage}
                  className="flex-1 bg-[#7a5d47] text-white py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {uploadingImage ? "Saving..." : editingListing ? "Update Listing" : "Create Listing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
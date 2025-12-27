// src/pages/VenueDashboard.jsx - ✅ INDIVIDUAL IMAGE UPLOADS
import { useEffect, useState } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import "../style.css";

const API = "/api";

export default function VenueDashboard() {
  const token = localStorage.getItem("solennia_token");
  const navigate = useNavigate();

  const [vendorStatus, setVendorStatus] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCreateListing, setShowCreateListing] = useState(false);
  const [editingListing, setEditingListing] = useState(null);

  // Form state - ✅ Individual images
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
    logo: null,          // Main logo image
    gallery_1: null,     // Gallery image 1
    gallery_2: null,     // Gallery image 2
    gallery_3: null,     // Gallery image 3
  });

  const [imagePreviews, setImagePreviews] = useState({
    logo: null,
    gallery_1: null,
    gallery_2: null,
    gallery_3: null,
  });

  /* ================= CHECK VENUE VENDOR STATUS ================= */
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
      
      if (!data.success) {
        alert("Please apply as a vendor first");
        navigate("/profile");
        return;
      }

      if (data.category?.toLowerCase() !== "venue") {
        alert("Access denied - This page is for venue vendors only");
        navigate("/vendor-dashboard");
        return;
      }

      if (data.status !== "approved") {
        alert("Your venue vendor application is still pending approval");
        navigate("/profile");
        return;
      }

      setVendorStatus(data);
      loadMyListings();
      
    } catch (err) {
      console.error("Failed to check vendor status:", err);
      alert("Error checking vendor status");
      navigate("/");
    }
  };

  /* ================= LOAD VENUE LISTINGS ================= */
  const loadMyListings = async () => {
    try {
      const res = await fetch(`${API}/venue/my-listings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (data.success) {
        setListings(data.listings || []);
      }
      
    } catch (err) {
      console.error("Failed to load venue listings:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ================= ✅ HANDLE INDIVIDUAL IMAGE UPLOADS ================= */
  const handleImageChange = (imageType, file) => {
    if (!file) return;

    setListingForm({ ...listingForm, [imageType]: file });

    // Generate preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreviews(prev => ({ ...prev, [imageType]: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  /* ================= CREATE/UPDATE LISTING ================= */
  const handleSubmitListing = async (e) => {
    e.preventDefault();

    if (!listingForm.venue_name.trim() || !listingForm.address.trim() || !listingForm.pricing.trim()) {
      alert("Please fill in venue name, address, and pricing");
      return;
    }

    if (!editingListing && !listingForm.logo) {
      alert("Please upload a logo image");
      return;
    }

    try {
      const formData = new FormData();
      
      // Add text fields
      const textFields = ['venue_name', 'venue_subcategory', 'venue_capacity', 
                         'venue_amenities', 'venue_operating_hours', 'venue_parking',
                         'description', 'pricing', 'address', 'contact_email'];
      
      textFields.forEach(field => {
        if (listingForm[field]) {
          formData.append(field, listingForm[field]);
        }
      });

      // ✅ Add images (individually)
      if (listingForm.logo) {
        formData.append('logo', listingForm.logo);
      }
      if (listingForm.gallery_1) {
        formData.append('gallery_1', listingForm.gallery_1);
      }
      if (listingForm.gallery_2) {
        formData.append('gallery_2', listingForm.gallery_2);
      }
      if (listingForm.gallery_3) {
        formData.append('gallery_3', listingForm.gallery_3);
      }

      const endpoint = editingListing 
        ? `${API}/venue/listings/${editingListing.id}`
        : `${API}/venue/listings`;
        
      const method = editingListing ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save listing");
      }

      alert(editingListing ? "Listing updated successfully!" : "Listing created successfully!");
      
      resetForm();
      setShowCreateListing(false);
      setEditingListing(null);
      loadMyListings();
      
    } catch (err) {
      console.error("Error submitting listing:", err);
      alert(err.message);
    }
  };

  /* ================= DELETE LISTING ================= */
  const handleDeleteListing = async (listingId) => {
    if (!confirm("Are you sure you want to delete this listing?")) {
      return;
    }

    try {
      const res = await fetch(`${API}/venue/listings/${listingId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete listing");
      }

      alert("Listing deleted successfully!");
      loadMyListings();
      
    } catch (err) {
      console.error("Error deleting listing:", err);
      alert(err.message);
    }
  };

  /* ================= EDIT LISTING ================= */
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
      logo: null,
      gallery_1: null,
      gallery_2: null,
      gallery_3: null,
    });
    
    // Set existing images for preview
    const gallery = Array.isArray(listing.gallery) ? listing.gallery : [];
    setImagePreviews({
      logo: listing.portfolio || listing.HeroImageUrl || null,
      gallery_1: gallery[0] || null,
      gallery_2: gallery[1] || null,
      gallery_3: gallery[2] || null,
    });
    
    setShowCreateListing(true);
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
      logo: null,
      gallery_1: null,
      gallery_2: null,
      gallery_3: null,
    });
    setImagePreviews({
      logo: null,
      gallery_1: null,
      gallery_2: null,
      gallery_3: null,
    });
    setEditingListing(null);
  };

  /* ================= LOADING STATE ================= */
  if (loading) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh" 
      }}>
        <p>Loading venue dashboard...</p>
      </div>
    );
  }

  /* ================= RENDER ================= */
  return (
    <div className="venue-dashboard">
      <style>{`
        .venue-dashboard {
          padding: 80px 20px 40px;
          max-width: 1200px;
          margin: 0 auto;
          font-family: 'Poppins', sans-serif;
        }
        .venue-dashboard h1 {
          color: #7a5d47;
          margin-bottom: 30px;
          font-size: 32px;
        }
        .welcome-card {
          background: #f6f0e8;
          padding: 30px;
          border-radius: 12px;
          margin-bottom: 30px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .welcome-card h2 {
          margin: 0 0 10px 0;
          color: #333;
        }
        .welcome-card p {
          margin: 0 0 20px 0;
          color: #666;
        }
        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.3s;
        }
        .btn-primary {
          background: #7a5d47;
          color: white;
        }
        .btn-primary:hover {
          background: #6a503d;
        }
        .btn-secondary {
          background: #e8ddae;
          color: #333;
        }
        .btn-secondary:hover {
          background: #d8cdae;
        }
        .btn-danger {
          background: #d32f2f;
          color: white;
        }
        .btn-danger:hover {
          background: #b71c1c;
        }
        .listings-section h2 {
          color: #7a5d47;
          margin-bottom: 20px;
        }
        .listings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        .listing-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: transform 0.3s;
        }
        .listing-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }
        .listing-logo-container {
          width: 100%;
          height: 220px;
          overflow: hidden;
          background: #e8ddae;
          position: relative;
        }
        .listing-logo {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }
        .listing-gallery-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
          padding: 10px;
          background: #f9f9f9;
        }
        .listing-gallery-item {
          aspect-ratio: 1;
          overflow: hidden;
          border-radius: 4px;
          background: #e8ddae;
        }
        .listing-gallery-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .listing-image-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #e8ddae 0%, #d8cdae 100%);
          color: #7a5d47;
          font-size: 14px;
          font-weight: 600;
        }
        .listing-content {
          padding: 20px;
        }
        .listing-content h3 {
          margin: 0 0 10px 0;
          color: #333;
          font-size: 20px;
        }
        .listing-content p {
          margin: 5px 0;
          color: #666;
          font-size: 14px;
        }
        .listing-actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
        .no-listings {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .no-listings h3 {
          color: #7a5d47;
          margin-bottom: 15px;
        }
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          overflow-y: auto;
          padding: 20px;
        }
        .modal-content {
          background: white;
          padding: 30px;
          border-radius: 12px;
          max-width: 700px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-content h2 {
          margin-top: 0;
          color: #7a5d47;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
        }
        .form-group label .required {
          color: #d32f2f;
        }
        .form-group input,
        .form-group textarea,
        .form-group select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
        }
        .form-group textarea {
          min-height: 100px;
          resize: vertical;
        }
        /* ✅ Individual Image Upload Boxes */
        .image-upload-box {
          border: 2px dashed #ddd;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          background: #f9f9f9;
          cursor: pointer;
          transition: all 0.3s;
        }
        .image-upload-box:hover {
          border-color: #7a5d47;
          background: #f0f0f0;
        }
        .image-upload-box.has-image {
          border-color: #4caf50;
          background: #f1f8f4;
        }
        .image-upload-box input[type="file"] {
          display: none;
        }
        .upload-icon {
          font-size: 40px;
          color: #7a5d47;
          margin-bottom: 10px;
        }
        .image-preview-container {
          margin-top: 15px;
        }
        .image-preview {
          max-width: 100%;
          border-radius: 8px;
          overflow: hidden;
        }
        .image-preview img {
          width: 100%;
          height: auto;
          display: block;
        }
        .gallery-upload-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-top: 10px;
        }
        .modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 20px;
        }
      `}</style>

      <h1>🏛️ Venue Dashboard</h1>

      {/* Welcome Card */}
      <div className="welcome-card">
        <h2>Welcome, Venue Vendor!</h2>
        <p>Create stunning venue listings with a logo and gallery images to showcase your space.</p>
        <button onClick={() => setShowCreateListing(true)} className="btn btn-primary">
          ➕ Create New Venue Listing
        </button>
      </div>

      {/* Listings Section */}
      <div className="listings-section">
        <h2>Your Venue Listings ({listings.length})</h2>
        
        {listings.length === 0 ? (
          <div className="no-listings">
            <h3>No venue listings yet</h3>
            <p>Create your first venue listing with beautiful images!</p>
            <button onClick={() => setShowCreateListing(true)} className="btn btn-primary">
              Create First Listing
            </button>
          </div>
        ) : (
          <div className="listings-grid">
            {listings.map((listing) => {
              const gallery = Array.isArray(listing.gallery) ? listing.gallery : [];

              return (
                <div key={listing.id} className="listing-card">
                  {/* Logo */}
                  <div className="listing-logo-container">
                    {(listing.portfolio || listing.HeroImageUrl) ? (
                      <img 
                        src={listing.portfolio || listing.HeroImageUrl} 
                        alt={listing.venue_name} 
                        className="listing-logo"
                      />
                    ) : (
                      <div className="listing-image-placeholder">
                        📷 No Logo
                      </div>
                    )}
                  </div>

                  {/* Gallery */}
                  {gallery.length > 0 && (
                    <div className="listing-gallery-grid">
                      {gallery.slice(0, 3).map((img, idx) => (
                        <div key={idx} className="listing-gallery-item">
                          <img src={img} alt={`Gallery ${idx + 1}`} />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="listing-content">
                    <h3>{listing.venue_name}</h3>
                    <p><strong>Type:</strong> {listing.venue_subcategory || "Not specified"}</p>
                    <p><strong>Address:</strong> {listing.address}</p>
                    <p><strong>Capacity:</strong> {listing.venue_capacity || "Not specified"}</p>
                    <p><strong>Pricing:</strong> {listing.pricing}</p>
                    <p><strong>Images:</strong> {gallery.length} gallery photos</p>
                    
                    <div className="listing-actions">
                      <button onClick={() => handleEditListing(listing)} className="btn btn-secondary">
                        ✏️ Edit
                      </button>
                      <button onClick={() => handleDeleteListing(listing.id)} className="btn btn-danger">
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Listing Modal */}
      {showCreateListing && (
        <div className="modal-backdrop" onClick={() => {
          setShowCreateListing(false);
          resetForm();
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingListing ? "✏️ Edit Venue Listing" : "➕ Create New Venue Listing"}</h2>
            
            <form onSubmit={handleSubmitListing}>
              {/* Basic Info */}
              <div className="form-group">
                <label>Venue Name <span className="required">*</span></label>
                <input
                  type="text"
                  value={listingForm.venue_name}
                  onChange={(e) => setListingForm({ ...listingForm, venue_name: e.target.value })}
                  placeholder="Grand Ballroom, Garden Paradise, etc."
                  required
                />
              </div>

              <div className="form-group">
                <label>Venue Type</label>
                <select
                  value={listingForm.venue_subcategory}
                  onChange={(e) => setListingForm({ ...listingForm, venue_subcategory: e.target.value })}
                >
                  <option value="">Select type...</option>
                  <option value="Ballroom">Ballroom</option>
                  <option value="Garden">Garden</option>
                  <option value="Beach">Beach</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Hotel">Hotel</option>
                  <option value="Church">Church</option>
                  <option value="Resort">Resort</option>
                  <option value="Conference">Conference Center</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Capacity</label>
                <input
                  type="text"
                  value={listingForm.venue_capacity}
                  onChange={(e) => setListingForm({ ...listingForm, venue_capacity: e.target.value })}
                  placeholder="e.g., 200 guests"
                />
              </div>

              <div className="form-group">
                <label>Address <span className="required">*</span></label>
                <input
                  type="text"
                  value={listingForm.address}
                  onChange={(e) => setListingForm({ ...listingForm, address: e.target.value })}
                  placeholder="Complete address"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={listingForm.description}
                  onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })}
                  placeholder="Describe your venue..."
                />
              </div>

              <div className="form-group">
                <label>Pricing <span className="required">*</span></label>
                <input
                  type="text"
                  value={listingForm.pricing}
                  onChange={(e) => setListingForm({ ...listingForm, pricing: e.target.value })}
                  placeholder="e.g., ₱50,000 - ₱100,000"
                  required
                />
              </div>

              <div className="form-group">
                <label>Amenities</label>
                <textarea
                  value={listingForm.venue_amenities}
                  onChange={(e) => setListingForm({ ...listingForm, venue_amenities: e.target.value })}
                  placeholder="Air conditioning, Sound system, etc."
                />
              </div>

              <div className="form-group">
                <label>Operating Hours</label>
                <input
                  type="text"
                  value={listingForm.venue_operating_hours}
                  onChange={(e) => setListingForm({ ...listingForm, venue_operating_hours: e.target.value })}
                  placeholder="e.g., 8:00 AM - 12:00 AM"
                />
              </div>

              <div className="form-group">
                <label>Parking</label>
                <input
                  type="text"
                  value={listingForm.venue_parking}
                  onChange={(e) => setListingForm({ ...listingForm, venue_parking: e.target.value })}
                  placeholder="e.g., Free parking for 100 cars"
                />
              </div>

              <div className="form-group">
                <label>Contact Email</label>
                <input
                  type="email"
                  value={listingForm.contact_email}
                  onChange={(e) => setListingForm({ ...listingForm, contact_email: e.target.value })}
                  placeholder="venue@example.com"
                />
              </div>

              {/* ✅ LOGO IMAGE UPLOAD */}
              <div className="form-group">
                <label>
                  Venue Logo {!editingListing && <span className="required">*</span>}
                </label>
                <div 
                  className={`image-upload-box ${imagePreviews.logo ? 'has-image' : ''}`}
                  onClick={() => document.getElementById('logo-input').click()}
                >
                  <input
                    id="logo-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange('logo', e.target.files[0])}
                  />
                  {imagePreviews.logo ? (
                    <div className="image-preview">
                      <img src={imagePreviews.logo} alt="Logo preview" />
                      <p style={{ marginTop: '10px', color: '#4caf50', fontWeight: 'bold' }}>✓ Logo Selected</p>
                    </div>
                  ) : (
                    <>
                      <div className="upload-icon">📸</div>
                      <p><strong>Click to upload logo</strong></p>
                      <small>Main image for your venue (1200x800px recommended)</small>
                    </>
                  )}
                </div>
              </div>

              {/* ✅ GALLERY IMAGES (3 INDIVIDUAL UPLOADS) */}
              <div className="form-group">
                <label>Gallery Images (up to 3 photos)</label>
                <div className="gallery-upload-grid">
                  {/* Gallery 1 */}
                  <div 
                    className={`image-upload-box ${imagePreviews.gallery_1 ? 'has-image' : ''}`}
                    onClick={() => document.getElementById('gallery-1-input').click()}
                  >
                    <input
                      id="gallery-1-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageChange('gallery_1', e.target.files[0])}
                    />
                    {imagePreviews.gallery_1 ? (
                      <div className="image-preview">
                        <img src={imagePreviews.gallery_1} alt="Gallery 1" />
                      </div>
                    ) : (
                      <>
                        <div className="upload-icon" style={{ fontSize: '30px' }}>📷</div>
                        <small>Photo 1</small>
                      </>
                    )}
                  </div>

                  {/* Gallery 2 */}
                  <div 
                    className={`image-upload-box ${imagePreviews.gallery_2 ? 'has-image' : ''}`}
                    onClick={() => document.getElementById('gallery-2-input').click()}
                  >
                    <input
                      id="gallery-2-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageChange('gallery_2', e.target.files[0])}
                    />
                    {imagePreviews.gallery_2 ? (
                      <div className="image-preview">
                        <img src={imagePreviews.gallery_2} alt="Gallery 2" />
                      </div>
                    ) : (
                      <>
                        <div className="upload-icon" style={{ fontSize: '30px' }}>📷</div>
                        <small>Photo 2</small>
                      </>
                    )}
                  </div>

                  {/* Gallery 3 */}
                  <div 
                    className={`image-upload-box ${imagePreviews.gallery_3 ? 'has-image' : ''}`}
                    onClick={() => document.getElementById('gallery-3-input').click()}
                  >
                    <input
                      id="gallery-3-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageChange('gallery_3', e.target.files[0])}
                    />
                    {imagePreviews.gallery_3 ? (
                      <div className="image-preview">
                        <img src={imagePreviews.gallery_3} alt="Gallery 3" />
                      </div>
                    ) : (
                      <>
                        <div className="upload-icon" style={{ fontSize: '30px' }}>📷</div>
                        <small>Photo 3</small>
                      </>
                    )}
                  </div>
                </div>
                <small style={{ color: '#666', fontSize: '12px', marginTop: '8px', display: 'block' }}>
                  Click each box to upload individual images showcasing your venue
                </small>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => {
                  setShowCreateListing(false);
                  resetForm();
                }} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingListing ? "💾 Update Listing" : "✨ Create Listing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

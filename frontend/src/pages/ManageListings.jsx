import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "../utils/toast";
import { useConfirmModal } from "../hooks/useConfirmModal";

const API =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "https://solennia.up.railway.app/api" : "/api");

export default function ManageListings() {
  const navigate = useNavigate();
  const { confirm, ConfirmModal } = useConfirmModal();
  const [searchParams] = useSearchParams();
  const token = localStorage.getItem("solennia_token");

  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const [listingRegion, setListingRegion] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [listingType, setListingType] = useState();
  const [listings, setListings] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // FIX: Separate raw string state for the amenities text input.
  // This lets the user type commas freely without the field fighting them.
  // We only parse it into an array on blur or on save.
  const [amenitiesRaw, setAmenitiesRaw] = useState("");

  const [form, setForm] = useState({
    venue_name: "",
    region: "",
    city: "",
    specific_address: "",
    venue_subcategory: "",
    venue_capacity: "",
    pricing: "",
    description: "",
    amenities: [],
    hero_image: "",
    icon_url: "",
    header_image: "",
    gallery: [],
    services: "",
    event_type: "",
    service_category: "",
    budget_range: "",
    base_price: "",
    package_price: "",
    ai_description: "",
  });

  // ===================================================
  // HELPERS
  // ===================================================

  function parseJwtPayload(t) {
    try {
      const p = t.split('.')[1];
      const decoded = atob(p.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (e) {
      return null;
    }
  }

  function tokenExpired(t) {
    const payload = parseJwtPayload(t);
    if (!payload || !payload.exp) return true;
    return payload.exp * 1000 < Date.now();
  }

  // Strip stray JSON brackets and quotes from a single string value
  function cleanItem(s) {
    return String(s).trim().replace(/^["']|["']$/g, '');
  }

  function ensureArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(cleanItem).filter(Boolean);
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '') return [];
      // Handle JSON array strings like ["tarub","tite","dede"]
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.map(cleanItem).filter(Boolean);
        } catch (e) { }
      }
      // Plain comma-separated — strip stray brackets/quotes
      return trimmed
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map(cleanItem)
        .filter(Boolean);
    }
    return [];
  }

  function capitalizeWords(str) {
    return String(str).toLowerCase().replace(/(^|[\s-])\w/g, c => c.toUpperCase());
  }

  // Parse raw amenities string into a clean, capitalized array
  function parseAmenities(raw) {
    if (!raw) return [];
    return ensureArray(raw).map(capitalizeWords);
  }

  // ===================================================
  // DETECT LISTING TYPE FROM URL
  // ===================================================

  useEffect(() => {
    if (!token || tokenExpired(token)) {
      toast.error("Please log in to manage listings");
      navigate("/login");
      return;
    }

    const hasVenue = searchParams.has('venue');
    const hasVendor = searchParams.has('vendor');

    if (hasVenue) {
      setListingType('venue');
    } else if (hasVendor) {
      setListingType('vendor');
    } else {
      (async () => {
        try {
          const r = await fetch(`${API}/vendor/status`, { headers: { Authorization: `Bearer ${token}` } });
          if (!r.ok) {
            toast.error("Unable to determine listing type");
            return;
          }
          const j = await r.json();
          const cat = (j?.category || "").toLowerCase();
          setListingType(cat === "venue" ? "venue" : "vendor");
        } catch (e) {
          console.error('Error detecting listing type:', e);
          toast.error("Failed to load listing type");
        }
      })();
    }
  }, [token, searchParams, navigate]);

  const isVenue = listingType === 'venue';

  // ===================================================
  // LOAD EXISTING LISTINGS
  // ===================================================

  const loadListings = async () => {
    if (!token || !listingType) return;
    try {
      if (isVenue) {
        const res = await fetch(`${API}/venue/my-listings`, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (res.ok && json.success && Array.isArray(json.venues)) {
          setListings(json.venues);
        } else {
          setListings([]);
        }
      } else {
        const res = await fetch(`${API}/vendor/my-listings`, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (res.ok && json.success && Array.isArray(json.vendors)) {
          setListings(json.vendors);
        } else if (res.ok && json.success && Array.isArray(json.listings)) {
          setListings(json.listings);
        } else {
          setListings([]);
        }
      }
    } catch (err) {
      console.error('Load listings failed', err);
      setListings([]);
    }
  };

  useEffect(() => {
    if (listingType) loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingType]);

  // ===================================================
  // LOAD REGIONS/CITIES
  // ===================================================

  useEffect(() => {
    fetch(`${API}/regions`)
      .then((r) => r.json())
      .then((d) => d.success && d.regions && setRegions(d.regions))
      .catch(() => { });
  }, []);

  const fetchCities = (regionCode) => {
    if (!regionCode) return setCities([]);
    fetch(`${API}/cities/${regionCode}`)
      .then((r) => r.json())
      .then((d) => d.success && d.cities && setCities(d.cities))
      .catch(() => setCities([]));
  };

  const onRegionChange = (v) => {
    setForm((f) => ({ ...f, region: v, city: "" }));
    setListingRegion(v);
    if (v) fetchCities(v);
  };

  // ===================================================
  // CLOUDINARY UPLOAD
  // ===================================================

  async function uploadFileToCloudinary(file, fileType) {
    if (!token) throw new Error("Not authenticated");
    const sigRes = await fetch(`${API}/vendor/get-upload-signature`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ file_type: fileType })
    });
    if (!sigRes.ok) throw new Error("Failed to get signature");
    const sigJson = await sigRes.json();
    const { upload_url, params } = sigJson;

    const fd = new FormData();
    fd.append("file", file);
    Object.entries(params || {}).forEach(([k, v]) => fd.append(k, v));

    const upRes = await fetch(upload_url, { method: "POST", body: fd });
    if (!upRes.ok) throw new Error("Upload failed");
    const upJson = await upRes.json();
    return upJson.secure_url;
  }

  const handleFileInput = async (e, targetField, fileType, multiple = false) => {
    const files = multiple ? Array.from(e.target.files || []) : (e.target.files ? [e.target.files[0]] : []);
    if (!files.length) return;
    try {
      setUploading(true);
      const urls = [];
      for (const f of files) {
        const url = await uploadFileToCloudinary(f, fileType);
        urls.push(url);
      }
      if (multiple) {
        setForm(prev => {
          const existing = ensureArray(prev.gallery);
          const combined = [...existing, ...urls];
          return { ...prev, gallery: combined };
        });
      } else {
        setForm(prev => ({ ...prev, [targetField]: urls[0] || '' }));
      }
      toast.success('Upload successful');
    } catch (err) {
      console.error('Upload error', err);
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ===================================================
  // EDIT LISTING
  // ===================================================

  const startEdit = (item) => {
    setIsEditing(true);
    setEditingId(item.id);

    if (isVenue) {
      const amenitiesArr = ensureArray(item.amenities || item.venue_amenities).map(capitalizeWords);
      // Sync raw string so the input field shows the existing amenities (capitalized)
      setAmenitiesRaw(amenitiesArr.join(', '));

      setForm({
        venue_name: item.venue_name || item.name || "",
        region: item.region || "",
        city: item.city || "",
        specific_address: item.specific_address || item.address || "",
        venue_subcategory: item.venue_subcategory || "",
        venue_capacity: item.venue_capacity || "",
        pricing: item.pricing || "",
        description: item.description || "",
        amenities: amenitiesArr,
        hero_image: item.HeroImageUrl || item.hero_image || "",
        icon_url: item.portfolio || item.logo || item.icon_url || "",
        header_image: item.header_image || "",
        gallery: ensureArray(item.gallery),
        services: "",
        event_type: item.service_type_tag || item.event_type || "",
        service_category: item.service_category || "",
        budget_range: item.budget_tier || item.budget_range || item.price_range || "",
        base_price: item.base_price || "",
        package_price: item.package_price || "",
        ai_description: item.ai_description || "",
      });
      if (item.region) {
        setListingRegion(item.region);
        fetchCities(item.region);
      }
    } else {
      setAmenitiesRaw("");
      setForm({
        venue_name: item.venue_name || item.business_name || "",
        region: item.region || "",
        city: item.city || "",
        specific_address: item.specific_address || "",
        venue_subcategory: "",
        venue_capacity: "",
        pricing: item.pricing || "",
        description: item.description || "",
        amenities: [],
        hero_image: item.hero_image || "",
        icon_url: item.icon_url || "",
        header_image: "",
        gallery: ensureArray(item.gallery),
        services: item.services || "",
        event_type: item.event_type || "",
        service_category: item.service_category || "",
        budget_range: item.budget_range || "",
        base_price: item.base_price || "",
        package_price: item.package_price || "",
        ai_description: item.ai_description || "",
      });
      if (item.region) {
        setListingRegion(item.region);
        fetchCities(item.region);
      }
    }
    window.scrollTo(0, 0);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingId(null);
    setAmenitiesRaw("");
    setForm({
      venue_name: "",
      region: "",
      city: "",
      specific_address: "",
      venue_subcategory: "",
      venue_capacity: "",
      pricing: "",
      description: "",
      amenities: [],
      hero_image: "",
      icon_url: "",
      header_image: "",
      gallery: [],
      services: "",
      event_type: "",
      service_category: "",
      budget_range: "",
      base_price: "",
      package_price: "",
      ai_description: "",
    });
    setListingRegion("");
    setCities([]);
  };

  const startNew = () => {
    setIsEditing(true);
    setEditingId(null);
    setAmenitiesRaw("");
    setForm({
      venue_name: "",
      region: "",
      city: "",
      specific_address: "",
      venue_subcategory: "",
      venue_capacity: "",
      pricing: "",
      description: "",
      amenities: [],
      hero_image: "",
      icon_url: "",
      header_image: "",
      gallery: [],
      services: "",
      event_type: "",
      service_category: "",
      budget_range: "",
      base_price: "",
      package_price: "",
      ai_description: "",
    });
    setListingRegion("");
    setCities([]);
    window.scrollTo(0, 0);
  };

  // ===================================================
  // DELETE LISTING
  // ===================================================

  const deleteListing = async (id) => {
    const confirmed = await confirm({ title: 'Delete this listing?', message: 'This action cannot be undone.' });
    if (!confirmed) return;
    try {
      if (isVenue) {
        const res = await fetch(`${API}/venue/listings/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          toast.success('Listing deleted');
          await loadListings();
        } else {
          const json = await res.json();
          toast.error(json.message || json.error || 'Failed to delete');
        }
      } else {
        const res = await fetch(`${API}/vendor/listings/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          toast.success('Listing deleted');
          await loadListings();
        } else {
          const json = await res.json();
          toast.error(json.message || json.error || 'Failed to delete');
        }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  // ===================================================
  // VALIDATION
  // ===================================================

  const validateForm = () => {
    if (!form.venue_name.trim()) {
      toast.error(isVenue ? "Venue name is required" : "Business name is required");
      return false;
    }
    if (!form.region) {
      toast.error("Region is required");
      return false;
    }
    if (!form.city) {
      toast.error("City is required");
      return false;
    }
    if (!form.specific_address.trim()) {
      toast.error("Specific address is required");
      return false;
    }
    if (isVenue && !form.venue_subcategory) {
      toast.error("Venue category is required");
      return false;
    }
    if (!isVenue && !form.service_category) {
      toast.error("Service category is required");
      return false;
    }
    if (isVenue) {
      if (!form.venue_capacity.trim()) {
        toast.error("Maximum capacity is required");
        return false;
      }
      // FIX: parse amenitiesRaw at validation time to get the final array
      const parsed = parseAmenities(amenitiesRaw);
      if (parsed.length === 0) {
        toast.error("At least one amenity is required");
        return false;
      }
    }
    if (!isVenue && !form.services.trim()) {
      toast.error("Services offered is required");
      return false;
    }
    if (!form.description.trim()) {
      toast.error("Description is required");
      return false;
    }
    if (!form.pricing.trim()) {
      toast.error("Pricing is required");
      return false;
    }
    if (!form.hero_image) {
      toast.error("Hero image is required — please upload one");
      return false;
    }
    if (!form.icon_url) {
      toast.error("Logo / icon image is required — please upload one");
      return false;
    }
    if (ensureArray(form.gallery).length === 0) {
      toast.error("At least one gallery image is required — please upload one");
      return false;
    }
    return true;
  };

  // ===================================================
  // SAVE LISTING
  // ===================================================

  const save = async (e) => {
    e.preventDefault();

    // FIX: flush amenitiesRaw → form.amenities before validation/save
    const parsedAmenities = parseAmenities(amenitiesRaw);
    setForm(f => ({ ...f, amenities: parsedAmenities }));

    if (!validateForm()) return;

    setSaving(true);

    try {
      if (isVenue) {
        const address = [form.specific_address, form.city, form.region].filter(Boolean).join(", ") || form.venue_name;

        const payload = {
          venue_name: form.venue_name,
          address,
          region: form.region || null,
          city: form.city || null,
          specific_address: form.specific_address || null,
          venue_subcategory: form.venue_subcategory || null,
          venue_capacity: form.venue_capacity || null,
          pricing: form.pricing || null,
          description: form.description || null,
          // Use parsedAmenities directly — form.amenities may not have updated yet (setState is async)
          amenities: parsedAmenities,
          hero_image: form.hero_image || null,
          logo: form.icon_url || null,
          gallery: ensureArray(form.gallery),
          event_type: form.event_type || null,
          service_category: form.service_category || null,
          budget_range: form.budget_range || null,
          base_price: form.base_price || null,
          package_price: form.package_price || null,
          ai_description: form.ai_description || null,
        };

        const url = editingId ? `${API}/venue/listings/${editingId}` : `${API}/venue/listings`;
        const method = editingId ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (res.ok && json.success) {
          toast.success(editingId ? "Venue listing updated" : "Venue listing created");
          await loadListings();
          cancelEdit();
        } else {
          toast.error(json.message || json.error || "Failed to save venue listing");
        }
      } else {
        const address = [form.specific_address, form.city, form.region].filter(Boolean).join(", ") || form.venue_name;

        const payload = {
          business_name: form.venue_name,
          address,
          region: form.region || null,
          city: form.city || null,
          specific_address: form.specific_address || null,
          service_category: form.service_category || null,
          services: form.services || null,
          pricing: form.pricing || null,
          description: form.description || null,
          hero_image: form.hero_image || null,
          icon_url: form.icon_url || null,
          gallery: ensureArray(form.gallery),
          event_type: form.event_type || null,
          budget_range: form.budget_range || null,
          base_price: form.base_price || null,
          package_price: form.package_price || null,
          ai_description: form.ai_description || null,
        };

        const url = editingId ? `${API}/vendor/listings/${editingId}` : `${API}/vendor/listings`;
        const method = editingId ? "PUT" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (res.ok && json.success) {
          toast.success(editingId ? "Supplier listing updated" : "Supplier listing created");
          await loadListings();
          cancelEdit();
        } else {
          toast.error(json.message || json.error || "Failed to save supplier listing");
        }
      }
    } catch (err) {
      toast.error(err.message || "Failed to save listing");
    } finally {
      setSaving(false);
    }
  };

  // ===================================================
  // RENDER
  // ===================================================

  if (!listingType) {
    return (
      <div className="max-w-3xl mx-auto px-6 mt-12">
        <div className="bg-white rounded-xl shadow p-6 text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const Req = () => <span className="text-red-600">*</span>;
  const MissingBadge = ({ show }) =>
    show ? <span className="ml-2 text-xs text-red-500 font-medium">(Required)</span> : null;

  // Compute parsed amenities for validation display (doesn't affect typing)
  const parsedAmenitiesForDisplay = parseAmenities(amenitiesRaw);

  return (
    <div className="max-w-4xl mx-auto px-6 mt-12 mb-12">
      <div className="bg-white rounded-xl shadow-lg p-8">
        {/* HEADER */}
        <header className="mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-3xl font-serif text-[#5b4636]">Manage Service</h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${isVenue ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
              {isVenue ? 'Venue' : 'Supplier'}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            {isVenue
              ? "Create and manage your venue listings. These will appear on the Venues page."
              : "Manage your supplier profile. This will appear on the Suppliers page."}
          </p>
        </header>

        {/* EXISTING LISTINGS */}
        {!isEditing && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-[#7a5d47]">
                {isVenue ? "Your Venue Listings" : "Your Supplier Profile"}
              </h3>
              <button
                type="button"
                onClick={startNew}
                className="px-4 py-2 bg-[#7a5d47] text-white rounded-lg shadow hover:bg-[#6a503d] transition-colors"
              >
                {isVenue
                  ? (listings.length > 0 ? "+ Add New Venue" : "Create First Venue")
                  : (listings.length > 0 ? "Add New Service" : "Create Profile")}
              </button>
            </div>

            {listings.length === 0 ? (
              <div className="text-center py-12 bg-gradient-to-br from-[#f6f0e8] to-white rounded-lg border-2 border-dashed border-[#c9bda4]">
                <svg className="mx-auto h-16 w-16 text-[#7a5d47] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <h3 className="text-xl font-semibold text-[#5b4636] mb-2">
                  {isVenue ? "Create Your First Venue Listing" : "Create Your Supplier Profile"}
                </h3>
                <p className="text-gray-600 text-sm mb-4 max-w-md mx-auto">
                  {isVenue
                    ? "Start adding your venues to make them visible to clients. You can create multiple venue listings."
                    : "Complete your supplier profile with details, pricing, and images so clients can discover and book you."}
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>
                    {isVenue ? "Listings appear on the Venues page" : "Your profile appears on the Suppliers page"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {listings.map((item, idx) => {
                  const keyId = item.id || idx;
                  const thumb = item.icon_url || item.logo || item.portfolio || item.hero_image || item.HeroImageUrl || (Array.isArray(item.gallery) && item.gallery[0]) || null;
                  const name = item.venue_name || item.name || item.BusinessName || item.business_name || "Untitled";
                  const desc = (item.description || item.services || "").slice(0, 120);

                  return (
                    <div key={keyId} className="flex items-center justify-between p-4 border border-gray-200 bg-gray-50 rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4 flex-1">
                        {thumb ? (
                          <img src={thumb} alt={name} className="w-20 h-20 object-cover rounded-lg shadow" onError={(e) => e.currentTarget.style.display = 'none'} />
                        ) : (
                          <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="font-semibold text-[#5b4636] text-lg mb-1">{name}</div>
                          <div className="text-sm text-gray-600">{desc}</div>
                          {item.city && item.region && (
                            <div className="text-xs text-gray-500 mt-1">📍 {item.city}, {item.region}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="px-4 py-2 bg-[#7a5d47] text-white rounded-lg shadow hover:bg-[#6a503d] transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteListing(item.id)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* EDIT/CREATE FORM */}
        {isEditing && (
          <form onSubmit={save} className="space-y-6">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
              <p className="text-sm text-blue-800">
                {editingId
                  ? `Editing ${isVenue ? "venue" : "supplier"} listing`
                  : `Creating new ${isVenue ? "venue" : "supplier"} listing`}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500 -mt-2">
              <span className="text-red-500 font-bold">*</span>
              <span>All fields are required</span>
            </div>

            {/* BASIC INFO */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {isVenue ? "Venue Name" : "Business Name"} <Req />
              </label>
              <input
                type="text"
                placeholder={isVenue ? "Enter venue name" : "Enter business name"}
                className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-[#7a5d47] focus:border-[#7a5d47] ${!form.venue_name.trim() ? 'border-red-300' : 'border-gray-300'}`}
                value={form.venue_name}
                onChange={(e) => setForm(f => ({ ...f, venue_name: e.target.value }))}
                required
              />
            </div>

            {/* LOCATION */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Region <Req /></label>
                <select
                  className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-[#7a5d47] ${!form.region ? 'border-red-300' : 'border-gray-300'}`}
                  value={form.region}
                  onChange={(e) => onRegionChange(e.target.value)}
                  required
                >
                  <option value="">Select region</option>
                  {regions.map(r => <option key={r.region_code} value={r.region_code}>{r.region_name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">City <Req /></label>
                <select
                  className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-[#7a5d47] ${!form.city ? 'border-red-300' : 'border-gray-300'}`}
                  value={form.city}
                  onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                  disabled={!listingRegion}
                  required
                >
                  <option value="">Select city</option>
                  {cities.map(c => <option key={c.city_code} value={c.city_name}>{c.city_name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Specific Address <Req /></label>
              <input
                type="text"
                placeholder="Street, building, barangay"
                className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-[#7a5d47] ${!form.specific_address.trim() ? 'border-red-300' : 'border-gray-300'}`}
                value={form.specific_address}
                onChange={(e) => setForm(f => ({ ...f, specific_address: e.target.value }))}
                required
              />
            </div>

            {/* VENUE-SPECIFIC FIELDS */}
            {isVenue && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Venue Category <Req /></label>
                    <select
                      className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-[#7a5d47] ${!form.venue_subcategory ? 'border-red-300' : 'border-gray-300'}`}
                      value={form.venue_subcategory}
                      onChange={(e) => setForm(f => ({ ...f, venue_subcategory: e.target.value }))}
                      required
                    >
                      <option value="">Select category</option>
                      <option value="Church">Church</option>
                      <option value="Garden">Garden</option>
                      <option value="Resort">Resort</option>
                      <option value="Conference">Conference</option>
                      <option value="Other">Others</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Appears on Venues page filter</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Maximum Capacity <Req /></label>
                    <input
                      type="text"
                      placeholder="e.g. 200 guests"
                      className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-[#7a5d47] ${!form.venue_capacity.trim() ? 'border-red-300' : 'border-gray-300'}`}
                      value={form.venue_capacity}
                      onChange={(e) => setForm(f => ({ ...f, venue_capacity: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                {/* FIX: Amenities field now uses amenitiesRaw (plain string) for the input value.
                    onChange updates only the raw string — no splitting while typing.
                    onBlur trims whitespace for a clean display but still doesn't force a split.
                    The actual array is parsed only at validation/save time. */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Amenities (comma-separated) <Req />
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Parking, Air conditioning, Sound system"
                    className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-[#7a5d47] ${parsedAmenitiesForDisplay.length === 0 ? 'border-red-300' : 'border-gray-300'}`}
                    value={amenitiesRaw}
                    onChange={(e) => setAmenitiesRaw(e.target.value)}
                    onBlur={(e) => {
                      // On blur: tidy up trailing/leading whitespace around commas for display,
                      // but keep the full comma-separated string intact so user can keep editing
                      const tidied = e.target.value
                        .split(',')
                        .map(s => s.trim())
                        .join(', ');
                      setAmenitiesRaw(tidied);
                    }}
                    required
                  />
                  {parsedAmenitiesForDisplay.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {parsedAmenitiesForDisplay.map((a, i) => (
                        <span key={i} className="text-xs bg-[#f0e8dc] text-[#5b4636] px-2 py-0.5 rounded-full border border-[#d4c5a9]">
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Type your amenities separated by commas. Tags will preview above.</p>
                </div>
              </>
            )}

            {/* VENDOR-SPECIFIC FIELDS */}
            {!isVenue && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Service Category <Req /></label>
                  <select
                    className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-[#7a5d47] ${!form.service_category ? 'border-red-300' : 'border-gray-300'}`}
                    value={form.service_category}
                    onChange={(e) => setForm(f => ({ ...f, service_category: e.target.value }))}
                    required
                  >
                    <option value="">Select category</option>
                    <option value="Catering">Catering</option>
                    <option value="Photography & Videography">Photography & Videography</option>
                    <option value="Decoration">Decoration</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Others">Others</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Appears on Suppliers page filter</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Services Offered <Req /></label>
                  <textarea
                    placeholder="Describe your services..."
                    className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-[#7a5d47] ${!form.services.trim() ? 'border-red-300' : 'border-gray-300'}`}
                    rows="4"
                    value={form.services}
                    onChange={(e) => setForm(f => ({ ...f, services: e.target.value }))}
                    required
                  />
                </div>
              </>
            )}

            {/* COMMON FIELDS */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description <Req /></label>
              <textarea
                placeholder={isVenue ? "Describe your venue..." : "Describe your business..."}
                className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-[#7a5d47] ${!form.description.trim() ? 'border-red-300' : 'border-gray-300'}`}
                rows="4"
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Pricing <Req /></label>
              <textarea
                placeholder="e.g. ₱10,000 - ₱50,000 or list your packages"
                className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-[#7a5d47] ${!form.pricing.trim() ? 'border-red-300' : 'border-gray-300'}`}
                rows="3"
                value={form.pricing}
                onChange={(e) => setForm(f => ({ ...f, pricing: e.target.value }))}
                required
              />
            </div>

            {/* IMAGE UPLOADS */}
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h4 className="text-lg font-semibold text-[#7a5d47] mb-1">Media & Images</h4>
              <p className="text-xs text-gray-500 mb-4">All three image fields are required before saving.</p>

              <div className="space-y-4">
                {/* Hero Image */}
                <div className={`p-4 rounded-lg border-2 ${!form.hero_image ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-transparent'}`}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Hero Image <Req />
                    <MissingBadge show={!form.hero_image} />
                  </label>
                  {form.hero_image && (
                    <div className="relative mb-2 inline-block">
                      <img src={form.hero_image} alt="Hero" className="w-full h-48 object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, hero_image: '' }))}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-700"
                        title="Remove image"
                      >✕</button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="hero-upload"
                    onChange={(e) => handleFileInput(e, 'hero_image', 'hero', false)}
                  />
                  <label
                    htmlFor="hero-upload"
                    className={`inline-block px-4 py-2 border rounded-lg cursor-pointer transition-colors ${!form.hero_image ? 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                  >
                    {uploading ? "Uploading..." : (form.hero_image ? "Replace Hero Image" : "Upload Hero Image")}
                  </label>
                </div>

                {/* Logo/Icon */}
                <div className={`p-4 rounded-lg border-2 ${!form.icon_url ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-transparent'}`}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Logo / Icon <Req />
                    <MissingBadge show={!form.icon_url} />
                  </label>
                  {form.icon_url && (
                    <div className="relative mb-2 inline-block">
                      <img src={form.icon_url} alt="Logo" className="w-24 h-24 object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, icon_url: '' }))}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-700"
                        title="Remove image"
                      >✕</button>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="logo-upload"
                    onChange={(e) => handleFileInput(e, 'icon_url', 'logo', false)}
                  />
                  <label
                    htmlFor="logo-upload"
                    className={`inline-block px-4 py-2 border rounded-lg cursor-pointer transition-colors ${!form.icon_url ? 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                  >
                    {uploading ? "Uploading..." : (form.icon_url ? "Replace Logo" : "Upload Logo")}
                  </label>
                </div>

                {/* Gallery */}
                <div className={`p-4 rounded-lg border-2 ${ensureArray(form.gallery).length === 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-transparent'}`}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Gallery Images <Req />
                    <MissingBadge show={ensureArray(form.gallery).length === 0} />
                  </label>
                  <p className="text-xs text-gray-500 mb-2">At least one gallery image is required.</p>
                  {ensureArray(form.gallery).length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {ensureArray(form.gallery).map((url, idx) => (
                        <div key={idx} className="relative">
                          <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-24 object-cover rounded-lg" />
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, gallery: ensureArray(f.gallery).filter((_, i) => i !== idx) }))}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-700"
                            title="Remove"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    id="gallery-upload"
                    onChange={(e) => handleFileInput(e, 'gallery', 'gallery', true)}
                  />
                  <label
                    htmlFor="gallery-upload"
                    className={`inline-block px-4 py-2 border rounded-lg cursor-pointer transition-colors ${ensureArray(form.gallery).length === 0 ? 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                  >
                    {uploading ? "Uploading..." : "Add Gallery Images"}
                  </label>
                </div>
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex gap-3 justify-end pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={cancelEdit}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="px-6 py-3 bg-[#7a5d47] text-white rounded-lg hover:bg-[#6a503d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : (editingId ? "Save Changes" : "Create Listing")}
              </button>
            </div>
          </form>
        )}
      </div>
      <ConfirmModal />
    </div>
  );
}
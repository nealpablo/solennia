import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "../utils/toast";

const API = 
  import.meta.env.VITE_API_BASE || 
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD 
    ? "https://solennia.up.railway.app/api" : "/api");

export default function VendorProfileSetup() {
  const navigate = useNavigate();
  const token = localStorage.getItem("solennia_token");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [application, setApplication] = useState(null);
  
  const [form, setForm] = useState({
    bio: "",
    services: "",
    service_areas: "",
  });
  
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [hero, setHero] = useState(null);
  const [heroPreview, setHeroPreview] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }
    
    checkVendorStatus();
  }, [token]);

  async function checkVendorStatus() {
    try {
      const res = await fetch(`${API}/vendor/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (!data.success) {
        toast.error("Unable to load vendor status");
        navigate("/profile");
        return;
      }
      
      // If profile already exists, redirect to dashboard
      if (data.has_profile) {
        toast.info("Profile already complete! Redirecting to dashboard...");
        navigate("/vendor-dashboard");
        return;
      }
      
      // If not approved, redirect to profile
      if (data.status !== "approved") {
        toast.info("Please wait for your application to be approved");
        navigate("/profile");
        return;
      }
      
      // Load application data
      setApplication({
        business_name: "Your Business",
        category: data.category || "General"
      });
      setLoading(false);
      
    } catch (err) {
      console.error("Status check error:", err);
      toast.error("Failed to load vendor status");
      navigate("/profile");
    }
  }

  function handleLogoChange(e) {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Logo must be under 10MB");
        return;
      }
      setLogo(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  }

  function handleHeroChange(e) {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Hero image must be under 10MB");
        return;
      }
      setHero(file);
      setHeroPreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!form.bio.trim() || !form.services.trim()) {
      toast.error("Please fill in all required fields (Bio and Services)");
      return;
    }
    
    setSaving(true);
    
    try {
      const formData = new FormData();
      formData.append("bio", form.bio);
      formData.append("services", form.services);
      formData.append("service_areas", form.service_areas);
      
      if (logo) {
        formData.append("logo", logo);
      }
      
      if (hero) {
        formData.append("hero", hero);
      }
      
      const res = await fetch(`${API}/vendor/profile`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success("Vendor profile created successfully! 🎉");
        
        // Update role in localStorage to ensure proper navigation
        localStorage.setItem("solennia_role", "1");
        
        setTimeout(() => navigate("/vendor-dashboard"), 1500);
      } else {
        toast.error(data.error || "Failed to create profile");
      }
      
    } catch (err) {
      console.error("Profile creation error:", err);
      toast.error("Failed to create profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f0e8] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7a5d47]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f0e8] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#7a5d47] to-[#5d4436] text-white p-8">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <h1 className="text-3xl font-bold">Complete Your Vendor Profile 🎉</h1>
            </div>
            <p className="text-white/90">
              Congratulations! Your application has been approved. 
              Complete your profile to start receiving bookings.
            </p>
          </div>

          {/* Application Info */}
          {application && (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 m-6">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">
                    <strong>Category:</strong> {application.category}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Bio */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Business Bio <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Tell clients about your business, your experience, and what makes you unique..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                rows="5"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                This will be displayed on your vendor profile
              </p>
            </div>

            {/* Services */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Services Offered <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.services}
                onChange={(e) => setForm({ ...form, services: e.target.value })}
                placeholder="List the services you offer (e.g., Wedding Photography, Event Catering, DJ Services)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                rows="4"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Separate multiple services with commas
              </p>
            </div>

            {/* Service Areas */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Service Areas
              </label>
              <input
                type="text"
                value={form.service_areas}
                onChange={(e) => setForm({ ...form, service_areas: e.target.value })}
                placeholder="Where do you serve? (e.g., Metro Manila, Quezon City, Nationwide)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
              />
            </div>

            {/* Logo Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Business Logo (Optional)
              </label>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <div className="relative">
                    <img 
                      src={logoPreview} 
                      alt="Logo preview" 
                      className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setLogo(null);
                        setLogoPreview(null);
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    id="logo-upload"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="logo-upload"
                    className="inline-block px-4 py-2 bg-[#7a5d47] text-white rounded-lg hover:opacity-90 cursor-pointer"
                  >
                    Choose Logo
                  </label>
                  <p className="mt-2 text-xs text-gray-500">
                    Recommended: Square image, max 10MB
                  </p>
                </div>
              </div>
            </div>

            {/* Hero Image Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Cover/Hero Image (Optional)
              </label>
              <div className="space-y-4">
                {heroPreview ? (
                  <div className="relative">
                    <img 
                      src={heroPreview} 
                      alt="Hero preview" 
                      className="w-full h-48 object-cover rounded-lg border-2 border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setHero(null);
                        setHeroPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <svg className="mx-auto w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="mt-2 text-sm text-gray-500">Hero/Cover Image</p>
                    </div>
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    id="hero-upload"
                    accept="image/*"
                    onChange={handleHeroChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="hero-upload"
                    className="inline-block px-4 py-2 bg-[#7a5d47] text-white rounded-lg hover:opacity-90 cursor-pointer"
                  >
                    Choose Hero Image
                  </label>
                  <p className="mt-2 text-xs text-gray-500">
                    Recommended: Wide landscape image (16:9), max 10MB
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#7a5d47] to-[#5d4436] text-white rounded-lg hover:opacity-90 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating Profile...
                  </span>
                ) : (
                  "Create Vendor Profile"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Help Text */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-blue-900 mb-1">What happens next?</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• After creating your profile, you'll be able to access your vendor dashboard</li>
                <li>• Clients will be able to see your profile in the vendor directory</li>
                <li>• You can start receiving and managing booking requests</li>
                <li>• You can upload more photos to your gallery from the dashboard</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
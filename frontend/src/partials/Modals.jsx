// src/partials/Modals.jsx - COMPLETE FILE WITH REDESIGNED PRIVACY & TERMS
import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import toast from "../utils/toast";

const API_BASE = 
  import.meta.env.VITE_API_BASE || 
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD 
    ? "https://solennia.up.railway.app" : "");

// Helper function to convert Firebase error codes to user-friendly messages
const getFirebaseErrorMessage = (error) => {
  const errorCode = error?.code || '';
  
  const errorMessages = {
    // Authentication errors
    'auth/invalid-credential': 'Invalid email or password. Please try again.',
    'auth/user-not-found': 'No account found with this email address.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/email-already-in-use': 'This email is already registered. Please login instead.',
    'auth/weak-password': 'Password is too weak. Please use a stronger password.',
    'auth/operation-not-allowed': 'This operation is not allowed. Please contact support.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your internet connection.',
    'auth/popup-blocked': 'Popup was blocked. Please allow popups for this site.',
    'auth/popup-closed-by-user': 'Authentication was cancelled.',
    'auth/requires-recent-login': 'Please login again to perform this action.',
    'auth/credential-already-in-use': 'This credential is already associated with another account.',
    'auth/invalid-verification-code': 'Invalid verification code.',
    'auth/invalid-verification-id': 'Invalid verification ID.',
    'auth/missing-verification-code': 'Please enter the verification code.',
    'auth/missing-verification-id': 'Verification ID is missing.',
    'auth/account-exists-with-different-credential': 'An account already exists with this email but different sign-in method.',
  };
  
  return errorMessages[errorCode] || error?.message || 'An error occurred. Please try again.';
};

export default function Modals() {

  /* =========================
     STATE
  ========================= */

  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [vendorLoading, setVendorLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // Venue inquiry state
  const [venueInquiry, setVenueInquiry] = useState({
    venueName: "",
    venueId: "",
    name: "",
    email: "",
    phone: "",
    eventDate: "",
    eventType: "",
    guestCount: "",
    message: "",
  });
  const [inquiryLoading, setInquiryLoading] = useState(false);

  // Schedule visit state
  const [scheduleVisit, setScheduleVisit] = useState({
    venueName: "",
    venueId: "",
    name: "",
    email: "",
    phone: "",
    preferredDate: "",
    preferredTime: "",
    message: "",
  });
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Create venue listing state
  const [venueListing, setVenueListing] = useState({
    name: "",
    location: "",
    capacity: "",
    price_range: "",
    description: "",
    amenities: [],
    venue_type: "",
    packages: [{ name: "", price: "", includes: "" }],
    contact_email: "",
    contact_phone: "",
    address: "",
    images: [],
  });
  const [venueListingLoading, setVenueListingLoading] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState([]);

  const [register, setRegister] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: "",
    color: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [vendorForm, setVendorForm] = useState({
    business_name: "",
    full_name: "",
    category: "",
    category_other: "",
    address: "",
    description: "",
    pricing: "",
    contact_email: "",
    permits: null,
    gov_id: null,
    portfolio: null,
    // Venue-specific fields
    venue_subcategory: "",
    venue_capacity: "",
    venue_amenities: "",
    venue_operating_hours: "",
    venue_parking: "",
  });

  /* =========================
     PASSWORD STRENGTH CHECKER
  ========================= */
  const checkPasswordStrength = (password) => {
    if (!password) {
      return { score: 0, label: "", color: "" };
    }

    let score = 0;
    
    // Length check
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    
    // Character variety checks
    if (/[a-z]/.test(password)) score++; // lowercase
    if (/[A-Z]/.test(password)) score++; // uppercase
    if (/[0-9]/.test(password)) score++; // numbers
    if (/[^A-Za-z0-9]/.test(password)) score++; // special chars

    // Determine label and color
    let label = "";
    let color = "";
    
    if (score <= 2) {
      label = "Weak";
      color = "#dc2626"; // red
    } else if (score <= 4) {
      label = "Medium";
      color = "#f59e0b"; // orange
    } else {
      label = "Strong";
      color = "#16a34a"; // green
    }

    return { score, label, color };
  };

  // Update password strength when password changes
  useEffect(() => {
    const strength = checkPasswordStrength(register.password);
    setPasswordStrength(strength);
  }, [register.password]);

  /* =========================
     HELPERS
  ========================= */

  const closeAll = () => {
    document.getElementById("authBackdrop")?.classList.add("hidden");
    document.getElementById("loginModal")?.classList.add("hidden");
    document.getElementById("registerModal")?.classList.add("hidden");
    document.getElementById("forgotPasswordModal")?.classList.add("hidden");
  };

  const openLogin = () => {
    document.getElementById("authBackdrop")?.classList.remove("hidden");
    document.getElementById("registerModal")?.classList.add("hidden");
    document.getElementById("forgotPasswordModal")?.classList.add("hidden");
    document.getElementById("loginModal")?.classList.remove("hidden");
  };

  const openRegister = () => {
    document.getElementById("authBackdrop")?.classList.remove("hidden");
    document.getElementById("loginModal")?.classList.add("hidden");
    document.getElementById("forgotPasswordModal")?.classList.add("hidden");
    document.getElementById("registerModal")?.classList.remove("hidden");
  };

  const openForgotPassword = () => {
    document.getElementById("loginModal")?.classList.add("hidden");
    document.getElementById("registerModal")?.classList.add("hidden");
    document.getElementById("forgotPasswordModal")?.classList.remove("hidden");
  };

  const closePrivacy = () =>
    document.getElementById("privacyModal")?.classList.add("hidden");

  const closeTerms = () =>
    document.getElementById("termsModal")?.classList.add("hidden");

  const closeFeedback = () =>
    document.getElementById("feedbackModal")?.classList.add("hidden");

  // Venue Modal Helpers
  const closeVenueInquiry = () => {
    document.getElementById("venueInquiryModal")?.classList.add("hidden");
    setVenueInquiry({
      venueName: "",
      venueId: "",
      name: "",
      email: "",
      phone: "",
      eventDate: "",
      eventType: "",
      guestCount: "",
      message: "",
    });
  };

  const openVenueInquiry = (venueId, venueName) => {
    setVenueInquiry(prev => ({
      ...prev,
      venueId: venueId || "",
      venueName: venueName || "",
    }));
    document.getElementById("venueInquiryModal")?.classList.remove("hidden");
  };

  const closeScheduleVisit = () => {
    document.getElementById("scheduleVisitModal")?.classList.add("hidden");
    setScheduleVisit({
      venueName: "",
      venueId: "",
      name: "",
      email: "",
      phone: "",
      preferredDate: "",
      preferredTime: "",
      message: "",
    });
  };

  const openScheduleVisit = (venueId, venueName) => {
    setScheduleVisit(prev => ({
      ...prev,
      venueId: venueId || "",
      venueName: venueName || "",
    }));
    document.getElementById("scheduleVisitModal")?.classList.remove("hidden");
  };

  // Venue Listing Modal Helpers
  const closeVenueListing = () => {
    document.getElementById("venueListingModal")?.classList.add("hidden");
    setVenueListing({
      name: "",
      location: "",
      capacity: "",
      price_range: "",
      description: "",
      amenities: [],
      venue_type: "",
      packages: [{ name: "", price: "", includes: "" }],
      contact_email: "",
      contact_phone: "",
      address: "",
      images: [],
    });
    setSelectedAmenities([]);
  };

  const openCreateVenueListing = () => {
    document.getElementById("venueListingModal")?.classList.remove("hidden");
  };

  // Vendor Modal Helpers
  const closeAllVendorModals = () => {
    document.getElementById("vendorTerms")?.classList.add("hidden");
    document.getElementById("vendorBackground")?.classList.add("hidden");
    document.getElementById("vendorMedia")?.classList.add("hidden");
  };

  const openVendorTerms = () => {
    document.getElementById("vendorTerms")?.classList.remove("hidden");
  };

  const openVendorBackground = () => {
    closeAllVendorModals();
    document.getElementById("vendorBackground")?.classList.remove("hidden");
  };

  const openVendorMedia = () => {
    closeAllVendorModals();
    document.getElementById("vendorMedia")?.classList.remove("hidden");
  };

  // Expose to global scope for external buttons
  useEffect(() => {
    window.openVendorModal = openVendorTerms;
    window.openVenueInquiry = openVenueInquiry;
    window.openScheduleVisit = openScheduleVisit;
    window.openCreateVenueListing = openCreateVenueListing;
    window.solenniaLogout = handleLogout;
  }, []);

  /* =========================
     LOGIN
  ========================= */

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const resolveRes = await fetch(
        `${API_BASE}/api/auth/resolve-username?u=${encodeURIComponent(loginIdentifier)}`
      );
      const resolveData = await resolveRes.json();
      if (!resolveRes.ok) throw new Error(resolveData.message);

      const cred = await signInWithEmailAndPassword(
        auth,
        resolveData.email,
        loginPassword
      );

      // Check if email is verified
      if (!cred.user.emailVerified) {
        toast.warning("Please verify your email before logging in. Check your inbox!");
        await auth.signOut();
        return;
      }

      const backendRes = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebase_uid: cred.user.uid,
          email: resolveData.email,
        }),
      });

      const backendData = await backendRes.json();
      if (!backendRes.ok) throw new Error(backendData.message);

      localStorage.setItem("solennia_token", backendData.token);
      localStorage.setItem("solennia_profile", JSON.stringify(backendData.user));
      localStorage.setItem("solennia_role", backendData.role);

      document.getElementById("menuSignIn")?.classList.add("hidden");
      document.getElementById("menuSignUp")?.classList.add("hidden");
      document.getElementById("menuLogout")?.classList.remove("hidden");

      toast.success("Login successful! Welcome back!");
      closeAll();
      
      // Refresh page to update header avatar
      window.location.reload();
    } catch (err) {
      console.error("Login error:", err);
      toast.error(getFirebaseErrorMessage(err));
    }
  };

  /* =========================
     REGISTER
  ========================= */

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      // Validate password strength
      if (passwordStrength.score <= 2) {
        toast.warning("Please use a stronger password");
        return;
      }

      // Validate passwords match
      if (register.password !== register.confirmPassword) {
        toast.error("Passwords do not match!");
        return;
      }

      // Create user in Firebase
      const cred = await createUserWithEmailAndPassword(
        auth,
        register.email,
        register.password
      );

      // Send email verification
      await sendEmailVerification(cred.user);

      // Register in backend
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: register.first_name,
          last_name: register.last_name,
          email: register.email,
          username: register.username,
          firebase_uid: cred.user.uid,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success("Registration successful! Please check your email to verify your account.");
      
      // Sign out user until they verify
      await auth.signOut();
      
      // Clear form
      setRegister({
        first_name: "",
        last_name: "",
        email: "",
        username: "",
        password: "",
        confirmPassword: "",
      });

      openLogin();
    } catch (err) {
      console.error("Registration error:", err);
      toast.error(getFirebaseErrorMessage(err));
    }
  };

  /* =========================
     FORGOT PASSWORD
  ========================= */

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    if (!forgotEmail) {
      toast.warning("Please enter your email address");
      return;
    }

    setForgotLoading(true);

    try {
      // Send password reset email via Firebase
      await sendPasswordResetEmail(auth, forgotEmail);
      
      toast.success("Password reset email sent! Check your inbox.");
      setForgotEmail("");
      closeAll();
    } catch (err) {
      console.error("Password reset error:", err);
      toast.error(getFirebaseErrorMessage(err));
    } finally {
      setForgotLoading(false);
    }
  };

  /* =========================
     LOGOUT
  ========================= */

  const handleLogout = async () => {
    await auth.signOut();

    localStorage.removeItem("solennia_token");
    localStorage.removeItem("solennia_profile");
    localStorage.removeItem("solennia_role");

    document.getElementById("menuLogout")?.classList.add("hidden");
    document.getElementById("menuSignIn")?.classList.remove("hidden");
    document.getElementById("menuSignUp")?.classList.remove("hidden");

    toast.success("Logged out successfully");
    
    // Give toast time to show before redirecting
    setTimeout(() => {
      window.location.href = "/";
    }, 1000);
  };

  /* =========================
     FEEDBACK
  ========================= */

  const submitFeedback = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login first.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: feedback }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success("Thank you for your feedback!");
      setFeedback("");
      closeFeedback();
    } catch (err) {
      toast.error(err.message || "Failed to submit feedback");
    }
  };

  /* =========================
     VENUE INQUIRY
  ========================= */

  const submitVenueInquiry = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login to send an inquiry.");
      openLogin();
      return;
    }

    setInquiryLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/venue/inquiry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(venueInquiry),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send inquiry");

      toast.success("Inquiry sent successfully! The venue will contact you soon.");
      closeVenueInquiry();
    } catch (err) {
      toast.error(err.message || "Failed to send inquiry");
    } finally {
      setInquiryLoading(false);
    }
  };

  /* =========================
     SCHEDULE VISIT
  ========================= */

  const submitScheduleVisit = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login to schedule a visit.");
      openLogin();
      return;
    }

    setScheduleLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/venue/schedule-visit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(scheduleVisit),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to schedule visit");

      toast.success("Visit scheduled successfully! The venue will confirm your appointment.");
      closeScheduleVisit();
    } catch (err) {
      toast.error(err.message || "Failed to schedule visit");
    } finally {
      setScheduleLoading(false);
    }
  };

  /* =========================
     VENUE LISTING CREATION
  ========================= */

  const submitVenueListing = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("solennia_token");
    if (!token) {
      toast.warning("Please login to create a venue listing.");
      openLogin();
      return;
    }

    setVenueListingLoading(true);

    try {
      const form = e.target;
      const formData = new FormData();

      // Basic info
     formData.append("venue_name", form.name.value);
formData.append("venue_subcategory", form.venue_type.value);
formData.append("venue_capacity", form.capacity.value);
formData.append("venue_amenities", selectedAmenities.join(", "));
formData.append("venue_operating_hours", "9:00 AM - 10:00 PM");
formData.append("venue_parking", "Contact for details");
formData.append("address", form.address.value);
formData.append("description", form.description.value);
formData.append("pricing", form.price_range.value);
formData.append("contact_email", form.contact_email.value);


      // Amenities (as comma-separated string)
      formData.append('venue_amenities', selectedAmenities.join(', '));

      // Packages (as text format)
      const packagesText = venueListing.packages
        .map(pkg => `${pkg.name}: ${pkg.price}\nIncludes: ${pkg.includes}`)
        .join('\n\n');
      formData.append('packages', packagesText);

      // Images - Upload first image only (main image)
      const imageFiles = form.images.files;
      if (imageFiles && imageFiles.length > 0) {
        formData.append('portfolio', imageFiles[0]);
      }

      const res = await fetch(`${API_BASE}/api/venue/listings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to create venue listing");
      }

      toast.success("Venue listing created successfully!");
      closeVenueListing();
      
      // Reload the page to show the new venue
      setTimeout(() => window.location.reload(), 1500);
      
    } catch (err) {
      console.error("Venue listing error:", err);
      toast.error(err.message || "Failed to create venue listing");
    } finally {
      setVenueListingLoading(false);
    }
  };

  const addPackage = () => {
    setVenueListing(prev => ({
      ...prev,
      packages: [...prev.packages, { name: "", price: "", includes: "" }]
    }));
  };

  const removePackage = (index) => {
    setVenueListing(prev => ({
      ...prev,
      packages: prev.packages.filter((_, i) => i !== index)
    }));
  };

  const updatePackage = (index, field, value) => {
    setVenueListing(prev => ({
      ...prev,
      packages: prev.packages.map((pkg, i) => 
        i === index ? { ...pkg, [field]: value } : pkg
      )
    }));
  };

  const toggleAmenity = (amenity) => {
    setSelectedAmenities(prev => 
      prev.includes(amenity)
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    );
  };

  /* =========================
     VENDOR ONBOARDING
  ========================= */

  const handleVendorStep1 = (e) => {
    e.preventDefault();
    const form = e.target;
    if (form.checkValidity()) {
      const formData = new FormData(form);
      const category = formData.get("category");
      
      setVendorForm(prev => ({
        ...prev,
        business_name: formData.get("business_name"),
        full_name: formData.get("full_name"),
        contact_email: formData.get("contact_email"),
        category: category,
        category_other: formData.get("category_other") || "",
        address: formData.get("address"),
        // Venue-specific fields
        venue_subcategory: category === "Venue" ? formData.get("venue_subcategory") : "",
        venue_capacity: category === "Venue" ? formData.get("venue_capacity") : "",
        venue_amenities: category === "Venue" ? formData.get("venue_amenities") : "",
        venue_operating_hours: category === "Venue" ? formData.get("venue_operating_hours") : "",
        venue_parking: category === "Venue" ? formData.get("venue_parking") : "",
      }));
      openVendorMedia();
    } else {
      form.reportValidity();
    }
  };

  const submitVendorApplication = async (e) => {
  e.preventDefault();

  const token = localStorage.getItem("solennia_token");
  if (!token) {
    toast.warning("Please login to apply as a vendor.");
    return;
  }

  const form = e.target;
  const formData = new FormData(form);

  // ✅ STRICT 1MB LIMIT - Fast uploads, no blocking
  const maxSize = 1 * 1024 * 1024; // 1MB
  const files = {
    permits: formData.get('permits'),
    gov_id: formData.get('gov_id'),
    portfolio: formData.get('portfolio')
  };

  for (const [key, file] of Object.entries(files)) {
    if (!file || file.size === 0) {
      toast.error(`Please select ${key.replace('_', ' ')}`);
      return;
    }
    
    const fileSizeKB = Math.round(file.size / 1024);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    
    if (file.size > maxSize) {
      toast.error(`${key.replace('_', ' ').toUpperCase()} is too large (${fileSizeMB}MB). Maximum 1MB allowed. Use TinyPNG.com to compress.`);
      return;
    }
  }

  // Append step 1 data
  Object.entries(vendorForm).forEach(([key, value]) => {
    if (value && !["permits", "gov_id", "portfolio"].includes(key)) {
      formData.set(key, value);
    }
  });

  try {
    setVendorLoading(true);
    
    // ✅ Clear progress message
    toast.info("Uploading documents... (5-15 seconds)");

    const res = await fetch(`${API_BASE}/api/vendor/apply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Application failed");

    toast.success("Application submitted successfully! We'll review it soon.");
    closeAllVendorModals();
    
    // Reset form
    setVendorForm({
      business_name: "",
      full_name: "",
      category: "",
      category_other: "",
      address: "",
      description: "",
      pricing: "",
      contact_email: "",
      permits: null,
      gov_id: null,
      portfolio: null,
      venue_subcategory: "",
      venue_capacity: "",
      venue_amenities: "",
      venue_operating_hours: "",
      venue_parking: "",
    });
    
    setTimeout(() => window.location.reload(), 1500);
    
  } catch (err) {
    console.error("Vendor application error:", err);
    toast.error(err.message || "An error occurred");
  } finally {
    setVendorLoading(false);
  }
};



  /* =========================
     RENDER - ALL MODALS
  ========================= */

  return (
    <>
      {/* ================= AUTH BACKDROP ================= */}
      <div
        id="authBackdrop"
        className="fixed inset-0 hidden z-[100] bg-black/40"
        onClick={closeAll}
      />

      {/* ================= LOGIN MODAL ================= */}
      <div
        id="loginModal"
        className="fixed inset-0 hidden z-[200] grid place-items-center pointer-events-none p-4"
      >
        <div 
          className="bg-[#f6f0e8] w-full max-w-md rounded-2xl shadow-xl pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-300 bg-[#e8ddae]">
            <h2 className="text-lg font-semibold">Login</h2>
            <button 
              onClick={closeAll}
              className="text-2xl font-light hover:text-gray-600" 
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold uppercase">
                Username or Email
              </label>
              <input
                type="text"
                required
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold uppercase">
                Password
              </label>
              <div className="relative">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800 mt-0.5"
                >
                  {showLoginPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={openForgotPassword}
                className="text-sm text-gray-600 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="w-full bg-[#e8ddae] hover:bg-[#dbcf9f] text-sm font-semibold uppercase py-2 rounded"
            >
              Login
            </button>

            <p className="text-center text-sm">
              Don't have an account?{" "}<br /><br />
              <button
                type="button"
                onClick={openRegister}
                className="text-gray-600 hover:underline"
              >
                Register here
              </button>
            </p>
          </form>
        </div>
      </div>

      {/* ================= REGISTER MODAL ================= */}
      <div
        id="registerModal"
        className="fixed inset-0 hidden z-[200] grid place-items-center pointer-events-none p-4"
      >
        <div 
          className="bg-[#f6f0e8] w-full max-w-md rounded-2xl shadow-xl pointer-events-auto max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-300 bg-[#e8ddae] sticky top-0 z-10">
            <h2 className="text-lg font-semibold">Register</h2>
            <button 
              onClick={closeAll}
              className="text-2xl font-light hover:text-gray-600" 
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <form onSubmit={handleRegister} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold uppercase">
                  First Name
                </label>
                <input
                  type="text"
                  required
                  value={register.first_name}
                  onChange={(e) =>
                    setRegister({ ...register, first_name: e.target.value })
                  }
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold uppercase">
                  Last Name
                </label>
                <input
                  type="text"
                  required
                  value={register.last_name}
                  onChange={(e) =>
                    setRegister({ ...register, last_name: e.target.value })
                  }
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold uppercase">
                Email
              </label>
              <input
                type="email"
                required
                value={register.email}
                onChange={(e) =>
                  setRegister({ ...register, email: e.target.value })
                }
                className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold uppercase">
                Username
              </label>
              <input
                type="text"
                required
                value={register.username}
                onChange={(e) =>
                  setRegister({ ...register, username: e.target.value })
                }
                className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold uppercase">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={register.password}
                  onChange={(e) =>
                    setRegister({ ...register, password: e.target.value })
                  }
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800"
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {register.password && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${(passwordStrength.score / 6) * 100}%`,
                          backgroundColor: passwordStrength.color
                        }}
                      />
                    </div>
                    <span 
                      className="text-xs font-semibold"
                      style={{ color: passwordStrength.color }}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Use 8+ characters with a mix of letters, numbers & symbols
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold uppercase">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={register.confirmPassword}
                  onChange={(e) =>
                    setRegister({ ...register, confirmPassword: e.target.value })
                  }
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800"
                >
                  {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              
              {/* Password Match Indicator */}
              {register.confirmPassword && (
                <div className="mt-1">
                  {register.password === register.confirmPassword ? (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <span>✓</span> Passwords match
                    </p>
                  ) : (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <span>✗</span> Passwords do not match
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-[#e8ddae] hover:bg-[#dbcf9f] text-sm font-semibold uppercase py-2 rounded"
            >
              Register
            </button>

            <p className="text-center text-sm">
              Already have an account?{" "}<br /><br />
              <button
                type="button"
                onClick={openLogin}
                className="text-gray-600 hover:underline"
              >
                Login here
              </button>
            </p>
          </form>
        </div>
      </div>

      {/* ================= FORGOT PASSWORD MODAL ================= */}
      <div
        id="forgotPasswordModal"
        className="fixed inset-0 hidden z-[200] grid place-items-center pointer-events-none p-4"
      >
        <div 
          className="bg-[#f6f0e8] w-full max-w-md rounded-2xl shadow-xl pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-300 bg-[#e8ddae]">
            <h2 className="text-lg font-semibold">Reset Password</h2>
            <button 
              onClick={closeAll}
              className="text-2xl font-light hover:text-gray-600" 
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <form onSubmit={handleForgotPassword} className="p-6 space-y-4">
            <p className="text-sm text-gray-700">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <div>
              <label className="block text-sm font-semibold uppercase">
                Email Address
              </label>
              <input
                type="email"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="your@email.com"
                className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
              />
            </div>

            <button
              type="submit"
              disabled={forgotLoading}
              className="w-full bg-[#e8ddae] hover:bg-[#dbcf9f] text-sm font-semibold uppercase py-2 rounded disabled:opacity-50"
            >
              {forgotLoading ? "Sending..." : "Send Reset Link"}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={openLogin}
                className="text-sm text-gray-600 hover:underline"
              >
                Back to login
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ================= VENUE INQUIRY MODAL ================= */}
      <div
        id="venueInquiryModal"
        className="fixed inset-0 hidden z-[200] grid place-items-center bg-black/40 p-4"
        onClick={closeVenueInquiry}
      >
        <div 
          className="bg-[#f6f0e8] w-full max-w-2xl rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-300 bg-[#e8ddae] sticky top-0 z-10">
            <h2 className="text-lg font-semibold">Send Inquiry</h2>
            <button 
              onClick={closeVenueInquiry}
              className="text-2xl font-light hover:text-gray-600" 
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <form onSubmit={submitVenueInquiry} className="p-6 space-y-4">
            {venueInquiry.venueName && (
              <div className="bg-[#e8ddae]/30 p-3 rounded-lg">
                <p className="text-sm font-semibold">Venue: {venueInquiry.venueName}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold uppercase">
                  Your Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={venueInquiry.name}
                  onChange={(e) => setVenueInquiry({...venueInquiry, name: e.target.value})}
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold uppercase">
                  Email <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={venueInquiry.email}
                  onChange={(e) => setVenueInquiry({...venueInquiry, email: e.target.value})}
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold uppercase">
                  Phone Number <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={venueInquiry.phone}
                  onChange={(e) => setVenueInquiry({...venueInquiry, phone: e.target.value})}
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold uppercase">
                  Event Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={venueInquiry.eventDate}
                  onChange={(e) => setVenueInquiry({...venueInquiry, eventDate: e.target.value})}
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold uppercase">
                  Event Type <span className="text-red-600">*</span>
                </label>
                <select
                  required
                  value={venueInquiry.eventType}
                  onChange={(e) => setVenueInquiry({...venueInquiry, eventType: e.target.value})}
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                >
                  <option value="">Select event type</option>
                  <option value="Wedding">Wedding</option>
                  <option value="Birthday">Birthday</option>
                  <option value="Corporate">Corporate Event</option>
                  <option value="Conference">Conference</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold uppercase">
                  Expected Guests <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={venueInquiry.guestCount}
                  onChange={(e) => setVenueInquiry({...venueInquiry, guestCount: e.target.value})}
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold uppercase">
                Additional Message
              </label>
              <textarea
                rows="4"
                value={venueInquiry.message}
                onChange={(e) => setVenueInquiry({...venueInquiry, message: e.target.value})}
                placeholder="Tell us more about your event..."
                className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={closeVenueInquiry}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-sm font-medium rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inquiryLoading}
                className="px-6 py-2 bg-[#e8ddae] hover:bg-[#dbcf9f] text-sm font-semibold uppercase rounded disabled:opacity-50"
              >
                {inquiryLoading ? "Sending..." : "Send Inquiry"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ================= SCHEDULE VISIT MODAL ================= */}
      <div
        id="scheduleVisitModal"
        className="fixed inset-0 hidden z-[200] grid place-items-center bg-black/40 p-4"
        onClick={closeScheduleVisit}
      >
        <div 
          className="bg-[#f6f0e8] w-full max-w-2xl rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-300 bg-[#e8ddae] sticky top-0 z-10">
            <h2 className="text-lg font-semibold">Schedule a Visit</h2>
            <button 
              onClick={closeScheduleVisit}
              className="text-2xl font-light hover:text-gray-600" 
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <form onSubmit={submitScheduleVisit} className="p-6 space-y-4">
            {scheduleVisit.venueName && (
              <div className="bg-[#e8ddae]/30 p-3 rounded-lg">
                <p className="text-sm font-semibold">Venue: {scheduleVisit.venueName}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold uppercase">
                  Your Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={scheduleVisit.name}
                  onChange={(e) => setScheduleVisit({...scheduleVisit, name: e.target.value})}
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold uppercase">
                  Email <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={scheduleVisit.email}
                  onChange={(e) => setScheduleVisit({...scheduleVisit, email: e.target.value})}
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold uppercase">
                Phone Number <span className="text-red-600">*</span>
              </label>
              <input
                type="tel"
                required
                value={scheduleVisit.phone}
                onChange={(e) => setScheduleVisit({...scheduleVisit, phone: e.target.value})}
                className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold uppercase">
                  Preferred Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={scheduleVisit.preferredDate}
                  onChange={(e) => setScheduleVisit({...scheduleVisit, preferredDate: e.target.value})}
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold uppercase">
                  Preferred Time <span className="text-red-600">*</span>
                </label>
                <select
                  required
                  value={scheduleVisit.preferredTime}
                  onChange={(e) => setScheduleVisit({...scheduleVisit, preferredTime: e.target.value})}
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                >
                  <option value="">Select time</option>
                  <option value="9:00 AM">9:00 AM</option>
                  <option value="10:00 AM">10:00 AM</option>
                  <option value="11:00 AM">11:00 AM</option>
                  <option value="1:00 PM">1:00 PM</option>
                  <option value="2:00 PM">2:00 PM</option>
                  <option value="3:00 PM">3:00 PM</option>
                  <option value="4:00 PM">4:00 PM</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold uppercase">
                Additional Message
              </label>
              <textarea
                rows="3"
                value={scheduleVisit.message}
                onChange={(e) => setScheduleVisit({...scheduleVisit, message: e.target.value})}
                placeholder="Any special requirements or questions?"
                className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={closeScheduleVisit}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-sm font-medium rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={scheduleLoading}
                className="px-6 py-2 bg-[#e8ddae] hover:bg-[#dbcf9f] text-sm font-semibold uppercase rounded disabled:opacity-50"
              >
                {scheduleLoading ? "Scheduling..." : "Schedule Visit"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ================= FEEDBACK MODAL - REDESIGNED ================= */}
      <div
        id="feedbackModal"
        className="fixed inset-0 hidden z-[200] grid place-items-center bg-black/50 backdrop-blur-sm p-4"
        onClick={closeFeedback}
      >
        <div 
          className="bg-[#f6f0e8] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Icon */}
          <div className="bg-gradient-to-r from-[#7a5d47] to-[#5d4436] px-6 py-5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-wide">Send Feedback</h2>
                <p className="text-sm text-white/80">We'd love to hear from you!</p>
              </div>
            </div>
            <button 
              onClick={closeFeedback}
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all border border-white/20" 
              aria-label="Close"
            >
              <span className="text-white text-xl">&times;</span>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Introduction Card */}
            <div className="bg-[#e8ddae] border-l-4 border-[#7a5d47] rounded-lg p-4 mb-6 flex items-start space-x-3">
              <svg className="w-6 h-6 text-[#7a5d47] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 leading-relaxed">
                  Your feedback helps us improve Solennia. Whether it's a suggestion, bug report, 
                  or just a comment, we appreciate your input and will review it carefully.
                </p>
              </div>
            </div>

            <form onSubmit={submitFeedback} className="space-y-6">
              {/* Message Field */}
              <div>
                <label className="block text-sm font-bold text-gray-900 uppercase mb-2">
                  Your Message <span className="text-red-600">*</span>
                </label>
                <textarea
                  required
                  rows="6"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Share your thoughts, ideas, or report issues here..."
                  className="w-full rounded-lg bg-gray-50 border-2 border-gray-300 p-3 focus:border-[#7a5d47] focus:ring-2 focus:ring-[#7a5d47]/20 transition-all text-sm"
                />
                <p className="text-xs text-gray-600 mt-2">
                  Minimum 10 characters. Be as detailed as possible.
                </p>
              </div>

              {/* Tips Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-bold text-blue-900 text-sm mb-2 flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/>
                  </svg>
                  <span>Tips for better feedback:</span>
                </h4>
                <ul className="text-xs text-blue-800 space-y-1 ml-6">
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>Be specific about what you experienced</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>Include steps to reproduce if reporting a bug</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>Suggest improvements or alternatives</span>
                  </li>
                </ul>
              </div>

              {/* Contact Response Option */}
              <div className="bg-gradient-to-br from-[#e8ddae] to-[#f6f0e8] border border-[#7a5d47]/20 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-[#7a5d47] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 mb-1">Need a response?</p>
                    <p className="text-xs text-gray-700">
                      We'll review all feedback. For urgent matters or to receive a direct response, 
                      please contact us at{' '}
                      <a href="mailto:solenniainquires@gmail.com" className="font-semibold text-[#7a5d47] hover:underline">
                        solenniainquires@gmail.com
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeFeedback}
                  className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#7a5d47] hover:bg-[#5d4436] text-white font-semibold text-sm rounded-lg transition-colors"
                >
                  Submit Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ================= PRIVACY POLICY MODAL - REDESIGNED ================= */}
      <div
        id="privacyModal"
        className="fixed inset-0 hidden z-[200] grid place-items-center bg-black/50 backdrop-blur-sm p-4"
        onClick={closePrivacy}
      >
        <div 
          className="bg-[#f6f0e8] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Icon */}
          <div className="bg-gradient-to-r from-[#7a5d47] to-[#5d4436] px-6 py-5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-wide">Privacy Policy</h2>
                <p className="text-sm text-white/80">Last updated: December 28, 2025</p>
              </div>
            </div>
            <button 
              onClick={closePrivacy}
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all border border-white/20" 
              aria-label="Close"
            >
              <span className="text-white text-xl">&times;</span>
            </button>
          </div>

          {/* Content with Scroll */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Introduction Card */}
            <div className="bg-[#e8ddae] border-l-4 border-[#7a5d47] rounded-lg p-4 flex items-start space-x-3">
              <svg className="w-6 h-6 text-[#7a5d47] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 leading-relaxed">
                  At Solennia, we value your trust and are committed to protecting your personal information. 
                  This Privacy Policy explains how information is collected, used, stored, and protected when 
                  you access or use the Solennia web platform and its related services.
                </p>
              </div>
            </div>

            {/* Section 1 */}
            <section className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#7a5d47] text-white rounded-lg flex items-center justify-center font-bold text-lg">
                  1
                </div>
                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                  Information Collection
                </h3>
              </div>
              <div className="pl-13 space-y-3 text-sm text-gray-700 leading-relaxed">
                <p>
                  Solennia collects personal information necessary to operate its platform effectively. This may include:
                </p>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-start space-x-2">
                    <span className="text-[#7a5d47] mt-0.5">•</span>
                    <p><strong className="text-gray-900">Personal Details:</strong> Name, email address, contact information, and account credentials</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-[#7a5d47] mt-0.5">•</span>
                    <p><strong className="text-gray-900">Business Information:</strong> For vendors - business name, service categories, descriptions, portfolio images, and verification documents</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-[#7a5d47] mt-0.5">•</span>
                    <p><strong className="text-gray-900">Usage Data:</strong> Device information, usage activity, and approximate location data</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#7a5d47] text-white rounded-lg flex items-center justify-center font-bold text-lg">
                  2
                </div>
                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                  How We Use Your Information
                </h3>
              </div>
              <div className="pl-13 space-y-3 text-sm text-gray-700 leading-relaxed">
                <p>The information collected is used strictly to support the core functions of the platform:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 flex items-start space-x-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>User authentication and account management</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 flex items-start space-x-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>Matching clients with suitable vendors</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 flex items-start space-x-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>Facilitating communication and bookings</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 flex items-start space-x-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>Processing applications and managing feedback</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 flex items-start space-x-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>Improving platform features and functionality</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 flex items-start space-x-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>Maintaining security and system integrity</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#7a5d47] text-white rounded-lg flex items-center justify-center font-bold text-lg">
                  3
                </div>
                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                  Data Sharing & Protection
                </h3>
              </div>
              <div className="pl-13 space-y-3 text-sm text-gray-700 leading-relaxed">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
                    </svg>
                    <strong className="text-green-900">We Do NOT Sell Your Data</strong>
                  </div>
                  <p className="text-green-800 text-xs">
                    Solennia does not sell or trade user data. Information may be shared only with trusted third-party 
                    service providers who assist in operating the platform, or when disclosure is required by law.
                  </p>
                </div>
                <p>
                  We implement appropriate technical and organizational security measures to protect your personal 
                  information against unauthorized access, loss, or misuse.
                </p>
              </div>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#7a5d47] text-white rounded-lg flex items-center justify-center font-bold text-lg">
                  4
                </div>
                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                  Your Privacy Rights
                </h3>
              </div>
              <div className="pl-13 space-y-3 text-sm text-gray-700 leading-relaxed">
                <p>Depending on your location, you may have the following rights:</p>
                <div className="space-y-2">
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-[#7a5d47] font-bold">→</span>
                    <div>
                      <strong className="text-gray-900">Access:</strong> Request access to your personal information
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-[#7a5d47] font-bold">→</span>
                    <div>
                      <strong className="text-gray-900">Correction:</strong> Request correction of inaccurate data
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-[#7a5d47] font-bold">→</span>
                    <div>
                      <strong className="text-gray-900">Deletion:</strong> Request deletion of your personal information
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 5 - Cookies */}
            <section className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#7a5d47] text-white rounded-lg flex items-center justify-center font-bold text-lg">
                  5
                </div>
                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                  Cookies & Tracking
                </h3>
              </div>
              <div className="pl-13 text-sm text-gray-700 leading-relaxed">
                <p>
                  Solennia uses cookies and similar technologies to analyze platform usage and enhance functionality. 
                  Users may manage cookie preferences through their browser settings.
                </p>
              </div>
            </section>

            {/* Section 6 - Children */}
            <section className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#7a5d47] text-white rounded-lg flex items-center justify-center font-bold text-lg">
                  6
                </div>
                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                  Children's Privacy
                </h3>
              </div>
              <div className="pl-13 text-sm text-gray-700 leading-relaxed">
                <p>
                  Solennia is not intended for use by individuals under the age of thirteen (13). The platform does 
                  not knowingly collect personal information from minors. Any such data discovered will be removed promptly.
                </p>
              </div>
            </section>

            {/* Contact Card */}
            <div className="bg-gradient-to-br from-[#e8ddae] to-[#f6f0e8] border border-[#7a5d47]/20 rounded-xl p-5 mt-6">
              <h4 className="font-bold text-gray-900 mb-3 flex items-center space-x-2">
                <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <span>Questions About Privacy?</span>
              </h4>
              <p className="text-sm text-gray-700 mb-3">
                For questions, concerns, or data-related requests regarding this Privacy Policy, please contact:
              </p>
              <a 
                href="mailto:solenniainquires@gmail.com" 
                className="inline-flex items-center space-x-2 text-sm font-semibold text-[#7a5d47] hover:text-[#5d4436] transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                </svg>
                <span>solenniainquires@gmail.com</span>
              </a>
            </div>
          </div>

          {/* Footer Button */}
          <div className="border-t border-gray-300 px-6 py-4 bg-[#e8ddae]/30">
            <button
              onClick={closePrivacy}
              className="w-full bg-[#7a5d47] hover:bg-[#5d4436] text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              I Understand
            </button>
          </div>
        </div>
      </div>

      {/* ================= TERMS OF SERVICE MODAL - REDESIGNED ================= */}
      <div
        id="termsModal"
        className="fixed inset-0 hidden z-[200] grid place-items-center bg-black/50 backdrop-blur-sm p-4"
        onClick={closeTerms}
      >
        <div 
          className="bg-[#f6f0e8] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Icon */}
          <div className="bg-gradient-to-r from-[#7a5d47] to-[#5d4436] px-6 py-5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-wide">Terms of Service</h2>
                <p className="text-sm text-white/80">Last updated: December 28, 2025</p>
              </div>
            </div>
            <button 
              onClick={closeTerms}
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all border border-white/20" 
              aria-label="Close"
            >
              <span className="text-white text-xl">&times;</span>
            </button>
          </div>

          {/* Content with Scroll */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Introduction Card */}
            <div className="bg-[#e8ddae] border-l-4 border-[#7a5d47] rounded-lg p-4 flex items-start space-x-3">
              <svg className="w-6 h-6 text-[#7a5d47] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 leading-relaxed">
                  Welcome to Solennia. By accessing or using the Solennia website, application, or any services 
                  provided through the platform, you agree to comply with and be bound by these Terms and Conditions.
                </p>
              </div>
            </div>

            {/* Section 1 */}
            <section className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#7a5d47] text-white rounded-lg flex items-center justify-center font-bold text-lg">
                  1
                </div>
                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                  Platform Overview
                </h3>
              </div>
              <div className="pl-13 space-y-3 text-sm text-gray-700 leading-relaxed">
                <p>
                  Solennia is a digital event management and service-matching platform designed to connect individuals, 
                  organizations, and event planners with professional event service providers.
                </p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-gray-900 mb-2">Services include:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-[#7a5d47]">✓</span>
                      <span>Venues</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[#7a5d47]">✓</span>
                      <span>Catering</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[#7a5d47]">✓</span>
                      <span>Photography & Videography</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[#7a5d47]">✓</span>
                      <span>Event Styling</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[#7a5d47]">✓</span>
                      <span>Equipment Rentals</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[#7a5d47]">✓</span>
                      <span>Entertainment</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#7a5d47] text-white rounded-lg flex items-center justify-center font-bold text-lg">
                  2
                </div>
                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                  User Responsibilities
                </h3>
              </div>
              <div className="pl-13 space-y-3 text-sm text-gray-700 leading-relaxed">
                <p className="font-medium text-gray-900">All users are required to:</p>
                <div className="space-y-2">
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-[#7a5d47] font-bold text-lg">1</span>
                    <p>Provide accurate, complete, and truthful information during registration and platform usage</p>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-[#7a5d47] font-bold text-lg">2</span>
                    <p>Ensure all submitted content is lawful, accurate, and does not infringe on third-party rights</p>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-[#7a5d47] font-bold text-lg">3</span>
                    <p>Maintain professional conduct and communicate transparently</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3 - Important Notice */}
            <section className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#7a5d47] text-white rounded-lg flex items-center justify-center font-bold text-lg">
                  3
                </div>
                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                  Platform Role & Liability
                </h3>
              </div>
              <div className="pl-13 space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <svg className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"/>
                    </svg>
                    <div className="text-sm text-amber-900 leading-relaxed">
                      <p className="font-bold mb-2">Important Notice:</p>
                      <p>
                        Solennia operates solely as an <strong>intermediary platform</strong>. We facilitate connections 
                        between users and vendors but do not participate in, control, or guarantee any transactions, 
                        agreements, payments, or service outcomes.
                      </p>
                      <p className="mt-2">
                        All negotiations, contracts, and service arrangements are entered into directly between users 
                        and vendors. Solennia shall not be held liable for disputes, losses, damages, delays, or 
                        dissatisfaction arising from services provided by vendors.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#7a5d47] text-white rounded-lg flex items-center justify-center font-bold text-lg">
                  4
                </div>
                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                  Vendor Standards
                </h3>
              </div>
              <div className="pl-13 text-sm text-gray-700 leading-relaxed">
                <p className="mb-3">
                  Vendors listed on Solennia are expected to maintain professional conduct, provide accurate 
                  information, and communicate transparently with users.
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-bold text-red-900 mb-2">Prohibited Behavior:</p>
                  <p className="text-red-800 text-xs">
                    Any fraudulent, misleading, abusive, or unethical behavior is strictly prohibited. Solennia 
                    reserves the right to suspend, restrict, or permanently terminate accounts that violate these 
                    Terms or receive repeated, substantiated complaints.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#7a5d47] text-white rounded-lg flex items-center justify-center font-bold text-lg">
                  5
                </div>
                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                  Account Termination
                </h3>
              </div>
              <div className="pl-13 text-sm text-gray-700 leading-relaxed">
                <p>
                  Solennia reserves the right to review, approve, reject, or remove content or accounts that 
                  violate platform standards, legal requirements, or community guidelines without prior notice.
                </p>
              </div>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#7a5d47] text-white rounded-lg flex items-center justify-center font-bold text-lg">
                  6
                </div>
                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                  Privacy & Data
                </h3>
              </div>
              <div className="pl-13 text-sm text-gray-700 leading-relaxed">
                <p>
                  Solennia is committed to protecting user privacy and data security. All information collected 
                  and processed through the platform is handled in accordance with our Privacy Policy.
                </p>
              </div>
            </section>

            {/* Section 7 */}
            <section className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#7a5d47] text-white rounded-lg flex items-center justify-center font-bold text-lg">
                  7
                </div>
                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                  Changes to Terms
                </h3>
              </div>
              <div className="pl-13 text-sm text-gray-700 leading-relaxed">
                <p>
                  Solennia reserves the right to modify or update these Terms and Conditions at any time to 
                  reflect changes in platform functionality, services, or legal obligations. Continued use of 
                  the platform after such updates constitutes acceptance of the revised terms.
                </p>
              </div>
            </section>

            {/* Contact Card */}
            <div className="bg-gradient-to-br from-[#e8ddae] to-[#f6f0e8] border border-[#7a5d47]/20 rounded-xl p-5 mt-6">
              <h4 className="font-bold text-gray-900 mb-3 flex items-center space-x-2">
                <svg className="w-5 h-5 text-[#7a5d47]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <span>Questions About Terms?</span>
              </h4>
              <p className="text-sm text-gray-700 mb-3">
                For questions or concerns regarding these Terms and Conditions, please contact:
              </p>
              <a 
                href="mailto:solenniainquires@gmail.com" 
                className="inline-flex items-center space-x-2 text-sm font-semibold text-[#7a5d47] hover:text-[#5d4436] transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                </svg>
                <span>solenniainquires@gmail.com</span>
              </a>
            </div>
          </div>

          {/* Footer Button */}
          <div className="border-t border-gray-300 px-6 py-4 bg-[#e8ddae]/30">
            <button
              onClick={closeTerms}
              className="w-full bg-[#7a5d47] hover:bg-[#5d4436] text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              I Understand
            </button>
          </div>
        </div>
      </div>

      {/* ================= VENDOR ONBOARDING - STEP 1: TERMS ================= */}
      <div
        id="vendorTerms"
        className="fixed inset-0 hidden z-[200] grid place-items-center bg-black/40 p-4"
        onClick={(e) => e.target === e.currentTarget && closeAllVendorModals()}
      >
        <div 
          className="bg-[#f6f0e8] w-full max-w-2xl rounded-2xl shadow-xl overflow-y-auto max-h-[80vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-300 bg-[#e8ddae]">
            <h2 className="text-lg font-semibold">Become a Vendor</h2>
            <button 
              onClick={closeAllVendorModals}
              className="text-2xl font-light hover:text-gray-600" 
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <div className="p-6 space-y-4">
            <h3 className="font-semibold text-base uppercase">
              Vendor Terms & Conditions
            </h3>

            <div className="text-sm space-y-3 leading-relaxed max-h-64 overflow-y-auto bg-gray-50 p-4 rounded">
              <p>
                By applying to become a vendor on Solennia, you acknowledge and agree
                to the following:
              </p>

              <ul className="list-disc pl-5 space-y-2">
                <li>
                  Provide accurate, complete, and up-to-date business and service
                  information.
                </li>
                <li>
                  Maintain professional, honest, and timely communication with
                  potential clients.
                </li>
                <li>
                  Deliver services in accordance with the descriptions and agreements
                  stated in your approved listings.
                </li>
                <li>
                  Comply with all applicable laws, regulations, licenses, and permits
                  related to your services.
                </li>
                <li>
                  Acknowledge that vendor application submission does not guarantee
                  approval or listing on the platform.
                </li>
              </ul>
            </div>

            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="vendorAgree" 
                className="w-4 h-4"
              />
              <label htmlFor="vendorAgree" className="text-sm">
                I agree to the terms and conditions
              </label>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  const checkbox = document.getElementById("vendorAgree");
                  if (!checkbox?.checked) {
                    toast.warning("Please agree to the terms and conditions");
                    return;
                  }
                  openVendorBackground();
                }}
                className="px-5 py-2 bg-[#e8ddae] hover:bg-[#dbcf9f] text-sm font-medium rounded"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= VENDOR ONBOARDING - STEP 2: BUSINESS INFO ================= */}
      <div
        id="vendorBackground"
        className="fixed inset-0 hidden z-[200] grid place-items-center bg-black/40 p-4"
        onClick={(e) => e.target === e.currentTarget && closeAllVendorModals()}
      >
        <div 
          className="bg-[#f6f0e8] w-full max-w-2xl rounded-2xl shadow-xl overflow-y-auto max-h-[80vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-300 bg-[#e8ddae]">
            <h2 className="text-lg font-semibold">Become a Vendor!</h2>
            <button 
              onClick={closeAllVendorModals}
              className="text-2xl font-light hover:text-gray-600" 
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <form onSubmit={handleVendorStep1} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold uppercase">
                Business Name <span className="text-red-600">*</span>
              </label>
              <input 
                name="business_name" 
                required 
                className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2" 
              />
            </div>

            <div>
              <label className="block text-sm font-semibold uppercase">
                Full Name <span className="text-red-600">*</span>
              </label>
              <input
                name="full_name"
                required
                placeholder="Your full legal name"
                className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold uppercase">
                Contact Email <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                name="contact_email"
                required
                pattern="^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.com$"
                title="Email must end with .com"
                className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold uppercase">
                Category <span className="text-red-600">*</span>
              </label>
              <select
                name="category"
                id="vendorCategory"
                required
                className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                onChange={(e) => {
                  const otherInput = document.getElementById("vendorCategoryOther");
                  const venueFields = document.getElementById("venueSpecificFields");
                  const venueSubcat = document.getElementById("venueSubcategory");
                  const venueCapacity = document.getElementById("venueCapacity");
                  const venueParking = document.getElementById("venueParking");
                  const venueHours = document.getElementById("venueOperatingHours");
                  const venueAmenities = document.getElementById("venueAmenities");
                  
                  // Handle "Others" category
                  if (e.target.value === "Others") {
                    otherInput?.classList.remove("hidden");
                    otherInput?.setAttribute("required", "required");
                  } else {
                    otherInput?.classList.add("hidden");
                    otherInput?.removeAttribute("required");
                  }
                  
                  // Handle "Venue" category - show venue-specific fields
                  if (e.target.value === "Venue") {
                    venueFields?.classList.remove("hidden");
                    venueSubcat?.setAttribute("required", "required");
                    venueCapacity?.setAttribute("required", "required");
                    venueParking?.setAttribute("required", "required");
                    venueHours?.setAttribute("required", "required");
                    venueAmenities?.setAttribute("required", "required");
                  } else {
                    venueFields?.classList.add("hidden");
                    venueSubcat?.removeAttribute("required");
                    venueCapacity?.removeAttribute("required");
                    venueParking?.removeAttribute("required");
                    venueHours?.removeAttribute("required");
                    venueAmenities?.removeAttribute("required");
                  }
                }}
              >
                <option value="">Select a category</option>
                <option value="Venue">Venue</option>
                <option value="Catering">Catering</option>
                <option value="Photography & Videography">Photography & Videography</option>
                <option value="Decoration">Decoration</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Others">Others</option>
              </select>
              
              <input
                type="text"
                id="vendorCategoryOther"
                name="category_other"
                placeholder="Please specify your category"
                className="mt-2 w-full rounded-md bg-gray-100 border border-gray-300 p-2 hidden"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold uppercase">
                Business Address / Service Areas <span className="text-red-600">*</span>
              </label>
              <textarea 
                name="address" 
                required 
                className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
              />
            </div>

            {/* ================= VENUE-SPECIFIC FIELDS ================= */}
            <div id="venueSpecificFields" className="hidden space-y-5 border-t border-gray-300 pt-5">
              <h3 className="text-sm font-semibold uppercase text-[#7a5d47]">
                Venue Details
              </h3>

              <div>
                <label className="block text-sm font-semibold uppercase">
                  Venue Type <span className="text-red-600">*</span>
                </label>
                <select
                  name="venue_subcategory"
                  id="venueSubcategory"
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold uppercase">
                    Maximum Capacity (guests) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    name="venue_capacity"
                    id="venueCapacity"
                    min="1"
                    placeholder="e.g., 200"
                    className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold uppercase">
                    Parking Capacity <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="venue_parking"
                    id="venueParking"
                    placeholder="e.g., 50 cars or No parking"
                    className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold uppercase">
                  Operating Hours <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="venue_operating_hours"
                  id="venueOperatingHours"
                  placeholder="e.g., 8:00 AM - 10:00 PM daily"
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold uppercase">
                  Available Amenities <span className="text-red-600">*</span>
                </label>
                <textarea
                  name="venue_amenities"
                  id="venueAmenities"
                  placeholder="e.g., Air conditioning, Sound system, Stage, Bridal room, Tables and chairs, etc."
                  rows="3"
                  className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                />
                <p className="text-xs text-gray-600 mt-1">
                  List all amenities and facilities available at your venue
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button 
                type="submit"
                className="w-10 h-10 bg-[#7a5d47] rounded-full text-white flex items-center justify-center hover:bg-[#654a38]"
              >
                ➜
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ================= VENDOR ONBOARDING - STEP 3: MEDIA ================= */}
      <div
        id="vendorMedia"
        className="fixed inset-0 hidden z-[200] grid place-items-center bg-black/40 p-4"
        onClick={(e) => e.target === e.currentTarget && closeAllVendorModals()}
      >
        <div 
          className="bg-[#f6f0e8] w-full max-w-2xl rounded-2xl shadow-xl overflow-y-auto max-h-[80vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-300 bg-[#e8ddae]">
            <h2 className="text-lg font-semibold">Media & Content</h2>
            <button 
              onClick={closeAllVendorModals}
              className="text-2xl font-light hover:text-gray-600" 
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <form onSubmit={submitVendorApplication} className="p-6 space-y-5" encType="multipart/form-data">
            <div>
              <label className="block text-sm font-semibold uppercase">
                Description of Services <span className="text-red-600">*</span>
              </label>
              <textarea 
                name="description" 
                required 
                rows="4"
                placeholder="Describe your services in detail..."
                className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold uppercase">
                Package List/Sample Pricing <span className="text-red-600">*</span>
              </label>
              <textarea 
                name="pricing" 
                required 
                rows="4"
                placeholder="e.g., Basic Package: ₱50,000&#10;Premium Package: ₱100,000"
                className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
              />
            </div>

            {/* ✅ IMPROVED FILE UPLOADS WITH SIZE INFO */}
            <div className="border-t border-gray-300 pt-4">
              <h3 className="text-sm font-semibold uppercase text-[#7a5d47] mb-3">
                Required Documents (Max 2MB each)
              </h3>

              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
  <p className="text-xs text-amber-900 font-semibold flex items-center gap-2">
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"/>
    </svg>
    Files must be under 2MB each! Compress large files before uploading.
  </p>
</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1">
                    Permits (PNG/JPG/PDF) <span className="text-red-600">*</span>
                  </label>
                  <input 
                    name="permits" 
                    type="file" 
                    required
                    accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file && file.size > 5 * 1024 * 1024) {
                        toast.warning("Permits file is too large. Max 2MB.");
                        e.target.value = '';
                      }
                    }}
                    className="w-full rounded-md bg-gray-100 border border-gray-300 p-2 text-sm" 
                  />
                  <p className="text-xs text-gray-600 mt-1">Business permits/licenses</p>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1">
                    Gov ID (PNG/JPG/PDF) <span className="text-red-600">*</span>
                  </label>
                  <input 
                    name="gov_id" 
                    type="file" 
                    required
                    accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file && file.size > 5 * 1024 * 1024) {
                        toast.warning("Government ID is too large. Max 2MB.");
                        e.target.value = '';
                      }
                    }}
                    className="w-full rounded-md bg-gray-100 border border-gray-300 p-2 text-sm" 
                  />
                  <p className="text-xs text-gray-600 mt-1">Valid government-issued ID</p>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold uppercase mb-1">
                    Portfolio (PNG/JPG/PDF) <span className="text-red-600">*</span>
                  </label>
                  <input 
                    name="portfolio" 
                    type="file" 
                    required
                    accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file && file.size > 5 * 1024 * 1024) {
                        toast.warning("Portfolio file is too large. Max 2MB.");
                        e.target.value = '';
                      }
                    }}
                    className="w-full rounded-md bg-gray-100 border border-gray-300 p-2 text-sm" 
                  />
                  <p className="text-xs text-gray-600 mt-1">Sample work/portfolio</p>
                </div>
              </div>
              
              {/* ✅ UPLOAD INFO */}
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>📌 Note:</strong> File uploads may take 10-30 seconds depending on your internet speed. 
                  Please wait until you see the success message.
                </p>
              </div>
            </div>

            {/* ✅ IMPROVED SUBMIT BUTTONS WITH LOADING STATE */}
            <div className="flex justify-between pt-4 border-t border-gray-300">
              <button 
                type="button"
                onClick={openVendorBackground}
                disabled={vendorLoading}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-sm font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back
              </button>
              <button 
                type="submit"
                disabled={vendorLoading}
                className="px-6 py-2.5 bg-[#e8ddae] hover:bg-[#dbcf9f] text-sm font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {vendorLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Submitting Documents...</span>
                  </>
                ) : (
                  "Submit Application"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>


      {/* ================= CREATE VENUE LISTING MODAL ================= */}
      <div
        id="venueListingModal"
        className="fixed inset-0 hidden z-[200] grid place-items-center bg-black/40 p-4"
        onClick={(e) => e.target === e.currentTarget && closeVenueListing()}
      >
        <div 
          className="bg-[#f6f0e8] w-full max-w-4xl rounded-2xl shadow-xl overflow-y-auto max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-300 bg-[#e8ddae] sticky top-0 z-10">
            <h2 className="text-lg font-semibold">Create Venue Listing</h2>
            <button 
              onClick={closeVenueListing}
              className="text-2xl font-light hover:text-gray-600" 
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <form onSubmit={submitVenueListing} className="p-6 space-y-6" encType="multipart/form-data">
            {/* Basic Information */}
            <div>
              <h3 className="text-base font-semibold uppercase mb-4 text-[#7a5d47]">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold uppercase mb-1">
                    Venue Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    name="name"
                    type="text"
                    required
                    className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                    placeholder="e.g., Grand Ballroom Events"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold uppercase mb-1">
                    Location/City <span className="text-red-600">*</span>
                  </label>
                  <input
                    name="location"
                    type="text"
                    required
                    className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                    placeholder="e.g., Tagaytay City"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-semibold uppercase mb-1">
                  Full Address <span className="text-red-600">*</span>
                </label>
                <textarea
                  name="address"
                  required
                  rows="2"
                  className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                  placeholder="Complete address of the venue"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-semibold uppercase mb-1">
                    Venue Type <span className="text-red-600">*</span>
                  </label>
                  <select
                    name="venue_type"
                    required
                    className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                  >
                    <option value="">Select type</option>
                    <option value="Church">Church</option>
                    <option value="Garden">Garden</option>
                    <option value="Resort">Resort</option>
                    <option value="Conference Hall">Conference Hall</option>
                    <option value="Ballroom">Ballroom</option>
                    <option value="Beach">Beach</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold uppercase mb-1">
                    Capacity (Guests) <span className="text-red-600">*</span>
                  </label>
                  <input
                    name="capacity"
                    type="number"
                    required
                    min="1"
                    className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                    placeholder="e.g., 300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold uppercase mb-1">
                    Price Range <span className="text-red-600">*</span>
                  </label>
                  <select
                    name="price_range"
                    required
                    className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                  >
                    <option value="">Select range</option>
                    <option value="$">$ (Budget-friendly)</option>
                    <option value="$$">$$ (Moderate)</option>
                    <option value="$$$">$$$ (Premium)</option>
                    <option value="$$$$">$$$$ (Luxury)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-base font-semibold uppercase mb-4 text-[#7a5d47]">Description</h3>
              <textarea
                name="description"
                required
                rows="4"
                className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                placeholder="Describe your venue, its features, and what makes it special..."
              />
            </div>

            {/* Amenities */}
            <div>
              <h3 className="text-base font-semibold uppercase mb-4 text-[#7a5d47]">Amenities</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  "Air Conditioning",
                  "Parking Available",
                  "Catering Services",
                  "Audio/Visual Equipment",
                  "Bridal Room",
                  "Garden Area",
                  "Dance Floor",
                  "Bar Service",
                  "WiFi",
                  "Stage/Platform",
                  "Kitchen Access",
                  "Wheelchair Accessible"
                ].map((amenity) => (
                  <label key={amenity} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAmenities.includes(amenity)}
                      onChange={() => toggleAmenity(amenity)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm">{amenity}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Packages */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-semibold uppercase text-[#7a5d47]">Packages</h3>
                <button
                  type="button"
                  onClick={addPackage}
                  className="px-4 py-2 bg-[#e8ddae] hover:bg-[#dbcf9f] text-sm font-medium rounded"
                >
                  + Add Package
                </button>
              </div>
              
              {venueListing.packages.map((pkg, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg mb-3">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-sm font-semibold">Package {index + 1}</span>
                    {venueListing.packages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePackage(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Package Name (e.g., Basic Package)"
                      value={pkg.name}
                      onChange={(e) => updatePackage(index, "name", e.target.value)}
                      className="w-full rounded-md bg-white border border-gray-300 p-2"
                    />
                    <input
                      type="text"
                      placeholder="Price (e.g., ₱80,000)"
                      value={pkg.price}
                      onChange={(e) => updatePackage(index, "price", e.target.value)}
                      className="w-full rounded-md bg-white border border-gray-300 p-2"
                    />
                  </div>
                  <textarea
                    placeholder="What's included? (separate items with commas)"
                    value={pkg.includes}
                    onChange={(e) => updatePackage(index, "includes", e.target.value)}
                    rows="2"
                    className="w-full rounded-md bg-white border border-gray-300 p-2 mt-3"
                  />
                </div>
              ))}
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-base font-semibold uppercase mb-4 text-[#7a5d47]">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold uppercase mb-1">
                    Contact Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    name="contact_email"
                    type="email"
                    required
                    className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                    placeholder="venue@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold uppercase mb-1">
                    Contact Phone <span className="text-red-600">*</span>
                  </label>
                  <input
                    name="contact_phone"
                    type="tel"
                    required
                    className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                    placeholder="+63 912 345 6789"
                  />
                </div>
              </div>
            </div>

            {/* Images */}
            <div>
              <h3 className="text-base font-semibold uppercase mb-4 text-[#7a5d47]">Venue Images</h3>
              <div>
                <label className="block text-sm font-semibold uppercase mb-1">
                  Upload Images <span className="text-red-600">*</span> <span className="text-xs font-normal text-gray-600">(Up to 10 images)</span>
                </label>
                <input
                  name="images"
                  type="file"
                  required
                  accept="image/png,image/jpeg,image/jpg"
                  multiple
                  className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Upload high-quality images of your venue. First image will be the main display image.
                </p>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-300">
              <button
                type="button"
                onClick={closeVenueListing}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-sm font-medium rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={venueListingLoading}
                className="px-6 py-2 bg-[#e8ddae] hover:bg-[#dbcf9f] text-sm font-semibold uppercase rounded disabled:opacity-50"
              >
                {venueListingLoading ? "Creating..." : "Create Listing"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";

export default function Modals() {

  /* =========================
     STATE
  ========================= */

  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [vendorLoading, setVendorLoading] = useState(false);

  const [register, setRegister] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    password: "",
  });
  
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
  });

  /* =========================
     HELPERS
  ========================= */

  const closeAll = () => {
    document.getElementById("authBackdrop")?.classList.add("hidden");
    document.getElementById("loginModal")?.classList.add("hidden");
    document.getElementById("registerModal")?.classList.add("hidden");
  };

  const openLogin = () => {
    document.getElementById("authBackdrop")?.classList.remove("hidden");
    document.getElementById("registerModal")?.classList.add("hidden");
    document.getElementById("loginModal")?.classList.remove("hidden");
  };

  const openRegister = () => {
    document.getElementById("authBackdrop")?.classList.remove("hidden");
    document.getElementById("loginModal")?.classList.add("hidden");
    document.getElementById("registerModal")?.classList.remove("hidden");
  };

  const closePrivacy = () =>
    document.getElementById("privacyModal")?.classList.add("hidden");

  const closeTerms = () =>
    document.getElementById("termsModal")?.classList.add("hidden");

  const closeFeedback = () =>
    document.getElementById("feedbackModal")?.classList.add("hidden");

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
    window.solenniaLogout = handleLogout;
  }, []);

  /* =========================
     LOGIN
  ========================= */

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const resolveRes = await fetch(
        `/api/auth/resolve-username?u=${encodeURIComponent(loginIdentifier)}`
      );
      const resolveData = await resolveRes.json();
      if (!resolveRes.ok) throw new Error(resolveData.message);

      const cred = await signInWithEmailAndPassword(
        auth,
        resolveData.email,
        loginPassword
      );

      const backendRes = await fetch("/api/auth/login", {
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

      closeAll();
    } catch (err) {
      alert(err.message);
    }
  };

  /* =========================
     REGISTER
  ========================= */

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        register.email,
        register.password
      );

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...register,
          firebase_uid: cred.user.uid,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      openLogin();
    } catch (err) {
      alert(err.message);
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

    window.location.href = "/";
  };

  /* =========================
     FEEDBACK
  ========================= */

  const submitFeedback = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("solennia_token");
    if (!token) return alert("Please login first.");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: feedback }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      alert("Thank you for your feedback!");
      setFeedback("");
      closeFeedback();
    } catch (err) {
      alert(err.message);
    }
  };

  /* =========================
     VENDOR ONBOARDING
  ========================= */

  const handleVendorStep1 = (e) => {
    e.preventDefault();
    const form = e.target;
    if (form.checkValidity()) {
      const formData = new FormData(form);
      setVendorForm(prev => ({
        ...prev,
        business_name: formData.get("business_name"),
        full_name: formData.get("full_name"),
        contact_email: formData.get("contact_email"),
        category: formData.get("category"),
        category_other: formData.get("category_other") || "",
        address: formData.get("address"),
      }));
      openVendorMedia();
    } else {
      form.reportValidity();
    }
  };

  const submitVendorApplication = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("solennia_token");
    if (!token) return alert("Please login first.");

    const form = e.target;
    const formData = new FormData(form);

    // Append step 1 data
    Object.entries(vendorForm).forEach(([key, value]) => {
      if (value && !["permits", "gov_id", "portfolio"].includes(key)) {
        formData.set(key, value);
      }
    });

    try {
      setVendorLoading(true);

      const res = await fetch("/api/vendor/apply", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Application failed");

      alert("Application submitted successfully! We'll review it soon.");
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
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setVendorLoading(false);
    }
  };

  /* =========================
     JSX
  ========================= */

  return (
    <>
      {/* ================= AUTH BACKDROP ================= */}
      <div
        id="authBackdrop"
        className="fixed inset-0 bg-black/50 hidden flex items-center justify-center z-[9999]"
        onClick={(e) => e.target === e.currentTarget && closeAll()}
      >
        {/* LOGIN */}
        <div
          id="loginModal"
          className="hidden bg-[#f6f0e8] p-8 rounded-2xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleLogin} className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4 text-center">Login to Solennia</h2>
            <input
              placeholder="Email or Username"
              className="border p-2 w-full rounded-lg"
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              className="border p-2 w-full rounded-lg"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
            <button className="w-full bg-[#7a5d47] text-white py-2 rounded-lg">
              Login
            </button>
            <p className="text-center text-sm">
              No account?{" "}
              <button type="button" onClick={openRegister} className="underline">
                Register
              </button>
            </p>
          </form>
        </div>

        {/* REGISTER */}
        <div
          id="registerModal"
          className="hidden bg-[#f6f0e8] p-8 rounded-2xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleRegister} className="space-y-3">
            <h2 className="text-2xl font-semibold mb-4 text-center">Create Your Account</h2>
            <div className="grid grid-cols-2 gap-4">
              <input 
                placeholder="First name" 
                className="border p-2 w-full rounded-lg"
                onChange={(e) => setRegister(r => ({ ...r, first_name: e.target.value }))}
              />
              <input 
                placeholder="Last name" 
                className="border p-2 w-full rounded-lg"
                onChange={(e) => setRegister(r => ({ ...r, last_name: e.target.value }))}
              />
            </div>
            <input 
              placeholder="Email" 
              type="email"
              className="border p-2 w-full rounded-lg"
              onChange={(e) => setRegister(r => ({ ...r, email: e.target.value }))}
            />
            <input 
              placeholder="Username" 
              className="border p-2 w-full rounded-lg"
              onChange={(e) => setRegister(r => ({ ...r, username: e.target.value }))}
            />
            <input 
              type="password" 
              placeholder="Password" 
              className="border p-2 w-full rounded-lg"
              onChange={(e) => setRegister(r => ({ ...r, password: e.target.value }))}
            />
            <button className="w-full bg-[#7a5d47] text-white py-2 rounded-lg">
              Create account
            </button>
            <p className="text-sm text-center mt-3">
              Already have an account?{" "}
              <button type="button" onClick={openLogin} className="underline">
                Login
              </button>
            </p>
          </form>
        </div>
      </div>

      {/* ================= PRIVACY MODAL ================= */}
      <div
        id="privacyModal"
        className="hidden fixed inset-0 z-[270] bg-black/40 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && closePrivacy()}
      >
        <div
          className="bg-[#f6f0e8] w-full max-w-2xl rounded-2xl shadow-xl border border-gray-300 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center px-6 py-4 border-b border-gray-300 bg-[#e8ddae]">
            <h3 className="text-lg font-semibold tracking-wide">Privacy Policy</h3>
            <button
              onClick={closePrivacy}
              className="text-2xl font-light hover:text-gray-600"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <div className="p-6 space-y-4 text-sm leading-relaxed text-gray-800 max-h-[70vh] overflow-y-auto">
            <p><strong>Introduction</strong><br />
              At Solennia, we are committed to protecting your privacy and ensuring that your personal information is handled responsibly. This Privacy Policy outlines how we collect, use, store, and share information when you use our mobile application or website. By using Solennia, you agree to the terms described in this policy.
            </p>
            <p><strong>Information We Collect</strong><br />
              We may collect personal data including your name, email address, contact number, and information related to your wedding plans. For vendors, we may collect business details such as company name, service descriptions, photos, and relevant documentation. Additionally, we gather non-personal information such as usage statistics, device information, and location data to help enhance our services and provide a more personalized user experience.
            </p>
            <p><strong>How We Use Your Information</strong><br />
              The information we collect is used solely to operate and improve our platform. This includes matching couples with suitable vendors, facilitating communication, managing bookings, sending relevant updates or promotional messages (which you may opt out of), and ensuring platform security.
            </p>
            <p><strong>Sharing of Information</strong><br />
              Your data is never sold to third parties. However, in certain cases, we may share your information with trusted service providers who assist us in delivering our services, or with legal authorities if required by law.
            </p>
            <p><strong>Data Protection</strong><br />
              We prioritize your privacy and employ appropriate security measures such as encryption and secure servers to protect your data. Nonetheless, users are encouraged to keep their login credentials secure, as no system can be completely immune to risk.
            </p>
            <p><strong>Your Rights</strong><br />
              You have the right to access, update, or delete your personal data at any time. If you wish to deactivate your account or request the removal of your information, you may contact us directly.
            </p>
            <p><strong>Cookies & Tracking</strong><br />
              We use cookies and tracking technologies to analyze usage patterns and improve site functionality; you can adjust your browser settings to manage cookie preferences.
            </p>
            <p><strong>Third-Party Links</strong><br />
              Solennia may contain links to third-party websites, including vendor pages and external services. Please note that we are not responsible for the privacy practices of these third parties, and we encourage users to review their respective policies.
            </p>
            <p><strong>Children's Privacy</strong><br />
              Our platform is not intended for children under the age of 13, and we do not knowingly collect personal information from minors. If we become aware of such data, it will be promptly deleted.
            </p>
            <p><strong>Policy Updates</strong><br />
              This policy may be updated periodically to reflect changes in our services or legal obligations. We will notify users of significant updates through email or in-app notifications.
            </p>
            <p><strong>Contact</strong><br />
              If you have any questions or concerns regarding this Privacy Policy, you may contact us at{" "}
              <a href="mailto:solenniainquires@gmail.com" className="underline">
                solenniainquires@gmail.com
              </a>. We are committed to maintaining your trust and safeguarding your privacy at every stage of your wedding planning journey.
            </p>
          </div>
        </div>
      </div>

      {/* ================= TERMS MODAL ================= */}
      <div
        id="termsModal"
        className="hidden fixed inset-0 z-[275] bg-black/40 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && closeTerms()}
      >
        <div
          className="bg-[#f6f0e8] w-full max-w-4xl rounded-2xl shadow-xl border border-gray-300 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center px-6 py-4 border-b border-gray-300 bg-[#e8ddae]">
            <h3 className="text-xl font-semibold tracking-wide">Terms and Conditions</h3>
            <button
              onClick={closeTerms}
              className="text-2xl font-light hover:text-gray-600"
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <div className="p-6 space-y-5 text-sm leading-relaxed text-gray-800 max-h-[70vh] overflow-y-auto">
            <p><strong>Acceptance of Terms</strong><br />
              Welcome to Solennia. By accessing or using our website, mobile application, or any services provided through our platform, you agree to be bound by the following Terms and Conditions. Please read them carefully. If you do not agree with these terms, you must refrain from using our platform.
            </p>
            <p><strong>About Solennia</strong><br />
              Solennia is a digital platform designed to connect couples planning their weddings with professional vendors offering relevant services. These services may include, but are not limited to, venue rentals, catering, photography, floral design, gown rentals, and entertainment.
            </p>
            <p><strong>User Accounts & Vendor Content</strong><br />
              All users—whether couples or vendors—must provide accurate and truthful information during registration. Vendors are responsible for ensuring that the content they submit is lawful and truthful.
            </p>
            <p><strong>Role as Intermediary</strong><br />
              Solennia acts only as an intermediary and is not responsible for agreements, disputes, payments, or service outcomes between users and vendors.
            </p>
            <p><strong>Vendor Responsibilities</strong><br />
              Vendors must maintain professionalism and transparency at all times.
            </p>
            <p><strong>Privacy</strong><br />
              All data is handled in accordance with our Privacy Policy.
            </p>
            <p><strong>Changes to Terms</strong><br />
              These terms may be updated at any time without prior notice.
            </p>
            <p><strong>Contact</strong><br />
              Contact us at{" "}
              <a href="mailto:solenniainquires@gmail.com" className="underline">
                solenniainquires@gmail.com
              </a>.
            </p>
          </div>
        </div>
      </div>

      {/* ================= FEEDBACK MODAL ================= */}
      <div
        id="feedbackModal"
        className="hidden fixed inset-0 z-[260] bg-black/40 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && closeFeedback()}
      >
        <div
          className="bg-[#f6f0e8] w-full max-w-md rounded-2xl shadow-xl border border-gray-300 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center px-6 py-4 border-b bg-[#e8ddae]">
            <h3 className="text-lg font-semibold">Your Feedback</h3>
            <button onClick={closeFeedback} className="text-2xl">&times;</button>
          </div>

          <form onSubmit={submitFeedback} className="px-6 py-5 space-y-4">
            <textarea
              rows="4"
              required
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Type your feedback here..."
              className="w-full rounded-lg border p-2"
            />
            <div className="flex justify-end">
              <button className="px-6 py-2 rounded-md bg-[#7a5d47] text-white">
                Send Feedback
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ================= VENDOR ONBOARDING - STEP 1: TERMS ================= */}
      <div
        id="vendorTerms"
        className="fixed inset-0 hidden z-[200] grid place-items-center bg-black/40 p-4"
        onClick={(e) => e.target === e.currentTarget && closeAllVendorModals()}
      >
        <div 
          className="bg-[#f6f0e8] w-full max-w-3xl rounded-2xl shadow-xl overflow-y-auto max-h-[80vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-300 bg-[#e8ddae]">
            <h2 className="text-xl font-semibold">Terms & Conditions</h2>
            <button 
              onClick={closeAllVendorModals}
              className="text-2xl font-light hover:text-gray-600" 
              aria-label="Close"
            >
              &times;
            </button>
          </div>
          
          <div className="p-6 space-y-4 text-sm leading-relaxed text-gray-800">
            <p>
              By applying to become a vendor on Solennia, you agree to the following terms and conditions. Solennia is a wedding planning platform that helps couples connect with trusted service providers like you.
            </p>
            <p>
              As a vendor, you are responsible for providing accurate and up-to-date information about your business, including your services, pricing, photos, and availability.
            </p>
            <p>
              Solennia acts only as a facilitator between clients and vendors. We do not control or guarantee the outcome of any agreements, bookings, or payments between you and your clients.
            </p>
            <p>
              For questions or support, you may contact us at{" "}
              <a href="mailto:vendors@solennia.com" className="underline">
                vendors@solennia.com
              </a>.
            </p>
          </div>
          
          <div className="p-6 border-t border-gray-300 flex justify-end">
            <button 
              onClick={openVendorBackground}
              className="px-6 py-2 rounded-md bg-[#e8ddae] hover:bg-[#dbcf9f] font-medium"
            >
              Agree and Continue
            </button>
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
                required
                className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                onChange={(e) => {
                  const otherInput = document.getElementById("vendorCategoryOther");
                  if (e.target.value === "Others") {
                    otherInput?.classList.remove("hidden");
                    otherInput?.setAttribute("required", "required");
                  } else {
                    otherInput?.classList.add("hidden");
                    otherInput?.removeAttribute("required");
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
                className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
              />
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
                  className="w-full rounded-md bg-gray-100 border border-gray-300 p-2 text-sm" 
                />
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
                  className="w-full rounded-md bg-gray-100 border border-gray-300 p-2 text-sm" 
                />
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
                  className="w-full rounded-md bg-gray-100 border border-gray-300 p-2 text-sm" 
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button 
                type="button"
                onClick={openVendorBackground}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-sm font-medium rounded"
              >
                Back
              </button>
              <button 
                type="submit"
                disabled={vendorLoading}
                className="px-5 py-2 bg-[#e8ddae] hover:bg-[#dbcf9f] text-sm font-medium rounded disabled:opacity-50"
              >
                {vendorLoading ? "Submitting..." : "Make Listing"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
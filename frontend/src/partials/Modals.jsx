import React, { useState } from "react";
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

  const [register, setRegister] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    password: "",
  });

  const [feedback, setFeedback] = useState("");
  const [vendorLoading, setVendorLoading] = useState(false);

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

  const closeVendorTerms = () =>
    document.getElementById("vendorTerms")?.classList.add("hidden");

  const closeFeedback = () =>
    document.getElementById("feedbackModal")?.classList.add("hidden");

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
          username: loginIdentifier,
        }),
      });

      const backendData = await backendRes.json();
      if (!backendRes.ok) throw new Error(backendData.message);

      localStorage.setItem("solennia_token", backendData.token);
      localStorage.setItem("solennia_profile", JSON.stringify(backendData.user));
      localStorage.setItem("solennia_role", backendData.role);

      closeAll();
      window.location.reload();
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
     FEEDBACK (FIXED)
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
     APPLY AS VENDOR
  ========================= */

  const applyVendor = async () => {
    const token = localStorage.getItem("solennia_token");
    if (!token) return alert("Please login first.");

    try {
      setVendorLoading(true);

      const res = await fetch("/api/vendor/apply", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Application failed");

      alert("Vendor application submitted!");
      closeVendorTerms();
      window.location.reload();
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
            <input
              placeholder="Username"
              className="border p-2 w-full"
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              className="border p-2 w-full"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
            <button className="w-full bg-[#7a5d47] text-white py-2 rounded">
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
            <input
              placeholder="First name"
              className="border p-2 w-full"
              onChange={(e) =>
                setRegister({ ...register, first_name: e.target.value })
              }
            />
            <input
              placeholder="Last name"
              className="border p-2 w-full"
              onChange={(e) =>
                setRegister({ ...register, last_name: e.target.value })
              }
            />
            <input
              placeholder="Email"
              className="border p-2 w-full"
              onChange={(e) =>
                setRegister({ ...register, email: e.target.value })
              }
            />
            <input
              placeholder="Username"
              className="border p-2 w-full"
              onChange={(e) =>
                setRegister({ ...register, username: e.target.value })
              }
            />
            <input
              type="password"
              placeholder="Password"
              className="border p-2 w-full"
              onChange={(e) =>
                setRegister({ ...register, password: e.target.value })
              }
            />
            <button className="w-full bg-[#7a5d47] text-white py-2 rounded">
              Create account
            </button>
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

      <p><strong>Children’s Privacy</strong><br />
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

{/* ================= VENDOR TERMS MODAL ================= */}
<div
  id="vendorTerms"
  className="fixed inset-0 hidden z-[200] grid place-items-center bg-black/40 p-4"
  onClick={(e) => e.target === e.currentTarget && closeVendorTerms()}
>
  <div
    className="bg-[#f6f0e8] w-full max-w-3xl rounded-2xl shadow-xl overflow-y-auto max-h-[80vh]"
    onClick={(e) => e.stopPropagation()}
  >
    <div className="flex justify-between items-center p-6 border-b border-gray-300">
      <h2 className="text-xl font-semibold">Terms & Conditions</h2>
      <button
        onClick={closeVendorTerms}
        className="text-2xl font-light"
        aria-label="Close"
      >
        &times;
      </button>
    </div>

    {/* 👇 YOUR VENDOR PARAGRAPHS GO HERE */}
    <div className="p-6 space-y-4 text-sm leading-relaxed text-gray-800">
      <p>By applying to become a vendor on Solennia, you agree...</p>
      <p>As a vendor, you are responsible...</p>
      <p>Currently, listing your services...</p>
      <p>Solennia acts only as a facilitator...</p>
      <p>Solennia reserves the right...</p>
      <p>We are committed to respecting your privacy...</p>
      <p>
        By applying to Solennia as a vendor, you confirm...
        <a href="mailto:solenniainquires@gmail.com" className="underline">
          vendors@solennia.com
        </a>.
      </p>
    </div>

    <div className="p-6 border-t border-gray-300 flex justify-end">
      <button
        onClick={applyVendor}
        className="px-6 py-2 rounded-md bg-[#e8ddae] hover:bg-[#dbcf9f] font-medium"
      >
        Agree and Continue
      </button>
    </div>
  </div>
</div>

    </>
  );
}
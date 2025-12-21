import React, { useState, useEffect } from "react";
import { auth } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import toast from "../utils/toast";

export default function Modals() {

  /* =========================
     STATE
  ========================= */

  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false); // NEW: Login password toggle
  const [feedback, setFeedback] = useState("");
  const [vendorLoading, setVendorLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

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

      // Check if email is verified
      if (!cred.user.emailVerified) {
        toast.warning("Please verify your email before logging in. Check your inbox!");
        await auth.signOut();
        return;
      }

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

      toast.success("Login successful! Welcome back!");
      closeAll();
      
      // Refresh page to update header avatar
      window.location.reload();
    } catch (err) {
      toast.error(err.message || "Login failed. Please try again.");
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
      const res = await fetch("/api/auth/register", {
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
      toast.error(err.message || "Registration failed. Please try again.");
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
      
      if (err.code === "auth/user-not-found") {
        toast.error("No account found with this email address");
      } else if (err.code === "auth/invalid-email") {
        toast.error("Invalid email address");
      } else {
        toast.error("Failed to send reset email. Please try again.");
      }
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

    toast.info("Logged out successfully");
    window.location.href = "/";
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

      toast.success("Thank you for your feedback!");
      setFeedback("");
      closeFeedback();
    } catch (err) {
      toast.error(err.message || "Failed to submit feedback");
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
    if (!token) {
      toast.warning("Please login to apply as a vendor.");
      return;
    }

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
      });
    } catch (err) {
      toast.error(err.message || "An error occurred");
    } finally {
      setVendorLoading(false);
    }
  };

  /* =========================
     RENDER
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
                  {showLoginPassword ? "👁️‍🗨️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={openForgotPassword}
                className="text-sm text-white-600 hover:underline"
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
              Don't have an account?{" "} <br></br><br></br>
              <button
                type="button"
                onClick={openRegister}
                className="text-white-600 hover:underline"
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
              Already have an account?{" "} <br></br><br></br>
              <button
                type="button"
                onClick={openLogin}
                className="text-black-600 hover:underline"
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
                className="text-sm text-black-600 hover:underline"
              >
                Back to login
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ================= FEEDBACK MODAL ================= */}
      <div
        id="feedbackModal"
        className="fixed inset-0 hidden z-[200] grid place-items-center bg-black/40 p-4"
        onClick={closeFeedback}
      >
        <div 
          className="bg-[#f6f0e8] w-full max-w-md rounded-2xl shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-300 bg-[#e8ddae]">
            <h2 className="text-lg font-semibold">Send Feedback</h2>
            <button 
              onClick={closeFeedback}
              className="text-2xl font-light hover:text-gray-600" 
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <form onSubmit={submitFeedback} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold uppercase">
                Your Message
              </label>
              <textarea
                required
                rows="5"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="mt-1 w-full rounded-md bg-gray-100 border border-gray-300 p-2"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#e8ddae] hover:bg-[#dbcf9f] text-sm font-semibold uppercase py-2 rounded"
            >
              Submit Feedback
            </button>
          </form>
        </div>
      </div>

      {/* ================= PRIVACY MODAL ================= */}
      <div
        id="privacyModal"
        className="fixed inset-0 hidden z-[200] grid place-items-center bg-black/40 p-4"
        onClick={closePrivacy}
      >
        <div 
          className="bg-[#f6f0e8] w-full max-w-2xl rounded-2xl shadow-xl overflow-y-auto max-h-[80vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-300 bg-[#e8ddae]">
            <h2 className="text-lg font-semibold">Privacy Policy</h2>
            <button 
              onClick={closePrivacy}
              className="text-2xl font-light hover:text-gray-600" 
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <div className="p-6 space-y-4 text-sm leading-relaxed">
            <p>
              At Solennia, we value your trust and are committed to protecting your personal information. This Privacy Policy explains how information is collected, used, stored, and protected when you access or use the Solennia web platform and its related services. By using Solennia, you acknowledge and agree to the practices outlined in this policy.

              Solennia collects personal information necessary to operate its platform effectively. This may include user details such as name, email address, contact information, and account credentials. For service providers and vendors, we may collect business-related information including business name, service categories, descriptions, portfolio images, and supporting documents required for verification. In addition, Solennia may collect non-personal data such as device information, usage activity, and approximate location data to improve system performance and user experience.

              The information collected is used strictly to support the core functions of the platform. These functions include enabling user authentication, matching clients with suitable vendors, facilitating communication and bookings, processing applications, managing feedback, improving platform features, and maintaining security and system integrity. Solennia does not sell or trade user data. Information may be shared only with trusted third-party service providers who assist in operating the platform, or when disclosure is required by law or legal process.

              Solennia implements reasonable administrative, technical, and security measures to protect personal information against unauthorized access, loss, or misuse. Despite these measures, users are advised to safeguard their account credentials, as no digital platform can guarantee absolute security.

              Users have the right to access, update, or request the deletion of their personal information. Account deactivation or data removal requests may be submitted through official communication channels. Solennia also uses cookies and similar technologies to analyze platform usage and enhance functionality. Users may manage cookie preferences through their browser settings.

              The Solennia platform may contain links to third-party websites or external vendor pages. Solennia is not responsible for the privacy practices or content of these third-party services, and users are encouraged to review their respective privacy policies.

              Solennia is not intended for use by individuals under the age of thirteen (13). The platform does not knowingly collect personal information from minors. Any such data discovered will be removed promptly.

              This Privacy Policy may be updated to reflect changes in platform features, legal requirements, or operational practices. Users will be notified of significant changes through email or platform notifications.

              For questions, concerns, or data-related requests regarding this Privacy Policy, users may contact solenniainquires@gmail.com
              . Solennia remains committed to transparency, accountability, and the responsible handling of user information throughout the platform.
            </p>
          </div>
        </div>
      </div>

      {/* ================= TERMS MODAL ================= */}
      <div
        id="termsModal"
        className="fixed inset-0 hidden z-[200] grid place-items-center bg-black/40 p-4"
        onClick={closeTerms}
      >
        <div 
          className="bg-[#f6f0e8] w-full max-w-2xl rounded-2xl shadow-xl overflow-y-auto max-h-[80vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-6 border-b border-gray-300 bg-[#e8ddae]">
            <h2 className="text-lg font-semibold">Terms of Service</h2>
            <button 
              onClick={closeTerms}
              className="text-2xl font-light hover:text-gray-600" 
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          <div className="p-6 space-y-4 text-sm leading-relaxed">
            <p>
              Welcome to Solennia. By accessing or using the Solennia website, application, or any services provided through the platform, you agree to comply with and be bound by these Terms and Conditions. If you do not agree to any part of these terms, you must immediately discontinue use of the platform.

              Solennia is a digital event management and service-matching platform designed to connect individuals, organizations, and event planners with professional event service providers. These services may include, but are not limited to, venues, catering, photography and videography, event styling, equipment rentals, entertainment, and other event-related services. Solennia aims to streamline event planning by providing centralized tools for vendor discovery, communication, and coordination.

              All users are required to provide accurate, complete, and truthful information during registration and platform usage. Vendors are solely responsible for ensuring that all submitted content—including business information, service descriptions, pricing details, images, and documentation—is lawful, accurate, and does not infringe on the rights of third parties. Solennia reserves the right to review, approve, reject, or remove content or accounts that violate platform standards, legal requirements, or community guidelines.

              Solennia operates solely as an intermediary platform. While Solennia facilitates connections between users and vendors, it does not participate in, control, or guarantee any transactions, agreements, payments, or service outcomes. All negotiations, contracts, and service arrangements are entered into directly between users and vendors. Solennia shall not be held liable for disputes, losses, damages, delays, or dissatisfaction arising from services provided by vendors or interactions conducted through the platform.

              Vendors listed on Solennia are expected to maintain professional conduct, provide accurate information, and communicate transparently with users. Any fraudulent, misleading, abusive, or unethical behavior is strictly prohibited. Solennia reserves the right to suspend, restrict, or permanently terminate accounts that violate these Terms and Conditions or receive repeated, substantiated complaints.

              Solennia is committed to protecting user privacy and data security. All information collected and processed through the platform is handled in accordance with the Solennia Privacy Policy. By using Solennia, users consent to the collection and use of their information as described in that policy.

              Solennia reserves the right to modify or update these Terms and Conditions at any time to reflect changes in platform functionality, services, or legal obligations. Any revisions shall take effect immediately upon posting. Continued use of the platform after such updates constitutes acceptance of the revised terms.

              For questions or concerns regarding these Terms and Conditions, users may contact solenniainquires@gmail.com
              . By using Solennia, you acknowledge your responsibility as a platform user and agree to engage in lawful, respectful, and professional interactions within the Solennia ecosystem.
            </p>
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
import React from "react";

export default function Modals() {

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

  const stopSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const closePrivacy = (e) => {
    e?.stopPropagation();
    document.getElementById("privacyModal")?.classList.add("hidden");
  };

  const closeFeedback = () => {
    document.getElementById("feedbackModal")?.classList.add("hidden");
  };

  const closeTerms = () => {
    document.getElementById("termsModal")?.classList.add("hidden");
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
        onClick={closeAll}
      >

        {/* ================= LOGIN MODAL ================= */}
        <div
          id="loginModal"
          className="bg-[#f6f0e8] rounded-2xl shadow-xl w-full max-w-md mx-auto hidden p-8 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={closeAll}
            className="absolute top-3 right-3 text-gray-600 hover:text-black text-xl"
          >
            &times;
          </button>

          <h2 className="text-2xl font-semibold mb-4 text-center">
            Login to Solennia
          </h2>

          <form
            id="loginForm"
            className="space-y-4"
            noValidate
            onSubmit={stopSubmit}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              placeholder="Email or Username"
              className="w-full border border-gray-400 rounded-lg px-3 py-2"
            />

            <input
              type="password"
              placeholder="Password"
              className="w-full border border-gray-400 rounded-lg px-3 py-2"
            />

            <button className="w-full bg-[#7a5d47] text-white py-2 rounded-lg">
              Login
            </button>

            <p className="text-sm text-center mt-3">
              No account yet?{" "}
              <button
                type="button"
                onClick={openRegister}
                className="text-[#7a5d47] hover:underline bg-transparent p-0"
              >
                Register
              </button>
            </p>
          </form>
        </div>

        {/* ================= REGISTER MODAL ================= */}
        <div
          id="registerModal"
          className="bg-[#f6f0e8] rounded-2xl shadow-xl w-full max-w-md mx-auto hidden p-8 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={closeAll}
            className="absolute top-3 right-3 text-gray-600 hover:text-black text-xl"
          >
            &times;
          </button>

          <h2 className="text-2xl font-semibold mb-4 text-center">
            Create Your Account
          </h2>

          <form
            id="registerForm"
            className="space-y-4"
            noValidate
            onSubmit={stopSubmit}
            onClick={(e) => e.stopPropagation()}
          >
            <input placeholder="First name" className="w-full border rounded-lg px-3 py-2" />
            <input placeholder="Last name" className="w-full border rounded-lg px-3 py-2" />
            <input placeholder="Email" className="w-full border rounded-lg px-3 py-2" />
            <input placeholder="Username" className="w-full border rounded-lg px-3 py-2" />
            <input type="password" placeholder="Password" className="w-full border rounded-lg px-3 py-2" />

            <button className="w-full bg-[#7a5d47] text-white py-2 rounded-lg">
              Create account
            </button>

            <p className="text-sm text-center mt-3">
              Already have an account?{" "}
              <button
                type="button"
                onClick={openLogin}
                className="text-[#7a5d47] hover:underline bg-transparent p-0"
              >
                Login
              </button>
            </p>
          </form>
        </div>
      </div>

      {/* ================= FEEDBACK MODAL ================= */}
      <div
        id="feedbackModal"
        className="hidden fixed inset-0 z-[260] bg-black/40 flex items-center justify-center p-4"
        onClick={closeFeedback}
      >
        <div
          className="bg-[#f6f0e8] w-full max-w-md rounded-2xl shadow-xl border border-gray-300"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center px-6 py-4 border-b bg-[#e8ddae]">
            <h3 className="text-lg font-semibold">Your Feedback</h3>
            <button onClick={closeFeedback} className="text-2xl">&times;</button>
          </div>

          <form className="px-6 py-5 space-y-4">
            <textarea
              rows="4"
              placeholder="Type your feedback here..."
              className="w-full border rounded-lg p-2"
            />
            <div className="flex justify-end">
              <button className="px-6 py-2 bg-[#7a5d47] text-white rounded-md">
                Send Feedback
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ================= PRIVACY MODAL ================= */}
      <div
        id="privacyModal"
        className="hidden fixed inset-0 z-[270] bg-black/40 flex items-center justify-center p-4"
        onClick={closePrivacy}
      >
        <div
          className="bg-[#f6f0e8] w-full max-w-2xl rounded-2xl shadow-xl border border-gray-300 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center px-6 py-4 border-b bg-[#e8ddae]">
            <h3 className="text-lg font-semibold tracking-wide">Privacy Policy</h3>
            <button onClick={closePrivacy} className="text-2xl">&times;</button>
          </div>

          <div className="p-6 space-y-4 text-sm leading-relaxed max-h-[70vh] overflow-y-auto">
            <p><strong>Introduction</strong><br />At Solennia, we are committed to protecting your privacy and ensuring that your personal information is handled responsibly.</p>
            <p><strong>Information We Collect</strong><br />We may collect personal data including your name, email address, contact number, and wedding-related information.</p>
            <p><strong>How We Use Your Information</strong><br />Information is used solely to operate and improve our platform.</p>
            <p><strong>Sharing of Information</strong><br />Your data is never sold to third parties.</p>
            <p><strong>Data Protection</strong><br />We employ encryption and secure servers.</p>
            <p><strong>Your Rights</strong><br />You may access, update, or delete your data.</p>
            <p><strong>Cookies & Tracking</strong><br />We use cookies to enhance functionality.</p>
            <p><strong>Children’s Privacy</strong><br />Not intended for children under 13.</p>
            <p><strong>Policy Updates</strong><br />Policies may be updated periodically.</p>
            <p><strong>Contact</strong><br />Email us at <a href="mailto:solenniainquires@gmail.com" className="underline">solenniainquires@gmail.com</a></p>
          </div>
        </div>
      </div>

      {/* ================= TERMS MODAL ================= */}
      <div
        id="termsModal"
        className="hidden fixed inset-0 z-[275] bg-black/40 flex items-center justify-center p-4"
        onClick={closeTerms}
      >
        <div
          className="bg-[#f6f0e8] w-full max-w-4xl rounded-2xl shadow-xl border border-gray-300"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center px-6 py-4 border-b bg-[#e8ddae]">
            <h3 className="text-xl font-semibold tracking-wide">Terms and Conditions</h3>
            <button onClick={closeTerms} className="text-2xl">&times;</button>
          </div>

          <div className="p-6 space-y-5 text-sm leading-relaxed max-h-[70vh] overflow-y-auto">
            <p><strong>Acceptance of Terms</strong><br />By using Solennia, you agree to these terms.</p>
            <p><strong>About Solennia</strong><br />Solennia connects couples with wedding vendors.</p>
            <p><strong>User Accounts</strong><br />Users must provide accurate information.</p>
            <p><strong>Role as Intermediary</strong><br />Solennia is not liable for vendor-client disputes.</p>
            <p><strong>Vendor Responsibilities</strong><br />Vendors must act professionally.</p>
            <p><strong>Changes</strong><br />Terms may be updated at any time.</p>
            <p><strong>Contact</strong><br />Email <a href="mailto:solenniainquires@gmail.com" className="underline">solenniainquires@gmail.com</a></p>
          </div>
        </div>
      </div>
    </>
  );
}

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
  };

  const closeFeedback = () => {
    document.getElementById("feedbackModal")?.classList.add("hidden");
  };

  const closePrivacy = () => {
    document.getElementById("privacyModal")?.classList.add("hidden");
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
        onClick={(e) => {
          if (e.target === e.currentTarget) closeAll();
        }}
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
          >
            <input className="w-full border rounded-lg px-3 py-2" placeholder="First name" />
            <input className="w-full border rounded-lg px-3 py-2" placeholder="Last name" />
            <input className="w-full border rounded-lg px-3 py-2" placeholder="Email" />
            <input className="w-full border rounded-lg px-3 py-2" placeholder="Username" />
            <input type="password" className="w-full border rounded-lg px-3 py-2" placeholder="Password" />

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
        onClick={(e) => e.target === e.currentTarget && closeFeedback()}
      >
        <div className="bg-[#f6f0e8] w-full max-w-md rounded-2xl shadow-xl border border-gray-300 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Your Feedback</h3>
            <button onClick={closeFeedback} className="text-2xl">&times;</button>
          </div>

          <textarea className="w-full border rounded-lg p-2" rows="4" />
        </div>
      </div>

      {/* ================= PRIVACY MODAL ================= */}
      <div
        id="privacyModal"
        className="hidden fixed inset-0 z-[270] bg-black/40 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && closePrivacy()}
      >
        <div className="bg-[#f6f0e8] w-full max-w-2xl rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4">Privacy Policy</h3>
          <p className="text-sm">Privacy content here.</p>
        </div>
      </div>

      {/* ================= TERMS MODAL ================= */}
      <div
        id="termsModal"
        className="hidden fixed inset-0 z-[275] bg-black/40 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && closeTerms()}
      >
        <div className="bg-[#f6f0e8] w-full max-w-4xl rounded-2xl p-6">
          <h3 className="text-xl font-semibold mb-4">Terms & Conditions</h3>
          <p className="text-sm">Terms content here.</p>
        </div>
      </div>
    </>
  );
}

// src/pages/Landing.jsx
import { useEffect, useState } from "react";
import "../style.css";

export default function Landing() {
  const [showModal, setShowModal] = useState(false);
  const [year, setYear] = useState("");

  // Redirect ONLY if logged in AND not intentionally on /landing
  useEffect(() => {
    try {
      const token = localStorage.getItem("solennia_token");
      const isLanding = window.location.pathname.startsWith("/landing");

      if (token && !isLanding) {
        window.location.replace("/");
      }
    } catch (_) {}
  }, []);

  // Set footer year
  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  const handleGetStarted = (e) => {
    e.preventDefault();
    setShowModal(true);
  };

  const handleGuestContinue = () => {
    try {
      localStorage.setItem("solennia_guest", "1");
      localStorage.removeItem("solennia_token");
      localStorage.removeItem("solennia_role");
      localStorage.removeItem("solennia_profile");
    } catch (_) {}

    window.location.href = "/";
  };

  const closeModal = (e) => {
    if (e.target.id === "guestModal") {
      setShowModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f0e8] font-[Cinzel] text-[#1c1b1a]">
      <main className="min-h-screen flex flex-col">
        <section className="relative flex-1">
          <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28 text-center">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-wide">
              Where Events and Vendors Click
            </h1>

            <p className="mt-6 text-lg text-gray-700">
              Plan less. Celebrate more — connect with trusted suppliers in seconds.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleGetStarted}
                className="inline-flex items-center justify-center px-6 py-3 rounded-md bg-[#7a5d47] text-white font-semibold hover:opacity-90"
              >
                Let’s Get Started
              </button>
            </div>

            <p className="mt-10 text-sm text-gray-500">{year}</p>
          </div>
        </section>

        {/* Guest Modal */}
        {showModal && (
          <div
            id="guestModal"
            onClick={closeModal}
            className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center"
          >
            <div className="bg-[#f6f0e8] rounded-2xl shadow-xl border border-gray-300 p-6 w-full max-w-md text-center">
              <h2 className="text-xl font-semibold">Continue as Guest?</h2>

              <p className="text-sm mt-2 text-gray-700">
                You can browse Solennia freely, or log in for a personalized experience.
              </p>

              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={handleGuestContinue}
                  className="px-5 py-2 rounded-md bg-[#e8ddae] hover:bg-[#dbcf9f]"
                >
                  Continue as Guest
                </button>

                <a
                  href="/#login"
                  className="px-5 py-2 rounded-md bg-[#7a5d47] text-white hover:opacity-90"
                >
                  Login / Register
                </a>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

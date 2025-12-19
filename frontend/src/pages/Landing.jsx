// src/landing.jsx
import { useEffect } from "react";
import "./style.css";

export default function Landing() {
  useEffect(() => {
    // Set year text
    const yearEl = document.getElementById("year");
    if (yearEl) {
      yearEl.textContent = `© ${new Date().getFullYear()} Solennia`;
    }

    // Button behavior (preserving landing.js intent)
    const btn = document.getElementById("btnGetStarted");
    if (btn) {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "/"; // or /index, /vendors, etc.
      });
    }

    return () => {
      if (btn) btn.replaceWith(btn.cloneNode(true));
    };
  }, []);

  return (
    <main className="font-[Cinzel] text-[#1c1b1a] bg-[#f6f0e8] min-h-screen flex flex-col">
      <section className="relative flex-1">
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-28 text-center">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-wide">
            Where Events and Vendors Click
          </h1>

          <p className="mt-6 text-lg text-gray-700">
            Plan less. Celebrate more — connect with trusted suppliers in seconds.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              id="btnGetStarted"
              href="#"
              className="inline-flex items-center justify-center px-6 py-3 rounded-md bg-[#7a5d47] text-white font-semibold hover:opacity-90"
            >
              Let’s Get Started
            </a>
          </div>

          <p id="year" className="mt-10 text-sm text-gray-500"></p>
        </div>
      </section>
    </main>
  );
}

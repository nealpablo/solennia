import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {

  /* =========================
     MODAL HANDLERS
  ========================= */

  const openModal = (id) => (e) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.classList.remove("hidden");
  };

  return (
    <footer className="bg-[#353946] text-[#e8ddae] py-6">
      <div className="max-w-6xl mx-auto px-8 grid grid-cols-1 md:grid-cols-3 gap-8 items-start">

        {/* ================= BRAND (LEFT) ================= */}
        <div className="space-y-3 text-left">
          <img
            src="/images/solennia.png"
            alt="Solennia logo"
            className="h-20 w-auto select-none"
          />

          <p className="text-[#d8cfae] italic text-xs leading-relaxed max-w-xs">
            “One click closer to the perfect event.”
          </p>

          <p className="text-xs">
            solenniainquires@gmail.com
          </p>

          <p className="text-[0.7rem] text-[#c9bda4]">
            © 2025 Solennia. All rights reserved.
          </p>
        </div>

        {/* ================= NAVIGATION (MIDDLE) ================= */}
        <ul
          className="
            space-y-4
            text-left
            uppercase
            tracking-[0.2em]
            text-sm
            leading-relaxed
            pt-2
            md:justify-self-center
          "
        >
         
        </ul>

        {/* ================= LEGAL (RIGHT) ================= */}
        <ul
          className="
            space-y-4
            text-left
            uppercase
            tracking-[0.2em]
            text-sm
            leading-relaxed
            pt-2
            md:justify-self-end
          "
        >
          <li>
            <button
              onClick={openModal("privacyModal")}
              className="hover:underline hover:text-[#f2e7c6] transition-colors text-left"
            >
              PRIVACY POLICY
            </button>
          </li>

          <li>
            <button
              onClick={openModal("termsModal")}
              className="hover:underline hover:text-[#f2e7c6] transition-colors text-left"
            >
              TERMS & CONDITIONS
            </button>
          </li>

          <li>
            <button
              onClick={openModal("feedbackModal")}
              className="hover:underline hover:text-[#f2e7c6] transition-colors text-left"
            >
              GIVE FEEDBACK
            </button>
          </li>
        </ul>

      </div>
    </footer>
  );
}

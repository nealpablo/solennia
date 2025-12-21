import React, { useEffect } from "react";
import "../style.css";

export default function AboutUs() {
  useEffect(() => {
    const lb = document.getElementById("imgLightbox");
    const img = document.getElementById("lbImg");
    const ttl = document.getElementById("lbTitle");
    const btnX = document.getElementById("lbClose");

    if (!lb || !img || !ttl || !btnX) return;

    function openLightbox(src, alt) {
      if (!src) return;
      img.src = src;
      img.alt = alt || "Preview";
      ttl.textContent = alt || "Preview";
      lb.classList.add("open");
      lb.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function closeLightbox() {
      lb.classList.remove("open");
      lb.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      setTimeout(() => {
        img.src = "";
        img.alt = "";
      }, 150);
    }

    function makeZoomable(id) {
      const el = document.getElementById(id);
      if (!el) return;

      el.addEventListener("click", () => openLightbox(el.src, el.alt));
      el.setAttribute("tabindex", "0");
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLightbox(el.src, el.alt);
        }
      });
    }

    makeZoomable("aboutImg1");
    makeZoomable("aboutImg2");

    btnX.addEventListener("click", closeLightbox);
    lb.addEventListener("click", (e) => {
      if (e.target === lb) closeLightbox();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lb.classList.contains("open")) {
        closeLightbox();
      }
    });

    return () => {
      btnX.removeEventListener("click", closeLightbox);
    };
  }, []);

  return (
    <main className="flex-1 font-[Cinzel] text-[#1c1b1a] bg-[#f6f0e8] scroll-smooth">
      {/* Page-specific styles (from HTML <style>) */}
      <style>{`
        #carousel { scrollbar-width: none; }
        #carousel::-webkit-scrollbar { display: none; }

        .zoomable { cursor: zoom-in; }
        .lb-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.65);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1.25rem;
        }
        .lb-backdrop.open { display: flex; }
        .lb-frame {
          position: relative;
          background: #fff;
          border-radius: .75rem;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.25);
          max-width: 92vw;
          max-height: 88vh;
          box-shadow: 0 20px 60px rgba(0,0,0,.45);
        }
        .lb-img {
          display: block;
          max-width: 92vw;
          max-height: 84vh;
          object-fit: contain;
          background: #111;
        }
        .lb-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255,255,255,0.95);
          padding: .5rem .75rem;
          gap: .5rem;
        }
        .lb-title {
          font-size: .85rem;
          font-weight: 600;
          color: #1c1b1a;
        }
        .lb-close {
          font-size: 1.25rem;
          line-height: 1;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: .25rem .5rem;
          border-radius: .5rem;
        }
        .lb-close:hover { background: rgba(0,0,0,.06); }
      `}</style>

      <section className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-wide">
          ABOUT SOLENNIA
        </h1>

<div className="mt-6 p-5 rounded-xl border border-gray-300 bg-[#efe9dd]">
  <h1 className="text-lg md:text-xl font-semibold uppercase tracking-wide">
    Driven by Innovation, Powered by Connection
  </h1>
  <p className="mt-2 text-sm md:text-base">
    Your event, your vision. Solennia brings together essential planning tools and trusted event service providers 
    in one centralized platform—so you can focus on creating meaningful experiences without unnecessary complexity.
  </p>
</div>

<div className="mt-6 p-5 rounded-xl border border-gray-300 bg-[#efe9dd]">
  <h3 className="text-lg md:text-xl font-semibold uppercase tracking-wide">
    Who We Are
  </h3>
  <div className="mt-3 space-y-4 text-sm md:text-base leading-relaxed">
    <p>
      We are a team of tech innovators, creative thinkers, and event 
      industry professionals brought together by a shared mission: 
      to simplify and elevate the way events are planned and managed.
    </p>
    <p>
      Solennia was built as an all-in-one digital event platform designed to support a wide range of 
      events—from corporate functions and social gatherings to private celebrations and community events. 
      By combining smart technology with human-centered design, we empower users to plan, organize, 
      and execute events with confidence and efficiency.
    </p>
    <p>
      From discovering reliable vendors to managing event details in one place, 
      Solennia serves as your digital partner—where creativity, organization, and convenience meet.
    </p>
  </div>
</div>

<div className="mt-6 p-5 rounded-xl border border-gray-300 bg-[#efe9dd]">
  <h1 className="text-lg md:text-xl font-semibold uppercase tracking-wide">
    What We Offer
  </h1>

  <div className="mt-4 space-y-4 text-sm md:text-base leading-relaxed">
    <div>
      <p className="font-semibold text-base md:text-lg">
        Curated Event Vendor Marketplace
      </p>
      <p>
        Discover verified event service providers including venues, caterers,
        photographers, entertainers, stylists, and equipment rentals—reviewed
        to ensure quality and reliability.
      </p>
    </div>

    <div>
      <p className="font-semibold text-base md:text-lg">
        Smart Event Planning Tools
      </p>
      <p>
        Access planning tools such as task trackers, scheduling aids, budgeting
        features, and vendor coordination tools through a unified dashboard.
      </p>
    </div>

    <div>
      <p className="font-semibold text-base md:text-lg">
        Inspiration &amp; Event Concepts
      </p>
      <p>
        Explore ideas, themes, and visual references to help shape the look,
        feel, and atmosphere of your event.
      </p>
    </div>

    <div>
      <p className="font-semibold text-base md:text-lg">
        Reliable Platform Support
      </p>
      <p>
        Whether you are planning independently or coordinating with
        professionals, Solennia provides guidance and platform support to help
        you move forward with clarity and control.
      </p>
    </div>
  </div>
</div>




        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <figure className="relative overflow-hidden rounded-xl border border-gray-300 bg-[#efe9dd]">
            <img
              id="aboutImg1"
              src="/images/about1.jpg"
              alt="Solennia platform in action"
              className="w-full h-64 md:h-80 object-cover zoomable"
              loading="lazy"
            />
            <figcaption className="p-3 text-xs text-gray-700">
              Solennia connects clients and trusted vendors.
            </figcaption>
          </figure>

          <figure className="relative overflow-hidden rounded-xl border border-gray-300 bg-[#efe9dd]">
            <img
              id="aboutImg2"
              src="/images/about2.jpg"
              alt="Vendors showcasing their work"
              className="w-full h-64 md:h-80 object-cover zoomable"
              loading="lazy"
            />
            <figcaption className="p-3 text-xs text-gray-700">
              Vendors showcase portfolios and grow their business.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Lightbox */}
      <div id="imgLightbox" className="lb-backdrop" aria-hidden="true">
        <div
          className="lb-frame"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lbTitle"
        >
          <div className="lb-bar">
            <div id="lbTitle" className="lb-title">Preview</div>
            <button id="lbClose" className="lb-close" aria-label="Close">
              &times;
            </button>
          </div>
          <img id="lbImg" className="lb-img" alt="" />
        </div>
      </div>
    </main>
  );
}

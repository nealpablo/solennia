import { useEffect } from "react";
import React from "react";

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
      if (e.key === "Escape" && lb.classList.contains("open")) closeLightbox();
    });

    return () => {
      btnX.removeEventListener("click", closeLightbox);
    };
  }, []);

  return (
    <div className="min-h-screen font-[Cinzel] text-[#1c1b1a] bg-[#f6f0e8] scroll-smooth">
      {/* Page styles */}
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
        }
        .lb-title {
          font-size: .85rem;
          font-weight: 600;
          color: #1c1b1a;
        }
        .lb-close {
          font-size: 1.25rem;
          background: transparent;
          border: none;
          cursor: pointer;
        }
      `}</style>

      <main>
        <section className="max-w-6xl mx-auto px-4 py-12">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-wide">
            ABOUT SOLENNIA
          </h1>

          <div className="mt-6 p-5 rounded-xl border border-gray-300 bg-[#efe9dd]">
            <h2 className="text-sm font-semibold uppercase">About Solennia</h2>
            <p className="mt-2 text-sm md:text-base">
              Solennia is a modern event planning platform designed to connect
              clients, planners, and event service providers in one seamless
              digital space.
            </p>
          </div>

          <div className="mt-6 p-5 rounded-xl border border-gray-300 bg-[#efe9dd]">
            <h3 className="text-sm font-semibold uppercase">Who We Are</h3>
            <p className="mt-3 text-sm md:text-base">
              We are a passionate team of innovators, developers, and event
              enthusiasts who believe that planning an event should be
              exciting—not stressful.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <figure className="rounded-xl border border-gray-300 bg-[#efe9dd] overflow-hidden">
              <img
                id="aboutImg1"
                src="/images/about1.jpg"
                alt="Solennia platform in action"
                className="w-full h-64 md:h-80 object-cover zoomable"
              />
            </figure>

            <figure className="rounded-xl border border-gray-300 bg-[#efe9dd] overflow-hidden">
              <img
                id="aboutImg2"
                src="/images/about2.jpg"
                alt="Vendors showcasing their work"
                className="w-full h-64 md:h-80 object-cover zoomable"
              />
            </figure>
          </div>
        </section>
      </main>

      {/* Lightbox (page-specific, stays here) */}
      <div id="imgLightbox" className="lb-backdrop" aria-hidden="true">
        <div className="lb-frame" role="dialog" aria-modal="true">
          <div className="lb-bar">
            <div id="lbTitle" className="lb-title">Preview</div>
            <button id="lbClose" className="lb-close">&times;</button>
          </div>
          <img id="lbImg" className="lb-img" alt="" />
        </div>
      </div>
    </div>
  );
}

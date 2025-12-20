// src/pages/HomePage.jsx
import React, { useEffect, useRef } from "react";
import "../style.css";

export default function HomePage() {
  const carouselRef = useRef(null);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    let animationId;
    const speed = 0.35; // 🔥 lower = slower (0.2–0.5 recommended)

    const animate = () => {
      carousel.scrollLeft += speed;

      // Reset seamlessly when halfway through
      if (carousel.scrollLeft >= carousel.scrollWidth / 2) {
        carousel.scrollLeft = 0;
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <main className="flex-1 font-[Cinzel] text-[#1c1b1a] bg-[#f6f0e8]">
      {/* =========================
          GALLERY / CONTINUOUS CAROUSEL
      ========================= */}
      <section className="mt-16 bg-[#7a5d47] py-10">
        <div className="max-w-6xl mx-auto px-4">
          <div
            ref={carouselRef}
            className="relative overflow-x-hidden rounded-xl"
          >
            <ul className="flex gap-8 py-2 list-none w-max">
              {/* SET 1 */}
              <li className="shrink-0 w-[420px]">
                <img
                  src="/images/gallery1.jpg"
                  alt="Kids Party"
                  className="w-full h-60 object-cover rounded-xl"
                />
              </li>

              <li className="shrink-0 w-[420px]">
                <img
                  src="/images/gallery2.jpg"
                  alt="Wedding"
                  className="w-full h-60 object-cover rounded-xl"
                />
              </li>

              <li className="shrink-0 w-[420px]">
                <img
                  src="/images/gallery3.jpg"
                  alt="Clients"
                  className="w-full h-60 object-cover rounded-xl"
                />
              </li>

              {/* SET 2 (DUPLICATE FOR LOOP) */}
              <li className="shrink-0 w-[420px]">
                <img
                  src="/images/gallery1.jpg"
                  alt="Kids Party"
                  className="w-full h-60 object-cover rounded-xl"
                />
              </li>

              <li className="shrink-0 w-[420px]">
                <img
                  src="/images/gallery2.jpg"
                  alt="Wedding"
                  className="w-full h-60 object-cover rounded-xl"
                />
              </li>

              <li className="shrink-0 w-[420px]">
                <img
                  src="/images/gallery3.jpg"
                  alt="Clients"
                  className="w-full h-60 object-cover rounded-xl"
                />
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* =========================
          AI SEARCH SECTION
      ========================= */}
      <section className="max-w-5xl mx-auto text-center mt-16 px-4">
        <h2 className="text-2xl md:text-3xl font-semibold">
          Plan your dream Event Now
        </h2>

        <p className="mt-2 text-gray-700">
          Let Solennia AI handle the stress — you enjoy the Yes!
        </p>

        <div className="mt-6 max-w-md mx-auto">
          <input
            type="text"
            placeholder="Type..."
            className="w-full border-b border-gray-500 bg-transparent focus:outline-none py-2 text-sm text-gray-800"
          />
        </div>
      </section>
    </main>
  );
}

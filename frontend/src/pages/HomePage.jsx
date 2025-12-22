// src/pages/HomePage.jsx
import React, { useEffect, useState, useRef } from "react";
import "../style.css";

export default function HomePage() {
  /* =========================
     CAROUSEL STATE
  ========================= */
  const images = [
    { src: "/images/gallery1.jpg", alt: "Kids Party" },
    { src: "/images/gallery2.jpg", alt: "Wedding" },
    { src: "/images/gallery3.jpg", alt: "Clients" },
  ];

  const [index, setIndex] = useState(0);
  const intervalRef = useRef(null);

  /* =========================
     AUTO PLAY
  ========================= */
  useEffect(() => {
    startAutoPlay();
    return stopAutoPlay;
  }, []);

  const startAutoPlay = () => {
    stopAutoPlay();
    intervalRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 4500);
  };

  const stopAutoPlay = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const nextSlide = () => {
    setIndex((prev) => (prev + 1) % images.length);
  };

  const prevSlide = () => {
    setIndex((prev) =>
      prev === 0 ? images.length - 1 : prev - 1
    );
  };

  return (
    <main className="flex-1 font-[Cinzel] text-[#1c1b1a] bg-[#f6f0e8]">
      {/* =========================
          COMPACT GALLERY STRIP
      ========================= */}
      <section className="mt-4 bg-[#7a5d47] py-4">
        <div className="max-w-6xl mx-auto px-4">
          <div
            className="relative overflow-hidden rounded-xl"
            onMouseEnter={stopAutoPlay}
            onMouseLeave={startAutoPlay}
          >
            {/* SLIDES */}
            <div
              className="flex transition-transform duration-700 ease-in-out"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {images.map((img, i) => (
                <div key={i} className="min-w-full">
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="w-full h-48 md:h-56 object-cover"
                  />
                </div>
              ))}
            </div>

            {/* CONTROLS */}
            <button
              onClick={prevSlide}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white w-9 h-9 rounded-full flex items-center justify-center transition"
            >
              ‹
            </button>

            <button
              onClick={nextSlide}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white w-9 h-9 rounded-full flex items-center justify-center transition"
            >
              ›
            </button>
          </div>
        </div>
      </section>

      {/* =========================
          AI SEARCH (PULLED UP)
      ========================= */}
      <section className="max-w-4xl mx-auto text-center mt-6 px-4">
        <h2 className="text-lg md:text-xl font-semibold">
          Plan your dream event now
        </h2>

        <p className="mt-1 text-sm text-gray-700">
          Let Solennia AI handle the stress — you enjoy the Yes!
        </p>

        <div className="mt-3 max-w-md mx-auto">
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

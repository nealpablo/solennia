// src/pages/HomePage.jsx
import React from "react";
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

  // Duplicate images for seamless infinite scroll
  const infiniteImages = [...images, ...images, ...images];

  return (
    <main className="flex-1 font-[Cinzel] text-[#1c1b1a] bg-[#f6f0e8]">
      {/* =========================
          GALLERY CAROUSEL - CONTINUOUS FLOW
      ========================= */}
      <section className="bg-[#7a5d47] py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="relative">
            {/* CAROUSEL CONTAINER */}
            <div className="overflow-hidden">
              <style>{`
                @keyframes scroll {
                  0% {
                    transform: translateX(calc(0% + 0rem));
                  }
                  100% {
                    transform: translateX(calc(-${images.length * 100}% - ${images.length * 1.5}rem));
                  }
                }
              `}</style>
              <div
                className="flex gap-6"
                style={{ 
                  paddingLeft: 'calc(50% - 40%)',
                  paddingRight: 'calc(50% - 40%)',
                  animation: 'scroll 20s linear infinite'
                }}
              >
                {infiniteImages.map((img, i) => (
                  <div 
                    key={i} 
                    className="flex-shrink-0"
                    style={{ width: '80%' }}
                  >
                    <img
                      src={img.src}
                      alt={img.alt}
                      className="w-full h-64 sm:h-80 md:h-96 lg:h-[400px] object-cover rounded-2xl shadow-2xl"
                    />
                  </div>
                ))}
              </div>
            </div>
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
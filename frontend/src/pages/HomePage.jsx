// src/pages/HomePage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../style.css";

export default function HomePage() {
  const navigate = useNavigate();
  const [aiQuery, setAiQuery] = useState("");

  // ✅ Handle AI Search - redirect to AI Assistant with the message
  const handleAISearch = (e) => {
    if (e.key === "Enter" && aiQuery.trim()) {
      const token = localStorage.getItem("solennia_token");
      if (!token) {
        // Store the query to use after login
        sessionStorage.setItem("pending_ai_query", aiQuery.trim());
      }
      // Redirect to AI Assistant with the message
      navigate(`/ai-booking?ai_message=${encodeURIComponent(aiQuery.trim())}`);
    }
  };

  const handleAIButtonClick = () => {
    if (aiQuery.trim()) {
      const token = localStorage.getItem("solennia_token");
      if (!token) {
        sessionStorage.setItem("pending_ai_query", aiQuery.trim());
      }
      navigate(`/ai-booking?ai_message=${encodeURIComponent(aiQuery.trim())}`);
    } else {
      // Just go to AI Assistant
      navigate("/ai-booking");
    }
  };

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
      <section className="max-w-4xl mx-auto text-center mt-6 px-4 pb-8">
        <h2 className="text-lg md:text-xl font-semibold">
          Plan your dream event now
        </h2>

        <p className="mt-1 text-sm text-gray-700">
          Let Solennia AI handle the stress — you enjoy the Yes!
        </p>

        <div className="mt-3 max-w-md mx-auto">
          <div className="relative">
            <input
              type="text"
              placeholder="Ask about weddings, suppliers, budgets..."
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={handleAISearch}
              className="w-full border-b-2 border-gray-400 bg-transparent focus:outline-none focus:border-[#7a5d47] py-2 pr-10 text-sm text-gray-800 placeholder:text-gray-500 transition-colors"
            />
            {/* Send button */}
            <button
              onClick={handleAIButtonClick}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-[#7a5d47] transition-colors"
              title="Chat with AI"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Press <span className="font-semibold">Enter</span> or click the arrow to chat with Solennia AI
          </p>
        </div>

        {/* Quick suggestion chips */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {[
            "Find a wedding photographer",
            "Budget for 100 guests",
            "Venue recommendations",
            "Event planning tips"
          ].map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => {
                setAiQuery(suggestion);
                navigate(`/ai-booking?ai_message=${encodeURIComponent(suggestion)}`);
              }}
              className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-full text-gray-600 hover:bg-[#fef3c7] hover:border-[#f59e0b] hover:text-[#92400e] transition-all"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

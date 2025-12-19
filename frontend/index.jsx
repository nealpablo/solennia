// src/index.jsx
import "./style.css";

import Header from "./partials/header";
import Footer from "./partials/footer";
import Modals from "./partials/modals";

export default function Index() {
  return (
    <div className="min-h-screen flex flex-col font-[Cinzel] text-[#1c1b1a] bg-[#f6f0e8]">
      
      {/* HEADER */}
      <Header />

      {/* MAIN CONTENT */}
      <main className="flex-1">

        {/* GALLERY */}
        <section id="gallery" className="mt-16 bg-[#7a5d47] py-10">
          <div className="max-w-6xl mx-auto px-4">
            <div className="relative overflow-x-auto rounded-xl bg-[#7a5d47] scrollbar-none">
              <ul className="flex gap-8 py-2 list-none">
                <li className="shrink-0 w-[420px]">
                  <img
                    src="/images/gallery1.jpg"
                    alt="Kids Party"
                    className="w-full h-60 object-cover rounded-xl cursor-pointer"
                  />
                </li>
                <li className="shrink-0 w-[420px]">
                  <img
                    src="/images/gallery2.jpg"
                    alt="Wedding"
                    className="w-full h-60 object-cover rounded-xl cursor-pointer"
                  />
                </li>
                <li className="shrink-0 w-[420px]">
                  <img
                    src="/images/gallery3.jpg"
                    alt="Clients"
                    className="w-full h-60 object-cover rounded-xl cursor-pointer"
                  />
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* AI PROMPT */}
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

      {/* FOOTER + MODALS */}
      <Footer />
      <Modals />
    </div>
  );
}

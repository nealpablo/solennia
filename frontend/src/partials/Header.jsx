// src/partials/Header.jsx
import { Link } from "react-router-dom";
import React from "react";

export default function Header() {
  return (
    <header className="bg-[#e8ddae] border-b border-gray-300">
      <nav className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">

        {/* LOGO */}
        <Link
          to="/"
          className="flex items-center gap-2 text-xl tracking-wide"
        >
          <span>SOLENNIA</span>
        </Link>

        {/* MOBILE MENU BUTTON */}
        <button
          id="mobileToggle"
          className="md:hidden p-2 rounded hover:bg-black/5"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* NAV LINKS */}
        <ul
          id="mobileMenu"
          className="md:flex items-center gap-6 text-sm font-medium hidden"
        >
          <li>
            <Link to="/" className="hover:underline">VENUE</Link>
          </li>
          <li>
            <Link to="/vendors" className="hover:underline">VENDORS</Link>
          </li>
          <li>
            <Link to="/about" className="hover:underline">ABOUT US</Link>
          </li>
        </ul>

        {/* RIGHT SIDE BUTTONS */}
        <div className="flex items-center gap-2">

          {/* SEARCH (unchanged) */}
          <div className="relative">
            <button
              id="searchBtn"
              className="p-2 rounded hover:bg-black/5"
              aria-label="Search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </button>

            <div
              id="searchPanel"
              className="hidden absolute right-0 mt-2 w-80 bg-white border border-gray-300 rounded-2xl shadow-xl z-50"
            >
              <div className="p-3">
                <input
                  id="searchInput"
                  type="text"
                  placeholder="Search Solennia..."
                  className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#7a5d47]"
                />
                <ul
                  id="searchResults"
                  className="mt-3 max-h-64 overflow-y-auto divide-y text-sm"
                />
              </div>
            </div>
          </div>

          {/* MESSAGES */}
          <Link
            to="/chat"
            className="p-2 rounded hover:bg-black/5"
            aria-label="Messages"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a4 4 0 0 1-4 4H8l-4 3V7a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4z" />
            </svg>
          </Link>

          {/* PROFILE DROPDOWN */}
          <div className="relative">
            <button
              id="profileBtn"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-400 hover:bg-black/5 overflow-hidden bg-transparent"
              aria-haspopup="menu"
            >
              <img
                id="navAvatar"
                className="w-full h-full object-cover hidden rounded-full"
                alt=""
              />
              <div
                id="navAvatarFallback"
                className="flex items-center justify-center w-full h-full rounded-full bg-transparent"
              >
                <svg
                  className="w-5 h-5 text-gray-700"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5 0-9 2.5-9 5.5V21h18v-1.5C21 16.5 17 14 12 14Z" />
                </svg>
              </div>
            </button>

            <div
              id="profileMenu"
              className="hidden absolute right-0 mt-2 w-56 rounded-xl border border-gray-300 bg-[#f6f0e8] shadow-xl z-50"
            >
              <div className="py-1">
                <Link
                  to="/profile"
                  id="menuProfile"
                  className="block px-4 py-2 text-sm hover:bg-gray-100"
                >
                  Profile
                </Link>

                <div className="my-1 border-t border-gray-300" />

                <button
                  id="menuSignIn"
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  Login
                </button>
                <button
                  id="menuSignUp"
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  Register
                </button>
                <button
                  id="menuLogout"
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 hidden"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>

        </div>
      </nav>
    </header>
  );
}

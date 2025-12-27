// src/partials/Header.jsx
import { Link } from "react-router-dom";
import React, { useEffect, useState } from "react";
import ChatDropdown from "./ChatDropdown";
import NotificationDropdown from "./NotificationDropdown";

export default function Header() {
  const [avatar, setAvatar] = useState(null);
  const [username, setUsername] = useState(null);
  const [email, setEmail] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Toggle profile dropdown
  const toggleProfileDropdown = () => {
    setIsProfileOpen(!isProfileOpen);
  };

  // Open auth modals
  const openLoginModal = () => {
    setIsProfileOpen(false);
    const authBackdrop = document.getElementById("authBackdrop");
    const loginModal = document.getElementById("loginModal");
    authBackdrop?.classList.remove("hidden");
    loginModal?.classList.remove("hidden");
  };

  const openRegisterModal = () => {
    setIsProfileOpen(false);
    const authBackdrop = document.getElementById("authBackdrop");
    const registerModal = document.getElementById("registerModal");
    authBackdrop?.classList.remove("hidden");
    registerModal?.classList.remove("hidden");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const profileMenu = document.getElementById("profileMenu");
      const profileBtn = document.getElementById("profileBtn");
      
      if (profileMenu && profileBtn && 
          !profileMenu.contains(event.target) && 
          !profileBtn.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update dropdown visibility based on state
  useEffect(() => {
    const profileMenu = document.getElementById("profileMenu");
    if (profileMenu) {
      if (isProfileOpen) {
        profileMenu.classList.remove("hidden");
      } else {
        profileMenu.classList.add("hidden");
      }
    }
  }, [isProfileOpen]);

  // Load profile avatar and username
  useEffect(() => {
    const loadProfile = () => {
      const profileData = localStorage.getItem("solennia_profile");
      if (profileData) {
        try {
          const parsed = JSON.parse(profileData);
          setAvatar(parsed.avatar || null);
          setUsername(parsed.username || parsed.first_name || null);
          setEmail(parsed.email || null);
        } catch (e) {
          console.error("Error parsing profile:", e);
        }
      } else {
        setAvatar(null);
        setUsername(null);
        setEmail(null);
      }
    };

    loadProfile();
    window.addEventListener("profileUpdated", loadProfile);
    window.addEventListener("storage", loadProfile);

    return () => {
      window.removeEventListener("profileUpdated", loadProfile);
      window.removeEventListener("storage", loadProfile);
    };
  }, []);

  // Auth dropdown state
  useEffect(() => {
    const token = localStorage.getItem("solennia_token");

    if (token) {
      document.getElementById("menuSignIn")?.classList.add("hidden");
      document.getElementById("menuSignUp")?.classList.add("hidden");
      document.getElementById("menuLogout")?.classList.remove("hidden");
    } else {
      document.getElementById("menuLogout")?.classList.add("hidden");
      document.getElementById("menuSignIn")?.classList.remove("hidden");
      document.getElementById("menuSignUp")?.classList.remove("hidden");
    }
  }, []);

  // Get user initials for avatar
  const getInitials = () => {
    if (!username) return "U";
    return username.substring(0, 2).toUpperCase();
  };

  return (
    <header className="bg-[#e8ddae] border-b border-gray-300">
      <nav className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">

        {/* LOGO */}
        <Link to="/" className="flex items-center gap-2 text-xl tracking-wide">
          <span>SOLENNIA</span>
        </Link>

        {/* MOBILE MENU */}
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
          <li><Link to="/venue" className="hover:underline">VENUE</Link></li>
          <li><Link to="/vendors" className="hover:underline">VENDORS</Link></li>
          <li><Link to="/about" className="hover:underline">ABOUT US</Link></li>
        </ul>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-2">

          {/* SEARCH */}
          <button
            id="searchBtn"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>

          {/* CHAT DROPDOWN */}
          <ChatDropdown />

          {/* NOTIFICATION DROPDOWN */}
          <NotificationDropdown />

          {/* PROFILE */}
          <div className="relative">
            <button
              id="profileBtn"
              onClick={toggleProfileDropdown}
              className="w-10 h-10 rounded-full border border-gray-700 overflow-hidden flex items-center justify-center hover:bg-black/5"
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#7a5d47] to-[#5d4436] text-white font-semibold text-sm">
                  {getInitials()}
                </div>
              )}
            </button>

            {/* PROFILE MENU */}
            <div
              id="profileMenu"
              className="hidden absolute right-0 mt-2 w-64 rounded-xl border border-gray-300 bg-[#f6f0e8] shadow-xl z-50"
            >
              {/* USERNAME SECTION - SHOWN AT TOP */}
              {username && (
                <div className="px-4 py-3 border-b border-gray-300 bg-[#e8ddae]">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full border-2 border-gray-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#7a5d47] to-[#5d4436] text-white font-semibold">
                          {getInitials()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {username}
                      </p>
                      {email && (
                        <p className="text-xs text-gray-600 truncate">
                          {email}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="py-1">
                <Link
                  to="/profile"
                  id="menuProfile"
                  onClick={() => setIsProfileOpen(false)}
                  className="block px-4 py-2 text-sm hover:bg-gray-100"
                >
                  Profile
                </Link>

                <div className="my-1 border-t border-gray-300" />

                <button
                  id="menuSignIn"
                  onClick={openLoginModal}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  Login
                </button>

                <button
                  id="menuSignUp"
                  onClick={openRegisterModal}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  Register
                </button>

                <button
                  id="menuLogout"
                  className="hidden w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => window.solenniaLogout && window.solenniaLogout()}
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
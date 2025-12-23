// src/App.jsx
import React, { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";

// Layout
import Header from "./partials/Header";
import Footer from "./partials/Footer";
import Modals from "./partials/Modals";

// Pages
import Landing from "./pages/Landing";
import HomePage from "./pages/HomePage";
import Venue from "./pages/Venue";
import VenueDetail from "./pages/VenueDetail";
import Vendors from "./pages/Vendors";
import VendorProfile from "./pages/VendorProfile";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";
import AdminPanel from "./pages/AdminPanel";
import VendorDashboard from "./pages/VendorDashboard";
import VenueDashboard from "./pages/VenueDashboard";
import AboutUs from "./pages/AboutUs";

/* =========================
   LAYOUT WRAPPER
========================= */
function Layout({ children }) {
  const location = useLocation();
  const hideLayout = location.pathname.startsWith("/landing");

  /**
   * 🔥 RESTORE LEGACY DROPDOWN + MODAL BEHAVIOR
   */
  useEffect(() => {
    const profileBtn = document.getElementById("profileBtn");
    const profileMenu = document.getElementById("profileMenu");

    const menuSignIn = document.getElementById("menuSignIn");
    const menuSignUp = document.getElementById("menuSignUp");

    const authBackdrop = document.getElementById("authBackdrop");
    const loginModal = document.getElementById("loginModal");
    const registerModal = document.getElementById("registerModal");

    function closeProfileMenu() {
      profileMenu?.classList.add("hidden");
    }

    function openProfileMenu(e) {
      e.stopPropagation();
      profileMenu?.classList.toggle("hidden");
    }

    function openLogin(e) {
      e.preventDefault();
      closeProfileMenu();
      authBackdrop?.classList.remove("hidden");
      loginModal?.classList.remove("hidden");
      registerModal?.classList.add("hidden");
    }

    function openRegister(e) {
      e.preventDefault();
      closeProfileMenu();
      authBackdrop?.classList.remove("hidden");
      registerModal?.classList.remove("hidden");
      loginModal?.classList.add("hidden");
    }

    // --- Attach listeners ---
    profileBtn?.addEventListener("click", openProfileMenu);
    menuSignIn?.addEventListener("click", openLogin);
    menuSignUp?.addEventListener("click", openRegister);

    // ✅ KEEP this (profile dropdown)
    document.addEventListener("click", closeProfileMenu);

    // --- Cleanup ---
    return () => {
      profileBtn?.removeEventListener("click", openProfileMenu);
      menuSignIn?.removeEventListener("click", openLogin);
      menuSignUp?.removeEventListener("click", openRegister);

      document.removeEventListener("click", closeProfileMenu);
    };
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f6f0e8]">
      {!hideLayout && <Header />}

      <div className="flex-1">{children}</div>

      {!hideLayout && <Footer />}
      <Modals />
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/landing" element={<Landing />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/venue" element={<Venue />} />
        <Route path="/venue/:id" element={<VenueDetail />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/vendor-profile" element={<VendorProfile />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/vendor-dashboard" element={<VendorDashboard />} />
        <Route path="/venue-dashboard" element={<VenueDashboard />} />
        <Route path="/about" element={<AboutUs />} />
      </Routes>
    </Layout>
  );
}
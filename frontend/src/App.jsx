// src/App.jsx
import { Routes, Route } from "react-router-dom";

import Landing from "./pages/landing.jsx";
import Vendors from "./pages/Vendors.jsx";
import Profile from "./pages/Profile.jsx";
import Chat from "./pages/Chat.jsx";
import AdminPanel from "./pages/adminpanel.jsx";
import VendorDashboard from "./pages/VendorDashboard.jsx";
import VendorProfile from "./pages/VendorProfile.jsx";
import AboutUs from "./pages/aboutus.jsx";

import Header from "./partials/Header.jsx";
import Footer from "./partials/Footer.jsx";

export default function App() {
  return (
    <>
      <Header />

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/vendors/:id" element={<VendorProfile />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/dashboard" element={<VendorDashboard />} />
        <Route path="/about" element={<AboutUs />} />
      </Routes>

      <Footer />
    </>
  );
}

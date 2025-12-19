import { Routes, Route, Navigate } from "react-router-dom";

import Header from "./partials/Header";
import Footer from "./partials/Footer";

import Landing from "./pages/landing";
import About from "./pages/aboutus";
import Vendors from "./pages/Vendors";
import VendorProfile from "./pages/VendorProfile";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";
import VendorDashboard from "./pages/VendorDashboard";
import AdminPanel from "./pages/adminpanel";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f6f0e8]">
      <Header />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<About />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/vendors/:id" element={<VendorProfile />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/vendor/dashboard" element={<VendorDashboard />} />
          <Route path="/admin" element={<AdminPanel />} />

          {/* fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

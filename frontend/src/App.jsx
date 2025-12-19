import { Routes, Route } from "react-router-dom";

import Header from "./partials/Header";
import Footer from "./partials/Footer";
import Modals from "./partials/Modals";

import Landing from "./pages/Landing";
import Vendors from "./pages/Vendors";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";
import AdminPanel from "./pages/AdminPanel";
import VendorDashboard from "./pages/VendorDashboard";
import AboutUs from "./pages/AboutUs";

export default function App() {
  return (
    <>
      <Header />

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/vendor-dashboard" element={<VendorDashboard />} />
        <Route path="/about" element={<AboutUs />} />
      </Routes>

      <Footer />
      <Modals />
    </>
  );
}

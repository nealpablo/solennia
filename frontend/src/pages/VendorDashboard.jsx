import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../style.css";

export default function VendorDashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect vendor dashboard entry directly to Manage Listings
    navigate("/manage-listings?vendor");
  }, [navigate]);

  return (
    <div style={{ padding: 80, textAlign: "center" }}>
      <p style={{ color: "#5d4436", fontWeight: 700 }}>Redirecting to Manage Listings…</p>
    </div>
  );
}

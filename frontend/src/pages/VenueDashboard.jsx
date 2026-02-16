import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../style.css";

export default function VenueDashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect venue dashboard entry directly to Manage Listings
    navigate("/manage-listings?venue");
  }, [navigate]);

  return (
    <div style={{ padding: 80, textAlign: "center" }}>
      <p style={{ color: "#5d4436", fontWeight: 700 }}>Redirecting to Manage Listings…</p>
    </div>
  );
}

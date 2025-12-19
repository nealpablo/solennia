import { useEffect, useState } from "react";
import Header from "../partials/Header";
import Footer from "../partials/Footer";
import Modals from "../partials/Modals";
import "../style.css";

const API = "/api";

export default function Profile() {
  const token = localStorage.getItem("solennia_token");

  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(Number(localStorage.getItem("solennia_role") || 0));
  const [vendorStatus, setVendorStatus] = useState(null);

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);

  /* ================= LOAD PROFILE ================= */
  useEffect(() => {
    if (!token) return;

    fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(j => {
        if (!j?.user) return;
        setProfile(j.user);
        localStorage.setItem("solennia_role", j.user.role ?? 0);
        setRole(j.user.role ?? 0);
      });
  }, [token]);

  /* ================= VENDOR STATUS ================= */
  useEffect(() => {
    if (!token || role !== 0) return;

    fetch(`${API}/vendor/status`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(j => setVendorStatus(j.status))
      .catch(() => {});
  }, [token, role]);

  /* ================= AVATAR UPLOAD ================= */
  async function uploadAvatar(e) {
    e.preventDefault();
    if (!avatarFile) return;

    const fd = new FormData();
    fd.append("avatar", avatarFile);

    const res = await fetch(`${API}/user/update`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });

    const json = await res.json();
    if (!res.ok) return alert(json.error || "Upload failed");

    setProfile(p => ({ ...p, avatar: json.avatar || p.avatar }));
    setShowAvatarModal(false);
  }

  /* ================= JOIN AS VENDOR ================= */
  function joinVendor() {
    if (!token) return alert("Please login first.");
    if (role !== 0) return alert("You cannot apply as vendor.");
    document.getElementById("vendorTerms")?.classList.remove("hidden");
  }

  /* ================= DASHBOARD ================= */
  function dashboardHref() {
    if (role === 2) return "/adminpanel.html";
    if (role === 1) return "/vendordashboard.html";
    return "#";
  }

  function dashboardLabel() {
    if (role === 2) return "Admin Panel";
    if (role === 1) return "Manage Dashboard";
    return "View Dashboard";
  }

  const name = profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
    : "Guest";

  return (
    <>
      <Header />

      <main className="pb-24">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="mt-6 text-xl font-semibold">PROFILE</h2>

          {/* Avatar */}
          <div className="flex flex-col items-center space-y-4">
            <div
              onClick={() => token && setShowAvatarModal(true)}
              style={{
                width: 112,
                height: 112,
                border: "2px solid #000",
                borderRadius: "9999px",
                overflow: "hidden",
                cursor: "pointer",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              {profile?.avatar ? (
                <img src={profile.avatar} className="w-full h-full object-cover" />
              ) : (
                <svg viewBox="0 0 24 24" width="48">
                  <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5 0-9 2.5-9 5.5V21h18v-1.5C21 16.5 17 14 12 14Z"/>
                </svg>
              )}
            </div>

            <div>
              <span className="font-semibold">Name:</span> {name}
            </div>

            <a href={dashboardHref()} className="btn-ghost">
              {dashboardLabel()}
            </a>
          </div>

          {/* Join Vendor */}
          {role === 0 && (
            <div className="mt-10 text-center">
              <button
                onClick={joinVendor}
                disabled={vendorStatus === "pending"}
                className={`btn-brown ${vendorStatus === "pending" ? "opacity-50" : ""}`}
              >
                {vendorStatus === "pending"
                  ? "Vendor Application Pending"
                  : "Join as a Vendor"}
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
      <Modals />

      {/* Avatar Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]">
          <div className="bg-[#f6f0e8] p-6 rounded-xl w-[90%] max-w-[420px]">
            <h2 className="text-lg font-semibold mb-3">Update Profile Picture</h2>

            <form onSubmit={uploadAvatar}>
              <input
                type="file"
                accept="image/*"
                required
                onChange={e => setAvatarFile(e.target.files[0])}
                className="border rounded p-2 w-full"
              />
              <button className="btn-brown w-full mt-4">Upload</button>
            </form>

            <button
              className="btn-ghost w-full mt-3"
              onClick={() => setShowAvatarModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

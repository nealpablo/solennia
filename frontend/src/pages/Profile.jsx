import React, { useEffect, useState } from "react";
import "../style.css";

const API = "/api";

export default function Profile() {
  const token = localStorage.getItem("solennia_token");

  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(
    Number(localStorage.getItem("solennia_role") || 0)
  );
  const [vendorStatus, setVendorStatus] = useState(null);

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);

  /* ================= LOAD PROFILE ================= */
  useEffect(() => {
    if (!token) return;

    fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => {
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
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j) => setVendorStatus(j.status))
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
      body: fd,
    });

    const json = await res.json();
    if (!res.ok) return alert(json.error || "Upload failed");

    setProfile((p) => ({ ...p, avatar: json.avatar || p.avatar }));
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
    if (role === 2) return "/admin"; // Admin
    if (role === 1) return "/vendor-dashboard"; // Vendor
    return null; // Client → NO ACCESS
  }

  function dashboardLabel() {
    if (role === 2) return "Admin Panel";
    if (role === 1) return "Manage Dashboard";
    return null;
  }

  const name = profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
    : "Guest";

  return (
    <>
      <main className="pb-24 bg-[#f6f0e8] text-[#1c1b1a]">
        <div className="max-w-6xl mx-auto px-4">
          {/* ================= PROFILE HEADER ================= */}
          <h2 className="mt-6 text-xl md:text-2xl font-semibold tracking-wide">
            PROFILE
          </h2>

          {/* ================= AVATAR SECTION ================= */}
          <div className="flex flex-col items-center text-center space-y-4 mt-6">
            <div
              onClick={() => token && setShowAvatarModal(true)}
              className="w-28 h-28 rounded-full border-2 border-black overflow-hidden bg-white flex items-center justify-center cursor-pointer"
            >
              {profile?.avatar ? (
                <img
                  src={profile.avatar}
                  className="w-full h-full object-cover"
                  alt="Profile avatar"
                />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="w-12 h-12 text-[#1c1b1a]"
                >
                  <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5 0-9 2.5-9 5.5V21h18v-1.5C21 16.5 17 14 12 14Z" />
                </svg>
              )}
            </div>

            <div className="text-sm">
              <span className="font-semibold uppercase tracking-wide">
                Name :
              </span>{" "}
              <span>{name}</span>
            </div>

            {/* ✅ FIX: ONLY RENDER DASHBOARD BUTTON IF ALLOWED */}
            {dashboardHref() && dashboardLabel() && (
              <a
                href={dashboardHref()}
                className="bg-[#e0d6c6] text-[#3b2f25] px-4 py-2 rounded-lg text-sm hover:opacity-90"
              >
                {dashboardLabel()}
              </a>
            )}
          </div>

          {/* ================= FAVORITES ================= */}
          <h2 className="mt-12 text-xl md:text-2xl font-semibold tracking-wide">
            FAVORITES
          </h2>

          <section className="mt-3 bg-[#ece8e1] border border-[#d9d6cf] rounded-xl p-4 md:p-6">
            <article className="rounded-xl border border-[#ded7c9] overflow-hidden bg-[#f5f0ea] mb-4">
              <img
                src="/images/gallery1.jpg"
                className="w-full object-cover"
              />
            </article>

            <article className="rounded-xl border border-[#ded7c9] overflow-hidden bg-[#f5f0ea]">
              <img
                src="/images/gallery2.jpg"
                className="w-full object-cover"
              />
            </article>

            <div className="mt-6 flex justify-center">
              <button className="bg-[#7a5d47] text-white px-6 py-2 rounded-lg hover:opacity-90">
                Compare Favorites
              </button>
            </div>
          </section>

          {/* ================= JOIN AS VENDOR ================= */}
          {role === 0 && (
            <section className="mt-12 text-center mb-16">
              <button
                onClick={joinVendor}
                disabled={vendorStatus === "pending"}
                className={`bg-[#7a5d47] text-white px-6 py-2 rounded-lg hover:opacity-90 ${
                  vendorStatus === "pending"
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                {vendorStatus === "pending"
                  ? "Vendor Application Pending"
                  : "Join as a Vendor"}
              </button>
            </section>
          )}
        </div>
      </main>

      {/* ================= AVATAR MODAL ================= */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]">
          <div className="bg-[#f6f0e8] p-6 rounded-2xl w-[90%] max-w-[420px] border border-[#c9bda4] shadow-lg">
            <h2 className="text-lg font-semibold mb-3">
              Update Profile Picture
            </h2>

            <form onSubmit={uploadAvatar}>
              <input
                type="file"
                accept="image/*"
                required
                onChange={(e) => setAvatarFile(e.target.files[0])}
                className="border border-gray-400 rounded-lg p-2 w-full bg-white"
              />
              <button className="bg-[#7a5d47] text-white w-full py-2 rounded-lg mt-4">
                Upload
              </button>
            </form>

            <button
              className="bg-[#e0d6c6] text-[#3b2f25] w-full py-2 rounded-lg mt-3"
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

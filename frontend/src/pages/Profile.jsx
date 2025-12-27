import React, { useEffect, useState } from "react";
import { auth } from "../firebase";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import toast from "../utils/toast";
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Edit profile state
  const [editForm, setEditForm] = useState({
    username: "",
    phone: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: "",
    color: "",
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);

  /* ================= PASSWORD STRENGTH CHECKER ================= */
  const checkPasswordStrength = (password) => {
    if (!password) {
      return { score: 0, label: "", color: "" };
    }

    let score = 0;
    
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    let label = "";
    let color = "";
    
    if (score <= 2) {
      label = "Weak";
      color = "#dc2626";
    } else if (score <= 4) {
      label = "Medium";
      color = "#f59e0b";
    } else {
      label = "Strong";
      color = "#16a34a";
    }

    return { score, label, color };
  };

  // Update password strength when password changes
  useEffect(() => {
    const strength = checkPasswordStrength(editForm.newPassword);
    setPasswordStrength(strength);
  }, [editForm.newPassword]);

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
        setEditForm(prev => ({
          ...prev,
          username: j.user.username || "",
          phone: j.user.phone || "",
        }));
        localStorage.setItem("solennia_role", j.user.role ?? 0);
        setRole(j.user.role ?? 0);
        
        // ✅ FIX: Save profile to localStorage for header
        localStorage.setItem("solennia_profile", JSON.stringify(j.user));
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

  /* ================= AVATAR PREVIEW ================= */
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  /* ================= AVATAR UPLOAD (✅ FIXED) ================= */
  async function uploadAvatar(e) {
    e.preventDefault();
    if (!avatarFile) {
      toast.warning("Please select an image first");
      return;
    }

    setUploadingAvatar(true);

    try {
      const fd = new FormData();
      fd.append("avatar", avatarFile);

      const res = await fetch(`${API}/user/update`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");

      // ✅ FIX: Extract avatar from response
      const newAvatar = json.avatar;
      setProfile((p) => ({ ...p, avatar: newAvatar }));

      // ✅ FIX: Update localStorage with new avatar
      const existingProfile = JSON.parse(localStorage.getItem("solennia_profile") || "{}");
      localStorage.setItem(
        "solennia_profile",
        JSON.stringify({
          ...existingProfile,
          avatar: newAvatar,
        })
      );

      // ✅ FIX: Dispatch event to notify header
      window.dispatchEvent(new CustomEvent("profileUpdated", { 
        detail: { avatar: newAvatar } 
      }));

      toast.success("Profile picture updated successfully!");
      setShowAvatarModal(false);
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (err) {
      toast.error(err.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  }

  /* ================= EDIT PROFILE ================= */
  async function saveProfileChanges(e) {
    e.preventDefault();
    setSavingChanges(true);

    try {
      let updatedFields = {};
      let passwordChanged = false;

      // 1. Update Username if changed
      if (editForm.username && editForm.username !== profile.username) {
        const usernameRes = await fetch(`${API}/user/update-username`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ username: editForm.username }),
        });

        const usernameData = await usernameRes.json();
        if (!usernameRes.ok) throw new Error(usernameData.message || "Failed to update username");
        
        updatedFields.username = editForm.username;
        toast.success("Username updated!");
      }

      // 2. Update Phone if changed
      if (editForm.phone !== (profile.phone || "")) {
        const phoneRes = await fetch(`${API}/user/update-phone`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ phone: editForm.phone }),
        });

        const phoneData = await phoneRes.json();
        if (!phoneRes.ok) throw new Error(phoneData.message || "Failed to update phone");
        
        updatedFields.phone = editForm.phone;
        toast.success("Phone number updated!");
      }

      // 3. Change Password (Firebase)
      if (editForm.newPassword) {
        if (!editForm.currentPassword) {
          throw new Error("Current password is required to change password");
        }

        if (passwordStrength.score <= 2) {
          throw new Error("Please use a stronger password");
        }

        if (editForm.newPassword !== editForm.confirmPassword) {
          throw new Error("New passwords do not match");
        }

        // Reauthenticate user with current password
        const user = auth.currentUser;
        if (!user) throw new Error("Not authenticated");

        const credential = EmailAuthProvider.credential(
          user.email,
          editForm.currentPassword
        );

        await reauthenticateWithCredential(user, credential);

        // Update password
        await updatePassword(user, editForm.newPassword);
        
        passwordChanged = true;
        toast.success("Password changed successfully!");

        // Clear password fields
        setEditForm(prev => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        }));
      }

      // ✅ FIX: Update local profile and localStorage
      if (Object.keys(updatedFields).length > 0) {
        setProfile(prev => ({ ...prev, ...updatedFields }));
        
        // Update localStorage
        const existingProfile = JSON.parse(localStorage.getItem("solennia_profile") || "{}");
        localStorage.setItem(
          "solennia_profile",
          JSON.stringify({
            ...existingProfile,
            ...updatedFields
          })
        );

        // Dispatch event
        window.dispatchEvent(new Event("profileUpdated"));
      }

      if (!passwordChanged && Object.keys(updatedFields).length === 0) {
        toast.info("No changes to save");
      } else if (Object.keys(updatedFields).length > 0 || passwordChanged) {
        toast.success("Profile updated successfully!");
        setTimeout(() => setShowEditModal(false), 1000);
      }

    } catch (err) {
      console.error("Profile update error:", err);
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSavingChanges(false);
    }
  }

  /* ================= JOIN AS VENDOR ================= */
  function joinVendor() {
    if (!token) {
      toast.warning("Please login first.");
      return;
    }
    if (role !== 0) {
      toast.warning("You cannot apply as vendor.");
      return;
    }
    document.getElementById("vendorTerms")?.classList.remove("hidden");
  }

  /* ================= DASHBOARD ================= */
  function dashboardHref() {
    if (role === 2) return "/admin";
    if (role === 1) return "/vendor-dashboard";
    return null;
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
          <div className="flex justify-between items-center mt-6">
            <h2 className="text-xl md:text-2xl font-semibold tracking-wide">
              PROFILE
            </h2>
            <button
              onClick={() => setShowEditModal(true)}
              className="bg-[#7a5d47] text-white px-4 py-2 rounded-lg text-sm hover:opacity-90 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Profile
            </button>
          </div>

          {/* ================= AVATAR SECTION ================= */}
          <div className="flex flex-col items-center text-center space-y-4 mt-6">
            <div className="relative">
              <div
                onClick={() => token && setShowAvatarModal(true)}
                className="w-28 h-28 rounded-full border-2 border-black overflow-hidden bg-white flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
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
                    fill="currentColor"
                  >
                    <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5 0-9 2.5-9 5.5V21h18v-1.5C21 16.5 17 14 12 14Z" />
                  </svg>
                )}
              </div>
              <button
                onClick={() => token && setShowAvatarModal(true)}
                className="absolute bottom-0 right-0 bg-[#7a5d47] text-white rounded-full p-2 hover:opacity-90"
                title="Change profile picture"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-lg font-semibold">{name}</div>
              {profile?.username && (
                <div className="text-sm text-gray-600">@{profile.username}</div>
              )}
              {profile?.phone && (
                <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {profile.phone}
                </div>
              )}
            </div>

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
                alt="Favorite 1"
              />
            </article>

            <article className="rounded-xl border border-[#ded7c9] overflow-hidden bg-[#f5f0ea]">
              <img
                src="/images/gallery2.jpg"
                className="w-full object-cover"
                alt="Favorite 2"
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4">
          <div className="bg-[#f6f0e8] p-6 rounded-2xl w-full max-w-md border border-[#c9bda4] shadow-lg">
            <h2 className="text-lg font-semibold mb-4">
              Update Profile Picture
            </h2>

            {avatarPreview && (
              <div className="mb-4 flex justify-center">
                <img
                  src={avatarPreview}
                  alt="Preview"
                  className="w-32 h-32 rounded-full object-cover border-2 border-gray-300"
                />
              </div>
            )}

            <form onSubmit={uploadAvatar}>
              <input
                type="file"
                accept="image/*"
                required
                onChange={(e) => setAvatarFile(e.target.files[0])}
                className="border border-gray-400 rounded-lg p-2 w-full bg-white text-sm"
              />
              <p className="text-xs text-gray-600 mt-2">
                Recommended: Square image, max 5MB
              </p>
              
              <button 
                type="submit"
                disabled={uploadingAvatar}
                className="bg-[#7a5d47] text-white w-full py-2 rounded-lg mt-4 disabled:opacity-50"
              >
                {uploadingAvatar ? "Uploading..." : "Upload"}
              </button>
            </form>

            <button
              className="bg-[#e0d6c6] text-[#3b2f25] w-full py-2 rounded-lg mt-3"
              onClick={() => {
                setShowAvatarModal(false);
                setAvatarFile(null);
                setAvatarPreview(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ================= EDIT PROFILE MODAL ================= */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4">
          <div className="bg-[#f6f0e8] rounded-2xl w-full max-w-2xl border border-[#c9bda4] shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#e8ddae] p-6 border-b border-gray-300 flex justify-between items-center z-10">
              <h2 className="text-lg font-semibold">Edit Profile</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-2xl font-light hover:text-gray-600"
              >
                &times;
              </button>
            </div>

            <form onSubmit={saveProfileChanges} className="p-6 space-y-6">
              {/* USERNAME */}
              <div>
                <label className="block text-sm font-semibold uppercase mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  placeholder="Enter username"
                  className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Current: @{profile?.username || "Not set"}
                </p>
              </div>

              {/* PHONE NUMBER (2FA) */}
              <div>
                <label className="block text-sm font-semibold uppercase mb-2">
                  Phone Number (For 2FA)
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+1234567890"
                  className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                />
                <p className="text-xs text-gray-600 mt-1">
                  {profile?.phone ? `Current: ${profile.phone}` : "Not set"}
                </p>
              </div>

              {/* PASSWORD SECTION */}
              <div className="border-t border-gray-300 pt-6">
                <h3 className="text-base font-semibold mb-4">Change Password</h3>
                
                {/* Current Password */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold uppercase mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={editForm.currentPassword}
                      onChange={(e) => setEditForm({ ...editForm, currentPassword: e.target.value })}
                      placeholder="Enter current password"
                      className="w-full rounded-md bg-gray-100 border border-gray-300 p-2 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600"
                    >
                      {showCurrentPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold uppercase mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={editForm.newPassword}
                      onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                      placeholder="Enter new password"
                      className="w-full rounded-md bg-gray-100 border border-gray-300 p-2 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600"
                    >
                      {showNewPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {editForm.newPassword && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full transition-all duration-300"
                            style={{
                              width: `${(passwordStrength.score / 6) * 100}%`,
                              backgroundColor: passwordStrength.color
                            }}
                          />
                        </div>
                        <span 
                          className="text-xs font-semibold"
                          style={{ color: passwordStrength.color }}
                        >
                          {passwordStrength.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Use 8+ characters with a mix of letters, numbers & symbols
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold uppercase mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={editForm.confirmPassword}
                      onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                      className="w-full rounded-md bg-gray-100 border border-gray-300 p-2 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600"
                    >
                      {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>

                  {/* Password Match Indicator */}
                  {editForm.confirmPassword && (
                    <div className="mt-1">
                      {editForm.newPassword === editForm.confirmPassword ? (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <span>✓</span> Passwords match
                        </p>
                      ) : (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <span>✗</span> Passwords do not match
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-2">
                  ⚠️ Leave password fields empty if you don't want to change your password
                </p>
              </div>

              {/* BUTTONS */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingChanges}
                  className="flex-1 bg-[#7a5d47] text-white py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {savingChanges ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
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
        
        // ✅ UPDATE: Save profile to localStorage for header
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

      // ✅ FIX: Update profile state with new avatar
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

      // ✅ FIX: Dispatch event to notify header and other components
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

      // 3. Update Password if provided
      if (editForm.newPassword) {
        if (editForm.newPassword !== editForm.confirmPassword) {
          throw new Error("Passwords do not match");
        }
        
        if (!editForm.currentPassword) {
          throw new Error("Current password is required to change password");
        }

        const user = auth.currentUser;
        if (!user || !user.email) {
          throw new Error("User not authenticated");
        }

        const credential = EmailAuthProvider.credential(
          user.email,
          editForm.currentPassword
        );

        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, editForm.newPassword);
        
        passwordChanged = true;
        toast.success("Password updated successfully!");
      }

      // Update local profile state
      setProfile(prev => ({
        ...prev,
        ...updatedFields
      }));

      // ✅ UPDATE: Update localStorage
      const existingProfile = JSON.parse(localStorage.getItem("solennia_profile") || "{}");
      localStorage.setItem(
        "solennia_profile",
        JSON.stringify({
          ...existingProfile,
          ...updatedFields
        })
      );

      // ✅ UPDATE: Dispatch event
      window.dispatchEvent(new Event("profileUpdated"));

      if (!editForm.newPassword && Object.keys(updatedFields).length === 0) {
        toast.info("No changes to save");
      } else if (Object.keys(updatedFields).length > 0 || passwordChanged) {
        toast.success("Profile updated successfully!");
      }

      // Reset password fields
      setEditForm(prev => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
      
      setShowEditModal(false);

    } catch (err) {
      console.error("Error updating profile:", err);
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSavingChanges(false);
    }
  }

  /* ================= VENDOR REQUEST ================= */
  async function requestVendorRole() {
    if (!token) return;

    const confirmRequest = window.confirm(
      "Are you sure you want to request vendor access? An admin will review your request."
    );

    if (!confirmRequest) return;

    try {
      const res = await fetch(`${API}/vendor/request`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Failed to submit request");
      }

      toast.success("Vendor request submitted successfully! Please wait for admin approval.");
      setVendorStatus("pending");
    } catch (err) {
      toast.error(err.message || "Failed to submit vendor request");
    }
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7a5d47] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Profile Header Card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-[#e8ddae] to-[#dbcf9f] p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Avatar */}
              <div className="relative">
                <div className="w-32 h-32 rounded-full border-4 border-white overflow-hidden bg-gray-100 flex items-center justify-center">
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg
                      className="w-16 h-16 text-gray-400"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5 0-9 2.5-9 5.5V21h18v-1.5C21 16.5 17 14 12 14Z" />
                    </svg>
                  )}
                </div>
                <button
                  onClick={() => setShowAvatarModal(true)}
                  className="absolute bottom-0 right-0 bg-[#7a5d47] text-white p-2 rounded-full hover:bg-[#614a38] transition-colors"
                  title="Change profile picture"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </button>
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-gray-900">
                  {profile.first_name} {profile.last_name}
                </h1>
                <p className="text-gray-700 mt-1">@{profile.username}</p>
                <p className="text-sm text-gray-600 mt-2">{profile.email}</p>
                {profile.phone && (
                  <p className="text-sm text-gray-600">{profile.phone}</p>
                )}
                <div className="flex gap-2 mt-4 justify-center md:justify-start">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      role === 2
                        ? "bg-red-100 text-red-800"
                        : role === 1
                        ? "bg-blue-100 text-blue-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {role === 2 ? "ADMIN" : role === 1 ? "VENDOR" : "CLIENT"}
                  </span>
                </div>
              </div>

              {/* Edit Button */}
              <button
                onClick={() => setShowEditModal(true)}
                className="px-6 py-2 bg-white text-[#7a5d47] rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit Profile
              </button>
            </div>
          </div>
        </div>

        {/* Account Information Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Account Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                First Name
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                {profile.first_name}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Last Name
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                {profile.last_name}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                {profile.email}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Username
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                @{profile.username}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Phone Number
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                {profile.phone || "Not set"}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Account Type
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                {role === 2 ? "Admin" : role === 1 ? "Vendor" : "Client"}
              </div>
            </div>
          </div>
        </div>

        {/* Vendor Request Card (Only for Clients) */}
        {role === 0 && (
          <div className="bg-gradient-to-r from-[#f6f0e8] to-[#e8ddae] rounded-2xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              Vendor Access
            </h2>

            {vendorStatus === null && (
              <div>
                <p className="text-gray-700 mb-4">
                  Are you a vendor? Request vendor access to start offering your services on our platform.
                </p>
                <button
                  onClick={requestVendorRole}
                  className="px-6 py-2 bg-[#7a5d47] text-white rounded-lg font-medium hover:bg-[#614a38] transition-colors"
                >
                  Request Vendor Access
                </button>
              </div>
            )}

            {vendorStatus === "pending" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 font-medium">
                  ⏳ Your vendor request is pending admin approval.
                </p>
              </div>
            )}

            {vendorStatus === "rejected" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">
                  ❌ Your vendor request was rejected. Please contact support for more information.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= AVATAR UPLOAD MODAL ================= */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4">
          <div className="bg-[#f6f0e8] rounded-2xl w-full max-w-md border border-[#c9bda4] shadow-lg">
            <div className="bg-[#e8ddae] p-6 border-b border-gray-300 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Change Profile Picture</h2>
              <button
                onClick={() => {
                  setShowAvatarModal(false);
                  setAvatarFile(null);
                  setAvatarPreview(null);
                }}
                className="text-2xl font-light hover:text-gray-600"
              >
                &times;
              </button>
            </div>

            <form onSubmit={uploadAvatar} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-semibold uppercase mb-2">
                  Select Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAvatarFile(e.target.files[0])}
                  className="w-full rounded-md bg-gray-100 border border-gray-300 p-2"
                />
              </div>

              {avatarPreview && (
                <div className="mb-4">
                  <p className="text-sm font-semibold uppercase mb-2">Preview</p>
                  <div className="w-32 h-32 rounded-full overflow-hidden mx-auto border-2 border-gray-300">
                    <img
                      src={avatarPreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

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
import React, { useEffect, useState } from "react";
import { auth } from "../firebase";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import toast from "../utils/toast";
import "../style.css";

const API = 
  import.meta.env.VITE_API_BASE || 
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD 
    ? "https://solennia.up.railway.app/api" : "/api");

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
    .then((j) => {
      setVendorStatus(j.status);
      
      // ✅ SHOW STATUS NOTIFICATION
      if (j.status === 'pending') {
        // Optional: Show a subtle notification that application is pending
        console.log('Vendor application is pending review');
      }
    })
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

  /* ================= REQUEST USERNAME CHANGE ================= */
  function requestUsernameChange() {
    toast.info("To change your username, please contact support at solenniainquires@gmail.com with your current username and desired new username.");
  }

  /* ================= EDIT PROFILE (✅ FIXED) ================= */
  async function saveProfileChanges(e) {
    e.preventDefault();
    setSavingChanges(true);

    try {
      let updatedFields = {};
      let passwordChanged = false;

      // 1. Update Phone if changed
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

      // 2. Change Password (Firebase) - ✅ FIXED WITH BETTER ERROR HANDLING
      if (editForm.newPassword.trim()) {
        // Validate all password requirements
        if (!editForm.currentPassword.trim()) {
          throw new Error("Current password is required to change password");
        }

        if (passwordStrength.score <= 2) {
          throw new Error("Please use a stronger password (minimum 8 characters with mixed case, numbers, and symbols)");
        }

        if (editForm.newPassword !== editForm.confirmPassword) {
          throw new Error("New passwords do not match");
        }

        // Check if user is authenticated in Firebase
        const user = auth.currentUser;
        if (!user) {
          throw new Error("Firebase authentication session expired. Please log out and log in again.");
        }

        // ✅ FIX: Use email from Firebase user or fallback to profile
        const userEmail = user.email || profile?.email;
        if (!userEmail) {
          throw new Error("Cannot verify account email. Please contact support.");
        }

        try {
          // Reauthenticate user with current password
          const credential = EmailAuthProvider.credential(
            userEmail,
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
        } catch (firebaseError) {
          // ✅ FIX: Provide specific error messages based on Firebase error codes
          console.error("Firebase password change error:", firebaseError);
          
          if (firebaseError.code === 'auth/invalid-credential' || firebaseError.code === 'auth/wrong-password') {
            throw new Error("Current password is incorrect. Please try again.");
          } else if (firebaseError.code === 'auth/weak-password') {
            throw new Error("New password is too weak. Please use a stronger password.");
          } else if (firebaseError.code === 'auth/requires-recent-login') {
            throw new Error("For security, please log out and log back in before changing your password.");
          } else if (firebaseError.code === 'auth/user-mismatch') {
            throw new Error("Authentication mismatch. Please log out and log in again.");
          } else if (firebaseError.code === 'auth/user-not-found') {
            throw new Error("User account not found. Please contact support.");
          } else if (firebaseError.code === 'auth/invalid-email') {
            throw new Error("Invalid email address. Please contact support.");
          } else {
            throw new Error(firebaseError.message || "Failed to change password. Please try again.");
          }
        }
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
        // Only show success if we haven't already shown specific success messages
        if (!passwordChanged && Object.keys(updatedFields).length > 0) {
          toast.success("Profile updated successfully!");
        }
        setTimeout(() => setShowEditModal(false), 1500);
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
    
    window.location.href = "/vendor-application";
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f0e8]">
        <div className="text-center">
          <p className="text-xl font-semibold mb-4">Please login to view your profile</p>
          <a
            href="/login"
            className="bg-[#7a5d47] text-white px-6 py-2 rounded-lg hover:opacity-90"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f0e8]">
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#f6f0e8] p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Avatar */}
              <div className="relative">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 border-4 border-[#7a5d47]">
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-[#7a5d47]">
                      {profile.username?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowAvatarModal(true)}
                  className="absolute bottom-0 right-0 bg-[#7a5d47] text-white p-2 rounded-full hover:opacity-90 shadow-lg"
                  title="Change Avatar"
                >
                  📷
                </button>
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-3xl font-bold mb-2">@{profile.username}</h1>
                {profile?.email && (
                  <p className="text-sm text-gray-700 mb-6">{profile.email}</p>
                )}
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  <span className="px-3 py-1 bg-[#e8ddae] text-[#7a5d47] rounded-full text-sm font-semibold">
                    {role === 0 ? "User" : role === 1 ? "Vendor" : "Admin"}
                  </span>
                  {profile.phone && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                      📱 2FA Enabled
                    </span>
                  )}
                </div>
              </div>

              {/* Edit Button */}
              <button
                onClick={() => setShowEditModal(true)}
                className="bg-[#7a5d47] text-white px-6 py-2 rounded-lg hover:opacity-90"
              >
                Edit Profile
              </button>
            </div>
          </div>

          {/* Additional Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Phone Card */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-semibold text-lg mb-2">Phone Number</h3>
              <p className="text-gray-700">
                {profile.phone || "Not set"}
              </p>
            </div>

            {/* Role Card */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="font-semibold text-lg mb-2">Account Type</h3>
              <p className="text-gray-700">
                {role === 0 ? "Regular User" : role === 1 ? "Vendor" : "Administrator"}
              </p>
            </div>
          </div>

          {/* Join as Vendor Button (for regular users) */}
          {role === 0 && (
            <div className="mt-6 bg-gradient-to-r from-[#e8ddae] to-[#d4c59a] rounded-xl shadow p-6">
              <h3 className="font-bold text-xl mb-2">Become a Vendor</h3>
              <p className="text-gray-700 mb-4">
                {vendorStatus === 'pending' 
                  ? "Your vendor application is currently under review. We'll notify you once it's processed."
                  : vendorStatus === 'approved'
                  ? "Your vendor application has been approved! Your role will be updated shortly."
                  : vendorStatus === 'rejected'
                  ? "Your previous vendor application was not approved. Please contact support for more information."
                  : "Join our platform as a vendor and start offering your services!"}
              </p>
              {vendorStatus !== 'pending' && vendorStatus !== 'approved' && (
                <button
                  onClick={joinVendor}
                  className="bg-[#7a5d47] text-white px-6 py-2 rounded-lg hover:opacity-90"
                >
                  Apply Now
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ================= AVATAR UPLOAD MODAL ================= */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4">
          <div className="bg-[#f6f0e8] rounded-2xl w-full max-w-md border border-[#c9bda4] shadow-lg">
            <div className="bg-[#e8ddae] p-4 border-b border-gray-300 flex justify-between items-center">
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
              {/* Image Preview */}
              <div className="mb-4 flex justify-center">
                <div className="w-40 h-40 rounded-full overflow-hidden bg-gray-200 border-4 border-[#7a5d47]">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt="Current"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-[#7a5d47]">
                      {profile.username?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                </div>
              </div>

              {/* File Input */}
              <div className="mb-6">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#7a5d47] file:text-white hover:file:opacity-90 file:cursor-pointer cursor-pointer"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAvatarModal(false);
                    setAvatarFile(null);
                    setAvatarPreview(null);
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!avatarFile || uploadingAvatar}
                  className="flex-1 bg-[#7a5d47] text-white py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {uploadingAvatar ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT PROFILE MODAL ================= */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4 sm:p-6">
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
              {/* USERNAME - READ ONLY WITH REQUEST BUTTON */}
              <div>
                <label className="block text-sm font-semibold uppercase mb-2">
                  Username
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editForm.username}
                    readOnly
                    disabled
                    className="flex-1 rounded-md bg-gray-200 border border-gray-300 p-2 cursor-not-allowed text-gray-600"
                  />
                  <button
                    type="button"
                    onClick={requestUsernameChange}
                    className="bg-[#7a5d47] text-white px-4 py-2 rounded-md text-sm hover:opacity-90 whitespace-nowrap"
                  >
                    Request Change
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Current: @{profile?.username || "Not set"}
                </p>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                  ℹ️ Username changes require admin approval. Click "Request Change" to contact support.
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
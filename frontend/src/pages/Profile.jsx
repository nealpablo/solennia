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

  // ✅ NEW: Booking Modal States
  const [showBookingsModal, setShowBookingsModal] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [processingBooking, setProcessingBooking] = useState(false);

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
        
        if (j.status === 'pending') {
          console.log('Vendor application is pending review');
        }
      })
      .catch(() => {});
  }, [token, role]);

  /* ================= ✅ NEW: LOAD BOOKINGS ================= */
  const loadBookings = async () => {
    if (!token) return;
    
    setLoadingBookings(true);
    try {
      // Clients see their bookings, Vendors see booking requests
      const endpoint = role === 1 ? '/bookings/vendor' : '/bookings/user';
      
      const res = await fetch(`${API}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      
      if (data.success) {
        setBookings(data.bookings || []);
      } else {
        toast.error(data.error || 'Failed to load bookings');
      }
    } catch (err) {
      console.error('Load bookings error:', err);
      toast.error('Failed to load bookings');
    } finally {
      setLoadingBookings(false);
    }
  };

  /* ================= ✅ NEW: ACCEPT BOOKING (VENDOR) ================= */
  const acceptBooking = async (bookingId) => {
    if (!confirm('Accept this booking request?')) return;
    
    setProcessingBooking(true);
    try {
      const res = await fetch(`${API}/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'Confirmed' }),
      });

      const data = await res.json();
      
      if (data.success) {
        toast.success('Booking accepted!');
        loadBookings(); // Reload bookings
        setSelectedBooking(null);
      } else {
        toast.error(data.error || 'Failed to accept booking');
      }
    } catch (err) {
      console.error('Accept booking error:', err);
      toast.error('Failed to accept booking');
    } finally {
      setProcessingBooking(false);
    }
  };

  /* ================= ✅ NEW: REJECT BOOKING (VENDOR) ================= */
  const rejectBooking = async (bookingId) => {
    if (!confirm('Reject this booking request?')) return;
    
    setProcessingBooking(true);
    try {
      const res = await fetch(`${API}/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'Rejected' }),
      });

      const data = await res.json();
      
      if (data.success) {
        toast.success('Booking rejected');
        loadBookings(); // Reload bookings
        setSelectedBooking(null);
      } else {
        toast.error(data.error || 'Failed to reject booking');
      }
    } catch (err) {
      console.error('Reject booking error:', err);
      toast.error('Failed to reject booking');
    } finally {
      setProcessingBooking(false);
    }
  };

  /* ================= ✅ NEW: CANCEL BOOKING (CLIENT) ================= */
  const cancelBooking = async (bookingId) => {
    if (!confirm('Cancel this booking?')) return;
    
    setProcessingBooking(true);
    try {
      const res = await fetch(`${API}/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      
      if (data.success) {
        toast.success('Booking cancelled');
        loadBookings(); // Reload bookings
        setSelectedBooking(null);
      } else {
        toast.error(data.error || 'Failed to cancel booking');
      }
    } catch (err) {
      console.error('Cancel booking error:', err);
      toast.error('Failed to cancel booking');
    } finally {
      setProcessingBooking(false);
    }
  };

  /* ================= ✅ NEW: GET STATUS BADGE COLOR ================= */
  const getStatusBadge = (status) => {
    const statusMap = {
      'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Confirmed': 'bg-green-100 text-green-800 border-green-300',
      'Rejected': 'bg-red-100 text-red-800 border-red-300',
      'Cancelled': 'bg-gray-100 text-gray-800 border-gray-300',
      'Completed': 'bg-blue-100 text-blue-800 border-blue-300',
    };
    
    return statusMap[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

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

  /* ================= AVATAR UPLOAD ================= */
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

      const newAvatar = json.avatar;
      setProfile((p) => ({ ...p, avatar: newAvatar }));

      const existingProfile = JSON.parse(localStorage.getItem("solennia_profile") || "{}");
      localStorage.setItem(
        "solennia_profile",
        JSON.stringify({
          ...existingProfile,
          avatar: newAvatar,
        })
      );

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

  /* ================= EDIT PROFILE ================= */
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

      // 2. Change Password (Firebase)
      if (editForm.newPassword.trim()) {
        if (!editForm.currentPassword.trim()) {
          throw new Error("Current password is required to change password");
        }

        if (passwordStrength.score <= 2) {
          throw new Error("Please use a stronger password");
        }

        if (editForm.newPassword !== editForm.confirmPassword) {
          throw new Error("New passwords do not match");
        }

        const user = auth.currentUser;
        if (!user) {
          throw new Error("Firebase authentication session expired. Please log out and log in again.");
        }

        const userEmail = user.email || profile?.email;
        if (!userEmail) {
          throw new Error("Cannot verify account email. Please contact support.");
        }

        try {
          const credential = EmailAuthProvider.credential(
            userEmail,
            editForm.currentPassword
          );

          await reauthenticateWithCredential(user, credential);
          await updatePassword(user, editForm.newPassword);
          
          passwordChanged = true;
          toast.success("Password changed successfully!");

          setEditForm(prev => ({
            ...prev,
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
          }));
        } catch (firebaseError) {
          console.error("Firebase password change error:", firebaseError);
          
          if (firebaseError.code === 'auth/invalid-credential' || firebaseError.code === 'auth/wrong-password') {
            throw new Error("Current password is incorrect. Please try again.");
          } else if (firebaseError.code === 'auth/weak-password') {
            throw new Error("New password is too weak. Please use a stronger password.");
          } else if (firebaseError.code === 'auth/requires-recent-login') {
            throw new Error("For security, please log out and log back in before changing your password.");
          } else {
            throw new Error(firebaseError.message || "Failed to change password. Please try again.");
          }
        }
      }

      if (Object.keys(updatedFields).length > 0) {
        setProfile(prev => ({ ...prev, ...updatedFields }));
        
        const existingProfile = JSON.parse(localStorage.getItem("solennia_profile") || "{}");
        localStorage.setItem(
          "solennia_profile",
          JSON.stringify({
            ...existingProfile,
            ...updatedFields
          })
        );

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
      <main className="pb-24 bg-[#f6f0e8] text-[#1c1b1a] min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {/* ================= PAGE HEADER ================= */}
          <div className="mb-6">
          </div>

          {/* ================= TWO COLUMN LAYOUT (40/60) ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
            
            {/* ================= LEFT COLUMN - PROFILE INFO (40%) ================= */}
            <div className="lg:col-span-2">
              <div className="flex flex-col items-center justify-center" style={{ height: 'calc(100vh - 180px)' }}>
                {/* Large Avatar */}
                <div className="relative mb-6">
                  <div
                    onClick={() => token && setShowAvatarModal(true)}
                    className="w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 rounded-full border-6 sm:border-8 border-white overflow-hidden bg-white flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity shadow-2xl"
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
                        className="w-32 h-32 text-[#7a5d47]"
                        fill="currentColor"
                      >
                        <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5 0-9 2.5-9 5.5V21h18v-1.5C21 16.5 17 14 12 14Z" />
                      </svg>
                    )}
                  </div>
                  <button
                    onClick={() => token && setShowAvatarModal(true)}
                    className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-[#7a5d47] text-white rounded-full p-3 sm:p-4 hover:opacity-90 shadow-xl border-4 border-white"
                    title="Change profile picture"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>

                {/* Name */}
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{name}</h1>
                
                {/* Username */}
                {profile?.username && (
                  <p className="text-sm text-gray-600 mb-4">@{profile.username}</p>
                )}

                {/* Email */}
                {profile?.email && (
                  <p className="text-sm text-gray-700 mb-6">{profile.email}</p>
                )}

                {/* Action Buttons */}
                <div className="space-y-3 w-full max-w-xs">
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="w-full bg-[#7a5d47] text-white px-4 py-3 rounded-lg text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-2 shadow-md"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Profile
                  </button>

                  {/* ✅ NEW: MY BOOKINGS BUTTON (CLIENT) */}
                  {role === 0 && (
                    <button
                      onClick={() => {
                        setShowBookingsModal(true);
                        loadBookings();
                      }}
                      className="w-full bg-[#e8ddae] text-[#3b2f25] px-4 py-3 rounded-lg text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-2 shadow-md"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      My Bookings
                    </button>
                  )}

                  {/* ✅ NEW: BOOKING REQUESTS BUTTON (VENDOR) */}
                  {role === 1 && (
                    <button
                      onClick={() => {
                        setShowBookingsModal(true);
                        loadBookings();
                      }}
                      className="w-full bg-[#e8ddae] text-[#3b2f25] px-4 py-3 rounded-lg text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-2 shadow-md"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Booking Requests
                    </button>
                  )}

                  {dashboardHref() && dashboardLabel() && (
                    <a
                      href={dashboardHref()}
                      className="w-full bg-[#e8ddae] text-[#3b2f25] px-4 py-3 rounded-lg text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-2 shadow-md"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                      {dashboardLabel()}
                    </a>
                  )}

                  {role === 0 && (
                    <button
                      onClick={joinVendor}
                      disabled={vendorStatus === "pending"}
                      className={`w-full bg-gradient-to-r from-[#7a5d47] to-[#5d4436] text-white px-4 py-3 rounded-lg text-sm font-semibold hover:opacity-90 shadow-md ${
                        vendorStatus === "pending" ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {vendorStatus === "pending" ? "Application Pending" : "Join as Supplier"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ================= RIGHT COLUMN - FAVORITES (60%) ================= */}
            <div className="lg:col-span-3 mt-4 lg:mt-0">
              <div className="bg-white rounded-2xl shadow-lg border border-[#c9bda4] overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
                {/* Header */}
                <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 flex-shrink-0">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#7a5d47]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                    Favorites
                  </h2>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
                    2 items
                  </span>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto">
                  {/* Favorite Item 1 */}
                  <div className="group relative overflow-hidden cursor-pointer transition-transform duration-300 hover:-translate-y-2">
                    <img
                      src="/images/gallery1.jpg"
                      className="w-full h-72 object-cover"
                      alt="Favorite 1"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <h3 className="text-xl font-bold mb-1">Kids Party Venue</h3>
                        <p className="text-xs text-gray-200 mb-2">Perfect space for children's celebrations with colorful decorations and entertainment areas</p>
                        <div className="flex items-center gap-3 text-xs mb-3">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"/>
                            </svg>
                            Manila, PH
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                            </svg>
                            50-100 guests
                          </span>
                        </div>
                        <button className="w-full bg-[#7a5d47] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#5d4436] transition-colors">
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Favorite Item 2 */}
                  <div className="group relative overflow-hidden cursor-pointer transition-transform duration-300 hover:-translate-y-2">
                    <img
                      src="/images/gallery2.jpg"
                      className="w-full h-72 object-cover"
                      alt="Favorite 2"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <h3 className="text-xl font-bold mb-1">Wedding Venue</h3>
                        <p className="text-xs text-gray-200 mb-2">Elegant outdoor ceremony space with beautiful garden backdrop and sophisticated decor</p>
                        <div className="flex items-center gap-3 text-xs mb-3">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"/>
                            </svg>
                            Tagaytay, PH
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                            </svg>
                            100-200 guests
                          </span>
                        </div>
                        <button className="w-full bg-[#7a5d47] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#5d4436] transition-colors">
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                  <button className="w-full bg-[#7a5d47] text-white px-6 py-2 rounded-lg hover:opacity-90 font-semibold flex items-center justify-center gap-2 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Compare Favorites
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ================= ✅ NEW: BOOKINGS MODAL ================= */}
      {showBookingsModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="bg-[#7a5d47] text-white p-6 flex justify-between items-center">
              <h2 className="text-xl font-bold">
                {role === 1 ? 'Booking Requests' : 'My Bookings'}
              </h2>
              <button
                onClick={() => {
                  setShowBookingsModal(false);
                  setSelectedBooking(null);
                }}
                className="text-white hover:text-gray-200 text-3xl font-light"
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingBookings ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7a5d47]"></div>
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-500">
                    {role === 1 ? 'No booking requests yet' : 'No bookings yet'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.map((booking) => (
                    <div
                      key={booking.ID}
                      className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{booking.ServiceName}</h3>
                          <p className="text-sm text-gray-600">
                            {role === 1 ? `Client: ${booking.client_name}` : `Vendor: ${booking.vendor_name}`}
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(booking.BookingStatus)}`}>
                          {booking.BookingStatus}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                        <div>
                          <span className="text-gray-600">Event Date:</span>
                          <p className="font-medium">{new Date(booking.EventDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Event Type:</span>
                          <p className="font-medium">{booking.EventType}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Venue:</span>
                          <p className="font-medium">{booking.Venue}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Guests:</span>
                          <p className="font-medium">{booking.NumberOfGuests}</p>
                        </div>
                      </div>

                      {booking.SpecialRequests && (
                        <div className="mb-3">
                          <span className="text-sm text-gray-600">Special Requests:</span>
                          <p className="text-sm mt-1">{booking.SpecialRequests}</p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-3">
                        {/* CLIENT ACTIONS */}
                        {role === 0 && booking.BookingStatus === 'Pending' && (
                          <button
                            onClick={() => cancelBooking(booking.ID)}
                            disabled={processingBooking}
                            className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 text-sm font-semibold"
                          >
                            {processingBooking ? 'Processing...' : 'Cancel Booking'}
                          </button>
                        )}

                        {/* VENDOR ACTIONS */}
                        {role === 1 && booking.BookingStatus === 'Pending' && (
                          <>
                            <button
                              onClick={() => acceptBooking(booking.ID)}
                              disabled={processingBooking}
                              className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 text-sm font-semibold"
                            >
                              {processingBooking ? 'Processing...' : 'Accept'}
                            </button>
                            <button
                              onClick={() => rejectBooking(booking.ID)}
                              disabled={processingBooking}
                              className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 text-sm font-semibold"
                            >
                              {processingBooking ? 'Processing...' : 'Reject'}
                            </button>
                          </>
                        )}

                        {/* VIEW DETAILS FOR ALL */}
                        <button
                          onClick={() => setSelectedBooking(booking)}
                          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-semibold"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <button
                onClick={() => {
                  setShowBookingsModal(false);
                  setSelectedBooking(null);
                }}
                className="w-full bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ✅ NEW: BOOKING DETAILS MODAL ================= */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="bg-[#7a5d47] text-white p-6 flex justify-between items-center">
              <h2 className="text-xl font-bold">Booking Details</h2>
              <button
                onClick={() => setSelectedBooking(null)}
                className="text-white hover:text-gray-200 text-3xl font-light"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-600">Service Name</label>
                  <p className="text-lg font-semibold">{selectedBooking.ServiceName}</p>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600">Status</label>
                  <p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${getStatusBadge(selectedBooking.BookingStatus)}`}>
                      {selectedBooking.BookingStatus}
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Event Date</label>
                    <p>{new Date(selectedBooking.EventDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Event Type</label>
                    <p>{selectedBooking.EventType}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Venue</label>
                    <p>{selectedBooking.Venue}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Number of Guests</label>
                    <p>{selectedBooking.NumberOfGuests}</p>
                  </div>
                </div>

                {role === 1 && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Client</label>
                    <p>{selectedBooking.client_name}</p>
                  </div>
                )}

                {role === 0 && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Vendor</label>
                    <p>{selectedBooking.vendor_name}</p>
                  </div>
                )}

                {selectedBooking.SpecialRequests && (
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Special Requests</label>
                    <p className="text-sm bg-gray-50 p-3 rounded-lg">{selectedBooking.SpecialRequests}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-semibold text-gray-600">Created At</label>
                  <p className="text-sm">{new Date(selectedBooking.CreatedAt).toLocaleString()}</p>
                </div>
              </div>

              {/* Actions */}
              {selectedBooking.BookingStatus === 'Pending' && (
                <div className="flex gap-2 mt-6 pt-6 border-t">
                  {role === 0 && (
                    <button
                      onClick={() => cancelBooking(selectedBooking.ID)}
                      disabled={processingBooking}
                      className="flex-1 bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold"
                    >
                      {processingBooking ? 'Processing...' : 'Cancel Booking'}
                    </button>
                  )}

                  {role === 1 && (
                    <>
                      <button
                        onClick={() => acceptBooking(selectedBooking.ID)}
                        disabled={processingBooking}
                        className="flex-1 bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 disabled:opacity-50 font-semibold"
                      >
                        {processingBooking ? 'Processing...' : 'Accept'}
                      </button>
                      <button
                        onClick={() => rejectBooking(selectedBooking.ID)}
                        disabled={processingBooking}
                        className="flex-1 bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold"
                      >
                        {processingBooking ? 'Processing...' : 'Reject'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <button
                onClick={() => setSelectedBooking(null)}
                className="w-full bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= AVATAR MODAL ================= */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4 sm:p-6">
          <div className="bg-[#f6f0e8] p-4 sm:p-6 rounded-2xl w-full max-w-md border border-[#c9bda4] shadow-lg">
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
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import toast from "../utils/toast";
import FeedbackModal from "../components/FeedbackModal";
import "../style.css";

const API = 
  import.meta.env.VITE_API_BASE || 
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD 
    ? "https://solennia.up.railway.app/api" : "/api");

export default function Profile() {
  const navigate = useNavigate();
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

  // Booking Modal States with TABS
  const [showBookingsModal, setShowBookingsModal] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [processingBooking, setProcessingBooking] = useState(false);
  const [activeTab, setActiveTab] = useState("original");

  // Feedback Modal States
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackBooking, setFeedbackBooking] = useState(null);

  // Reschedule Modal States
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    new_date: "",
    new_time: "14:00"
  });

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

  // CALENDAR MODAL STATES
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availability, setAvailability] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [availabilityForm, setAvailabilityForm] = useState({
    start_time: "09:00",
    end_time: "17:00",
    is_available: true,
    notes: ""
  });
  const [editingAvailability, setEditingAvailability] = useState(null);
  const [savingAvailability, setSavingAvailability] = useState(false);

  /* ================= CALENDAR: FORMAT DATE TO LOCAL TIMEZONE ================= */
  const formatDateToLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /* ================= HELPER TO GET PENDING RESCHEDULE DATA ================= */
  const getPendingRescheduleData = (booking) => {
    // Method 1: Check if backend provided it directly (from LEFT JOIN)
    if (booking.original_date && booking.requested_date) {
      return {
        originalDate: booking.original_date,
        requestedDate: booking.requested_date,
        hasPending: true
      };
    }

    // Method 2: Extract from reschedule_history array (fallback)
    const rescheduleHistory = booking.reschedule_history || [];
    const pendingReschedule = rescheduleHistory.find(r => r.Status === 'Pending');
    
    if (pendingReschedule) {
      return {
        originalDate: pendingReschedule.OriginalEventDate,
        requestedDate: pendingReschedule.RequestedEventDate,
        hasPending: true
      };
    }

    return { hasPending: false };
  };

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

  /* ================= VENDOR STATUS  ================= */
  useEffect(() => {
    if (!token || role !== 0) return;

    fetch(`${API}/vendor/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        // Handle 401/404 gracefully
        if (r.status === 401 || r.status === 404) {
          console.log('Vendor status endpoint not available or unauthorized - skipping');
          return null;
        }
        return r.json();
      })
      .then((j) => {
        if (j && j.status) {
          setVendorStatus(j.status);
          if (j.status === 'pending') {
            console.log('Vendor application is pending review');
          }
        }
      })
      .catch((err) => {
        // Silently handle errors - vendor status is not critical
        console.log('Vendor status check skipped:', err.message);
      });
  }, [token, role]);

  /* ================= CALENDAR: LOAD AVAILABILITY ================= */
  useEffect(() => {
    if (!showCalendarModal || !profile?.id) return;
    loadAvailability();
  }, [showCalendarModal, profile?.id, currentMonth]);

  const loadAvailability = async () => {
    if (!profile?.id) return;
    
    try {
      setLoadingAvailability(true);
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      
      const res = await fetch(`${API}/vendor/availability/${profile.id}?year=${year}&month=${month}`);
      const json = await res.json();
      
      if (json.success) {
        setAvailability(json.availability || []);
      }
    } catch (err) {
      console.error("Failed to load availability:", err);
    } finally {
      setLoadingAvailability(false);
    }
  };

  /* ================= CALENDAR HELPERS ================= */
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getAvailabilityForDate = (date) => {
    const dateStr = formatDateToLocal(date);
    return availability.filter(a => a.date === dateStr);
  };

  const isDateBooked = (date) => {
    const dateStr = formatDateToLocal(date);
    return availability.some(a => a.date === dateStr && !a.is_available);
  };

  const isDateAvailable = (date) => {
    const dateStr = formatDateToLocal(date);
    return availability.some(a => a.date === dateStr && a.is_available);
  };

  const getUpcomingAvailability = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return availability
      .filter(a => {
        const availDate = new Date(a.date);
        return availDate >= today;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  /* ================= CALENDAR: AVAILABILITY MODAL ================= */
  const openAvailabilityModal = (date, existingAvailability = null) => {
    setSelectedDate(date);
    
    if (existingAvailability) {
      setEditingAvailability(existingAvailability);
      setAvailabilityForm({
        start_time: existingAvailability.start_time ? existingAvailability.start_time.substring(0, 5) : "09:00",
        end_time: existingAvailability.end_time ? existingAvailability.end_time.substring(0, 5) : "17:00",
        is_available: existingAvailability.is_available,
        notes: existingAvailability.notes || ""
      });
    } else {
      setEditingAvailability(null);
      setAvailabilityForm({
        start_time: "09:00",
        end_time: "17:00",
        is_available: true,
        notes: ""
      });
    }
    
    setShowAvailabilityModal(true);
  };

  const closeAvailabilityModal = () => {
    setShowAvailabilityModal(false);
    setSelectedDate(null);
    setEditingAvailability(null);
    setAvailabilityForm({
      start_time: "09:00",
      end_time: "17:00",
      is_available: true,
      notes: ""
    });
  };

  /* ================= CALENDAR: SAVE AVAILABILITY ================= */
  const saveAvailability = async (e) => {
    e.preventDefault();
    
    if (!selectedDate) return;
    
    if (!token) {
      toast.error("Please log in");
      return;
    }

    try {
      setSavingAvailability(true);
      
      const dateStr = formatDateToLocal(selectedDate);
      const payload = {
        date: dateStr,
        ...availabilityForm
      };

      let url = `${API}/vendor/availability`;
      let method = "POST";

      if (editingAvailability) {
        url = `${API}/vendor/availability/${editingAvailability.id}`;
        method = "PATCH";
      }

      const res = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      
      if (json.success) {
        toast.success(editingAvailability ? "Availability updated!" : "Availability added!");
        closeAvailabilityModal();
        loadAvailability();
      } else {
        toast.error(json.error || "Failed to save availability");
      }
    } catch (err) {
      console.error("Save availability error:", err);
      toast.error("Failed to save availability");
    } finally {
      setSavingAvailability(false);
    }
  };

  /* ================= CALENDAR: DELETE AVAILABILITY ================= */
  const deleteAvailability = async (availabilityId) => {
    if (!confirm("Delete this availability entry?")) return;
    
    if (!token) {
      toast.error("Please log in");
      return;
    }

    try {
      const res = await fetch(`${API}/vendor/availability/${availabilityId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      const json = await res.json();
      
      if (json.success) {
        toast.success("Availability deleted!");
        closeAvailabilityModal();
        loadAvailability();
      } else {
        toast.error(json.error || "Failed to delete availability");
      }
    } catch (err) {
      console.error("Delete availability error:", err);
      toast.error("Failed to delete availability");
    }
  };

  /* ================= HELPER: FORMAT DATE AND TIME ================= */
  const formatDateTime = (dateString) => {
    if (!dateString) return { date: 'N/A', time: 'N/A', full: 'N/A' };
    
    const date = new Date(dateString);
    const dateFormatted = date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const timeFormatted = date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
    
    return { date: dateFormatted, time: timeFormatted, full: `${dateFormatted} at ${timeFormatted}` };
  };

  /* ================= LOAD BOOKINGS ================= */
  const loadBookings = async () => {
    if (!token) return;
    
    setLoadingBookings(true);
    try {
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

  /* ================= ACCEPT BOOKING (VENDOR) ================= */
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
        toast.success('Booking accepted!', { duration: 5000 });
        loadBookings();
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

  /* ================= REJECT BOOKING (VENDOR) ================= */
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
        toast.success('Booking rejected', { duration: 5000 });
        loadBookings();
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

  /* =================  COMPLETE BOOKING (VENDOR) ================= */
  const completeBooking = async (bookingId) => {
    if (!confirm('Mark this booking as completed? The client will be able to leave feedback.')) return;
    
    setProcessingBooking(true);
    try {
      const res = await fetch(`${API}/bookings/${bookingId}/complete`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      
      if (data.success) {
        toast.success('Booking marked as completed! Client can now leave feedback.', { duration: 5000 });
        loadBookings();
        setSelectedBooking(null);
      } else {
        toast.error(data.error || 'Failed to mark as completed');
      }
    } catch (err) {
      console.error('Complete booking error:', err);
      toast.error('Failed to mark as completed');
    } finally {
      setProcessingBooking(false);
    }
  };

  /* ================= CANCEL BOOKING (CLIENT) ================= */
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
        toast.success('Booking cancelled', { duration: 5000 });
        loadBookings();
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

  /* ================= OPEN FEEDBACK MODAL (CLIENT) ================= */
  const openFeedbackModal = (booking) => {
    setFeedbackBooking(booking);
    setShowFeedbackModal(true);
  };

  /* =================  HANDLE FEEDBACK SUCCESS ================= */
  const handleFeedbackSuccess = () => {
    setShowFeedbackModal(false);
    setFeedbackBooking(null);
    loadBookings(); // Reload bookings to show updated state
  };

  /* ================= OPEN RESCHEDULE MODAL ================= */
  const openRescheduleModal = (booking) => {
    setRescheduleBooking(booking);
    
    const currentDate = new Date(booking.EventDate);
    const dateStr = currentDate.toISOString().split('T')[0];
    const timeStr = currentDate.toTimeString().slice(0, 5);
    
    setRescheduleForm({
      new_date: dateStr,
      new_time: timeStr
    });
    
    setShowRescheduleModal(true);
  };

  /* ================= HANDLE RESCHEDULE SUBMISSION ================= */
  const handleReschedule = async (e) => {
    e.preventDefault();
    
    if (!rescheduleForm.new_date || !rescheduleForm.new_time) {
      toast.error("Please select both date and time");
      return;
    }
    
    try {
      setProcessingBooking(true);
      
      const newEventDateTime = `${rescheduleForm.new_date} ${rescheduleForm.new_time}:00`;
      
      const res = await fetch(`${API}/bookings/${rescheduleBooking.ID}/reschedule`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          new_event_date: newEventDateTime
        })
      });
      
      const data = await res.json();
      
      if (res.status === 400 && data.past_event) {
        toast.error(data.message || "Cannot reschedule. Event date has passed.", { duration: 8000 });
        setShowRescheduleModal(false);
        return;
      }
      
      if (res.status === 409 && data.conflict) {
        toast.error(
          data.message || "This vendor is already booked for the selected date and time.",
          { duration: 10000 }
        );
        return;
      }
      
      if (!data.success) {
        throw new Error(data.error || "Failed to reschedule booking");
      }
      
      toast.success(
        "Reschedule request sent successfully! Your booking status has changed to Pending. The vendor will review and approve/reject your new schedule.",
        { duration: 8000 }
      );
      
      setShowRescheduleModal(false);
      setRescheduleBooking(null);
      setRescheduleForm({ new_date: "", new_time: "14:00" });
      loadBookings();
      
    } catch (error) {
      console.error("Reschedule error:", error);
      toast.error(error.message || "Failed to reschedule booking");
    } finally {
      setProcessingBooking(false);
    }
  };

  /* ================= GET STATUS BADGE COLOR ================= */
  const getStatusBadge = (status) => {
    const statusMap = {
      'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'Confirmed': 'bg-green-100 text-green-800 border-green-300',
      'Rejected': 'bg-red-100 text-red-800 border-red-300',
      'Cancelled': 'bg-gray-100 text-gray-800 border-gray-300',
      'Completed': 'bg-purple-100 text-purple-800 border-purple-300', // ✅ CHANGED to purple
    };
    
    return statusMap[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  /* ================= FILTER BOOKINGS BY TAB ================= */
  const getFilteredBookings = () => {
    if (activeTab === "original") {
      return bookings.filter(booking => {
        const rescheduleHistory = booking.reschedule_history || [];
        const hasApproved = rescheduleHistory.some(r => r.Status === 'Approved');
        return !hasApproved;
      });
    } else {
      return bookings.filter(booking => {
        const rescheduleHistory = booking.reschedule_history || [];
        return rescheduleHistory.some(r => r.Status === 'Approved' || r.Status === 'Rejected');
      });
    }
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

  const filteredBookings = getFilteredBookings();

  return (
    <>
      <main className="pb-24 bg-[#f6f0e8] text-[#1c1b1a] min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
            
            {/* LEFT COLUMN - PROFILE INFO */}
            <div className="lg:col-span-2">
              <div className="flex flex-col items-center justify-center" style={{ height: 'calc(100vh - 180px)' }}>
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

                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{name}</h1>
                
                {profile?.username && (
                  <p className="text-sm text-gray-600 mb-4">@{profile.username}</p>
                )}

                {profile?.email && (
                  <p className="text-sm text-gray-700 mb-6">{profile.email}</p>
                )}

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

                  {role === 0 && (
                    <button
                      onClick={() => {
                        setShowBookingsModal(true);
                        setActiveTab("original");
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

                  {role === 1 && (
                    <button
                      onClick={() => {
                        setShowBookingsModal(true);
                        setActiveTab("original");
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

                  {role === 1 && (
                    <button
                      onClick={() => setShowCalendarModal(true)}
                      className="w-full bg-[#e8ddae] text-[#3b2f25] px-4 py-3 rounded-lg text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-2 shadow-md"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Manage Calendar
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

            {/* RIGHT COLUMN - FAVORITES */}
            <div className="lg:col-span-3 mt-4 lg:mt-0">
              <div className="bg-white rounded-2xl shadow-lg border border-[#c9bda4] overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
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

                <div className="flex-1 overflow-y-auto">
                  <div className="group relative overflow-hidden cursor-pointer transition-transform duration-300 hover:-translate-y-2">
                    <img
                      src="/images/gallery1.jpg"
                      className="w-full h-72 object-cover"
                      alt="Favorite 1"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <h3 className="text-xl font-bold mb-1">Kids Party Venue</h3>
                        <p className="text-xs text-gray-200 mb-2">Perfect space for children's celebrations</p>
                        <button className="w-full bg-[#7a5d47] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#5d4436] transition-colors">
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="group relative overflow-hidden cursor-pointer transition-transform duration-300 hover:-translate-y-2">
                    <img
                      src="/images/gallery2.jpg"
                      className="w-full h-72 object-cover"
                      alt="Favorite 2"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                        <h3 className="text-xl font-bold mb-1">Wedding Venue</h3>
                        <p className="text-xs text-gray-200 mb-2">Elegant outdoor ceremony space</p>
                        <button className="w-full bg-[#7a5d47] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#5d4436] transition-colors">
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

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

      {/* ================= BOOKINGS MODAL WITH TABS ================= */}
      {showBookingsModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
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

            <div className="flex border-b border-gray-200 bg-gray-50">
              <button
                onClick={() => setActiveTab("original")}
                className={`flex-1 px-6 py-3 font-semibold text-sm transition-colors ${
                  activeTab === "original"
                    ? "bg-white text-[#7a5d47] border-b-2 border-[#7a5d47]"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                📋 Original Bookings
              </button>
              <button
                onClick={() => setActiveTab("rescheduled")}
                className={`flex-1 px-6 py-3 font-semibold text-sm transition-colors ${
                  activeTab === "rescheduled"
                    ? "bg-white text-[#7a5d47] border-b-2 border-[#7a5d47]"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                🔄 Rescheduled Bookings
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingBookings ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7a5d47]"></div>
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-500">
                    {activeTab === "original" 
                      ? "No original bookings found" 
                      : "No rescheduled bookings found"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredBookings.map((booking) => {
                    const pendingData = getPendingRescheduleData(booking);
                    const displayDate = pendingData.hasPending 
                      ? pendingData.originalDate 
                      : booking.EventDate;
                    const { date, time } = formatDateTime(displayDate);
                    
                    const canReschedule = role === 0 && booking.BookingStatus === 'Confirmed' && !pendingData.hasPending;
                    const canComplete = role === 1 && booking.BookingStatus === 'Confirmed'; // ✅ NEW
                    const canLeaveFeedback = role === 0 && booking.BookingStatus === 'Completed'; // ✅ NEW
                    
                    const rescheduleHistory = booking.reschedule_history || [];
                    
                    return (
                      <div
                        key={booking.ID}
                        className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                      >
                        {activeTab === "original" && (
                          <>
                            {pendingData.hasPending && (
                              <div className="mb-3 bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
                                <div className="flex items-start gap-2">
                                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-yellow-900 mb-1">
                                      {role === 1 ? '⏳ Pending Reschedule Request' : '⏳ Awaiting Reschedule Approval'}
                                    </p>
                                    <p className="text-xs text-yellow-700 mb-2">
                                      {role === 1 
                                        ? 'Client has requested a new schedule. Review below.' 
                                        : 'Vendor is reviewing your reschedule request.'}
                                    </p>
                                    <div className="bg-white border border-yellow-200 rounded p-2 mt-2">
                                      <p className="text-xs text-gray-700">
                                        <span className="font-semibold">Original:</span>{' '}
                                        {formatDateTime(pendingData.originalDate).full}
                                      </p>
                                      <p className="text-xs text-yellow-800 mt-1">
                                        <span className="font-semibold">Requested:</span>{' '}
                                        {formatDateTime(pendingData.requestedDate).full}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

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
                                <span className="text-gray-600">{pendingData.hasPending ? 'Original' : 'Event'} Date:</span>
                                <p className="font-medium">{date}</p>
                              </div>
                              <div>
                                <span className="text-gray-600">{pendingData.hasPending ? 'Original' : 'Event'} Time:</span>
                                <p className="font-medium">{time}</p>
                              </div>
                              <div>
                                <span className="text-gray-600">Location:</span>
                                <p className="font-medium">{booking.EventLocation || 'Not specified'}</p>
                              </div>
                              <div>
                                <span className="text-gray-600">Budget:</span>
                                <p className="font-medium">₱{parseFloat(booking.TotalAmount || 0).toLocaleString()}</p>
                              </div>
                            </div>

                            <div className="flex gap-2 mt-3 flex-wrap">
                              {role === 0 && booking.BookingStatus === 'Pending' && !pendingData.hasPending && (
                                <button
                                  onClick={() => cancelBooking(booking.ID)}
                                  disabled={processingBooking}
                                  className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 text-sm font-semibold"
                                >
                                  Cancel
                                </button>
                              )}

                              {canReschedule && (
                                <button
                                  onClick={() => openRescheduleModal(booking)}
                                  disabled={processingBooking}
                                  className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm font-semibold"
                                >
                                  📅 Reschedule
                                </button>
                              )}

                              {/* NEW: COMPLETE BUTTON FOR VENDORS */}
                              {canComplete && (
                                <button
                                  onClick={() => completeBooking(booking.ID)}
                                  disabled={processingBooking}
                                 className="flex-1 bg-[#7a5d47] text-white px-4 py-2 rounded-lg hover:bg-[#5d4436] disabled:opacity-50 text-sm font-semibold"


                                >
                                   Mark Completed
                                </button>
                              )}

                              {/*  NEW: FEEDBACK BUTTON FOR CLIENTS */}
                              {canLeaveFeedback && (
                                <button
                                  onClick={() => openFeedbackModal(booking)}
                                  className="flex-1 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 text-sm font-semibold"
                                >
                                  ⭐ Leave Feedback
                                </button>
                              )}

                              {role === 1 && booking.BookingStatus === 'Pending' && (
                                <>
                                  <button
                                    onClick={() => acceptBooking(booking.ID)}
                                    disabled={processingBooking}
                                    className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50 text-sm font-semibold"
                                  >
                                    {pendingData.hasPending ? '✓ Approve' : 'Accept'}
                                  </button>
                                  <button
                                    onClick={() => rejectBooking(booking.ID)}
                                    disabled={processingBooking}
                                    className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 text-sm font-semibold"
                                  >
                                    {pendingData.hasPending ? '✗ Reject' : 'Reject'}
                                  </button>
                                </>
                              )}

                              <button
                                onClick={() => setSelectedBooking(booking)}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-semibold"
                              >
                                View
                              </button>
                            </div>
                          </>
                        )}

                        {activeTab === "rescheduled" && (
                          <>
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

                            {rescheduleHistory.map((reschedule) => (
                              <div
                                key={reschedule.ID}
                                className={`mb-3 p-3 rounded border-l-4 ${
                                  reschedule.Status === 'Approved'
                                    ? 'bg-green-50 border-green-500'
                                    : 'bg-red-50 border-red-500'
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold mb-2">
                                      {reschedule.Status === 'Approved' 
                                        ? '✅ Approved Reschedule' 
                                        : '❌ Rejected Reschedule'}
                                    </p>
                                    <div className="bg-white border rounded p-2 space-y-1">
                                      <p className="text-xs text-gray-700">
                                        <span className="font-semibold">Original:</span>{' '}
                                        {formatDateTime(reschedule.OriginalEventDate).full}
                                      </p>
                                      <p className="text-xs text-blue-800">
                                        <span className="font-semibold">Requested:</span>{' '}
                                        {formatDateTime(reschedule.RequestedEventDate).full}
                                      </p>
                                      {reschedule.Status === 'Approved' && (
                                        <p className="text-xs text-green-700 mt-1 pt-1 border-t">
                                          <span className="font-semibold">Approved on:</span>{' '}
                                          {formatDateTime(reschedule.ProcessedAt).full}
                                        </p>
                                      )}
                                      {reschedule.Status === 'Rejected' && (
                                        <p className="text-xs text-red-700 mt-1 pt-1 border-t">
                                          <span className="font-semibold">Rejected on:</span>{' '}
                                          {formatDateTime(reschedule.ProcessedAt).full}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}

                            <div className="grid grid-cols-2 gap-3 text-sm mb-3 mt-3 pt-3 border-t">
                              <div>
                                <span className="text-gray-600">Current Date:</span>
                                <p className="font-medium">{formatDateTime(booking.EventDate).date}</p>
                              </div>
                              <div>
                                <span className="text-gray-600">Current Time:</span>
                                <p className="font-medium">{formatDateTime(booking.EventDate).time}</p>
                              </div>
                              <div>
                                <span className="text-gray-600">Location:</span>
                                <p className="font-medium">{booking.EventLocation || 'Not specified'}</p>
                              </div>
                              <div>
                                <span className="text-gray-600">Budget:</span>
                                <p className="font-medium">₱{parseFloat(booking.TotalAmount || 0).toLocaleString()}</p>
                              </div>
                            </div>

                            <div className="flex gap-2 mt-3">
                              <button
                                onClick={() => setSelectedBooking(booking)}
                                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm font-semibold"
                              >
                                View Full Details
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

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

      {/* ================= BOOKING DETAILS MODAL ================= */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
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
              {(() => {
                const pendingData = getPendingRescheduleData(selectedBooking);
                return pendingData.hasPending ? (
                  <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                    <p className="font-semibold text-yellow-900 mb-2">
                      {role === 1 ? '⏳ Pending Reschedule Request' : '⏳ Awaiting Approval'}
                    </p>
                    <div className="bg-white border border-yellow-200 rounded p-3">
                      <p className="text-sm text-gray-800 mb-2">
                        <span className="font-semibold">Original:</span><br />
                        {formatDateTime(pendingData.originalDate).full}
                      </p>
                      <p className="text-sm text-yellow-800">
                        <span className="font-semibold">Requested:</span><br />
                        {formatDateTime(pendingData.requestedDate).full}
                      </p>
                    </div>
                  </div>
                ) : null;
              })()}

              {selectedBooking.reschedule_history && selectedBooking.reschedule_history.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-700 mb-3">🔄 Reschedule History</h3>
                  {selectedBooking.reschedule_history.map((reschedule) => (
                    <div
                      key={reschedule.ID}
                      className={`mb-3 p-3 rounded border-l-4 ${
                        reschedule.Status === 'Pending' ? 'bg-yellow-50 border-yellow-500' :
                        reschedule.Status === 'Approved' ? 'bg-green-50 border-green-500' :
                        'bg-red-50 border-red-500'
                      }`}
                    >
                      <p className="text-sm font-semibold mb-2">
                        {reschedule.Status === 'Pending' && '⏳ Pending'}
                        {reschedule.Status === 'Approved' && '✅ Approved'}
                        {reschedule.Status === 'Rejected' && '❌ Rejected'}
                      </p>
                      <div className="bg-white border rounded p-2 space-y-1">
                        <p className="text-xs">
                          <strong>From:</strong> {formatDateTime(reschedule.OriginalEventDate).full}
                        </p>
                        <p className="text-xs">
                          <strong>To:</strong> {formatDateTime(reschedule.RequestedEventDate).full}
                        </p>
                        {reschedule.ProcessedAt && (
                          <p className="text-xs text-gray-600 mt-1 pt-1 border-t">
                            <strong>Processed:</strong> {formatDateTime(reschedule.ProcessedAt).full}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

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
                    <label className="text-sm font-semibold text-gray-600">Current Date</label>
                    <p className="text-base">{formatDateTime(selectedBooking.EventDate).date}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Current Time</label>
                    <p className="text-base">{formatDateTime(selectedBooking.EventDate).time}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Location</label>
                    <p className="text-base">{selectedBooking.EventLocation || 'Not specified'}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Event Type</label>
                    <p className="text-base">{selectedBooking.EventType || 'Not specified'}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Budget</label>
                    <p className="text-base font-semibold text-green-600">
                      ₱{parseFloat(selectedBooking.TotalAmount || 0).toLocaleString()}
                    </p>
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

                {selectedBooking.AdditionalNotes && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <label className="text-sm font-semibold text-blue-900">Additional Notes</label>
                    <p className="text-sm mt-2 text-blue-800 whitespace-pre-wrap">{selectedBooking.AdditionalNotes}</p>
                  </div>
                )}
              </div>

              {selectedBooking.BookingStatus === 'Pending' && (
                <div className="flex gap-2 mt-6 pt-6 border-t">
                  {role === 0 && !getPendingRescheduleData(selectedBooking).hasPending && (
                    <button
                      onClick={() => cancelBooking(selectedBooking.ID)}
                      disabled={processingBooking}
                      className="flex-1 bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold"
                    >
                      Cancel
                    </button>
                  )}

                  {role === 1 && (
                    <>
                      <button
                        onClick={() => acceptBooking(selectedBooking.ID)}
                        disabled={processingBooking}
                        className="flex-1 bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 disabled:opacity-50 font-semibold"
                      >
                        {getPendingRescheduleData(selectedBooking).hasPending ? 'Approve Reschedule' : 'Accept'}
                      </button>
                      <button
                        onClick={() => rejectBooking(selectedBooking.ID)}
                        disabled={processingBooking}
                        className="flex-1 bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold"
                      >
                        {getPendingRescheduleData(selectedBooking).hasPending ? 'Reject Reschedule' : 'Reject'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {role === 0 && selectedBooking.BookingStatus === 'Confirmed' && !getPendingRescheduleData(selectedBooking).hasPending && (
                <div className="flex gap-2 mt-6 pt-6 border-t">
                  <button
                    onClick={() => {
                      setSelectedBooking(null);
                      openRescheduleModal(selectedBooking);
                    }}
                    disabled={processingBooking}
                    className="flex-1 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 font-semibold"
                  >
                    📅 Reschedule Booking
                  </button>
                </div>
              )}

              {/*  NEW: COMPLETE BUTTON IN DETAILS MODAL */}
              {role === 1 && selectedBooking.BookingStatus === 'Confirmed' && (
                <div className="flex gap-2 mt-6 pt-6 border-t">
                  <button
                    onClick={() => completeBooking(selectedBooking.ID)}
                    disabled={processingBooking}
                    className="flex-1 bg-[#7a5d47] text-white px-4 py-2 rounded-lg hover:bg-[#5d4436] disabled:opacity-50 text-sm font-semibold"

                  >
                     Mark as Completed
                  </button>
                </div>
              )}

              {/*  NEW: FEEDBACK BUTTON IN DETAILS MODAL */}
              {role === 0 && selectedBooking.BookingStatus === 'Completed' && (
                <div className="flex gap-2 mt-6 pt-6 border-t">
                  <button
                    onClick={() => {
                      setSelectedBooking(null);
                      openFeedbackModal(selectedBooking);
                    }}
                    className="flex-1 bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600 font-semibold"
                  >
                    ⭐ Leave Feedback
                  </button>
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

      {/* ================= RESCHEDULE MODAL ================= */}
      {showRescheduleModal && rescheduleBooking && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10001] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold mb-1">📅 Reschedule Booking</h3>
                  <p className="text-sm text-blue-100">
                    {rescheduleBooking.ServiceName}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowRescheduleModal(false);
                    setRescheduleBooking(null);
                  }}
                  className="text-white hover:text-gray-200 text-3xl font-light"
                >
                  ×
                </button>
              </div>
            </div>

            <form onSubmit={handleReschedule} className="p-6">
              <div className="mb-4 bg-amber-50 border-l-4 border-amber-500 p-3 rounded">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Note:</p>
                    <p className="text-xs text-amber-800 mt-1">
                      Your booking status will change to "Pending" after rescheduling. The vendor must approve your new schedule.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-1">Current Schedule:</p>
                <p className="font-semibold text-gray-900">
                  {formatDateTime(rescheduleBooking.EventDate).date}
                </p>
                <p className="font-semibold text-gray-900">
                  {formatDateTime(rescheduleBooking.EventDate).time}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  New Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={rescheduleForm.new_date}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, new_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  New Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={rescheduleForm.new_time}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, new_time: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 flex gap-3">
                <span className="text-xl">ℹ️</span>
                <p className="text-sm text-blue-800">
                  The vendor will be notified of your reschedule request and must approve the new date and time.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRescheduleModal(false);
                    setRescheduleBooking(null);
                  }}
                  disabled={processingBooking}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingBooking}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processingBooking ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Request Reschedule
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FEEDBACK MODAL ================= */}
      {showFeedbackModal && feedbackBooking && (
        <FeedbackModal
          booking={feedbackBooking}
          isOpen={showFeedbackModal}
          onClose={() => {
            setShowFeedbackModal(false);
            setFeedbackBooking(null);
          }}
          onSuccess={handleFeedbackSuccess}
        />
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

              <div className="border-t border-gray-300 pt-6">
                <h3 className="text-base font-semibold mb-4">Change Password</h3>
                
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

      {/* CALENDAR MODAL ================= */}
      {showCalendarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10002] p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden shadow-2xl">
            <div className="bg-[#7a5d47] text-white p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Manage Your Calendar</h2>
                <p className="text-sm text-white/80 mt-1">Set your availability and manage bookings</p>
              </div>
              <button
                onClick={() => setShowCalendarModal(false)}
                className="text-white hover:text-gray-200 text-3xl font-light"
              >
                ×
              </button>
            </div>

            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 100px)' }}>
              {/* Upcoming Availability Summary */}
              {(() => {
                const upcomingAvailability = getUpcomingAvailability();
                return upcomingAvailability.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                    <h4 className="font-semibold text-gray-700 mb-3">Your Upcoming Availability:</h4>
                    <div className="space-y-2">
                      {upcomingAvailability.map((avail, index) => (
                        <div 
                          key={index} 
                          className={`p-3 rounded-lg border ${
                            avail.is_available 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-red-50 border-red-200'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">
                                {avail.is_available ? '✓' : '✕'} {formatDate(avail.date)}
                              </p>
                              <p className="text-sm text-gray-600">
                                {avail.start_time?.substring(0, 5)} - {avail.end_time?.substring(0, 5)}
                              </p>
                              {avail.notes && (
                                <p className="text-xs text-gray-500 mt-1">{avail.notes}</p>
                              )}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              avail.is_available 
                                ? 'bg-green-500 text-white' 
                                : 'bg-red-500 text-white'
                            }`}>
                              {avail.is_available ? 'Available' : 'Booked'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Calendar */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                {/* Calendar Header */}
                <div className="flex justify-between items-center mb-6">
                  <button 
                    onClick={previousMonth}
                    className="bg-[#7a5d47] text-white px-4 py-2 rounded-lg hover:opacity-90"
                  >
                    ← Previous
                  </button>
                  <h4 className="text-xl font-bold">
                    {new Date(currentMonth).toLocaleDateString('en-US', { 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </h4>
                  <button 
                    onClick={nextMonth}
                    className="bg-[#7a5d47] text-white px-4 py-2 rounded-lg hover:opacity-90"
                  >
                    Next →
                  </button>
                </div>

                {/* Legend */}
                <div className="flex gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded"></div>
                    <span>Booked</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 rounded"></div>
                    <span>Click to manage</span>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {/* Weekday headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center font-semibold text-gray-600 py-2">
                      {day}
                    </div>
                  ))}

                  {/* Calendar days */}
                  {(() => {
                    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
                    const days = [];
                    
                    // Empty cells before month starts
                    for (let i = 0; i < startingDayOfWeek; i++) {
                      days.push(<div key={`empty-${i}`} className="aspect-square"></div>);
                    }
                    
                    // Days of month
                    for (let day = 1; day <= daysInMonth; day++) {
                      const date = new Date(year, month, day);
                      const isToday = date.toDateString() === new Date().toDateString();
                      const isPast = date < new Date().setHours(0, 0, 0, 0);
                      const availabilityData = getAvailabilityForDate(date);
                      const isAvailable = isDateAvailable(date);
                      const isBooked = isDateBooked(date);

                      days.push(
                        <div
                          key={day}
                          onClick={() => {
                            if (!isPast) {
                              if (availabilityData.length > 0) {
                                openAvailabilityModal(date, availabilityData[0]);
                              } else {
                                openAvailabilityModal(date);
                              }
                            }
                          }}
                          className={`aspect-square p-2 rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all ${
                            isPast 
                              ? 'bg-gray-100 opacity-50 cursor-not-allowed' 
                              : isAvailable
                              ? 'bg-green-50 border-green-500 hover:bg-green-100'
                              : isBooked
                              ? 'bg-red-50 border-red-500 hover:bg-red-100'
                              : 'bg-white border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                          } ${isToday ? 'ring-2 ring-[#7a5d47]' : ''}`}
                          title={availabilityData.length > 0 ? `${availabilityData[0].is_available ? 'Available' : 'Booked'}` : 'Click to set availability'}
                        >
                          <span className="font-semibold">{day}</span>
                          {availabilityData.length > 0 && (
                            <span className="text-xs mt-1">
                              {availabilityData[0].is_available ? '✓' : '✕'}
                            </span>
                          )}
                        </div>
                      );
                    }
                    
                    return days;
                  })()}
                </div>

                {loadingAvailability && (
                  <div className="text-center py-4 text-gray-500">
                    Loading availability...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AVAILABILITY EDIT MODAL (inside Calendar Modal) ================= */}
      {showAvailabilityModal && selectedDate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10003] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-[#7a5d47] text-white p-6">
              <h3 className="text-xl font-bold">
                {editingAvailability ? 'Edit' : 'Set'} Availability
              </h3>
              <p className="text-sm text-white/80 mt-1">
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>

            <form onSubmit={saveAvailability} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Status</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="is_available"
                      checked={availabilityForm.is_available === true}
                      onChange={() => setAvailabilityForm({ ...availabilityForm, is_available: true })}
                      className="w-4 h-4"
                    />
                    <span>Available</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="is_available"
                      checked={availabilityForm.is_available === false}
                      onChange={() => setAvailabilityForm({ ...availabilityForm, is_available: false })}
                      className="w-4 h-4"
                    />
                    <span>Booked/Unavailable</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Start Time</label>
                  <input
                    type="time"
                    value={availabilityForm.start_time}
                    onChange={(e) => setAvailabilityForm({ ...availabilityForm, start_time: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">End Time</label>
                  <input
                    type="time"
                    value={availabilityForm.end_time}
                    onChange={(e) => setAvailabilityForm({ ...availabilityForm, end_time: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2">Notes (Optional)</label>
                <textarea
                  value={availabilityForm.notes}
                  onChange={(e) => setAvailabilityForm({ ...availabilityForm, notes: e.target.value })}
                  placeholder="Add any notes about this time slot..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="3"
                />
              </div>

              <div className="flex gap-3">
                {editingAvailability && (
                  <button
                    type="button"
                    onClick={() => deleteAvailability(editingAvailability.id)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    Delete
                  </button>
                )}
                <div className="flex-1"></div>
                <button
                  type="button"
                  onClick={closeAvailabilityModal}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAvailability}
                  className="px-6 py-2 bg-[#7a5d47] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {savingAvailability ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "../utils/toast";

const API = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD
        ? "https://solennia.up.railway.app/api"
        : "/api");

const EVENT_TYPES = [
    "Wedding",
    "Birthday",
    "Corporate Event",
    "Conference",
    "Reception",
    "Anniversary",
    "Other"
];

export default function CreateVenueBooking() {
    const location = useLocation();
    const navigate = useNavigate();
    const venueData = location.state || {};

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Step 1: Event Details
    const [eventDetails, setEventDetails] = useState({
        event_type: "",
        start_date: "",
        end_date: "",
        guest_count: "",
        event_time: "14:00", // Default to 2:00 PM (15-min interval)
        event_location: venueData.address || "",
        budget: ""
    });

    // Step 2: Venue Configuration
    const [venueConfig, setVenueConfig] = useState({
        selected_amenities: [],
        special_requirements: "",
        setup_time: "",
        teardown_time: ""
    });

    // Step 3: Contact & Review
    const [contactInfo, setContactInfo] = useState({
        contact_name: "",
        contact_email: "",
        contact_phone: ""
    });

    useEffect(() => {
        if (!venueData.venueId) {
            toast.error("No venue selected. Redirecting...");
            setTimeout(() => navigate("/venue"), 2000);
        }

        // Load user profile for contact info
        const profile = localStorage.getItem("solennia_profile");
        if (profile) {
            try {
                const parsed = JSON.parse(profile);
                setContactInfo({
                    contact_name: `${parsed.first_name || ""} ${parsed.last_name || ""}`.trim(),
                    contact_email: parsed.email || "",
                    contact_phone: parsed.phone || ""
                });
            } catch (e) {
                console.error("Error parsing profile:", e);
            }
        }
    }, [venueData, navigate]);

    const handleEventDetailsChange = (field, value) => {
        setEventDetails(prev => ({ ...prev, [field]: value }));

        // Auto-set end_date to start_date if not specified (single-day event default)
        if (field === "start_date" && !eventDetails.end_date) {
            setEventDetails(prev => ({ ...prev, end_date: value }));
        }
    };

    const handleAmenityToggle = (amenity) => {
        setVenueConfig(prev => ({
            ...prev,
            selected_amenities: prev.selected_amenities.includes(amenity)
                ? prev.selected_amenities.filter(a => a !== amenity)
                : [...prev.selected_amenities, amenity]
        }));
    };

    const validateStep1 = () => {
        if (!eventDetails.event_type) {
            toast.error("Please select an event type");
            return false;
        }
        if (!eventDetails.start_date) {
            toast.error("Please select a start date");
            return false;
        }
        if (!eventDetails.guest_count || eventDetails.guest_count < 1) {
            toast.error("Please enter the number of guests");
            return false;
        }
        if (!eventDetails.event_time) {
            toast.error("Please select an event time");
            return false;
        }
        if (!eventDetails.budget || eventDetails.budget <= 0) {
            toast.error("Please enter your budget");
            return false;
        }

        // Capacity warning
        if (venueData.capacity && parseInt(eventDetails.guest_count) > parseInt(venueData.capacity)) {
            const confirm = window.confirm(
                `Warning: Your guest count (${eventDetails.guest_count}) exceeds the venue capacity (${venueData.capacity}). Continue anyway?`
            );
            if (!confirm) return false;
        }

        return true;
    };

    const validateStep2 = () => {
        // Step 2 is optional, always valid
        return true;
    };

    const validateStep3 = () => {
        if (!contactInfo.contact_name) {
            toast.error("Please enter your name");
            return false;
        }
        if (!contactInfo.contact_email) {
            toast.error("Please enter your email");
            return false;
        }
        return true;
    };

    const handleNext = () => {
        if (step === 1 && !validateStep1()) return;
        if (step === 2 && !validateStep2()) return;
        if (step === 3) {
            handleSubmit();
            return;
        }
        setStep(prev => prev + 1);
    };

    const handleBack = () => {
        if (step > 1) setStep(prev => prev - 1);
    };

    const handleSubmit = async () => {
        if (!validateStep3()) return;

        const token = localStorage.getItem("solennia_token");
        if (!token) {
            toast.error("Please login to continue");
            navigate("/login");
            return;
        }

        setLoading(true);

        const bookingPayload = {
            venue_id: venueData.venueId,
            event_type: eventDetails.event_type,
            start_date: eventDetails.start_date,
            end_date: eventDetails.end_date || eventDetails.start_date,
            guest_count: parseInt(eventDetails.guest_count),
            event_time: eventDetails.event_time,
            event_location: eventDetails.event_location,
            selected_amenities: venueConfig.selected_amenities,
            additional_notes: buildAdditionalNotes(),
            total_amount: parseFloat(eventDetails.budget) || 0
        };

        try {
            const response = await fetch(`${API}/venue-bookings/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(bookingPayload)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                toast.success("Venue booking request submitted successfully!");

                if (data.capacity_warning) {
                    toast.warning(data.capacity_warning);
                }

                // Redirect to bookings page
                setTimeout(() => navigate("/my-bookings"), 1500);
            } else if (response.status === 409) {
                toast.error("Venue is already booked for the selected dates. Please choose different dates.");
            } else {
                toast.error(data.error || "Failed to create booking");
            }
        } catch (error) {
            console.error("Booking error:", error);
            toast.error("Failed to submit booking. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const buildAdditionalNotes = () => {
        let notes = `--- Contact Information ---\n`;
        notes += `Name: ${contactInfo.contact_name}\n`;
        notes += `Email: ${contactInfo.contact_email}\n`;
        notes += `Phone: ${contactInfo.contact_phone || "Not provided"}\n\n`;

        if (venueConfig.setup_time || venueConfig.teardown_time) {
            notes += `--- Timing ---\n`;
            if (venueConfig.setup_time) notes += `Setup Time: ${venueConfig.setup_time}\n`;
            if (venueConfig.teardown_time) notes += `Teardown Time: ${venueConfig.teardown_time}\n`;
            notes += `\n`;
        }

        if (venueConfig.special_requirements) {
            notes += `--- Special Requirements ---\n`;
            notes += `${venueConfig.special_requirements}\n`;
        }

        return notes.trim();
    };

    if (!venueData.venueId) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[#e8ddae] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Redirecting...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <button
                        onClick={() => navigate(`/venue/${venueData.venueId}`)}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Venue
                    </button>

                    <div className="flex items-center gap-4">
                        {venueData.venueImage && (
                            <img
                                src={venueData.venueImage}
                                alt={venueData.venueName}
                                className="w-20 h-20 rounded-lg object-cover"
                            />
                        )}
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Book {venueData.venueName}</h1>
                            <p className="text-gray-600">{venueData.venueType} • Capacity: {venueData.capacity} guests</p>
                        </div>
                    </div>
                </div>

                {/* Progress Steps */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex items-center justify-between mb-2">
                        {[1, 2, 3].map((s) => (
                            <React.Fragment key={s}>
                                <div className="flex flex-col items-center">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${step >= s
                                            ? "bg-[#7a5d47] text-white"
                                            : "bg-gray-200 text-gray-500"
                                            }`}
                                    >
                                        {s}
                                    </div>
                                    <span className={`text-sm mt-2 ${step >= s ? "text-[#7a5d47] font-medium" : "text-gray-500"}`}>
                                        {s === 1 && "Event Details"}
                                        {s === 2 && "Configuration"}
                                        {s === 3 && "Review"}
                                    </span>
                                </div>
                                {s < 3 && (
                                    <div
                                        className={`flex-1 h-1 mx-4 rounded transition-colors ${step > s ? "bg-[#7a5d47]" : "bg-gray-200"
                                            }`}
                                    />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Step Content */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    {/* Step 1: Event Details */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">Event Details</h2>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Event Type *
                                </label>
                                <select
                                    value={eventDetails.event_type}
                                    onChange={(e) => handleEventDetailsChange("event_type", e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                >
                                    <option value="">Select event type</option>
                                    {EVENT_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Start Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={eventDetails.start_date}
                                        onChange={(e) => handleEventDetailsChange("start_date", e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        value={eventDetails.end_date}
                                        onChange={(e) => handleEventDetailsChange("end_date", e.target.value)}
                                        min={eventDetails.start_date || new Date().toISOString().split('T')[0]}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Leave blank for single-day event</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Number of Guests *
                                    </label>
                                    <input
                                        type="number"
                                        value={eventDetails.guest_count}
                                        onChange={(e) => handleEventDetailsChange("guest_count", e.target.value)}
                                        min="1"
                                        placeholder="e.g., 150"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                    />
                                    {venueData.capacity && (
                                        <p className="text-xs text-gray-500 mt-1">Venue capacity: {venueData.capacity} guests</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Event Time *
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {/* Hour */}
                                        <select
                                            value={(() => {
                                                if (!eventDetails.event_time) return "";
                                                const [hours] = eventDetails.event_time.split(':');
                                                const h = parseInt(hours);
                                                return h === 0 ? "12" : h > 12 ? (h - 12).toString() : h.toString();
                                            })()}
                                            onChange={(e) => {
                                                const hour12 = parseInt(e.target.value);
                                                const [, mins] = (eventDetails.event_time || "14:00").split(':');
                                                const currentHour24 = eventDetails.event_time ? parseInt(eventDetails.event_time.split(':')[0]) : 14;
                                                const isPM = currentHour24 >= 12;
                                                let hour24 = hour12;
                                                if (isPM && hour12 !== 12) hour24 = hour12 + 12;
                                                if (!isPM && hour12 === 12) hour24 = 0;
                                                handleEventDetailsChange("event_time", `${hour24.toString().padStart(2, '0')}:${mins || '00'}`);
                                            }}
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                        >
                                            <option value="">Hr</option>
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                                <option key={h} value={h}>{h}</option>
                                            ))}
                                        </select>

                                        {/* Minute */}
                                        <select
                                            value={eventDetails.event_time ? eventDetails.event_time.split(':')[1] : ""}
                                            onChange={(e) => {
                                                const [hours] = (eventDetails.event_time || "14:00").split(':');
                                                handleEventDetailsChange("event_time", `${hours || '14'}:${e.target.value}`);
                                            }}
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                        >
                                            <option value="">Min</option>
                                            {['00', '15', '30', '45'].map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>

                                        {/* AM/PM */}
                                        <select
                                            value={(() => {
                                                if (!eventDetails.event_time) return "";
                                                const [hours] = eventDetails.event_time.split(':');
                                                return parseInt(hours) >= 12 ? "PM" : "AM";
                                            })()}
                                            onChange={(e) => {
                                                const [hours, mins] = (eventDetails.event_time || "14:00").split(':');
                                                let hour24 = parseInt(hours);
                                                const wasPM = hour24 >= 12;
                                                const nowPM = e.target.value === "PM";

                                                if (wasPM && !nowPM) {
                                                    hour24 = hour24 === 12 ? 0 : hour24 - 12;
                                                } else if (!wasPM && nowPM) {
                                                    hour24 = hour24 === 12 ? 12 : hour24 + 12;
                                                }

                                                handleEventDetailsChange("event_time", `${hour24.toString().padStart(2, '0')}:${mins || '00'}`);
                                            }}
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                        >
                                            <option value="">--</option>
                                            <option value="AM">AM</option>
                                            <option value="PM">PM</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Event Location *
                                    </label>
                                    <input
                                        type="text"
                                        value={eventDetails.event_location}
                                        onChange={(e) => handleEventDetailsChange("event_location", e.target.value)}
                                        placeholder="e.g., Manila, Philippines"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Budget *
                                    </label>
                                    <input
                                        type="number"
                                        value={eventDetails.budget}
                                        onChange={(e) => handleEventDetailsChange("budget", e.target.value)}
                                        min="0"
                                        step="0.01"
                                        placeholder="e.g., 50000"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Enter your budget in PHP (₱)</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Venue Configuration */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">Venue Configuration</h2>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Select Amenities
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {[
                                        "Sound System",
                                        "Projector & Screen",
                                        "Microphone",
                                        "Chairs & Tables",
                                        "Air Conditioning",
                                        "Parking",
                                        "Catering Service",
                                        "Wi-Fi",
                                        "Stage/Platform"
                                    ].map(amenity => (
                                        <label
                                            key={amenity}
                                            className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${venueConfig.selected_amenities.includes(amenity)
                                                ? "border-[#7a5d47] bg-[#7a5d47]/5"
                                                : "border-gray-200 hover:border-gray-300"
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={venueConfig.selected_amenities.includes(amenity)}
                                                onChange={() => handleAmenityToggle(amenity)}
                                                className="w-4 h-4 text-[#7a5d47] rounded focus:ring-[#7a5d47]"
                                            />
                                            <span className="text-sm">{amenity}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Setup Time (Optional)
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {/* Hour */}
                                        <select
                                            value={(() => {
                                                if (!venueConfig.setup_time) return "";
                                                const [hours] = venueConfig.setup_time.split(':');
                                                const h = parseInt(hours);
                                                return h === 0 ? "12" : h > 12 ? (h - 12).toString() : h.toString();
                                            })()}
                                            onChange={(e) => {
                                                const hour12 = parseInt(e.target.value);
                                                const [, mins] = (venueConfig.setup_time || "14:00").split(':');
                                                const currentHour24 = venueConfig.setup_time ? parseInt(venueConfig.setup_time.split(':')[0]) : 14;
                                                const isPM = currentHour24 >= 12;
                                                let hour24 = hour12;
                                                if (isPM && hour12 !== 12) hour24 = hour12 + 12;
                                                if (!isPM && hour12 === 12) hour24 = 0;
                                                setVenueConfig(prev => ({ ...prev, setup_time: `${hour24.toString().padStart(2, '0')}:${mins || '00'}` }));
                                            }}
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                        >
                                            <option value="">Hr</option>
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                                <option key={h} value={h}>{h}</option>
                                            ))}
                                        </select>

                                        {/* Minute */}
                                        <select
                                            value={venueConfig.setup_time ? venueConfig.setup_time.split(':')[1] : ""}
                                            onChange={(e) => {
                                                const [hours] = (venueConfig.setup_time || "14:00").split(':');
                                                setVenueConfig(prev => ({ ...prev, setup_time: `${hours || '14'}:${e.target.value}` }));
                                            }}
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                        >
                                            <option value="">Min</option>
                                            {['00', '15', '30', '45'].map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>

                                        {/* AM/PM */}
                                        <select
                                            value={(() => {
                                                if (!venueConfig.setup_time) return "";
                                                const [hours] = venueConfig.setup_time.split(':');
                                                return parseInt(hours) >= 12 ? "PM" : "AM";
                                            })()}
                                            onChange={(e) => {
                                                const [hours, mins] = (venueConfig.setup_time || "14:00").split(':');
                                                let hour24 = parseInt(hours);
                                                const wasPM = hour24 >= 12;
                                                const nowPM = e.target.value === "PM";

                                                if (wasPM && !nowPM) {
                                                    hour24 = hour24 === 12 ? 0 : hour24 - 12;
                                                } else if (!wasPM && nowPM) {
                                                    hour24 = hour24 === 12 ? 12 : hour24 + 12;
                                                }

                                                setVenueConfig(prev => ({ ...prev, setup_time: `${hour24.toString().padStart(2, '0')}:${mins || '00'}` }));
                                            }}
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                        >
                                            <option value="">--</option>
                                            <option value="AM">AM</option>
                                            <option value="PM">PM</option>
                                        </select>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">When you need access for setup</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Teardown Time (Optional)
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {/* Hour */}
                                        <select
                                            value={(() => {
                                                if (!venueConfig.teardown_time) return "";
                                                const [hours] = venueConfig.teardown_time.split(':');
                                                const h = parseInt(hours);
                                                return h === 0 ? "12" : h > 12 ? (h - 12).toString() : h.toString();
                                            })()}
                                            onChange={(e) => {
                                                const hour12 = parseInt(e.target.value);
                                                const [, mins] = (venueConfig.teardown_time || "14:00").split(':');
                                                const currentHour24 = venueConfig.teardown_time ? parseInt(venueConfig.teardown_time.split(':')[0]) : 14;
                                                const isPM = currentHour24 >= 12;
                                                let hour24 = hour12;
                                                if (isPM && hour12 !== 12) hour24 = hour12 + 12;
                                                if (!isPM && hour12 === 12) hour24 = 0;
                                                setVenueConfig(prev => ({ ...prev, teardown_time: `${hour24.toString().padStart(2, '0')}:${mins || '00'}` }));
                                            }}
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                        >
                                            <option value="">Hr</option>
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                                <option key={h} value={h}>{h}</option>
                                            ))}
                                        </select>

                                        {/* Minute */}
                                        <select
                                            value={venueConfig.teardown_time ? venueConfig.teardown_time.split(':')[1] : ""}
                                            onChange={(e) => {
                                                const [hours] = (venueConfig.teardown_time || "14:00").split(':');
                                                setVenueConfig(prev => ({ ...prev, teardown_time: `${hours || '14'}:${e.target.value}` }));
                                            }}
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                        >
                                            <option value="">Min</option>
                                            {['00', '15', '30', '45'].map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>

                                        {/* AM/PM */}
                                        <select
                                            value={(() => {
                                                if (!venueConfig.teardown_time) return "";
                                                const [hours] = venueConfig.teardown_time.split(':');
                                                return parseInt(hours) >= 12 ? "PM" : "AM";
                                            })()}
                                            onChange={(e) => {
                                                const [hours, mins] = (venueConfig.teardown_time || "14:00").split(':');
                                                let hour24 = parseInt(hours);
                                                const wasPM = hour24 >= 12;
                                                const nowPM = e.target.value === "PM";

                                                if (wasPM && !nowPM) {
                                                    hour24 = hour24 === 12 ? 0 : hour24 - 12;
                                                } else if (!wasPM && nowPM) {
                                                    hour24 = hour24 === 12 ? 12 : hour24 + 12;
                                                }

                                                setVenueConfig(prev => ({ ...prev, teardown_time: `${hour24.toString().padStart(2, '0')}:${mins || '00'}` }));
                                            }}
                                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                        >
                                            <option value="">--</option>
                                            <option value="AM">AM</option>
                                            <option value="PM">PM</option>
                                        </select>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">When you'll finish teardown</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Special Requirements (Optional)
                                </label>
                                <textarea
                                    value={venueConfig.special_requirements}
                                    onChange={(e) => setVenueConfig(prev => ({ ...prev, special_requirements: e.target.value }))}
                                    rows="4"
                                    placeholder="Any special requests or requirements for your event..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: Contact & Review */}
                    {step === 3 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-gray-800 mb-4">Review & Submit</h2>

                            {/* Contact Information */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h3 className="font-semibold text-gray-800 mb-3">Contact Information</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                                        <input
                                            type="text"
                                            value={contactInfo.contact_name}
                                            onChange={(e) => setContactInfo(prev => ({ ...prev, contact_name: e.target.value }))}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                            <input
                                                type="email"
                                                value={contactInfo.contact_email}
                                                onChange={(e) => setContactInfo(prev => ({ ...prev, contact_email: e.target.value }))}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                            <input
                                                type="tel"
                                                value={contactInfo.contact_phone}
                                                onChange={(e) => setContactInfo(prev => ({ ...prev, contact_phone: e.target.value }))}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7a5d47] focus:border-transparent"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Booking Summary */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h3 className="font-semibold text-gray-800 mb-3">Booking Summary</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Event Type:</span>
                                        <span className="font-medium">{eventDetails.event_type}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Date:</span>
                                        <span className="font-medium">
                                            {eventDetails.start_date === eventDetails.end_date || !eventDetails.end_date
                                                ? eventDetails.start_date
                                                : `${eventDetails.start_date} to ${eventDetails.end_date}`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Time:</span>
                                        <span className="font-medium">{eventDetails.event_time}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Guests:</span>
                                        <span className="font-medium">{eventDetails.guest_count} people</span>
                                    </div>
                                    {venueConfig.selected_amenities.length > 0 && (
                                        <div className="flex justify-between items-start">
                                            <span className="text-gray-600">Amenities:</span>
                                            <span className="font-medium text-right">
                                                {venueConfig.selected_amenities.join(", ")}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <div className="flex gap-2">
                                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="text-sm text-amber-800">
                                        <p className="font-medium mb-1">Note:</p>
                                        <p>This is a booking request. The venue owner will review and confirm your booking. Final pricing will be provided by the venue.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between gap-4">
                    {step > 1 && (
                        <button
                            onClick={handleBack}
                            disabled={loading}
                            className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            ← Back
                        </button>
                    )}
                    <button
                        onClick={() => navigate(`/venue/${venueData.venueId}`)}
                        disabled={loading}
                        className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={loading}
                        className={`ml-auto px-8 py-3 bg-[#7a5d47] hover:bg-[#654a38] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${loading ? "cursor-not-allowed" : ""
                            }`}
                    >
                        {loading && (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        )}
                        {step === 3 ? "Submit Booking" : "Next →"}
                    </button>
                </div>
            </div>
        </div>
    );
}
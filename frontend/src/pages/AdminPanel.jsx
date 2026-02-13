import { useEffect, useState } from "react";
import React from "react";
import toast from "../utils/toast";
import "../style.css";

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "https://solennia.up.railway.app" : "");

const authHeaders = () => {
  const token = localStorage.getItem("solennia_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const roleLabel = (r) => (r === 2 ? "Admin" : r === 1 ? "Supplier" : "Client");

export default function AdminPanel() {
  const [apps, setApps] = useState([]);
  const [users, setUsers] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [activeTab, setActiveTab] = useState("vendors");

  const [lightbox, setLightbox] = useState({ show: false, url: "", title: "", isPdf: false });
  const [confirm, setConfirm] = useState({
    show: false,
    message: "",
    label: "Confirm",
    className: "approve-btn",
    onConfirm: null,
  });
  const [rejectModal, setRejectModal] = useState({
    show: false,
    appId: null,
    reason: "",
    onSubmit: null,
  });

  const previewDocument = (url, title = "Document") => {
    // Robust detection: Cloudinary raw uploads or explicit .pdf extension
    const isPdf = url.toLowerCase().includes(".pdf") || url.includes("/raw/upload/");
    setLightbox({ show: true, url, title, isPdf });
  };

  const closeLightbox = () => {
    setLightbox({ show: false, url: "", title: "", isPdf: false });
  };

  const openConfirm = (message, confirmLabel = "Confirm", confirmClass = "approve-btn") => {
    return new Promise((resolve) => {
      setConfirm({
        show: true,
        message,
        label: confirmLabel,
        className: confirmClass,
        onConfirm: (result) => {
          setConfirm({ show: false, message: "", label: "Confirm", className: "approve-btn", onConfirm: null });
          resolve(result);
        },
      });
    });
  };

  useEffect(() => {
    const token = localStorage.getItem("solennia_token");
    const role = parseInt(localStorage.getItem("solennia_role") || "0", 10);

    if (!token || role !== 2) {
      toast.error("Access denied — admin only.");
      setTimeout(() => {
        window.location.href = "/";
      }, 1200);
    }
  }, []);

  async function loadVendorApplications() {
    try {
      const res = await fetch(`${API_BASE}/admin/vendor-applications`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      setApps(json.applications || []);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function loadUsers() {
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      setUsers(json.users || []);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function loadFeedbacks() {
    try {
      const res = await fetch(`${API_BASE}/admin/feedbacks`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      setFeedbacks(json.feedbacks || []);
    } catch (err) {
      toast.error(err.message);
    }
  }

  useEffect(() => {
    loadVendorApplications();
    loadUsers();
    loadFeedbacks();
  }, []);

  async function handleDecision(id, action) {
    const isApprove = action === "approve";

    if (isApprove) {
      const ok = await openConfirm(
        "Approve this application?",
        "Approve",
        "approve-btn"
      );

      if (!ok) return;

      try {
        const res = await fetch(`${API_BASE}/admin/vendor-application/decision`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ id, action }),
        });

        const json = await res.json();

        if (!res.ok) throw new Error(json.message || json.error);

        toast.success(json.message || "Application approved successfully");
        loadVendorApplications();
      } catch (err) {
        toast.error(err.message);
      }
    } else {
      // Show rejection reason modal
      setRejectModal({
        show: true,
        appId: id,
        reason: "",
        onSubmit: async (reason) => {
          if (!reason || reason.trim().length < 10) {
            toast.error("Please provide a detailed reason (at least 10 characters)");
            return false;
          }

          try {
            const res = await fetch(`${API_BASE}/admin/vendor-application/decision`, {
              method: "POST",
              headers: authHeaders(),
              body: JSON.stringify({ id, action: "deny", reason: reason.trim() }),
            });

            const json = await res.json();

            if (!res.ok) throw new Error(json.message || json.error);

            toast.success("Application denied with reason sent to applicant");
            setRejectModal({ show: false, appId: null, reason: "", onSubmit: null });
            loadVendorApplications();
            return true;
          } catch (err) {
            toast.error(err.message);
            return false;
          }
        }
      });
    }
  }

  async function changeRole(userId, currentRole, newRole) {
    const ok = await openConfirm(
      newRole > currentRole ? "Promote user?" : "Demote user?",
      newRole > currentRole ? "Promote" : "Demote",
      newRole > currentRole ? "approve-btn" : "deny-btn"
    );

    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE}/admin/users/role`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ user_id: userId, role: newRole }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || json.error);
      }

      toast.success("Role updated successfully");
      loadUsers();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const vendorApps = apps.filter(a => a.category !== "Venue");
  const venueApps = apps.filter(a => a.category === "Venue");

  return (
    <>
      <style>{`
        .admin-panel .table-container {
          overflow-x: auto;
          background: #fff;
          border: 1px solid #d1d5db;
          border-radius: 1rem;
          padding: 1rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-bottom: 2rem;
        }
        .admin-panel table { width: 100%; border-collapse: collapse; }
        .admin-panel th, .admin-panel td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e5e5; vertical-align: middle; }
        .admin-panel th { background: #e8ddae; color: #1c1b1a; font-weight: 600; }
        .admin-panel button { border: 2px solid transparent; padding: 0.4rem 0.8rem; border-radius: 0.5rem; cursor: pointer; font-weight: 600; transition: all 0.2s ease; }
        .admin-panel button.approve-btn { background: #7a5d47; color: #fff; border: 2px solid #5a4333; }
        .admin-panel button.approve-btn:hover { background: #6a503d; border-color: #4a3323; }
        .admin-panel button.deny-btn { background: #e63946; color: #fff; border: 2px solid #d62828; }
        .admin-panel button.deny-btn:hover { background: #d62828; border-color: #c1121f; }
        .lb-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem; }
        .lb-content { background: #fff; border-radius: 12px; overflow: hidden; width: 650px; height: 800px; max-width: 95vw; max-height: 90vh; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); display: flex; flex-direction: column; position: relative; }
        .lb-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; background: #fcf9ee; border-bottom: 2px solid #e8ddae; z-index: 10; }
        .lb-close { border: none; background: #e8ddae; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 1.25rem; font-weight: bold; cursor: pointer; transition: all 0.2s; }
        .lb-close:hover { background: #d1c69a; transform: rotate(90deg); }
        .lb-body { flex: 1; min-height: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #f9fafb; position: relative; padding: 1rem; }
        .lb-pdf { width: 100%; height: 100%; border: none; display: block; }
        .lb-img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; pointer-events: none; user-select: none; }
        .confirm-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; }
        .confirm-card { background: #fff; padding: 1.5rem; border-radius: .75rem; width: 100%; max-width: 22rem; box-shadow: 0 10px 30px rgba(0,0,0,.25); }
        .reject-modal-card { background: #fff; padding: 1.5rem; border-radius: .75rem; width: 100%; max-width: 32rem; box-shadow: 0 10px 30px rgba(0,0,0,.25); }
        .reject-reason-input { width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 0.5rem; font-size: 0.875rem; resize: vertical; font-family: inherit; }
        .reject-reason-input:focus { outline: none; border-color: #dc2626; }
        .confirm-actions { display: flex; gap: .5rem; justify-content: flex-end; margin-top: .75rem; }
        .btn-ghost { background: #e0d6c6; color: #3b2f25; border-radius: 8px; padding: .5rem .9rem; border: 1px solid #c9bda9; }
        .tab-buttons { display: flex; gap: 0.5rem; margin-bottom: 2rem; border-bottom: 2px solid #e5e5e5; flex-wrap: wrap; }
        .tab-btn { padding: 0.75rem 1.5rem; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: 600; color: #6b7280; transition: all 0.2s ease; }
        .tab-btn:hover { color: #1f2937; background: #f9fafb; }
        .tab-btn.active { color: #7a5d47; border-bottom-color: #7a5d47; }
        .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem; }
        .badge.pending { background: #fef3c7; color: #92400e; }
      `}</style>

      {lightbox.show && (
        <div className="lb-backdrop" onClick={closeLightbox}>
          <div className="lb-content" onClick={(e) => e.stopPropagation()}>
            <div className="lb-header">
              <div className="text-sm font-semibold">{lightbox.title}</div>
              <button className="lb-close" onClick={closeLightbox}>&times;</button>
            </div>
            <div className="lb-body">
              {lightbox.isPdf ? (
                <iframe className="lb-pdf" src={lightbox.url} />
              ) : (
                <img className="lb-img" src={lightbox.url} alt="Document Preview" />
              )}
            </div>
          </div>
        </div>
      )}

      {confirm.show && (
        <div className="confirm-backdrop">
          <div className="confirm-card">
            <h3 className="text-lg font-semibold mb-2">Are you sure?</h3>
            <p className="text-sm text-gray-800">{confirm.message}</p>
            <div className="confirm-actions">
              <button className={confirm.className} onClick={() => confirm.onConfirm(true)}>
                {confirm.label}
              </button>
              <button className="btn-ghost" onClick={() => confirm.onConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModal.show && (
        <div className="confirm-backdrop">
          <div className="reject-modal-card">
            <h3 className="text-xl font-bold mb-2 text-red-600">Reject Application</h3>
            <p className="text-sm text-gray-700 mb-4">
              Please provide a reason for rejecting this application. This will be sent to the applicant.
            </p>
            <textarea
              className="reject-reason-input"
              placeholder="Enter detailed reason for rejection (minimum 10 characters)..."
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
              rows={5}
              autoFocus
            />
            <div className="text-xs text-gray-500 mb-4">
              {rejectModal.reason.length} characters
            </div>
            <div className="confirm-actions">
              <button
                className="deny-btn"
                onClick={async () => {
                  const success = await rejectModal.onSubmit(rejectModal.reason);
                  // Modal will close on success
                }}
              >
                Send Rejection
              </button>
              <button
                className="btn-ghost"
                onClick={() => setRejectModal({ show: false, appId: null, reason: "", onSubmit: null })}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="admin-panel max-w-7xl mx-auto w-full p-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Admin Panel</h1>

        {/* TABS NAVIGATION */}
        <div className="tab-buttons">
          <button className={`tab-btn ${activeTab === "vendors" ? "active" : ""}`} onClick={() => setActiveTab("vendors")}>
            Supplier Applications
            {vendorApps.length > 0 && <span className="badge pending">{vendorApps.length}</span>}
          </button>
          <button className={`tab-btn ${activeTab === "venues" ? "active" : ""}`} onClick={() => setActiveTab("venues")}>
            Venue Applications
            {venueApps.length > 0 && <span className="badge pending">{venueApps.length}</span>}
          </button>
          <button className={`tab-btn ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>
            User Management
          </button>
          <button className={`tab-btn ${activeTab === "feedback" ? "active" : ""}`} onClick={() => setActiveTab("feedback")}>
            Feedback
          </button>
        </div>

        {activeTab === "vendors" && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Supplier Applications</h2>
            <p className="text-gray-600 mb-6">Service providers (Photography, Catering, Styling, etc.)</p>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Business Name</th>
                    <th>Category</th>
                    <th>Address</th>
                    <th>Description</th>
                    <th>Pricing</th>
                    <th>Documents</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorApps.length === 0 ? (
                    <tr><td colSpan="9" className="text-center py-4">No pending Supplier applications</td></tr>
                  ) : (
                    vendorApps.map((a) => {
                      const fullName = [a.first_name, a.last_name].filter(Boolean).join(" ") || a.username || "-";
                      const businessEmail = a.contact_email || a.email || "-";
                      return (
                        <tr key={a.id}>
                          <td>{fullName}</td>
                          <td>{businessEmail}</td>
                          <td>{a.business_name}</td>
                          <td>{a.category}</td>
                          <td>{a.address}</td>
                          <td>{a.description}</td>
                          <td>{a.pricing}</td>
                          <td>
                            {a.gov_id && (
                              <button onClick={() => previewDocument(a.gov_id, "Valid ID")} className="text-blue-600 underline text-sm mr-2">
                                ID
                              </button>
                            )}
                            {a.permits && (
                              <button onClick={() => previewDocument(a.permits, "Business Permit")} className="text-blue-600 underline text-sm mr-2">
                                Permit
                              </button>
                            )}
                            {a.portfolio && (
                              <button onClick={() => previewDocument(a.portfolio, "Portfolio")} className="text-blue-600 underline text-sm">
                                Services
                              </button>
                            )}
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <button className="approve-btn" onClick={() => handleDecision(a.id, "approve")}>Approve</button>
                              <button className="deny-btn" onClick={() => handleDecision(a.id, "deny")}>Reject</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === "venues" && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Venue Applications</h2>
            <p className="text-gray-600 mb-6">Event venues and locations</p>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>Email</th>
                    <th>Venue Name</th>
                    <th>Type</th>
                    <th>Address</th>
                    <th>Capacity</th>
                    <th>Pricing</th>
                    <th>Documents</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {venueApps.length === 0 ? (
                    <tr><td colSpan="9" className="text-center py-4">No pending venue applications</td></tr>
                  ) : (
                    venueApps.map((a) => {
                      const fullName = [a.first_name, a.last_name].filter(Boolean).join(" ") || a.username || "-";
                      const businessEmail = a.contact_email || a.email || "-";
                      return (
                        <tr key={a.id}>
                          <td>{fullName}</td>
                          <td>{businessEmail}</td>
                          <td>{a.business_name}</td>
                          <td>{a.venue_type || "General"}</td>
                          <td>{a.address}</td>
                          <td>{a.venue_capacity || "-"}</td>
                          <td>{a.pricing}</td>
                          <td>
                            {a.gov_id && (
                              <button onClick={() => previewDocument(a.gov_id, "Valid ID")} className="text-blue-600 underline text-sm mr-2">
                                ID
                              </button>
                            )}
                            {a.permits && (
                              <button onClick={() => previewDocument(a.permits, "Business Permit")} className="text-blue-600 underline text-sm mr-2">
                                Permit
                              </button>
                            )}
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <button className="approve-btn" onClick={() => handleDecision(a.id, "approve")}>Approve</button>
                              <button className="deny-btn" onClick={() => handleDecision(a.id, "deny")}>Deny</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === "users" && (
          <>
            <h2 className="text-2xl font-semibold mb-6">User Management</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr><td colSpan="5" className="text-center py-4">No users found</td></tr>
                  ) : (
                    users.map((u) => {
                      const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "Unknown";
                      return (
                        <tr key={u.id}>
                          <td>{name}</td>
                          <td>{u.email}</td>
                          <td>{roleLabel(u.role)}</td>
                          <td>{new Date(u.created_at).toLocaleDateString()}</td>
                          <td>
                            <div className="flex gap-2 flex-wrap">
                              {u.role < 2 && (
                                <button className="approve-btn" onClick={() => changeRole(u.id, u.role, u.role + 1)}>
                                  Promote
                                </button>
                              )}
                              {u.role > 0 && (
                                <button className="deny-btn" onClick={() => changeRole(u.id, u.role, u.role - 1)}>
                                  Demote
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === "feedback" && (
          <>
            <h2 className="text-2xl font-semibold mb-6">User Feedback</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Message</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbacks.length === 0 ? (
                    <tr><td colSpan="3" className="text-center py-4">No feedback yet</td></tr>
                  ) : (
                    feedbacks.map((f) => {
                      const name = [f.first_name, f.last_name].filter(Boolean).join(" ") || f.username || "Unknown User";
                      return (
                        <tr key={f.id}>
                          <td>{name}</td>
                          <td>{f.message}</td>
                          <td>{new Date(f.created_at).toLocaleDateString()}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main >

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
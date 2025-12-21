import { useEffect, useState } from "react";
import React from "react";
import "../style.css";

/* =========================
   CONFIG
========================= */
const API =
  import.meta.env.VITE_API_BASE ||
  (location.hostname.includes("vercel.app") || location.hostname.includes("railway.app")
    ? "https://solennia.up.railway.app/api"
    : "/api");

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
  
  // Toast state
  const [toast, setToast] = useState({ show: false, message: "", type: "error" });
  
  // Lightbox state
  const [lightbox, setLightbox] = useState({ show: false, url: "", title: "", isPdf: false });
  
  // Confirm modal state
  const [confirm, setConfirm] = useState({
    show: false,
    message: "",
    label: "Confirm",
    className: "approve-btn",
    onConfirm: null,
  });

  /* =========================
     TOAST
  ========================= */
  const showToast = (message, type = "error") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "error" });
    }, 2300);
  };

  /* =========================
     LIGHTBOX
  ========================= */
  const previewDocument = (url, title = "Document") => {
    const isPdf = url.endsWith(".pdf");
    setLightbox({ show: true, url, title, isPdf });
  };

  const closeLightbox = () => {
    setLightbox({ show: false, url: "", title: "", isPdf: false });
  };

  /* =========================
     CONFIRM DIALOG
  ========================= */
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

  /* =========================
     ACCESS CONTROL
  ========================= */
  useEffect(() => {
    const token = localStorage.getItem("solennia_token");
    const role = parseInt(localStorage.getItem("solennia_role") || "0", 10);

    if (!token || role !== 2) {
      showToast("Access denied — admin only.");
      setTimeout(() => {
        window.location.href = "/";
      }, 1200);
    }
  }, []);

  /* =========================
     DATA LOADING
  ========================= */
  async function loadVendorApplications() {
    try {
      const res = await fetch(`${API}/admin/vendor-applications`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      setApps(json.applications || []);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function loadUsers() {
    try {
      const res = await fetch(`${API}/admin/users`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      setUsers(json.users || []);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function loadFeedbacks() {
    try {
      const res = await fetch(`${API}/admin/feedbacks`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      setFeedbacks(json.feedbacks || []);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  useEffect(() => {
    loadVendorApplications();
    loadUsers();
    loadFeedbacks();
  }, []);

  /* =========================
     VENDOR ACTIONS
  ========================= */
  async function handleDecision(id, action) {
    const isApprove = action === "approve";
    const ok = await openConfirm(
      isApprove ? "Approve this vendor application?" : "Deny this application?",
      isApprove ? "Approve" : "Deny",
      isApprove ? "approve-btn" : "deny-btn"
    );

    if (!ok) return;

    try {
      const res = await fetch(`${API}/admin/vendor-application/decision`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id, action }),
      });

      const json = await res.json();
      
      if (!res.ok) throw new Error(json.message || json.error);

      showToast(json.message || "Action completed successfully", "success");
      loadVendorApplications();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  /* =========================
     USER ROLE MANAGEMENT
  ========================= */
  async function changeRole(userId, currentRole, newRole) {
    const ok = await openConfirm(
      newRole > currentRole ? "Promote user?" : "Demote user?",
      newRole > currentRole ? "Promote" : "Demote",
      newRole > currentRole ? "approve-btn" : "deny-btn"
    );

    if (!ok) return;

    try {
      const res = await fetch(`${API}/admin/users/role`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ user_id: userId, role: newRole }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message || json.error);
      }

      showToast("Role updated successfully", "success");
      loadUsers();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  /* =========================
     RENDER
  ========================= */
  return (
    <>
      <style>{`
        /* Admin Panel Specific Styles - Don't override body/header */
        .admin-panel .table-container {
          overflow-x: auto;
          background: #fff;
          border: 1px solid #d1d5db;
          border-radius: 1rem;
          padding: 1rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-bottom: 2rem;
        }

        .admin-panel table {
          width: 100%;
          border-collapse: collapse;
        }

        .admin-panel th, 
        .admin-panel td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid #e5e5e5;
          vertical-align: middle;
        }

        .admin-panel th {
          background: #e8ddae;
          color: #1c1b1a;
        }

        .admin-panel button {
          border: 2px solid transparent;
          padding: 0.4rem 0.8rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .admin-panel button.approve-btn {
          background: #7a5d47;
          color: #fff;
          border-color: #5a4333;
        }

        .admin-panel button.approve-btn:hover {
          background: #6a503d;
        }

        .admin-panel button.deny-btn {
          background: #b91c1c;
          color: #fff;
          border-color: #7f1414;
        }

        .admin-panel button.deny-btn:hover {
          background: #991b1b;
        }

        .admin-panel button.muted {
          background: #e5e7eb;
          color: #6b7280;
          border-color: #d1d5db;
          cursor: not-allowed;
        }

        /* Toast */
        .toast-container {
          position: fixed;
          top: 5rem;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          z-index: 10000;
          pointer-events: none;
        }

        .toast {
          background: #fff;
          border: 1px solid #ccc;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          font-size: 0.9rem;
          color: #222;
          pointer-events: auto;
          transition: opacity 0.2s;
        }

        .toast.error {
          border-color: #b91c1c;
          background: #fee2e2;
        }

        .toast.success {
          border-color: #16a34a;
          background: #dcfce7;
        }

        /* Lightbox */
        .lb-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }

        .lb-content {
          max-width: 92vw;
          max-height: 88vh;
          background: #fff;
          border-radius: .75rem;
          overflow: hidden;
          border: 1px solid #e5e7eb;
          box-shadow: 0 10px 40px rgba(0,0,0,.35);
          display: flex;
          flex-direction: column;
        }

        .lb-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #e8ddae;
          padding: .5rem .75rem;
        }

        .lb-close {
          font-size: 1.4rem;
          background: transparent;
          border: none;
          cursor: pointer;
        }

        .lb-img, .lb-pdf {
          width: 100%;
          height: 80vh;
        }

        /* Confirm modal */
        .confirm-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10050;
        }

        .confirm-card {
          background: #f6f0e8;
          border: 1px solid #d1d5db;
          border-radius: 0.9rem;
          padding: 1rem 1.25rem;
          width: 100%;
          max-width: 22rem;
          box-shadow: 0 10px 30px rgba(0,0,0,.25);
        }

        .confirm-actions {
          display: flex;
          gap: .5rem;
          justify-content: flex-end;
          margin-top: .75rem;
        }

        .btn-ghost {
          background: #e0d6c6;
          color: #3b2f25;
          border-radius: 8px;
          padding: .5rem .9rem;
          border: 1px solid #c9bda9;
        }
      `}</style>

      {/* Toast */}
      {toast.show && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox.show && (
        <div className="lb-backdrop" onClick={closeLightbox}>
          <div className="lb-content" onClick={(e) => e.stopPropagation()}>
            <div className="lb-header">
              <div className="text-sm font-semibold">{lightbox.title}</div>
              <button className="lb-close" onClick={closeLightbox}>&times;</button>
            </div>
            {lightbox.isPdf ? (
              <iframe className="lb-pdf" src={lightbox.url} />
            ) : (
              <img className="lb-img" src={lightbox.url} alt="Document Preview" />
            )}
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirm.show && (
        <div className="confirm-backdrop">
          <div className="confirm-card">
            <h3 className="text-lg font-semibold mb-2">Are you sure?</h3>
            <p className="text-sm text-gray-800">{confirm.message}</p>
            <div className="confirm-actions">
              <button 
                className={confirm.className}
                onClick={() => confirm.onConfirm(true)}
              >
                {confirm.label}
              </button>
              <button 
                className="btn-ghost"
                onClick={() => confirm.onConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - wrapped in admin-panel class */}
      <main className="admin-panel max-w-7xl mx-auto w-full p-6">
        <h2 className="text-2xl font-semibold mb-6 mt-2">Vendor Applications</h2>

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
              {apps.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-4">
                    No pending applications
                  </td>
                </tr>
              ) : (
                apps.map((a) => {
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
                        <a 
                          onClick={() => previewDocument(a.permits, "Permit")}
                          className="underline cursor-pointer text-blue-600"
                        >
                          Permit
                        </a>
                        <a 
                          onClick={() => previewDocument(a.gov_id, "ID")}
                          className="underline cursor-pointer text-blue-600 ml-2"
                        >
                          ID
                        </a>
                        <a 
                          onClick={() => previewDocument(a.portfolio, "Portfolio")}
                          className="underline cursor-pointer text-blue-600 ml-2"
                        >
                          Portfolio
                        </a>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            className="approve-btn"
                            onClick={() => handleDecision(a.id, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            className="deny-btn"
                            onClick={() => handleDecision(a.id, "deny")}
                          >
                            Deny
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <h2 className="text-2xl font-semibold mb-6">User Management</h2>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Username</th>
                <th>Role</th>
                <th style={{ minWidth: "240px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-4">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>{`${u.first_name} ${u.last_name}`}</td>
                    <td>{u.email}</td>
                    <td>{u.username}</td>
                    <td>{roleLabel(u.role)}</td>
                    <td>
                      <div className="flex gap-2">
                        {u.role < 2 ? (
                          <button
                            className="approve-btn"
                            onClick={() => changeRole(u.id, u.role, u.role + 1)}
                          >
                            Promote
                          </button>
                        ) : (
                          <span style={{ color: "#777" }}>Max role</span>
                        )}
                        
                        {u.role === 2 || u.role === 0 ? (
                          <button className="muted" disabled>
                            Demote
                          </button>
                        ) : (
                          <button
                            className="deny-btn"
                            onClick={() => changeRole(u.id, u.role, u.role - 1)}
                          >
                            Demote
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
                <tr>
                  <td colSpan="3" className="text-center py-4">
                    No feedback yet
                  </td>
                </tr>
              ) : (
                feedbacks.map((f) => {
                  const name =
                    [f.first_name, f.last_name].filter(Boolean).join(" ") ||
                    f.username ||
                    "Unknown User";

                  return (
                    <tr key={f.id}>
                      <td>{name}</td>
                      <td>{f.message}</td>
                      <td>{new Date(f.created_at).toLocaleString()}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
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

const safeParse = (str) => {
  try { return JSON.parse(str); } catch (e) { return null; }
};

// Returns "X days ago" or "today" from a datetime string
function suspendedDaysAgo(suspendedAt) {
  if (!suspendedAt) return null;
  const then = new Date(suspendedAt);
  const now = new Date();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

function suspendedLabel(suspendedAt) {
  if (!suspendedAt) return null;
  const dateStr = new Date(suspendedAt).toLocaleDateString();
  const ago = suspendedDaysAgo(suspendedAt);
  return `Suspended ${ago} (since ${dateStr})`;
}

export default function AdminPanel() {
  const [apps, setApps] = useState([]);
  const [users, setUsers] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [reports, setReports] = useState([]);
  const [activeTab, setActiveTab] = useState("vendors");
  const [reportModal, setReportModal] = useState({ show: false, report: null, status: "", notes: "" });
  const [lightbox, setLightbox] = useState({ show: false, url: "", title: "", isPdf: false });
  const [confirm, setConfirm] = useState({ show: false, message: "", label: "Confirm", className: "approve-btn", onConfirm: null });
  const [rejectModal, setRejectModal] = useState({ show: false, appId: null, reason: "", onSubmit: null });
  const [selectedApp, setSelectedApp] = useState(null);

  const previewDocument = (url, title = "Document") => {
    if (!url || url.trim() === "") { toast.error("Document URL is missing or invalid"); return; }
    const urlLower = url.toLowerCase();
    const isPdf = urlLower.includes(".pdf") || url.includes("/raw/upload/") || urlLower.includes("pdf");
    setLightbox({ show: true, url, title, isPdf });
  };

  const closeLightbox = () => setLightbox({ show: false, url: "", title: "", isPdf: false });

  const openConfirm = (message, confirmLabel = "Confirm", confirmClass = "approve-btn") => {
    return new Promise((resolve) => {
      setConfirm({
        show: true, message, label: confirmLabel, className: confirmClass,
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
      setTimeout(() => { window.location.href = "/"; }, 1200);
    }
  }, []);

  async function loadVendorApplications() {
    try {
      const res = await fetch(`${API_BASE}/admin/vendor-applications`, { headers: authHeaders() });
      const json = await res.json();
      setApps(json.applications || []);
    } catch (err) { toast.error(err.message); }
  }

  async function loadUsers() {
    try {
      const res = await fetch(`${API_BASE}/admin/users`, { headers: authHeaders() });
      const json = await res.json();
      setUsers(json.users || []);
    } catch (err) { toast.error(err.message); }
  }

  async function loadFeedbacks() {
    try {
      const res = await fetch(`${API_BASE}/admin/feedbacks`, { headers: authHeaders() });
      const json = await res.json();
      setFeedbacks(json.feedbacks || []);
    } catch (err) { toast.error(err.message); }
  }

  async function loadReports() {
    try {
      const res = await fetch(`${API_BASE}/admin/reports`, { headers: authHeaders() });
      const json = await res.json();
      setReports(json.reports || []);
    } catch (err) { toast.error(err.message); }
  }

  useEffect(() => {
    loadVendorApplications();
    loadUsers();
    loadFeedbacks();
    loadReports();
  }, []);

  async function updateReportStatus() {
    if (!reportModal.report) return;
    try {
      const res = await fetch(`${API_BASE}/admin/reports/${reportModal.report.ID}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status: reportModal.status, admin_notes: reportModal.notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error);
      toast.success("Report status updated");
      setReportModal({ show: false, report: null, status: "", notes: "" });
      loadReports();
    } catch (err) { toast.error(err.message); }
  }

  async function handleDecision(id, action) {
    const isApprove = action === "approve";
    if (isApprove) {
      const ok = await openConfirm("Approve this application?", "Approve", "approve-btn");
      if (!ok) return;
      try {
        const res = await fetch(`${API_BASE}/admin/vendor-application/decision`, {
          method: "POST", headers: authHeaders(),
          body: JSON.stringify({ id, action }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || json.error);
        toast.success(json.message || "Application approved successfully");
        loadVendorApplications();
      } catch (err) { toast.error(err.message); }
    } else {
      setRejectModal({
        show: true, appId: id, reason: "",
        onSubmit: async (reason) => {
          if (!reason || reason.trim().length < 10) {
            toast.error("Please provide a detailed reason (at least 10 characters)");
            return false;
          }
          try {
            const res = await fetch(`${API_BASE}/admin/vendor-application/decision`, {
              method: "POST", headers: authHeaders(),
              body: JSON.stringify({ id, action: "deny", reason: reason.trim() }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || json.error);
            toast.success("Application denied with reason sent to applicant");
            setRejectModal({ show: false, appId: null, reason: "", onSubmit: null });
            loadVendorApplications();
            return true;
          } catch (err) { toast.error(err.message); return false; }
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
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ user_id: userId, role: newRole }),
      });
      if (!res.ok) { const json = await res.json(); throw new Error(json.message || json.error); }
      toast.success("Role updated successfully");
      loadUsers();
      loadReports();
    } catch (err) { toast.error(err.message); }
  }

  // Issue a warning to a supplier — increments warning_count, auto-suspends at 3
  async function issueWarning(vendorUserId, reportId, reason) {
    try {
      const res = await fetch(`${API_BASE}/admin/suppliers/${vendorUserId}/warn`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ report_id: reportId, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error);

      if (json.auto_suspended) {
        toast.success(`Warning issued. Supplier automatically suspended after 3 warnings.`);
      } else {
        toast.success(json.message || `Warning #${json.warning_count} issued.`);
      }

      setReportModal({ show: false, report: null, status: "", notes: "" });
      loadReports();
      loadUsers();
    } catch (err) { toast.error(err.message); }
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
        .admin-panel button { border: 2px solid transparent; padding: 0.4rem 0.8rem; border-radius: 0.5rem; cursor: pointer; font-weight: 600; transition: all 0.2s ease; width: fit-content; white-space: nowrap; }
        .admin-panel button.approve-btn, button.approve-btn { background: #7a5d47; color: #fff; border: 2px solid #5a4333; }
        .admin-panel button.approve-btn:hover, button.approve-btn:hover { background: #6a503d; border-color: #4a3323; }
        .admin-panel button.deny-btn, button.deny-btn { background: #e63946; color: #fff; border: 2px solid #d62828; }
        .admin-panel button.deny-btn:hover, button.deny-btn:hover { background: #d62828; border-color: #c1121f; }
        .admin-panel button.warn-btn, button.warn-btn { background: #d97706; color: #fff; border: 2px solid #b45309; }
        .admin-panel button.warn-btn:hover, button.warn-btn:hover { background: #b45309; border-color: #92400e; }
        .lb-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem; }
        .lb-content { background: #fff; border-radius: 12px; overflow: hidden; width: 650px; height: 800px; max-width: 95vw; max-height: 90vh; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); display: flex; flex-direction: column; position: relative; }
        .lb-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; background: #fcf9ee; border-bottom: 2px solid #e8ddae; z-index: 10; }
        .lb-close { border: none; background: #e8ddae; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 1.25rem; font-weight: bold; cursor: pointer; transition: all 0.2s; }
        .lb-close:hover { background: #d1c69a; transform: rotate(90deg); }
        .lb-body { flex: 1; min-height: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #f9fafb; position: relative; padding: 1rem; }
        .lb-pdf { width: 100%; height: 100%; border: none; display: block; }
        .lb-img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; pointer-events: none; user-select: none; }
        .confirm-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10002; }
        .confirm-card { background: #fff; padding: 1.5rem; border-radius: .75rem; width: 100%; max-width: 22rem; box-shadow: 0 10px 30px rgba(0,0,0,.25); }
        .reject-modal-card { background: #fff; padding: 1.5rem; border-radius: .75rem; width: 100%; max-width: 32rem; box-shadow: 0 10px 30px rgba(0,0,0,.25); }
        .reject-reason-input { width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 0.5rem; font-size: 0.875rem; resize: vertical; font-family: inherit; }
        .reject-reason-input:focus { outline: none; border-color: #dc2626; }
        .confirm-actions { display: flex; gap: .5rem; justify-content: flex-end; margin-top: .75rem; }
        .btn-ghost { background: #e0d6c6; color: #3b2f25; border-radius: 8px; padding: .5rem .9rem; border: 1px solid #c9bda9; cursor: pointer; font-weight: 600; }
        .tab-buttons { display: flex; gap: 0.5rem; margin-bottom: 2rem; border-bottom: 2px solid #e5e5e5; flex-wrap: wrap; }
        .tab-btn { padding: 0.75rem 1.5rem; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: 600; color: #6b7280; transition: all 0.2s ease; }
        .tab-btn:hover { color: #1f2937; background: #f9fafb; }
        .tab-btn.active { color: #7a5d47; border-bottom-color: #7a5d47; }
        .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem; }
        .badge.pending { background: #fef3c7; color: #92400e; }
        .warning-badge { display: inline-flex; align-items: center; gap: 3px; padding: 0.2rem 0.5rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 700; }
        .warning-badge.w1 { background: #fef3c7; color: #92400e; }
        .warning-badge.w2 { background: #fed7aa; color: #9a3412; }
        .warning-badge.w3 { background: #fecaca; color: #991b1b; }
        .suspended-badge { display: inline-flex; align-items: center; gap: 4px; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
      `}</style>

      {/* Confirm modal */}
      {confirm.show && (
        <div className="confirm-backdrop">
          <div className="confirm-card">
            <h3 className="text-lg font-semibold mb-2">Are you sure?</h3>
            <p className="text-sm text-gray-800">{confirm.message}</p>
            <div className="confirm-actions">
              <button className={confirm.className} onClick={() => confirm.onConfirm(true)}>{confirm.label}</button>
              <button className="btn-ghost" onClick={() => confirm.onConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject application modal */}
      {rejectModal.show && (
        <div className="confirm-backdrop">
          <div className="reject-modal-card">
            <h3 className="text-xl font-bold mb-2 text-red-600">Reject Application</h3>
            <p className="text-sm text-gray-700 mb-4">Please provide a reason for rejecting this application. This will be sent to the applicant.</p>
            <textarea
              className="reject-reason-input"
              placeholder="Enter detailed reason for rejection (minimum 10 characters)..."
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
              rows={5} autoFocus
            />
            <div className="text-xs text-gray-500 mb-4">{rejectModal.reason.length} characters</div>
            <div className="confirm-actions">
              <button className="deny-btn" onClick={async () => { await rejectModal.onSubmit(rejectModal.reason); }}>Send Rejection</button>
              <button className="btn-ghost" onClick={() => setRejectModal({ show: false, appId: null, reason: "", onSubmit: null })}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor/Venue Details Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 overflow-y-auto" onClick={() => setSelectedApp(null)}>
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#fcf9ee] border-b border-[#e8ddae] p-4 flex justify-between items-center z-10">
              <div>
                <h2 className="text-xl font-bold text-[#7a5d47]">{selectedApp.business_name}</h2>
                <p className="text-sm text-gray-600">{selectedApp.category} • {selectedApp.city}, {selectedApp.region}</p>
              </div>
              <button onClick={() => setSelectedApp(null)} className="w-8 h-8 rounded-full bg-[#e8ddae] hover:bg-[#d1c69a] flex items-center justify-center text-lg font-bold transition-colors">&times;</button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-bold uppercase text-gray-500 border-b pb-1">Applicant Details</h3>
                  <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                    <span className="text-gray-500">Full Name:</span>
                    <span className="font-medium">{[selectedApp.first_name, selectedApp.last_name].filter(Boolean).join(" ") || selectedApp.username}</span>
                    <span className="text-gray-500">Email:</span>
                    <span className="font-medium">{selectedApp.contact_email || selectedApp.email}</span>
                    <span className="text-gray-500">Phone:</span>
                    <span className="font-medium">{selectedApp.contact_number || "-"}</span>
                    <span className="text-gray-500">Address:</span>
                    <span className="font-medium">{[selectedApp.region, selectedApp.city, selectedApp.address].filter(Boolean).join(", ") || "-"}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-sm font-bold uppercase text-gray-500 border-b pb-1">Social Media</h3>
                  <div className="text-sm space-y-2">
                    {(() => {
                      const links = safeParse(selectedApp.social_links);
                      if (!links || (!links.facebook && !links.instagram)) return <p className="text-gray-400 italic">No social media links provided</p>;
                      return (
                        <>
                          {links.facebook && <div className="flex items-center gap-2"><span className="font-semibold text-blue-600">Facebook:</span><a href={links.facebook} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[200px]">{links.facebook}</a></div>}
                          {links.instagram && <div className="flex items-center gap-2"><span className="font-semibold text-pink-600">Instagram:</span><a href={links.instagram} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[200px]">{links.instagram}</a></div>}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase text-gray-500 border-b pb-1">Business Information</h3>
                <div className="space-y-2 text-sm">
                  <div><span className="block text-gray-500 mb-1">Description:</span><p className="bg-gray-50 p-3 rounded border whitespace-pre-wrap">{selectedApp.description || "No description provided."}</p></div>
                  <div><span className="block text-gray-500 mb-1">Pricing / Packages:</span><p className="bg-gray-50 p-3 rounded border whitespace-pre-wrap">{selectedApp.pricing || "No pricing info provided."}</p></div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase text-gray-500 border-b pb-1">Documents & Media</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { key: "gov_id", label: "Government ID" },
                    { key: "permits", label: "Business Permit" },
                    { key: "portfolio", label: "Portfolio" },
                    { key: "selfie_with_id", label: "Selfie w/ ID" },
                    { key: "sample_photos", label: "Sample Work" },
                  ].map(({ key, label }) => selectedApp[key] && (
                    <div key={key} onClick={(e) => { e.stopPropagation(); previewDocument(selectedApp[key], label); }} className="cursor-pointer group">
                      <div className="relative h-40 bg-gray-200 rounded border overflow-hidden flex items-center justify-center">
                        <img src={selectedApp[key]} alt={label} className="max-w-full max-h-full object-contain opacity-90 group-hover:opacity-100 transition-opacity" onError={(e) => { e.target.style.display = 'none'; }} />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
                          <span className="text-xs font-semibold text-transparent group-hover:text-white drop-shadow-md transition-colors">View</span>
                        </div>
                      </div>
                      <p className="text-xs text-center mt-1 text-gray-500 font-medium">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 sticky bottom-0">
              <button style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', fontWeight: 600, cursor: 'pointer', background: '#fff' }} onClick={() => setSelectedApp(null)}>Close</button>
              <button style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '2px solid #d62828', fontWeight: 600, cursor: 'pointer', background: '#e63946', color: '#fff' }} onClick={() => { handleDecision(selectedApp.id, "deny"); setSelectedApp(null); }}>Reject Application</button>
              <button style={{ padding: '0.5rem 1.5rem', borderRadius: '0.5rem', border: '2px solid #5a4333', fontWeight: 600, cursor: 'pointer', background: '#7a5d47', color: '#fff' }} onClick={() => { handleDecision(selectedApp.id, "approve"); setSelectedApp(null); }}>Approve Application</button>
            </div>
          </div>
        </div>
      )}

      {/* Report detail modal */}
      {reportModal.show && reportModal.report && (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 overflow-y-auto" onClick={() => setReportModal({ show: false, report: null, status: "", notes: "" })}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#fcf9ee] border-b border-[#e8ddae] p-4 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold text-[#7a5d47]">Report Details</h2>
              <button onClick={() => setReportModal({ show: false, report: null, status: "", notes: "" })} className="w-8 h-8 rounded-full bg-[#e8ddae] hover:bg-[#d1c69a] flex items-center justify-center text-lg font-bold">&times;</button>
            </div>

            <div className="p-6 space-y-4">
              {/* Report info grid */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-500">Client:</span>
                <span className="font-medium">{reportModal.report.reporter_first_name} {reportModal.report.reporter_last_name} ({reportModal.report.reporter_email})</span>

                <span className="text-gray-500">Supplier/Venue:</span>
                <div>
                  <span className="font-medium">{reportModal.report.vendor_name} ({reportModal.report.vendor_email})</span>
                  {/* Warning count badge */}
                  {reportModal.report.vendor_warning_count > 0 && (
                    <span className={`warning-badge ml-2 w${Math.min(reportModal.report.vendor_warning_count, 3)}`}>
                      ⚠ {reportModal.report.vendor_warning_count} warning{reportModal.report.vendor_warning_count > 1 ? "s" : ""}
                    </span>
                  )}
                  {/* Suspended badge */}
                  {reportModal.report.vendor_suspended_at && (
                    <div className="suspended-badge mt-1">
                      🚫 {suspendedLabel(reportModal.report.vendor_suspended_at)}
                    </div>
                  )}
                </div>

                <span className="text-gray-500">Booking reference:</span>
                <span className="font-medium">
                  {reportModal.report.ServiceName
                    ? `${reportModal.report.ServiceName}${reportModal.report.EventDate ? " • " + new Date(reportModal.report.EventDate).toLocaleDateString() : ""}`
                    : reportModal.report.BookingID ? `#${reportModal.report.BookingID}` : "—"}
                </span>

                <span className="text-gray-500">Report category:</span>
                <span className="font-medium capitalize">{(reportModal.report.ReportReason || "").replace(/_/g, " ")}</span>

                <span className="text-gray-500">Date submitted:</span>
                <span className="font-medium">{new Date(reportModal.report.CreatedAt).toLocaleString()}</span>
              </div>

              <div>
                <span className="block text-sm text-gray-500 mb-1">Detailed complaint</span>
                <p className="bg-gray-50 p-3 rounded border text-sm whitespace-pre-wrap">{reportModal.report.ReportDetails || reportModal.report.feedback_comment || "—"}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                <select
                  className="w-full p-2 border rounded"
                  value={reportModal.status}
                  onChange={e => setReportModal(prev => ({ ...prev, status: e.target.value }))}
                >
                  <option value="Pending">Pending</option>
                  <option value="Under_Review">Under Review</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Admin remarks (internal)</label>
                <textarea
                  className="w-full p-2 border rounded h-24 resize-y"
                  placeholder="Internal notes..."
                  value={reportModal.notes}
                  onChange={e => setReportModal(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t flex flex-wrap justify-end gap-2">
              <button className="px-4 py-2 rounded-lg border border-gray-300 font-medium hover:bg-gray-100" onClick={() => setReportModal({ show: false, report: null, status: "", notes: "" })}>
                Cancel
              </button>

              {/* Issue Warning button — only if supplier is not already suspended */}
              {reportModal.report.vendor_user_id && !reportModal.report.vendor_suspended_at && (
                <button
                  className="warn-btn px-4 py-2"
                  onClick={async () => {
                    const warningCount = reportModal.report.vendor_warning_count || 0;
                    const nextWarning = warningCount + 1;
                    const willSuspend = nextWarning >= 3;
                    const confirmMsg = willSuspend
                      ? `Issue warning #${nextWarning}? This will AUTOMATICALLY SUSPEND the supplier (3rd warning).`
                      : `Issue warning #${nextWarning} to this supplier? They currently have ${warningCount} warning(s).`;

                    const ok = await openConfirm(confirmMsg, willSuspend ? "Warn & Suspend" : "Issue Warning", "warn-btn");
                    if (!ok) return;
                    await issueWarning(reportModal.report.vendor_user_id, reportModal.report.ID, reportModal.notes);
                  }}
                  title="Issue a formal warning. 3 warnings = auto-suspend."
                >
                  ⚠ Issue Warning ({reportModal.report.vendor_warning_count || 0}/3)
                </button>
              )}

              {/* Suspend button — only if not already suspended */}
              {reportModal.report.vendor_user_id && !reportModal.report.vendor_suspended_at && (
                <button
                  className="deny-btn px-4 py-2"
                  onClick={async () => {
                    const savedReport = { ...reportModal };
                    setReportModal({ show: false, report: null, status: "", notes: "" });
                    const ok = await openConfirm("Suspend this supplier's account? Their listings will be deactivated immediately.", "Suspend", "deny-btn");
                    if (!ok) { setReportModal(savedReport); return; }

                    // FIX: suspend the supplier
                    await changeRole(savedReport.report.vendor_user_id, 1, 0);

                    // FIX: auto-resolve the report with a note
                    await fetch(`${API_BASE}/admin/reports/${savedReport.report.ID}`, {
                      method: "PATCH",
                      headers: authHeaders(),
                      body: JSON.stringify({
                        status: "Resolved",
                        admin_notes: (savedReport.notes ? savedReport.notes + "\n" : "") +
                          "[System] Supplier account suspended and listings deactivated."
                      }),
                    });

                    loadReports();
                  }}
                  title="Suspend supplier — deactivates all their listings immediately"
                >
                  🚫 Suspend Supplier
                </button>
              )}

              {/* Reinstate button — only if currently suspended */}
              {reportModal.report.vendor_user_id && reportModal.report.vendor_suspended_at && (
                <button
                  className="approve-btn px-4 py-2"
                  style={{ background: "#059669", borderColor: "#047857" }}
                  onClick={async () => {
                    const savedReport = { ...reportModal };
                    setReportModal({ show: false, report: null, status: "", notes: "" });
                    const ok = await openConfirm("Reinstate this supplier? Their listings will be reactivated.", "Reinstate", "approve-btn");
                    if (!ok) { setReportModal(savedReport); return; }
                    await changeRole(savedReport.report.vendor_user_id, 0, 1);
                    loadReports();
                  }}
                  title="Reinstate suspended supplier and reactivate their listings"
                >
                  ✅ Reinstate Supplier
                </button>
              )}

              <button
                className="approve-btn px-4 py-2"
                onClick={() => {
                  setReportModal(prev => ({ ...prev, show: false }));
                  setTimeout(() => { updateReportStatus(); }, 100);
                }}
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="admin-panel max-w-7xl mx-auto w-full p-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Admin Panel</h1>

        <div className="tab-buttons">
          <button className={`tab-btn ${activeTab === "vendors" ? "active" : ""}`} onClick={() => setActiveTab("vendors")}>
            Supplier Applications {vendorApps.length > 0 && <span className="badge pending">{vendorApps.length}</span>}
          </button>
          <button className={`tab-btn ${activeTab === "venues" ? "active" : ""}`} onClick={() => setActiveTab("venues")}>
            Venue Applications {venueApps.length > 0 && <span className="badge pending">{venueApps.length}</span>}
          </button>
          <button className={`tab-btn ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>User Management</button>
          <button className={`tab-btn ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")}>
            Moderation {reports.filter(r => r.Status === 'Pending').length > 0 && <span className="badge pending">{reports.filter(r => r.Status === 'Pending').length}</span>}
          </button>
          <button className={`tab-btn ${activeTab === "feedback" ? "active" : ""}`} onClick={() => setActiveTab("feedback")}>Feedback</button>
        </div>

        {/* Supplier Applications Tab */}
        {activeTab === "vendors" && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Supplier Applications</h2>
            <p className="text-gray-600 mb-6">Service providers (Photography, Catering, Styling, etc.)</p>
            <div className="table-container">
              <table>
                <thead><tr><th>Full Name</th><th>Email</th><th>Business Name</th><th>Category</th><th>Location</th><th>Description</th><th>Pricing</th><th>View Details</th><th>Actions</th></tr></thead>
                <tbody>
                  {vendorApps.length === 0 ? (
                    <tr><td colSpan="9" className="text-center py-4">No pending Supplier applications</td></tr>
                  ) : vendorApps.map((a) => {
                    const fullName = [a.first_name, a.last_name].filter(Boolean).join(" ") || a.username || "-";
                    const businessEmail = a.contact_email || a.email || "-";
                    return (
                      <tr key={a.id}>
                        <td>{fullName}</td><td>{businessEmail}</td><td>{a.business_name}</td><td>{a.category}</td>
                        <td>{a.city ? `${a.city}, ${a.region}` : "-"}</td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</td>
                        <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.pricing}</td>
                        <td><button className="approve-btn" style={{ whiteSpace: 'nowrap' }} onClick={() => setSelectedApp(a)}>View Details</button></td>
                        <td><div className="flex gap-2"><button className="approve-btn flex-1" onClick={() => handleDecision(a.id, "approve")}>Approve</button><button className="deny-btn flex-1" onClick={() => handleDecision(a.id, "deny")}>Reject</button></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Venue Applications Tab */}
        {activeTab === "venues" && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Venue Applications</h2>
            <p className="text-gray-600 mb-6">Event venues and locations</p>
            <div className="table-container">
              <table>
                <thead><tr><th>Full Name</th><th>Email</th><th>Venue Name</th><th>Type</th><th>Location</th><th>Capacity</th><th>Pricing</th><th>View Details</th><th>Actions</th></tr></thead>
                <tbody>
                  {venueApps.length === 0 ? (
                    <tr><td colSpan="9" className="text-center py-4">No pending venue applications</td></tr>
                  ) : venueApps.map((a) => {
                    const fullName = [a.first_name, a.last_name].filter(Boolean).join(" ") || a.username || "-";
                    const businessEmail = a.contact_email || a.email || "-";
                    return (
                      <tr key={a.id}>
                        <td>{fullName}</td><td>{businessEmail}</td><td>{a.business_name}</td>
                        <td>{a.venue_subcategory || "General"}</td>
                        <td>{a.city ? `${a.city}, ${a.region}` : "-"}</td>
                        <td>{a.venue_capacity || "-"}</td>
                        <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.pricing}</td>
                        <td><button className="approve-btn" style={{ whiteSpace: 'nowrap' }} onClick={() => setSelectedApp(a)}>View Details</button></td>
                        <td><div className="flex gap-2"><button className="approve-btn flex-1" onClick={() => handleDecision(a.id, "approve")}>Approve</button><button className="deny-btn flex-1" onClick={() => handleDecision(a.id, "deny")}>Reject</button></div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* User Management Tab */}
        {activeTab === "users" && (
          <>
            <h2 className="text-2xl font-semibold mb-6">User Management</h2>
            <div className="table-container">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Warnings</th><th>Suspension</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr><td colSpan="7" className="text-center py-4">No users found</td></tr>
                  ) : users.map((u) => {
                    const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "Unknown";
                    return (
                      <tr key={u.id}>
                        <td>{name}</td>
                        <td>{u.email}</td>
                        <td>{roleLabel(u.role)}</td>
                        {/* Warning count column */}
                        <td>
                          {u.warning_count > 0 ? (
                            <span className={`warning-badge w${Math.min(u.warning_count, 3)}`}>
                              ⚠ {u.warning_count} warning{u.warning_count > 1 ? "s" : ""}
                            </span>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        {/* Suspended days column */}
                        <td>
                          {u.suspended_at ? (
                            <span className="suspended-badge">
                              🚫 {suspendedDaysAgo(u.suspended_at)}
                            </span>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="flex gap-2 flex-wrap">
                            {u.role < 2 && <button className="approve-btn" onClick={() => changeRole(u.id, u.role, u.role + 1)}>Promote</button>}
                            {u.role > 0 && <button className="deny-btn" onClick={() => changeRole(u.id, u.role, u.role - 1)}>Demote</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Moderation / Reports Tab */}
        {activeTab === "reports" && (
          <>
            <h2 className="text-2xl font-semibold mb-6">Client Reports</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Complainant</th><th>Supplier/Venue</th>
                    <th>Booking ref</th><th>Category</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.length === 0 ? (
                    <tr><td colSpan="7" className="text-center py-4">No reports found</td></tr>
                  ) : reports.map((r) => (
                    <tr key={r.ID}>
                      <td>{new Date(r.CreatedAt).toLocaleDateString()}</td>
                      <td>
                        <div className="font-medium">{r.reporter_first_name} {r.reporter_last_name}</div>
                        <div className="text-xs text-gray-500">{r.reporter_email}</div>
                      </td>
                      <td>
                        <div className="font-medium">{r.vendor_name}</div>
                        <div className="text-xs text-gray-500">{r.vendor_email}</div>
                        {/* Warning count in table */}
                        {r.vendor_warning_count > 0 && (
                          <span className={`warning-badge w${Math.min(r.vendor_warning_count, 3)}`}>
                            ⚠ {r.vendor_warning_count} warning{r.vendor_warning_count > 1 ? "s" : ""}
                          </span>
                        )}
                        {/* Suspended badge in table */}
                        {r.vendor_suspended_at && (
                          <div className="suspended-badge mt-1">
                            🚫 {suspendedDaysAgo(r.vendor_suspended_at)}
                          </div>
                        )}
                      </td>
                      <td className="text-sm">
                        {r.ServiceName ? `${r.ServiceName}${r.EventDate ? " " + new Date(r.EventDate).toLocaleDateString() : ""}` : r.BookingID ? `#${r.BookingID}` : "—"}
                      </td>
                      <td className="capitalize">{(r.ReportReason || "").replace(/_/g, " ")}</td>
                      <td>
                        <span className={`px-2 py-1 rounded text-xs font-semibold
                          ${r.Status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                            r.Status === 'Resolved' ? 'bg-green-100 text-green-800' :
                              r.Status === 'Dismissed' ? 'bg-gray-100 text-gray-800' :
                                'bg-blue-100 text-blue-800'}`}>
                          {r.Status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <button
                          className="approve-btn text-xs px-2 py-1"
                          onClick={() => setReportModal({
                            show: true, report: r,
                            status: r.Status === "Dismissed" ? "Rejected" : r.Status,
                            notes: r.AdminNotes || ""
                          })}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Feedback Tab */}
        {activeTab === "feedback" && (
          <>
            <h2 className="text-2xl font-semibold mb-6">User Feedback</h2>
            <div className="table-container">
              <table>
                <thead><tr><th>User</th><th>Message</th><th>Date</th></tr></thead>
                <tbody>
                  {feedbacks.length === 0 ? (
                    <tr><td colSpan="3" className="text-center py-4">No feedback yet</td></tr>
                  ) : feedbacks.map((f) => {
                    const name = [f.first_name, f.last_name].filter(Boolean).join(" ") || f.username || "Unknown User";
                    return (
                      <tr key={f.id}>
                        <td>{name}</td><td>{f.message}</td>
                        <td>{new Date(f.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* Document Preview Lightbox */}
      {lightbox.show && (
        <div className="fixed inset-0 bg-black/85 z-[99999] flex items-center justify-center p-4" onClick={closeLightbox}>
          <div className="relative bg-white rounded-xl w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b bg-[#fcf9ee]">
              <h3 className="text-lg font-bold text-[#7a5d47]">{lightbox.title}</h3>
              <div className="flex items-center gap-2">
                <a href={lightbox.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs font-medium bg-[#e8ddae] hover:bg-[#dbcf9f] rounded-lg transition-colors">Open in New Tab</a>
                <button onClick={closeLightbox} className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-lg font-bold transition-colors">&times;</button>
              </div>
            </div>
            <div className="h-[80vh] w-full bg-gray-50 p-4 flex items-center justify-center overflow-hidden">
              {lightbox.isPdf ? (
                <iframe src={lightbox.url} title={lightbox.title} className="w-full h-full rounded border" />
              ) : (
                <img src={lightbox.url} alt={lightbox.title} className="w-full h-full object-contain drop-shadow-md"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentNode.innerHTML = `<div class="text-center p-8"><p class="text-gray-500 text-lg">Unable to load image</p><a href="${lightbox.url}" target="_blank" rel="noopener noreferrer" class="mt-3 inline-block px-4 py-2 bg-[#7a5d47] text-white rounded-lg text-sm hover:bg-[#5d4636]">Open URL Directly</a></div>`;
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
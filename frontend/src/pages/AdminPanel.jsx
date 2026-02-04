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
  
  // ✅ FAQ State
  const [faqs, setFaqs] = useState([]);
  const [faqLoading, setFaqLoading] = useState(false);
  const [generatingFAQs, setGeneratingFAQs] = useState(false);
  
  const [lightbox, setLightbox] = useState({ show: false, url: "", title: "", isPdf: false });
  const [confirm, setConfirm] = useState({
    show: false,
    message: "",
    label: "Confirm",
    className: "approve-btn",
    onConfirm: null,
  });

  const previewDocument = (url, title = "Document") => {
    const isPdf = url.endsWith(".pdf");
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

  // ✅ FAQ Functions
  async function loadFAQs() {
    setFaqLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/faqs`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      setFaqs(json.faqs || []);
    } catch (err) {
      console.error("Failed to load FAQs:", err);
    } finally {
      setFaqLoading(false);
    }
  }

  async function generateNewFAQs() {
    setGeneratingFAQs(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/faqs/generate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ category: 'general' })
      });
      const json = await res.json();
      
      if (json.success && json.faqs?.length > 0) {
        // Save each generated FAQ
        for (const faq of json.faqs) {
          await fetch(`${API_BASE}/api/ai/faqs`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(faq)
          });
        }
        toast.success(`Generated ${json.faqs.length} FAQs!`);
        loadFAQs();
      } else {
        toast.error('No FAQs generated');
      }
    } catch (err) {
      toast.error('Failed to generate FAQs');
    } finally {
      setGeneratingFAQs(false);
    }
  }

  async function toggleFAQPublish(faqId, currentStatus) {
    try {
      await fetch(`${API_BASE}/api/ai/faqs/${faqId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ is_published: !currentStatus })
      });
      loadFAQs();
      toast.success(currentStatus ? 'FAQ unpublished' : 'FAQ published');
    } catch (err) {
      toast.error('Failed to update FAQ');
    }
  }

  async function deleteFAQ(faqId) {
    const confirmed = await openConfirm('Are you sure you want to delete this FAQ?', 'Delete', 'deny-btn');
    if (!confirmed) return;
    
    try {
      await fetch(`${API_BASE}/api/ai/faqs/${faqId}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      loadFAQs();
      toast.success('FAQ deleted');
    } catch (err) {
      toast.error('Failed to delete FAQ');
    }
  }

  useEffect(() => {
    loadVendorApplications();
    loadUsers();
    loadFeedbacks();
  }, []);

  async function handleDecision(id, action) {
    const isApprove = action === "approve";
    const ok = await openConfirm(
      isApprove ? "Approve this application?" : "Deny this application?",
      isApprove ? "Approve" : "Deny",
      isApprove ? "approve-btn" : "deny-btn"
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

      toast.success(json.message || "Action completed successfully");
      loadVendorApplications();
    } catch (err) {
      toast.error(err.message);
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
        .lb-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 9999; }
        .lb-content { background: #fff; border-radius: 1rem; overflow: hidden; max-width: 90vw; max-height: 90vh; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        .lb-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #e8ddae; }
        .lb-close { border: none; background: transparent; font-size: 1.5rem; font-weight: bold; cursor: pointer; padding: 0 .5rem; }
        .lb-pdf { width: 80vw; height: 80vh; border: none; }
        .lb-img { max-width: 80vw; max-height: 80vh; display: block; }
        .confirm-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; }
        .confirm-card { background: #fff; padding: 1.5rem; border-radius: .75rem; width: 100%; max-width: 22rem; box-shadow: 0 10px 30px rgba(0,0,0,.25); }
        .confirm-actions { display: flex; gap: .5rem; justify-content: flex-end; margin-top: .75rem; }
        .btn-ghost { background: #e0d6c6; color: #3b2f25; border-radius: 8px; padding: .5rem .9rem; border: 1px solid #c9bda9; }
        .tab-buttons { display: flex; gap: 0.5rem; margin-bottom: 2rem; border-bottom: 2px solid #e5e5e5; flex-wrap: wrap; }
        .tab-btn { padding: 0.75rem 1.5rem; background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; font-weight: 600; color: #6b7280; transition: all 0.2s ease; }
        .tab-btn:hover { color: #1f2937; background: #f9fafb; }
        .tab-btn.active { color: #7a5d47; border-bottom-color: #7a5d47; }
        .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; margin-left: 0.5rem; }
        .badge.pending { background: #fef3c7; color: #92400e; }
        .faq-card { padding: 1rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 0.5rem; margin-bottom: 1rem; }
        .faq-card.published { background: #f0fdf4; border-color: #86efac; }
        .faq-category { padding: 0.25rem 0.5rem; background: #fef3c7; color: #92400e; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; }
        .faq-actions { display: flex; gap: 0.5rem; }
        .faq-btn { padding: 0.25rem 0.75rem; border: none; border-radius: 0.25rem; font-size: 0.75rem; cursor: pointer; }
        .faq-btn.publish { background: #16a34a; color: white; }
        .faq-btn.unpublish { background: #dc2626; color: white; }
        .faq-btn.delete { background: #fee2e2; color: #dc2626; }
      `}</style>

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

      <main className="admin-panel max-w-7xl mx-auto w-full p-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Admin Panel</h1>

        {/* ✅ TABS NAVIGATION - FAQ tab is the 5th button */}
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
          {/* ✅ NEW FAQ TAB BUTTON */}
          <button 
            className={`tab-btn ${activeTab === "faqs" ? "active" : ""}`} 
            onClick={() => { setActiveTab("faqs"); loadFAQs(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>✨</span> FAQs (AI)
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
                            {a.valid_id && (
                              <button onClick={() => previewDocument(a.valid_id, "Valid ID")} className="text-blue-600 underline text-sm mr-2">
                                ID
                              </button>
                            )}
                            {a.business_permit && (
                              <button onClick={() => previewDocument(a.business_permit, "Business Permit")} className="text-blue-600 underline text-sm mr-2">
                                Permit
                              </button>
                            )}
                            {a.portfolio_url && (
                              <a href={a.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">
                                Portfolio
                              </a>
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
                            {a.valid_id && (
                              <button onClick={() => previewDocument(a.valid_id, "Valid ID")} className="text-blue-600 underline text-sm mr-2">
                                ID
                              </button>
                            )}
                            {a.business_permit && (
                              <button onClick={() => previewDocument(a.business_permit, "Business Permit")} className="text-blue-600 underline text-sm mr-2">
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

        {/* ✅ FAQ TAB CONTENT - Shows when FAQ tab is clicked */}
        {activeTab === "faqs" && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 className="text-2xl font-semibold">FAQ Management</h2>
                <p className="text-gray-600 text-sm mt-1">Use Case UC18: AI-generated FAQs for event planning</p>
              </div>
              <button
                onClick={generateNewFAQs}
                disabled={generatingFAQs}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: generatingFAQs ? '#ccc' : 'linear-gradient(135deg, #f59e0b, #ea580c)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: '600',
                  cursor: generatingFAQs ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {generatingFAQs ? (
                  <>
                    <span style={{ 
                      width: '1rem', 
                      height: '1rem', 
                      border: '2px solid white', 
                      borderTopColor: 'transparent', 
                      borderRadius: '50%', 
                      animation: 'spin 1s linear infinite' 
                    }}></span>
                    Generating...
                  </>
                ) : (
                  <>✨ AI Generate FAQs</>
                )}
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#16a34a' }}>
                  {faqs.filter(f => f.is_published).length}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#166534' }}>Published</div>
              </div>
              <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#92400e' }}>
                  {faqs.filter(f => !f.is_published).length}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Drafts</div>
              </div>
              <div style={{ padding: '1rem', background: '#ede9fe', borderRadius: '0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#6d28d9' }}>
                  {faqs.length}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6d28d9' }}>Total FAQs</div>
              </div>
            </div>
            
            {faqLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  border: '4px solid #e8ddae',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem'
                }}></div>
                <p style={{ color: '#666' }}>Loading FAQs...</p>
              </div>
            ) : faqs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#666', background: '#f9fafb', borderRadius: '1rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
                <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>No FAQs yet</h3>
                <p style={{ marginBottom: '1rem' }}>Click "AI Generate FAQs" to create helpful Q&As for your users!</p>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                  The AI will analyze common event planning questions and generate relevant FAQs.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {faqs.map((faq) => (
                  <div 
                    key={faq.id} 
                    className={`faq-card ${faq.is_published ? 'published' : ''}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span className="faq-category">{faq.category}</span>
                      <div className="faq-actions">
                        <button
                          onClick={() => toggleFAQPublish(faq.id, faq.is_published)}
                          className={`faq-btn ${faq.is_published ? 'unpublish' : 'publish'}`}
                        >
                          {faq.is_published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          onClick={() => deleteFAQ(faq.id)}
                          className="faq-btn delete"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <h4 style={{ fontWeight: '600', marginBottom: '0.5rem', color: '#1f2937' }}>
                      Q: {faq.question}
                    </h4>
                    <p style={{ color: '#4b5563', fontSize: '0.875rem', lineHeight: '1.5' }}>
                      A: {faq.answer}
                    </p>
                    <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#9ca3af', display: 'flex', gap: '1rem' }}>
                      <span>Priority: {faq.priority || 5}</span>
                      <span>{faq.is_published ? '✅ Published' : '⏸️ Draft'}</span>
                      {faq.created_at && (
                        <span>Created: {new Date(faq.created_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

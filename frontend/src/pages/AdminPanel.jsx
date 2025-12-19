import { useEffect, useState } from "react";
import React from "react";
import "../style.css";

/* =========================
   CONFIG
========================= */
const API =
  import.meta.env.VITE_API_BASE ||
  (location.hostname.includes("vercel.app")
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

  useEffect(() => {
    const token = localStorage.getItem("solennia_token");
    const role = parseInt(localStorage.getItem("solennia_role") || "0", 10);

    if (!token || role !== 2) {
      alert("Access denied — admin only.");
      window.location.href = "/";
    }
  }, []);

  async function loadVendorApplications() {
    const res = await fetch(`${API}/admin/vendor-applications`, {
      headers: authHeaders(),
    });
    const json = await res.json();
    setApps(json.applications || []);
  }

  async function loadUsers() {
    const res = await fetch(`${API}/admin/users`, {
      headers: authHeaders(),
    });
    const json = await res.json();
    setUsers(json.users || []);
  }

  async function loadFeedbacks() {
    const res = await fetch(`${API}/admin/feedbacks`, {
      headers: authHeaders(),
    });
    const json = await res.json();
    setFeedbacks(json.feedbacks || []);
  }

  useEffect(() => {
    loadVendorApplications();
    loadUsers();
    loadFeedbacks();
  }, []);

  async function handleDecision(id, action) {
    if (!confirm(`${action === "approve" ? "Approve" : "Deny"} this application?`))
      return;

    await fetch(`${API}/admin/vendor-application/decision`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id, action }),
    });

    loadVendorApplications();
  }

  async function changeRole(user_id, role) {
    await fetch(`${API}/admin/users/role`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ user_id, role }),
    });

    loadUsers();
  }

  return (
    <main className="max-w-7xl mx-auto w-full p-6 font-[Cinzel] bg-[#f6f0e8] text-[#1c1b1a]">
      <h2 className="text-2xl font-semibold mb-6">Vendor Applications</h2>

      <div className="overflow-x-auto bg-white border rounded-xl p-4 mb-10">
        <table className="w-full border-collapse">
          <thead className="bg-[#e8ddae]">
            <tr>
              <th>Full Name</th>
              <th>Email</th>
              <th>Business</th>
              <th>Category</th>
              <th>Address</th>
              <th>Description</th>
              <th>Pricing</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id}>
                <td>{`${a.first_name || ""} ${a.last_name || ""}`}</td>
                <td>{a.contact_email || a.email}</td>
                <td>{a.business_name}</td>
                <td>{a.category}</td>
                <td>{a.address}</td>
                <td>{a.description}</td>
                <td>{a.pricing}</td>
                <td className="flex gap-2">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold mb-6">User Management</h2>

      <div className="overflow-x-auto bg-white border rounded-xl p-4 mb-10">
        <table className="w-full">
          <thead className="bg-[#e8ddae]">
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Username</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{`${u.first_name} ${u.last_name}`}</td>
                <td>{u.email}</td>
                <td>{u.username}</td>
                <td>{roleLabel(u.role)}</td>
                <td className="flex gap-2">
                  {u.role < 2 && (
                    <button
                      className="approve-btn"
                      onClick={() => changeRole(u.id, u.role + 1)}
                    >
                      Promote
                    </button>
                  )}
                  {u.role > 0 && u.role < 2 && (
                    <button
                      className="deny-btn"
                      onClick={() => changeRole(u.id, u.role - 1)}
                    >
                      Demote
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold mb-6">User Feedback</h2>

      <div className="overflow-x-auto bg-white border rounded-xl p-4">
        <table className="w-full">
          <thead className="bg-[#e8ddae]">
            <tr>
              <th>User</th>
              <th>Message</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {feedbacks.map((f) => (
              <tr key={f.id}>
                <td>{`${f.first_name || ""} ${f.last_name || ""}`}</td>
                <td>{f.message}</td>
                <td>{new Date(f.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

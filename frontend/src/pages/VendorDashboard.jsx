import { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";

const API = "/api";

export default function VendorDashboard() {
  const token = localStorage.getItem("solennia_token");

  const [vendor, setVendor] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [gallery, setGallery] = useState([]);

  const [showEdit, setShowEdit] = useState(false);
  const [showHero, setShowHero] = useState(false);
  const [showLogo, setShowLogo] = useState(false);

  const [form, setForm] = useState({
    business_name: "",
    bio: "",
    services: "",
    service_areas: "",
  });

  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  /* ================= SAFE FETCH ================= */
  async function safeFetch(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opts.headers || {}),
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || json.message || "Error");
    return json;
  }

  /* ================= LOAD DASHBOARD ================= */
  async function loadDashboard() {
    try {
      const body = await safeFetch(`${API}/vendor/dashboard`);
      setVendor(body.vendor);
      setBookings(body.bookings || []);
      setGallery(body.vendor?.gallery || []);

      if (body.insights && chartRef.current) {
        chartInstance.current?.destroy();
        chartInstance.current = new Chart(chartRef.current, {
          type: "line",
          data: body.insights,
        });
      }
    } catch (err) {
      alert(err.message);
      if (err.message.toLowerCase().includes("unauthorized")) {
        window.location.href = "/profile";
      }
    }
  }

  useEffect(() => {
    loadDashboard();
    return () => chartInstance.current?.destroy();
  }, []);

  /* ================= EDIT PROFILE ================= */
  function openEdit() {
    setForm({
      business_name: vendor.business_name || "",
      bio: vendor.bio || "",
      services: Array.isArray(vendor.services)
        ? vendor.services.join(", ")
        : vendor.services || "",
      service_areas: Array.isArray(vendor.service_areas)
        ? vendor.service_areas.join(", ")
        : vendor.service_areas || "",
    });
    setShowEdit(true);
  }

  async function submitEdit(e) {
    e.preventDefault();
    await safeFetch(`${API}/vendor/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowEdit(false);
    loadDashboard();
    alert("Profile updated!");
  }

  /* ================= UPLOAD HANDLERS ================= */
  async function uploadFile(endpoint, fileKey, file) {
    const fd = new FormData();
    fd.append(fileKey, file);
    await safeFetch(endpoint, { method: "POST", body: fd });
    loadDashboard();
  }

  async function uploadGallery(files) {
    const fd = new FormData();
    [...files].forEach((f) => fd.append("images[]", f));
    const res = await safeFetch(`${API}/vendor/upload-gallery`, {
      method: "POST",
      body: fd,
    });
    setGallery(res.gallery || []);
  }

  if (!vendor) return null;

  return (
    <>
      <main className="max-w-[1100px] mx-auto p-4">
        {/* PROFILE */}
        <section className="card flex gap-4 items-center">
          <img
            src={vendor.avatar || "/images/default-avatar.png"}
            className="w-24 h-24 rounded-full border-2 border-black object-cover bg-white"
            alt="Vendor"
          />

          <div className="flex-1">
            <h2 className="text-xl font-semibold">{vendor.business_name}</h2>
            <p className="small">{vendor.address}</p>
            <p className="small mt-2">{vendor.bio}</p>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <b>Services:</b>{" "}
                {Array.isArray(vendor.services)
                  ? vendor.services.join(", ")
                  : vendor.services}
              </div>
              <div>
                <b>Areas:</b>{" "}
                {Array.isArray(vendor.service_areas)
                  ? vendor.service_areas.join(", ")
                  : vendor.service_areas}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button className="btn-ghost" onClick={openEdit}>
              Edit Profile
            </button>
            <button className="btn-ghost" onClick={() => setShowHero(true)}>
              Upload Banner
            </button>
            <button className="btn-ghost" onClick={() => setShowLogo(true)}>
              Upload Logo
            </button>
          </div>
        </section>

        {/* DASHBOARD */}
        <section className="card mt-6">
          <h3 className="font-semibold mb-3">Dashboard</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold">Bookings Summary</h4>
              {bookings.length === 0 ? (
                <div className="small">No bookings</div>
              ) : (
                bookings.map((b, i) => (
                  <div key={i} className="small">
                    {b.title}: <b>{b.count}</b>
                  </div>
                ))
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold">Visitor Insights</h4>
              <canvas ref={chartRef} />
            </div>
          </div>
        </section>

        {/* GALLERY */}
        <section className="card mt-6">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Listings & Gallery</h3>

            <label className="btn-ghost cursor-pointer">
              Upload Gallery
              <input
                type="file"
                multiple
                accept="image/*"
                hidden
                onChange={(e) => uploadGallery(e.target.files)}
              />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
            {gallery.map((url, i) => (
              <img
                key={i}
                src={url}
                className="w-full h-[120px] object-cover rounded-lg"
                alt=""
              />
            ))}
          </div>
        </section>
      </main>

      {/* EDIT MODAL */}
      {showEdit && (
        <Modal title="Edit Vendor Profile" onClose={() => setShowEdit(false)}>
          <form onSubmit={submitEdit}>
            <Field label="Business Name">
              <input
                value={form.business_name}
                onChange={(e) =>
                  setForm({ ...form, business_name: e.target.value })
                }
                required
              />
            </Field>

            <Field label="Bio">
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </Field>

            <Field label="Services">
              <input
                value={form.services}
                onChange={(e) => setForm({ ...form, services: e.target.value })}
              />
            </Field>

            <Field label="Service Areas">
              <input
                value={form.service_areas}
                onChange={(e) =>
                  setForm({ ...form, service_areas: e.target.value })
                }
              />
            </Field>

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowEdit(false)}
              >
                Cancel
              </button>
              <button className="btn-brown">Save</button>
            </div>
          </form>
        </Modal>
      )}

      {showHero && (
        <UploadModal
          title="Upload Hero"
          onClose={() => setShowHero(false)}
          onUpload={(f) => uploadFile(`${API}/vendor/upload-hero`, "hero", f)}
        />
      )}

      {showLogo && (
        <UploadModal
          title="Upload Logo"
          onClose={() => setShowLogo(false)}
          onUpload={(f) => uploadFile(`${API}/vendor/upload-logo`, "logo", f)}
        />
      )}
    </>
  );
}

/* ================= SMALL COMPONENTS ================= */

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]">
      <div className="bg-[#f6f0e8] p-4 rounded-xl w-full max-w-[720px]">
        <h3 className="font-semibold mb-3">{title}</h3>
        {children}
        <button className="btn-ghost mt-3" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function UploadModal({ title, onUpload, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => onUpload(e.target.files[0])}
      />
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <div className="mt-3">
      <label className="block text-sm font-semibold mb-1">{label}</label>
      {children}
    </div>
  );
}

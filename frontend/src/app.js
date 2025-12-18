// src/app.js
// =====================================================
// 🔥 SOLENNIA APP — FINAL FIXED VERSION
// - data-include support RESTORED
// - header/footer/modals injection FIXED
// - profile dropdown FIXED
// - login/register CLICKABLE
// - auth backdrop pointer-events FIXED
// - firebase + hybrid auth preserved
// - feedback preserved
// =====================================================

import './style.css';

/* ============================
 * RAW PARTIALS (VITE)
 * ============================ */
import headerHTML from './partials/header.html?raw';
import footerHTML from './partials/footer.html?raw';
import modalsHTML from './partials/modals.html?raw';

/* ============================
 * FIREBASE
 * ============================ */
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";

const firebaseApp = initializeApp({
  apiKey: "AIzaSyC_GISDBsbuQK2xwQohGBUuZ8Qu1pkGggI",
  authDomain: "solennia-cafc2.firebaseapp.com",
  projectId: "solennia-cafc2",
  storageBucket: "solennia-cafc2.appspot.com",
  messagingSenderId: "1050301290248",
  appId: "1:1050301290248:web:fc6debbf4022db37d73ebd",
});
const firebaseAuth = getAuth(firebaseApp);

/* ============================
 * CONSTANTS
 * ============================ */
const API = import.meta.env.VITE_API_BASE || '/api';
const LS_TOKEN = 'solennia_token';
const LS_ROLE  = 'solennia_role';

/* ============================
 * HELPERS
 * ============================ */
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const getToken = () => localStorage.getItem(LS_TOKEN);
const isGuest  = () => localStorage.getItem('solennia_guest') === '1';

/* ============================
 * TOAST
 * ============================ */
function showToast(msg, type='info', ms=3000) {
  const c = $('#toastContainer');
  const t = $('#toast');
  if (!c || !t) return;

  t.textContent = msg;
  t.className =
    'pointer-events-auto max-w-md w-[92%] md:w-auto rounded-xl shadow-xl border px-4 py-3 text-sm ' +
    (type === 'success' ? 'bg-green-100 border-green-400 text-green-800' :
     type === 'error'   ? 'bg-red-100 border-red-400 text-red-800' :
     type === 'warning' ? 'bg-yellow-100 border-yellow-400 text-yellow-900' :
                          'bg-white border-gray-300 text-gray-900');

  c.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>c.classList.add('hidden'), ms);
}

/* =====================================================
 * 🔥 PARTIAL INJECTION
 * ===================================================== */
function resolvePartial(url) {
  if (!url) return '';
  if (url.endsWith('header.html')) return headerHTML;
  if (url.endsWith('footer.html')) return footerHTML;
  if (url.endsWith('modals.html')) return modalsHTML;
  return '';
}

async function injectDataIncludes() {
  for (const el of $$('[data-include]')) {
    const html = resolvePartial(el.getAttribute('data-include'));
    if (!html) continue;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    el.replaceWith(...wrap.childNodes);
  }
}

async function ensureHeaderFooterFallback() {
  const header = document.querySelector('header');
  const footer = document.querySelector('footer');
  if (header && header.children.length === 0) header.outerHTML = headerHTML;
  if (footer && footer.children.length === 0) footer.outerHTML = footerHTML;
}

async function ensureModalsOnce() {
  if ($('#loginModal')) return;
  const holder = document.createElement('div');
  holder.innerHTML = modalsHTML;
  document.body.appendChild(holder);
}

/* =====================================================
 * AUTH BACKDROP CONTROL (🔥 FIX)
 * ===================================================== */
function openAuthModal(modal) {
  const backdrop = $('#authBackdrop');
  backdrop?.classList.remove('hidden');
  backdrop.style.pointerEvents = 'auto';
  modal?.classList.remove('hidden');
}

function closeAuthModal() {
  const backdrop = $('#authBackdrop');
  backdrop?.classList.add('hidden');
  backdrop.style.pointerEvents = 'none';
  $('#loginModal')?.classList.add('hidden');
  $('#registerModal')?.classList.add('hidden');
}

/* =====================================================
 * PROFILE DROPDOWN (🔥 FIXED)
 * ===================================================== */
function setupProfileDropdown() {
  const btn = $('#profileBtn');
  const menu = $('#profileMenu');
  if (!btn || !menu) return;

  let open = false;

  function set(state) {
    open = typeof state === 'boolean' ? state : !open;
    menu.classList.toggle('hidden', !open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  btn.addEventListener('click', (e)=>{
    e.preventDefault();
    e.stopPropagation();
    set();
  });

  menu.addEventListener('click', e => e.stopPropagation());

  document.addEventListener('click', ()=> open && set(false));
  document.addEventListener('keydown', e => e.key === 'Escape' && set(false));
}

/* =====================================================
 * AUTH MODALS (🔥 THIS WAS MISSING)
 * ===================================================== */
function setupAuthModals() {
  $('#menuSignIn')?.addEventListener('click', (e)=>{
    e.preventDefault(); e.stopPropagation();
    openAuthModal($('#loginModal'));
  });

  $('#menuSignUp')?.addEventListener('click', (e)=>{
    e.preventDefault(); e.stopPropagation();
    openAuthModal($('#registerModal'));
  });

  $('#authBackdrop')?.addEventListener('click', closeAuthModal);
  $$('[data-close]').forEach(b => b.addEventListener('click', closeAuthModal));
}

/* =====================================================
 * AUTH UI
 * ===================================================== */
function updateAuthUI() {
  const authed = !!getToken() && !isGuest();
  const role = parseInt(localStorage.getItem(LS_ROLE) || '0', 10);

  $('#menuSignIn')?.classList.toggle('hidden', authed);
  $('#menuSignUp')?.classList.toggle('hidden', authed);
  $('#menuLogout')?.classList.toggle('hidden', !authed);
  $('#menuProfile')?.classList.toggle('hidden', !authed);
  $('#menuAdmin')?.classList.toggle('hidden', !(authed && role === 2));
}

/* =====================================================
 * AUTH LOGIC
 * ===================================================== */
function setupAuth() {
  updateAuthUI();

  $('#loginForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());

    try {
      let email = d.identifier;

      // 🔥 USERNAME → EMAIL RESOLVER
      if (!email.includes('@')) {
        const r0 = await fetch(`${API}/auth/resolve-username?u=${encodeURIComponent(email)}`);
        const j0 = await r0.json();
        if (!r0.ok) throw new Error(j0.message || 'Username not found');
        email = j0.email;
      }

      const cred = await signInWithEmailAndPassword(firebaseAuth, email, d.password);

      if (!cred.user.emailVerified) {
        showToast('Verify your email first','warning');
        return;
      }

      const r = await fetch(`${API}/auth/login`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          email: email,
          firebase_uid: cred.user.uid
        })
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j.message || 'Login failed');

      localStorage.setItem(LS_TOKEN, j.token);
      localStorage.setItem(LS_ROLE, String(j.role || 0));
      localStorage.setItem('solennia_profile', JSON.stringify(j.user || {}));
      localStorage.removeItem('solennia_guest');

      updateAuthUI();
      closeAuthModal();
      showToast('Welcome back','success');

    } catch (err) {
      showToast(err.message,'error');
    }
  });

  $('#menuLogout')?.addEventListener('click', ()=>{
    localStorage.clear();
    location.href = '/index.html';
  });
}

/* =====================================================
 * FEEDBACK
 * ===================================================== */
function setupFeedback() {
  const form = $('#feedbackForm');
  const modal = $('#feedbackModal');

  $('#footerFeedbackLink')?.addEventListener('click', (e)=>{
    e.preventDefault();
    if (!getToken()) return showToast('Login required','warning');
    modal?.classList.remove('hidden');
  });

  $('#closeFeedback')?.addEventListener('click', ()=> modal?.classList.add('hidden'));

  form?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const msg = form.querySelector('textarea')?.value.trim();
    if (!msg) return showToast('Message required','warning');

    const r = await fetch('/api/feedback', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:`Bearer ${getToken()}`
      },
      body: JSON.stringify({ message: msg })
    });

    const j = await r.json();
    if (!r.ok) return showToast(j.error || 'Failed','error');

    showToast('Feedback sent','success');
    form.reset();
    modal?.classList.add('hidden');
  });
}

/* =====================================================
 * 🧾 VENDOR APPLICATION SUBMIT (🔥 REQUIRED)
 * ===================================================== */
function setupVendorApplication() {
  const submitBtn = document.getElementById('submitVendor');
  if (!submitBtn) return;

  submitBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const form1 = document.getElementById('vendorForm1');
    const form2 = document.getElementById('vendorForm2');

    if (!form1 || !form2) return;

    if (!form1.checkValidity() || !form2.checkValidity()) {
      form1.reportValidity();
      form2.reportValidity();
      return;
    }

    const fd = new FormData(form2);

    // REQUIRED FROM STEP 1
    fd.append('business_name', form1.business_name.value);
    fd.append('category', form1.category.value);
    fd.append('address', form1.address.value);

    // 🔥 THIS IS WHAT WAS NEVER SENT BEFORE
    fd.append('contact_email', form1.contact_email.value);

    // Optional (not stored, harmless)
    fd.append('full_name', form1.full_name.value);

    try {
      const res = await fetch(`${API}/vendor/apply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`
        },
        body: fd
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Vendor application failed');

      showToast('Vendor application submitted', 'success');

      document.getElementById('vendorMedia')?.classList.add('hidden');
      document.getElementById('vendorBackground')?.classList.add('hidden');

    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

/* =====================================================
 * 🚀 BOOT
 * ===================================================== */
async function boot() {
  await injectDataIncludes();
  await ensureHeaderFooterFallback();
  await ensureModalsOnce();

  setupProfileDropdown();
  setupAuthModals();
  setupAuth();
  setupFeedback();

  setupVendorApplication(); // 🔥 ADD THIS LINE
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', boot)
  : boot();

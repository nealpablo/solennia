// src/app.js
// =====================================================
// 🔥 SOLENNIA APP — REACT-COMPATIBLE VERSION
// - HTML partial injection REMOVED
// - React partials (Header/Footer/Modals) assumed
// - Auth, Firebase, vendor flow preserved
// =====================================================

import './style.css';

/* ============================
 * FIREBASE
 * ============================ */
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

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

/* ============================
 * PROFILE DROPDOWN
 * ============================ */
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

/* ============================
 * AUTH MODALS
 * ============================ */
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

function setupAuthModals() {
  $('#menuSignIn')?.addEventListener('click', (e)=>{
    e.preventDefault();
    openAuthModal($('#loginModal'));
  });

  $('#menuSignUp')?.addEventListener('click', (e)=>{
    e.preventDefault();
    openAuthModal($('#registerModal'));
  });

  $('#authBackdrop')?.addEventListener('click', closeAuthModal);
  $$('[data-close]').forEach(b => b.addEventListener('click', closeAuthModal));
}

/* ============================
 * AUTH UI
 * ============================ */
function updateAuthUI() {
  const authed = !!getToken() && !isGuest();
  const role = parseInt(localStorage.getItem(LS_ROLE) || '0', 10);

  $('#menuSignIn')?.classList.toggle('hidden', authed);
  $('#menuSignUp')?.classList.toggle('hidden', authed);
  $('#menuLogout')?.classList.toggle('hidden', !authed);
  $('#menuProfile')?.classList.toggle('hidden', !authed);
  $('#menuAdmin')?.classList.toggle('hidden', !(authed && role === 2));
}

/* ============================
 * AUTH LOGIC
 * ============================ */
function setupAuth() {
  updateAuthUI();

  $('#loginForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());

    try {
      let email = d.identifier;

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
          email,
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

/* ============================
 * FEEDBACK
 * ============================ */
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

/* ============================
 * 🚀 BOOT
 * ============================ */
function boot() {
  setupProfileDropdown();
  setupAuthModals();
  setupAuth();
  setupFeedback();
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', boot)
  : boot();

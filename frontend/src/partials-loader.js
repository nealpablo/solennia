// src/partials-loader.js
// Inject header/footer/modals and wire universal UI.

// Import partials as raw strings (works on build & Vercel)
import headerHTML from './partials/header.html?raw';
import footerHTML from './partials/footer.html?raw';
import modalsHTML from './partials/modals.html?raw';

const PATHS = {
  header: '/partials/header.html',
  footer: '/partials/footer.html',
  modals: '/partials/modals.html',
};

function normalize(url) {
  if (!url) return '';
  return url.startsWith('/partials/') ? '/src' + url : url;
}

// Resolve API base: env > global override > production fallback > dev proxy
const API =
  (import.meta?.env?.VITE_API_BASE) ||
  (window.__API_BASE__ || null) ||
  (location.hostname.includes('vercel.app') ? 'https://solennia.up.railway.app' : '/api');

// fetchHTML returns inlined partials for our 3 files; falls back to fetch otherwise
async function fetchHTML(url) {
  const u = String(url || '');
  if (u.endsWith('/partials/header.html') || u.endsWith('/src/partials/header.html')) return headerHTML;
  if (u.endsWith('/partials/footer.html') || u.endsWith('/src/partials/footer.html')) return footerHTML;
  if (u.endsWith('/partials/modals.html')  || u.endsWith('/src/partials/modals.html'))  return modalsHTML;
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

async function injectDataIncludes() {
  const nodes = Array.from(document.querySelectorAll('[data-include]'));
  for (const el of nodes) {
    const raw = el.getAttribute('data-include') || '';
    const url = normalize(raw);
    if (!url) continue;
    try {
      const html = await fetchHTML(url);
      const wrap = document.createElement('div');
      wrap.innerHTML = html;
      el.replaceWith(...wrap.childNodes);
    } catch (e) { console.error('[partials-loader] include failed:', raw, e); }
  }
}

async function ensureHeaderFooterIfEmpty() {
  const header = document.querySelector('header');
  if (header && header.children.length === 0) {
    try { header.outerHTML = await fetchHTML(PATHS.header); } catch (e) { console.error('header inject failed', e); }
  }
  const footer = document.querySelector('footer');
  if (footer && footer.children.length === 0) {
    try { footer.outerHTML = await fetchHTML(PATHS.footer); } catch (e) { console.error('footer inject failed', e); }
  }
}

async function ensureModalsOnce() {
  if (document.getElementById('loginModal')) return;
  try {
    const html = await fetchHTML(PATHS.modals);
    const holder = document.createElement('div');
    holder.id = 'globalPartials';
    holder.innerHTML = html;
    document.body.appendChild(holder);
  } catch (e) { console.error('modals inject failed', e); }
}

function wireUniversalUI() {
  const $  = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

  // LS helpers
  const LS_TOKEN   = 'solennia_token';
  const LS_ROLE    = 'solennia_role';
  const LS_PROFILE = 'solennia_profile';

  const token = () => localStorage.getItem(LS_TOKEN);
  const role  = () => parseInt(localStorage.getItem(LS_ROLE) || '0', 10);
  const onAdminPage = () => location.pathname.endsWith('/adminpanel.html');

  // Footer year
  const fy = $('#footerYear');
  if (fy) fy.textContent = `© ${new Date().getFullYear()} Solennia. All rights reserved.`;

  // Mobile menu
  $('#mobileToggle')?.addEventListener('click', ()=> $('#mobileMenu')?.classList.toggle('hidden'));

  // Profile dropdown
  const profileBtn  = $('#profileBtn');
  const profileMenu = $('#profileMenu');
  function toggleProfileMenu(show) {
    if (!profileMenu) return;
    const willShow = (typeof show === 'boolean') ? show : profileMenu.classList.contains('hidden');
    profileMenu.classList.toggle('hidden', !willShow);
    profileBtn?.setAttribute('aria-expanded', willShow ? 'true' : 'false');
  }
  profileBtn?.addEventListener('click', (e)=>{ e.stopPropagation(); toggleProfileMenu(); });
  document.addEventListener('click', (e)=>{
    if (!profileMenu || !profileBtn) return;
    if (!profileMenu.contains(e.target) && !profileBtn.contains(e.target)) toggleProfileMenu(false);
  });
  document.addEventListener('keydown', (e)=>{ if (e.key==='Escape') toggleProfileMenu(false); });

  // Auth modals
  const authBackdrop = $('#authBackdrop');
  const loginModal   = $('#loginModal');
  const registerModal= $('#registerModal');
  const openModal = (el) => { authBackdrop?.classList.remove('hidden'); el?.classList.remove('hidden'); };
  const closeAuth = () => { authBackdrop?.classList.add('hidden'); loginModal?.classList.add('hidden'); registerModal?.classList.add('hidden'); };

  // Open login/register from dropdown
  $('#menuSignIn')?.addEventListener('click', (e)=>{ e.preventDefault(); toggleProfileMenu(false); openModal(loginModal); });
  $('#menuSignUp')?.addEventListener('click', (e)=>{ e.preventDefault(); toggleProfileMenu(false); openModal(registerModal); });
  authBackdrop?.addEventListener('click', closeAuth);
  $$('[data-close]').forEach(b => b.addEventListener('click', closeAuth));

  // Notifications
  const notifBtn = $('#notifBtn');
  const notifPanel = $('#notifPanel');
  function toggleNotif(show) {
    if (!notifPanel || !notifBtn) return;
    const willShow = typeof show === 'boolean' ? show : notifPanel.classList.contains('hidden');
    notifPanel.classList.toggle('hidden', !willShow);
    notifBtn.setAttribute('aria-expanded', willShow ? 'true' : 'false');
    if (willShow) toggleProfileMenu(false);
  }
  notifBtn?.addEventListener('click', (e)=>{ e.stopPropagation(); toggleNotif(); });
  document.addEventListener('click', (e)=>{
    if (!notifPanel || !notifBtn) return;
    if (!notifPanel.contains(e.target) && !notifBtn.contains(e.target)) toggleNotif(false);
  });
  document.addEventListener('keydown',(e)=>{ if (e.key==='Escape') toggleNotif(false); });

  // Search
  const searchBtn   = $('#searchBtn');
  const searchPanel = $('#searchPanel');
  const searchInput = $('#searchInput');
  const searchResults = $('#searchResults');
  function toggleSearch(show) {
    if (!searchPanel || !searchBtn) return;
    const willShow = typeof show === 'boolean' ? show : searchPanel.classList.contains('hidden');
    searchPanel.classList.toggle('hidden', !willShow);
    searchBtn.setAttribute('aria-expanded', willShow ? 'true' : 'false');
    if (willShow) { toggleProfileMenu(false); toggleNotif(false); setTimeout(()=>searchInput?.focus(),0); renderSearchResults(''); }
  }
  function collectSearchables() {
    const items=[]; const seen=new Set();
    document.querySelectorAll('a[href]').forEach(a=>{
      const label=(a.textContent||'').trim().replace(/\s+/g,' ');
      const href=a.getAttribute('href'); if(!label||!href) return;
      const k=label.toLowerCase()+'|'+href; if(seen.has(k)) return; seen.add(k);
      items.push({label,href});
    });
    return items;
  }
  function renderSearchResults(q){
    if(!searchResults) return;
    const query=(q||'').toLowerCase().trim();
    const items=collectSearchables();
    const matches=query?items.filter(i=>i.label.toLowerCase().includes(query)).slice(0,12):[];
    searchResults.innerHTML='';
    if(!matches.length){
      const li=document.createElement('li'); li.className='py-3 text-center text-gray-500';
      li.textContent=query?'No matches — press Enter to search vendors.':'Type to search links on this page…';
      searchResults.appendChild(li); return;
    }
    matches.forEach(i=>{
      const li=document.createElement('li'); li.className='py-2';
      const a=document.createElement('a'); a.href=i.href; a.className='block px-2 hover:bg-gray-100 rounded'; a.textContent=i.label;
      li.appendChild(a); searchResults.appendChild(li);
    });
  }
  searchBtn?.addEventListener('click', (e)=>{ e.stopPropagation(); toggleSearch(); });
  document.addEventListener('click',(e)=>{ if(!searchPanel||!searchBtn) return; if(!searchPanel.contains(e.target)&&!searchBtn.contains(e.target)) toggleSearch(false); });
  document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') toggleSearch(false); });
  searchInput?.addEventListener('input',(e)=>renderSearchResults(e.target.value));
  searchInput?.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'){
      const q=(searchInput.value||'').trim();
      const base='/index.html#gallery';
      window.location.href = q ? `${base}?q=${encodeURIComponent(q)}` : base;
      toggleSearch(false);
    }
  });

  // Footer actions
  const privacyLink  = $('#footerPrivacyPolicy');
  const termsLink    = $('#footerTermsLink');
  const feedbackLink = $('#footerFeedbackLink');
  const privacyModal = $('#privacyModal');
  const termsModal   = $('#termsModal');
  const closePrivacy = $('#closePrivacy');
  const closeTerms   = $('#closeTerms');
  const open = (el)=> el && el.classList.remove('hidden');
  const close= (el)=> el && el.classList.add('hidden');

  privacyLink?.addEventListener('click', (e)=>{ e.preventDefault(); open(privacyModal); });
  termsLink?.addEventListener('click',   (e)=>{ e.preventDefault(); open(termsModal); });
  closePrivacy?.addEventListener('click', ()=> close(privacyModal));
  closeTerms?.addEventListener('click',   ()=> close(termsModal));
  privacyModal?.addEventListener('click', (e)=>{ if(e.target===privacyModal) close(privacyModal); });
  termsModal?.addEventListener('click',   (e)=>{ if(e.target===termsModal) close(termsModal); });

  // Feedback requires login
  const feedbackModal = $('#feedbackModal');
  const closeFeedback = $('#closeFeedback');
  feedbackLink?.addEventListener('click', (e)=>{
    e.preventDefault();
    if(!token()){
      alert('You need to log in before giving feedback.');
      return;
    }
    open(feedbackModal);
  });
  closeFeedback?.addEventListener('click', ()=> close(feedbackModal));
  feedbackModal?.addEventListener('click', (e)=>{ if(e.target===feedbackModal) close(feedbackModal); });

  // -------- AUTH: Login & Register (calls backend, saves token & role) --------
  function setAuthUI() {
    const isAuthed = !!token();
    $('#menuLogout')?.classList.toggle('hidden', !isAuthed);
    $('#menuSignIn')?.classList.toggle('hidden',  isAuthed);
    $('#menuSignUp')?.classList.toggle('hidden',  isAuthed);
    ensureMenuAdmin(); // update admin item visibility after auth change
  }

  function saveProfileFromUser(user) {
    if (!user) return;
    const { first_name = '', last_name = '', username = '', email = '' } = user;
    localStorage.setItem(LS_PROFILE, JSON.stringify({ first_name, last_name, username, email }));
    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl) profileNameEl.textContent = [first_name, last_name].filter(Boolean).join(' ') || 'User';
  }

  const loginForm = $('#loginForm');
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#loginError');
    try {
      const data = Object.fromEntries(new FormData(loginForm).entries());
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(()=>({}));
      if (!res.ok || !json?.token) throw new Error(json?.error || json?.message || 'Login failed');
      localStorage.setItem(LS_TOKEN, json.token);
      localStorage.setItem(LS_ROLE,  String(json.role ?? 0));
      if (json.user) saveProfileFromUser(json.user);
      err?.classList.add('hidden');
      closeAuth();
      setAuthUI();
      alert('Welcome back!');
    } catch (ex) {
      if (err) { err.textContent = ex.message; err.classList.remove('hidden'); } else alert(ex.message);
    }
  });

  const registerForm = $('#registerForm');
  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#registerError');
    try {
      const data = Object.fromEntries(new FormData(registerForm).entries());
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(()=>({}));
      if (!res.ok || !json?.token) throw new Error(json?.error || json?.message || 'Register failed');
      localStorage.setItem(LS_TOKEN, json.token);
      localStorage.setItem(LS_ROLE,  String(json.role ?? 0));
      if (json.user) saveProfileFromUser(json.user);
      err?.classList.add('hidden');
      closeAuth();
      setAuthUI();
      alert(`Account created! Your username is ${json.username || data.username}.`);
    } catch (ex) {
      if (err) { err.textContent = ex.message; err.classList.remove('hidden'); } else alert(ex.message);
    }
  });

  // Logout
  $('#menuLogout')?.addEventListener('click', () => {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_ROLE);
    localStorage.removeItem(LS_PROFILE);
    setAuthUI();
    alert('Signed out.');
  });

  // -------- Admin Panel menu (site-wide), hidden on admin page & for non-admins --------
  function ensureMenuAdmin() {
    const root = $('#profileMenu .py-1');
    const after = $('#menuProfile');
    if (!root || !after) return;
    let item = $('#menuAdmin');
    if (!item) {
      item = document.createElement('a');
      item.id = 'menuAdmin';
      item.href = '/adminpanel.html';
      item.className = 'block px-4 py-2 text-sm hover:bg-gray-100';
      item.setAttribute('role', 'menuitem');
      item.textContent = 'Admin Panel';
      after.insertAdjacentElement('afterend', item);
    }
    const shouldShow = role() === 2 && !onAdminPage();
    item.classList.toggle('hidden', !shouldShow);
  }
  ensureMenuAdmin();
  setAuthUI(); // reflect current state on load

  // -------- Vendor flow (profile + anywhere else) --------
  const vendorTerms = $('#vendorTerms');
  const vendorBackground = $('#vendorBackground');
  const vendorMedia = $('#vendorMedia');
  function openVendorFlow() {
    if (!token()) { openModal(loginModal); return; }
    vendorTerms?.classList.remove('hidden');
  }
  $('#joinVendorBtn')?.addEventListener('click', (e)=>{ e.preventDefault(); openVendorFlow(); });
  $('#menuVendor')?.addEventListener('click', (e)=>{ e.preventDefault(); openVendorFlow(); });
  $$('[data-closevendor]').forEach(btn => btn.addEventListener('click', ()=>{
    vendorTerms?.classList.add('hidden');
    vendorBackground?.classList.add('hidden');
    vendorMedia?.classList.add('hidden');
  }));
  $('#agreeTerms')?.addEventListener('click', ()=>{
    vendorTerms?.classList.add('hidden');
    vendorBackground?.classList.remove('hidden');
  });
  $('#toMedia')?.addEventListener('click', ()=>{
    vendorBackground?.classList.add('hidden');
    vendorMedia?.classList.remove('hidden');
  });
$('#submitVendor')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    if (!token()) { openModal(loginModal); return; }

    const step1Form = $('#vendorForm1');
    const step2Form = $('#vendorForm2');

    // Build multipart payload
    const fd = new FormData();

    // text fields from step 1
    if (step1Form) {
      const s1 = new FormData(step1Form);
      for (const [k,v] of s1.entries()) fd.append(k, v);
    }
    // text fields from step 2
    if (step2Form) {
      const s2 = new FormData(step2Form);
      for (const [k,v] of s2.entries()) {
        if (k === 'permits' || k === 'gov_id' || k === 'portfolio') continue; // handle below
        fd.append(k, v);
      }
    }

    // files
    const fPermits   = $('#vendorPermits')?.files?.[0];
    const fGovId     = $('#vendorGovId')?.files?.[0];
    const fPortfolio = $('#vendorPortfolio')?.files?.[0];
    if (fPermits)   fd.append('permits', fPermits);
    if (fGovId)     fd.append('gov_id', fGovId);
    if (fPortfolio) fd.append('portfolio', fPortfolio);

    try {
      const res = await fetch(`${API}/vendor/apply`, {
        method: 'POST',
        headers: {
          // DO NOT set Content-Type for FormData; browser sets boundary
          ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        },
        body: fd,
      });
      const json = await res.json().catch(()=>({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || json?.message || 'Failed to submit application');
      }
      alert('Vendor application submitted!');
      $('#vendorMedia')?.classList.add('hidden');
    } catch (err) {
      alert(err.message || 'Something went wrong. Please try again.');
    }
  });

  // Hash route support for #vendor
  if (location.hash === '#vendor') openVendorFlow();
}

async function boot() {
  await injectDataIncludes();
  await ensureHeaderFooterIfEmpty();
  await ensureModalsOnce();
  wireUniversalUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

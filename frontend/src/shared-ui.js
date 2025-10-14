// src/partials-loader.js
// Inject header/footer/modals and wire universal UI (auth, dropdowns, search, footer, vendor flow)
// Also: add back the "Admin Panel" menu item here (site-wide), but hide it on /adminpanel.html

const PATHS = {
  header: '/src/partials/header.html',
  footer: '/src/partials/footer.html',
  modals: '/src/partials/modals.html',
};

function normalize(url) {
  if (!url) return '';
  return url.startsWith('/partials/') ? '/src' + url : url;
}

async function fetchHTML(url) {
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
    } catch (e) {
      console.error('[partials-loader] include failed:', raw, e);
    }
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
  } catch (e) {
    console.error('modals inject failed', e);
  }
}

function wireUniversalUI() {
  const $  = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const token = () => localStorage.getItem('solennia_token');
  const role  = () => parseInt(localStorage.getItem('solennia_role') || '0', 10);
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
  authBackdrop?.addEventListener('click', closeAuth);
  $$('[data-close]').forEach(b => b.addEventListener('click', closeAuth));

  // Login/Register from dropdown (ensure they always open)
  $('#menuSignIn')?.addEventListener('click', (e)=>{ e.preventDefault(); toggleProfileMenu(false); openModal(loginModal); });
  $('#menuSignUp')?.addEventListener('click', (e)=>{ e.preventDefault(); toggleProfileMenu(false); openModal(registerModal); });

  // Admin Panel item: ensure present globally, but hidden on /adminpanel.html
  (function ensureMenuAdmin() {
    // Find the profile menu root and the "Profile" anchor to insert after
    const menuRoot = $('#profileMenu .py-1');
    const afterEl  = $('#menuProfile');
    if (!menuRoot || !afterEl) return;

    let menuAdmin = $('#menuAdmin');
    if (!menuAdmin) {
      // Create the Admin Panel link if missing
      menuAdmin = document.createElement('a');
      menuAdmin.id = 'menuAdmin';
      menuAdmin.href = '/adminpanel.html';
      menuAdmin.className = 'block px-4 py-2 text-sm hover:bg-gray-100';
      menuAdmin.setAttribute('role', 'menuitem');
      menuAdmin.textContent = 'Admin Panel';
      afterEl.insertAdjacentElement('afterend', menuAdmin);
    }
    // Show only if user is admin (role===2) and NOT on the admin panel page
    const shouldShow = role() === 2 && !onAdminPage();
    menuAdmin.classList.toggle('hidden', !shouldShow);
  })();

  // Reflect auth state for SignIn/SignUp/Logout
  (function setAuthUI() {
    const isAuthed = !!token();
    $('#menuLogout')?.classList.toggle('hidden', !isAuthed);
    $('#menuSignIn')?.classList.toggle('hidden',  isAuthed);
    $('#menuSignUp')?.classList.toggle('hidden',  isAuthed);
  })();

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

  // Footer actions (Privacy, Terms, Feedback)
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

  // ===== Vendor flow (fixes "Join as a Vendor" not working on profile page) =====
  const vendorTerms = $('#vendorTerms');
  const vendorBackground = $('#vendorBackground');
  const vendorMedia = $('#vendorMedia');

  function openVendorFlow() {
    if (!token()) { openModal(loginModal); return; }
    vendorTerms?.classList.remove('hidden');
  }
  // Buttons that should open the vendor flow
  $('#joinVendorBtn')?.addEventListener('click', (e)=>{ e.preventDefault(); openVendorFlow(); });
  $('#menuVendor')?.addEventListener('click', (e)=>{ e.preventDefault(); openVendorFlow(); });

  // Step controls
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
    const step1 = $('#vendorForm1') ? Object.fromEntries(new FormData($('#vendorForm1')).entries()) : {};
    const step2 = $('#vendorForm2') ? Object.fromEntries(new FormData($('#vendorForm2')).entries()) : {};
    const payload = { ...step1, ...step2 };
    const API = (import.meta?.env?.VITE_API_BASE) || '/api';
    try {
      const res = await fetch(`${API}/vendor/apply`, {
        method:'POST',
        headers: {
          'Content-Type':'application/json',
          ...(token()?{Authorization:`Bearer ${token()}`}:{})
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(()=>({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || json?.message || 'Failed');
      alert('Vendor application submitted!');
      vendorMedia?.classList.add('hidden');
    } catch (err) {
      alert(err.message || 'Something went wrong. Please try again.');
    }
  });

  // Hash route: #vendor should open vendor flow (if present)
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

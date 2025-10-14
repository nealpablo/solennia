import './style.css';

/* ---------- OPEN MODALS FROM LANDING HASH (#login / #register / #choice / #vendor) ---------- */
window.addEventListener('load', () => {
  const hash = window.location.hash;
  const hasToken = !!localStorage.getItem('solennia_token');

  const loginModalEl = document.getElementById('loginModal');
  const registerModalEl = document.getElementById('registerModal');
  const authBackdropEl = document.getElementById('authBackdrop');

  const choiceBackdropHome = document.getElementById('choiceBackdropHome');
  const choiceModalHome = document.getElementById('choiceModalHome');

  // Auth modals
  if (hash === '#login' && loginModalEl && authBackdropEl) {
    authBackdropEl.classList.remove('hidden');
    loginModalEl.classList.remove('hidden');
  }
  if (hash === '#register' && registerModalEl && authBackdropEl) {
    authBackdropEl.classList.remove('hidden');
    registerModalEl.classList.remove('hidden');
  }

  // Choice modal (only when logged out)
  if (hash === '#choice' && choiceBackdropHome && choiceModalHome && !hasToken) {
    choiceBackdropHome.classList.remove('hidden');
    choiceModalHome.classList.remove('hidden');
  }

  // ✅ Vendor flow hash: /index.html#vendor
  // Opens vendor Terms directly if logged in; otherwise shows choice/login.
  if (hash === '#vendor') {
    const vendorTerms = document.getElementById('vendorTerms');
    const cb = () => {
      if (!hasToken) {
        // If logged out, show the choice/login path
        if (choiceBackdropHome && choiceModalHome) {
          choiceBackdropHome.classList.remove('hidden');
          choiceModalHome.classList.remove('hidden');
        } else if (authBackdropEl && loginModalEl) {
          authBackdropEl.classList.remove('hidden');
          loginModalEl.classList.remove('hidden');
        }
      } else if (vendorTerms) {
        vendorTerms.classList.remove('hidden');
      }
    };
    // Run after a tick so DOM is fully ready
    setTimeout(cb, 0);
  }
});

/* ----------------------------- NAV ----------------------------- */
const mobileToggle = document.getElementById('mobileToggle');
const mobileMenu = document.getElementById('mobileMenu');
mobileToggle?.addEventListener('click', () => mobileMenu?.classList.toggle('hidden'));

const fy = document.getElementById('footerYear');
if (fy) fy.textContent = `© ${new Date().getFullYear()} Solennia. All rights reserved.`;


/* ----------------------- NOTIFICATIONS DROPDOWN ----------------------- */
const notifBtn = document.getElementById('notifBtn');
const notifPanel = document.getElementById('notifPanel');

function toggleNotif(show) {
  if (!notifPanel || !notifBtn) return;
  const willShow = typeof show === 'boolean' ? show : notifPanel.classList.contains('hidden');
  notifPanel.classList.toggle('hidden', !willShow);
  notifBtn.setAttribute('aria-expanded', willShow ? 'true' : 'false');
  // Close profile menu if notifications open
  if (willShow) {
    const pm = document.getElementById('profileMenu');
    const pb = document.getElementById('profileBtn');
    pm?.classList.add('hidden');
    pb?.setAttribute('aria-expanded', 'false');
  }
}

notifBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleNotif();
});

// click-away & ESC to close
document.addEventListener('click', (e) => {
  if (!notifPanel || !notifBtn) return;
  if (!notifPanel.contains(e.target) && !notifBtn.contains(e.target)) {
    toggleNotif(false);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') toggleNotif(false);
});

/* ---------------------------- SEARCH DROPDOWN ---------------------------- */
const searchBtn = document.getElementById('searchBtn');
const searchPanel = document.getElementById('searchPanel');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

function toggleSearch(show) {
  if (!searchPanel || !searchBtn) return;
  const willShow = typeof show === 'boolean' ? show : searchPanel.classList.contains('hidden');
  searchPanel.classList.toggle('hidden', !willShow);
  searchBtn.setAttribute('aria-expanded', willShow ? 'true' : 'false');
  if (willShow) {
    // close other menus
    document.getElementById('profileMenu')?.classList.add('hidden');
    document.getElementById('notifPanel')?.classList.add('hidden');
    // focus input next tick
    setTimeout(() => searchInput?.focus(), 0);
    renderSearchResults(''); // clear
  }
}

searchBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSearch();
});

// close on outside click / esc
document.addEventListener('click', (e) => {
  if (!searchPanel || !searchBtn) return;
  if (!searchPanel.contains(e.target) && !searchBtn.contains(e.target)) toggleSearch(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') toggleSearch(false);
});

/* Collect page links as searchable items */
function collectSearchables() {
  const items = [];
  const seen = new Set();

  document.querySelectorAll('a[href]').forEach(a => {
    const label = (a.textContent || '').trim().replace(/\s+/g, ' ');
    const href = a.getAttribute('href');
    if (!label || !href) return;
    const key = label.toLowerCase() + '|' + href;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ label, href });
  });

  return items;
}

function renderSearchResults(q) {
  if (!searchResults) return;
  const query = (q || '').trim().toLowerCase();
  const items = collectSearchables();
  const matches = query
    ? items.filter(i => i.label.toLowerCase().includes(query)).slice(0, 12)
    : [];

  searchResults.innerHTML = '';

  if (matches.length === 0) {
    const li = document.createElement('li');
    li.className = 'py-3 text-center text-gray-500';
    li.textContent = query ? 'No matches — press Enter to search vendors.' : 'Type to search links on this page…';
    searchResults.appendChild(li);
    return;
  }

  matches.forEach(i => {
    const li = document.createElement('li');
    li.className = 'py-2';
    const a = document.createElement('a');
    a.href = i.href;
    a.className = 'block px-2 hover:bg-gray-100 rounded';
    a.textContent = i.label;
    li.appendChild(a);
    searchResults.appendChild(li);
  });
}

searchInput?.addEventListener('input', (e) => {
  renderSearchResults(e.target.value);
});

// Press Enter → jump to vendors/gallery with query in URL
searchInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const q = (searchInput.value || '').trim();
    const base = '/index.html#gallery';
    if (q) {
      // store for future use if needed
      localStorage.setItem('solennia_last_search', q);
      window.location.href = `${base}?q=${encodeURIComponent(q)}`;
    } else {
      window.location.href = base;
    }
    toggleSearch(false);
  }
});

/* ----------------------- PROFILE DROPDOWN ----------------------- */
const profileBtn = document.getElementById('profileBtn');
const profileMenu = document.getElementById('profileMenu');
const menuGreeting = document.getElementById('menuGreeting');
const menuSignIn = document.getElementById('menuSignIn');
const menuSignUp = document.getElementById('menuSignUp');
const menuVendor = document.getElementById('menuVendor');
const menuLogout = document.getElementById('menuLogout');
const menuAdmin = document.getElementById('menuAdmin'); // ✅ ADDED FOR ADMIN ROLE

function toggleMenu(show) {
  if (!profileMenu) return;
  if (typeof show === 'boolean') {
    profileMenu.classList.toggle('hidden', !show);
  } else {
    profileMenu.classList.toggle('hidden');
  }
  profileBtn?.setAttribute('aria-expanded', profileMenu.classList.contains('hidden') ? 'false' : 'true');
}

profileBtn?.addEventListener('click', () => toggleMenu());
document.addEventListener('click', (e) => {
  if (!profileMenu || !profileBtn) return;
  if (!profileMenu.contains(e.target) && !profileBtn.contains(e.target)) {
    profileMenu.classList.add('hidden');
    profileBtn.setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') toggleMenu(false);
});

// reflect auth state in menu
function setAuthUI() {
  const token = localStorage.getItem('solennia_token');
  const role = parseInt(localStorage.getItem('solennia_role') || '0', 10); // ✅ ADDED
  if (token) {
    menuLogout?.classList.remove('hidden');
    menuSignIn?.classList.add('hidden');
    menuSignUp?.classList.add('hidden');
  } else {
    if (menuGreeting) menuGreeting.textContent = 'Welcome';
    menuLogout?.classList.add('hidden');
    menuSignIn?.classList.remove('hidden');
    menuSignUp?.classList.remove('hidden');
    localStorage.removeItem('solennia_role'); // ✅ clear on logout
  }
  // ✅ Admin link
  if (menuAdmin) menuAdmin.classList.toggle('hidden', role !== 2);
}
setAuthUI();

/* -------------------------- AUTH MODALS -------------------------- */
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const backdrop = document.getElementById('authBackdrop');

function openModal(el) {
  backdrop?.classList.remove('hidden');
  el?.classList.remove('hidden');
}
function closeModals() {
  backdrop?.classList.add('hidden');
  loginModal?.classList.add('hidden');
  registerModal?.classList.add('hidden');
}
backdrop?.addEventListener('click', closeModals);
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModals));

// open login/signup from menu
menuSignIn?.addEventListener('click', () => { toggleMenu(false); openModal(loginModal); });
menuSignUp?.addEventListener('click', () => { toggleMenu(false); openModal(registerModal); });

// API base (Vite dev proxy: /api -> backend)
const API = '/api';

// helper: POST JSON (no auth header, used for auth endpoints)
async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || json?.message || 'Request failed');
  return json;
}

// 🧩 Helper to include Authorization header automatically if logged in
function authHeaders() {
  const token = localStorage.getItem('solennia_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

/* 🔥 ADDED: central helpers to cache & apply profile name across pages */
function applyProfileNameFromCache() {
  const profile = JSON.parse(localStorage.getItem('solennia_profile') || 'null');
  const full = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '';
  // Dropdown greeting
  if (menuGreeting) menuGreeting.textContent = full ? `Welcome, ${full}` : 'Welcome';
  // Profile page header
  const profileNameEl = document.getElementById('profileName');
  if (profileNameEl) profileNameEl.textContent = full || 'Guest';
}

async function refreshProfileFromServerIfNeeded() {
  const token = localStorage.getItem('solennia_token');
  if (!token) { applyProfileNameFromCache(); return; }
  try {
    const res = await fetch(`${API}/auth/me`, { headers: authHeaders() });
    const json = await res.json();
    if (res.ok && json?.success && json.user) {
      const { first_name = '', last_name = '', username = '', email = '' } = json.user;
      localStorage.setItem('solennia_profile', JSON.stringify({ first_name, last_name, username, email }));
    }
  } catch (_) {
    // ignore; fallback to whatever is cached
  } finally {
    applyProfileNameFromCache();
  }
}

/* ------------------------------ LOGIN ------------------------------ */
const loginForm = document.getElementById('loginForm');
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('loginError');
  try {
    const data = Object.fromEntries(new FormData(loginForm).entries());
    const res = await postJSON(`${API}/auth/login`, data);
    localStorage.setItem('solennia_token', res.token);
    localStorage.setItem('solennia_role', String(res.role ?? 0)); // ✅ ADDED
    await refreshProfileFromServerIfNeeded();
    err?.classList.add('hidden');
    closeModals();
    setAuthUI();
    alert('Welcome back!');
  } catch (ex) {
    if (err) {
      err.textContent = ex.message;
      err.classList.remove('hidden');
    } else alert(ex.message);
  }
});

/* ---------------------------- REGISTER ---------------------------- */
const registerForm = document.getElementById('registerForm');
registerForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('registerError');
  try {
    const data = Object.fromEntries(new FormData(registerForm).entries());
    const res = await postJSON(`${API}/auth/register`, data);
    localStorage.setItem('solennia_token', res.token);
    localStorage.setItem('solennia_role', String(res.role ?? 0)); // ✅ ADDED
    await refreshProfileFromServerIfNeeded();
    err?.classList.add('hidden');
    closeModals();
    setAuthUI();
    alert(`Account created! Your username is ${res.username}.`);
  } catch (ex) {
    if (err) {
      err.textContent = ex.message;
      err.classList.remove('hidden');
    } else alert(ex.message);
  }
});

/* ------------------------------ LOGOUT ---------------------------- */
menuLogout?.addEventListener('click', () => {
  localStorage.removeItem('solennia_token');
  localStorage.removeItem('solennia_profile');
  localStorage.removeItem('solennia_role'); // ✅ ADDED
  setAuthUI();
  applyProfileNameFromCache();
  toggleMenu(false);
  alert('Signed out.');
});

/* ---------------------- VENDOR ONBOARDING ---------------------- */
const openVendorBtnFromMenu = document.getElementById('menuVendor');
const joinVendorBtn = document.getElementById('joinVendorBtn'); // ✅ NEW: support CTA on profile & home
const vendorTerms = document.getElementById('vendorTerms');
const vendorBackground = document.getElementById('vendorBackground');
const vendorMedia = document.getElementById('vendorMedia');
const vendorClose = document.querySelectorAll('[data-closevendor]');
const agreeTerms = document.getElementById('agreeTerms');
const toMedia = document.getElementById('toMedia');
const submitVendor = document.getElementById('submitVendor');

/* Require login to open vendor flow — shared handler */
function openVendorFlow() {
  const token = localStorage.getItem('solennia_token');
  toggleMenu(false);
  if (!token) {
    alert('Please log in or register to become a vendor.');
    return;
  }
  vendorTerms?.classList.remove('hidden');
}

// ✅ Wire BOTH triggers
openVendorBtnFromMenu?.addEventListener('click', openVendorFlow);
joinVendorBtn?.addEventListener('click', openVendorFlow);

vendorClose.forEach(btn => btn.addEventListener('click', () => {
  vendorTerms?.classList.add('hidden');
  vendorBackground?.classList.add('hidden');
  vendorMedia?.classList.add('hidden');
}));
agreeTerms?.addEventListener('click', () => {
  vendorTerms?.classList.add('hidden');
  vendorBackground?.classList.remove('hidden');
});
toMedia?.addEventListener('click', () => {
  vendorBackground?.classList.add('hidden');
  vendorMedia?.classList.remove('hidden');
});

submitVendor?.addEventListener('click', (e) => {
  e.preventDefault();
  const step1Form = document.getElementById('vendorForm1');
  const step2Form = document.getElementById('vendorForm2');
  const step1 = step1Form ? Object.fromEntries(new FormData(step1Form).entries()) : {};
  const step2 = step2Form ? Object.fromEntries(new FormData(step2Form).entries()) : {};
  const payload = { ...step1, ...step2 };

  fetch(`${API}/vendor/apply`, {
    method: 'POST',
    headers: authHeaders(),          // ✅ send JWT
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || json?.message || 'Failed');
      alert('Vendor application submitted!');
      vendorMedia?.classList.add('hidden');
    })
    .catch((err) => alert(err.message || 'Something went wrong. Please try again.'));
});

/* ---------------- FEEDBACK LINK HANDLER (FOOTER) ---------------- */
const feedbackLink = document.getElementById('footerFeedbackLink');
const feedbackModal = document.getElementById('feedbackModal');
const closeFeedback = document.getElementById('closeFeedback');
const feedbackForm = document.getElementById('feedbackForm');

feedbackLink?.addEventListener('click', (e) => {
  e.preventDefault();
  const token = localStorage.getItem('solennia_token');
  if (!token) {
    alert('You need to log in before giving feedback.');
    return;
  }
  feedbackModal?.classList.remove('hidden');
});

closeFeedback?.addEventListener('click', () => {
  feedbackModal?.classList.add('hidden');
});

feedbackForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = Object.fromEntries(new FormData(feedbackForm).entries());

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: authHeaders(),        // ✅ send JWT
      body: JSON.stringify(formData),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Failed to send feedback');
    alert('Thank you for your feedback!');
    feedbackModal?.classList.add('hidden');
    feedbackForm.reset();
  } catch (err) {
    alert(err.message || 'Error sending feedback');
  }
});

/* ------------------- CHOICE MODAL (HOME) LOGIC ------------------- */
const choiceBackdropHome = document.getElementById('choiceBackdropHome');
const choiceModalHome = document.getElementById('choiceModalHome');
const choiceCloseHome = document.getElementById('choiceCloseHome');
const choiceLoginHome = document.getElementById('choiceLoginHome');
const choiceRegisterHome = document.getElementById('choiceRegisterHome');
const choiceExploreHome = document.getElementById('choiceExploreHome');

function openChoiceHome() {
  choiceBackdropHome?.classList.remove('hidden');
  choiceModalHome?.classList.remove('hidden');
}
function closeChoiceHome() {
  choiceBackdropHome?.classList.add('hidden');
  choiceModalHome?.classList.add('hidden');
}
choiceBackdropHome?.addEventListener('click', closeChoiceHome);
choiceCloseHome?.addEventListener('click', closeChoiceHome);

choiceLoginHome?.addEventListener('click', () => {
  closeChoiceHome();
  openModal(loginModal);
});
choiceRegisterHome?.addEventListener('click', () => {
  closeChoiceHome();
  openModal(registerModal);
});
choiceExploreHome?.addEventListener('click', () => {
  closeChoiceHome();
});


/* ================== AUTO-SCROLLING CAROUSEL ================== */
(() => {
  const container = document.getElementById('carousel');
  const track = document.getElementById('carouselTrack');
  if (!container || !track) return;

  // Duplicate once so we can loop seamlessly
  track.innerHTML += track.innerHTML;

  // ~30px/sec (tweak as needed)
  const pxPerMs = 0.082;

  // We'll compute loopWidth after layout
  let loopWidth = 0;
  let last = performance.now();
  let pausedUntil = 0;

  // Ensure container is ready to scroll horizontally
  container.style.overflowX = 'auto';

  function computeLoopWidth() {
    // We duplicated once, so half the track width is the loop segment
    loopWidth = track.scrollWidth / 2;
  }

  // Recompute after images have likely laid out
  computeLoopWidth();
  // Also recompute on resize (safer on responsive)
  window.addEventListener('resize', computeLoopWidth);

  function loop(now) {
    const dt = now - last;
    last = now;

    if (loopWidth > 0 && now > pausedUntil) {
      let next = container.scrollLeft + pxPerMs * dt;

      // When we pass the first segment, wrap around seamlessly
      if (next >= loopWidth) {
        next -= loopWidth;
      }
      container.scrollLeft = next;
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Click any image to center it; pause auto-scroll briefly so user can view it
  track.querySelectorAll('img').forEach((img) => {
    img.addEventListener('click', () => {
      pausedUntil = performance.now() + 2000; // 2s pause after click
      const target = img.offsetLeft + img.offsetWidth / 2 - container.clientWidth / 2;
      container.scrollTo({ left: target, behavior: 'smooth' });
    });
  });

  // NOTE: Removed mouseenter/mouseleave pause so it ALWAYS moves.
})();


/* 🔥 ADDED: apply cached name on first load, then refresh from server if logged in */
applyProfileNameFromCache();
refreshProfileFromServerIfNeeded();

if (json.user.role === 2) {
  const menuProfile = document.getElementById('menuProfile');
  if (menuProfile) {
    const adminLink = document.createElement('a');
    adminLink.href = '/adminpanel.html';
    adminLink.textContent = 'Admin Panel';
    adminLink.className = 'block px-4 py-2 text-sm hover:bg-gray-100';
    menuProfile.insertAdjacentElement('afterend', adminLink);
  }
}

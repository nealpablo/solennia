import './style.css';

// If already logged in, don't stay on landing.
try {
  const token = localStorage.getItem('solennia_token');
  if (token) {
    window.location.replace('/');
  }
} catch (_) {}

// Footer year (optional element)
const y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();

// Build (hidden) modal for continue-as-guest
const modal = document.createElement('div');
modal.id = 'guestModal';
modal.className = 'fixed inset-0 bg-black/40 z-[300] hidden items-center justify-center';
modal.innerHTML = `
  <div class="bg-[#f6f0e8] rounded-2xl shadow-xl border border-gray-300 p-6 w-full max-w-md text-center">
    <h2 class="text-xl font-semibold">Continue as Guest?</h2>
    <p class="text-sm mt-2 text-gray-700">You can browse Solennia freely, or log in for a personalized experience.</p>
    <div class="mt-6 flex justify-center gap-3">
      <button id="guestContinue" class="px-5 py-2 rounded-md bg-[#e8ddae] hover:bg-[#dbcf9f]">Continue as Guest</button>
      <a id="guestLogin" class="px-5 py-2 rounded-md bg-[#7a5d47] text-white hover:opacity-90" href="/index.html#login">Login / Register</a>
    </div>
  </div>
`;
document.body.appendChild(modal);

// Get Started button → open modal
const btn = document.getElementById('btnGetStarted');
if (btn) {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  });
}

// Modal interactions
const guestContinue = document.getElementById('guestContinue');
guestContinue?.addEventListener('click', () => {
  try {
    // Set bypass so root redirect allows guests in
    localStorage.setItem('solennia_guest', '1');
  } catch (_) {}
  // Go to root (index)
  window.location.href = '/';
});

// Close modal on backdrop click (optional)
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
});

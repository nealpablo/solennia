import './partials-loader.js';
import './style.css';

// Footer year
const y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();

// Get Started → respect logged-in state, else show choice modal
const token = localStorage.getItem('solennia_token');
const btn = document.getElementById('btnGetStarted');
if (btn) {
  btn.setAttribute('href', token ? '/index.html' : '/index.html#choice');
}

// Also show a lightweight guest prompt on landing (only if logged out)
if (!token) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/40 z-[300] flex items-center justify-center';
  modal.innerHTML = `
    <div class="bg-[#f6f0e8] rounded-2xl shadow-xl border border-gray-300 p-6 w-full max-w-md text-center">
      <h2 class="text-xl font-semibold">Continue as Guest?</h2>
      <p class="text-sm mt-2 text-gray-700">You can browse Solennia freely, or log in for a personalized experience.</p>
      <div class="mt-6 flex justify-center gap-3">
        <a id="guestContinue" class="px-5 py-2 rounded-md bg-[#e8ddae] hover:bg-[#dbcf9f]" href="/index.html">Continue as Guest</a>
        <a id="guestLogin" class="px-5 py-2 rounded-md bg-[#7a5d47] text-white hover:opacity-90" href="/index.html#login">Login / Register</a>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

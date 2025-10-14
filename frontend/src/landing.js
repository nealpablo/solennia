import './style.css'; // ensures Tailwind applies on landing

// footer year
const y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();

// If already logged in, skip the #choice modal and go straight to home
const token = localStorage.getItem('solennia_token');
const btn = document.getElementById('btnGetStarted');

// ✅ Updated: always use absolute path for reliability
if (btn) {
  btn.setAttribute('href', token ? '/index.html' : '/index.html#choice');
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./landing.html",              // include landing so Tailwind scans it
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

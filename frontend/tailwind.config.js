// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Centaur for body text (elegant serif)
        'centaur': ['Centaur', 'EB Garamond', 'Georgia', 'serif'],
        
        // Cinzel for headers (decorative serif)
        'cinzel': ['Cinzel', 'serif'],
      },
    },
  },
  plugins: [],
}
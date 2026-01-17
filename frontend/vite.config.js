import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ✅ Backend URL - default to Railway
const BACKEND = process.env.VITE_BACKEND_URL || "https://solennia.up.railway.app";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      "/api": {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
        // Add timeout to handle slow Railway responses
        timeout: 30000,
      },
    },
  },
  // Optimize for Railway connection
  optimizeDeps: {
    exclude: []
  }
});
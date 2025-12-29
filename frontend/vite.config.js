import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ✅ Backend URL (Railway)
const BACKEND =
  process.env.NODE_ENV === "production"
    ? "https://solennia.up.railway.app"
    : (process.env.VITE_BACKEND_URL || "http://127.0.0.1:3000");

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
      },
    },
  },
});

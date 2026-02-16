import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

//  Use local backend in development, Railway in production
const BACKEND = process.env.NODE_ENV === 'production' 
  ? "https://solennia.up.railway.app"
  : "http://localhost:8000"; // Your local PHP server

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
        timeout: 30000,
      },
    },
  },
  optimizeDeps: {
    exclude: []
  }
});
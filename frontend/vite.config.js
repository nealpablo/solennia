import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ✅ Use Railway in production, localhost in dev
const BACKEND =
  process.env.NODE_ENV === 'production'
    ? 'https://solennia.vercel.app'
    : (process.env.VITE_BACKEND_URL || 'http://127.0.0.1:3000');

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[vite-proxy] error:', err?.message || err);
          });
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('[vite-proxy] →', req.method, req.url, '=>', BACKEND);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log('[vite-proxy] ←', req.method, req.url, proxyRes.statusCode);
          });
        },
      },
    },
  },
});

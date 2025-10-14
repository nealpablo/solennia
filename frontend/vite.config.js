import { defineConfig } from 'vite';
import { resolve } from 'path';

// ✅ Use Railway in production, localhost in dev
const BACKEND =
  process.env.NODE_ENV === 'production'
    ? 'https://solennia-henna.vercel.app'
    : (process.env.VITE_BACKEND_URL || 'http://127.0.0.1:3000');

export default defineConfig({
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err, _req, _res) => {
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
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        landing: resolve(__dirname, 'landing.html'),
        profile: resolve(__dirname, 'profile.html'),
        aboutus: resolve(__dirname, 'aboutus.html'),
        adminpanel: resolve(__dirname, 'adminpanel.html'),
      },
    },
  },
});

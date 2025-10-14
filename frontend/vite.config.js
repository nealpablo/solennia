// frontend/vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
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

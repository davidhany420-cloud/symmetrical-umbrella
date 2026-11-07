import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// Two apps from one codebase, sharing the same data layer:
//   index.html  → تطبيق الركاب والكباتن
//   admin.html  → لوحة الإدارة
export default defineConfig({
  // relative paths so the site works under any folder (e.g. GitHub Pages)
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, 'index.html'),
        admin: path.resolve(__dirname, 'admin.html'),
      },
    },
  },
});

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        solutions: resolve(__dirname, 'solutions/index.html'),
        industries: resolve(__dirname, 'industries/index.html'),
        pricing: resolve(__dirname, 'pricing/index.html'),
        contact: resolve(__dirname, 'contact/index.html'),
      },
    },
  },
});

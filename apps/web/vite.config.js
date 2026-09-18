import { defineConfig } from 'vite';

const proxy = {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
  '/health': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
  '/ready': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
};

export default defineConfig({
  server: {
    port: 5173,
    proxy,
  },
  preview: {
    host: '127.0.0.1',
    port: 8080,
    strictPort: true,
    proxy,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});

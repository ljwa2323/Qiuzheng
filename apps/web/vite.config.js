import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3000';
  const base = env.VITE_BASE_PATH || '/';
  const allowedHosts = env.VITE_ALLOWED_HOSTS
    ? env.VITE_ALLOWED_HOSTS.split(',').map((h) => h.trim()).filter(Boolean)
    : true;

  const proxy = {
    '/api': {
      target: apiTarget,
      changeOrigin: true,
    },
    '/health': {
      target: apiTarget,
      changeOrigin: true,
    },
    '/ready': {
      target: apiTarget,
      changeOrigin: true,
    },
  };

  return {
    base,
    server: {
      port: 5173,
      proxy,
    },
    preview: {
      host: '127.0.0.1',
      port: Number(env.VITE_PREVIEW_PORT || 8080),
      strictPort: true,
      allowedHosts,
      proxy,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});

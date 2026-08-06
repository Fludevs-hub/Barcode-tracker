import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const API_TARGET = 'http://localhost:3000';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || API_TARGET;

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Barcode Tracker',
          short_name: 'Barcodes',
          description: 'Track barcode batches and their serial sequence, with role-based access.',
          theme_color: '#EEF2F7',
          background_color: '#EEF2F7',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
        workbox: {
          runtimeCaching: [{ urlPattern: /\/api\//i, handler: 'NetworkOnly' }],
        },
      }),
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
      },
    },
  };
});

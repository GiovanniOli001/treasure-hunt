import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/*.svg', 'assets/*.png'],
      manifest: {
        name: 'Treasure Hunt - Transportme',
        short_name: 'Treasure Hunt',
        description: 'Drop your pin. Win the prize!',
        theme_color: '#0a1628',
        background_color: '#0a1628',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/assets/Transportme UPLIFT LOGO 2025_pin.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/assets/Transportme UPLIFT LOGO 2025_pin.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*basemaps\.cartocdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});

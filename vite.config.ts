import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// base is pinned to the GitHub Pages path (resolves vite-plugin-pwa scope bugs #156/#656).
export default defineConfig({
  base: '/music-jungle/',
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Music Jungle',
        short_name: 'Music Jungle',
        description: 'Explore a jungle and discover the instrument families!',
        theme_color: '#1b5e20',
        background_color: '#0d2818',
        display: 'fullscreen',
        orientation: 'landscape',
        start_url: '/music-jungle/',
        scope: '/music-jungle/',
        icons: [
          { src: '/music-jungle/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/music-jungle/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/music-jungle/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,glb,mp3,m4a,json,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/music-jungle/index.html',
      },
    }),
  ],
});

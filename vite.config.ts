import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'FLOW — Suivi financier',
        short_name: 'FLOW',
        description: 'Suivi des dépenses et revenus, perso et pro. Offline-first.',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0b0f',
        theme_color: '#0b0b0f',
        start_url: '/',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Raccourcis au appui long sur l'icône (Android, et macOS/iPadOS récents).
        shortcuts: [
          { name: 'Ajouter une dépense', short_name: 'Ajouter', url: '/mouvements?nouveau=1' },
          { name: 'Scanner une facture', short_name: 'Scanner', url: '/mouvements?scan=1' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Le moteur OCR représente plusieurs mégaoctets : le précharger
        // ferait payer à tout le monde une fonction que peu utiliseront.
        globIgnores: ['**/ocr/**'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // Le moteur OCR pèse quelques mégaoctets : on le met en cache à la
        // première utilisation plutôt que de le précharger au démarrage.
        runtimeCaching: [
          {
            urlPattern: /\/ocr\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'flow-ocr',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            urlPattern: /^https:\/\/tessdata\.projectnaptha\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'flow-ocr-lang',
              expiration: { maxEntries: 6, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})

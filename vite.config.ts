/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Version affichée sur « État du système » et jointe aux erreurs : le commit en CI, sinon « dev ».
const release = process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev'

export default defineConfig({
  define: { __APP_RELEASE__: JSON.stringify(release), __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()) },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Coquille de l'app en cache ; les données hors ligne (outbox) arrivent au lot 5.
      // push-sw.js ajoute la réception des notifications (lot 10).
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], globIgnores: ['screenshots/**'], navigateFallback: '/index.html', importScripts: ['push-sw.js'] },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      // Manifeste complet pour l'installation et l'APK (lot 9, voir docs/LOT-09.md). `id` ne doit
      // plus changer : Android s'en sert pour reconnaître l'app installée.
      manifest: {
        id: '/',
        name: 'OhO',
        short_name: 'OhO',
        description: 'Nos outils, à deux : courses, voyages, films et dépenses partagées.',
        lang: 'fr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0a2540',
        background_color: '#ffffff',
        categories: ['lifestyle', 'productivity', 'shopping', 'travel'],
        prefer_related_applications: false,
        launch_handler: { client_mode: ['navigate-existing', 'auto'] },
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-monochrome-512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
        ],
        // Appui long sur l'icône : un outil directement.
        shortcuts: [
          { name: 'Courses', url: '/courses', icons: [{ src: 'pwa-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Agenda', url: '/agenda', icons: [{ src: 'pwa-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Voyages', url: '/voyages', icons: [{ src: 'pwa-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'À regarder', url: '/a-regarder', icons: [{ src: 'pwa-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Dépenses', url: '/depenses', icons: [{ src: 'pwa-192.png', sizes: '192x192', type: 'image/png' }] },
        ],
        // Générées par `npm run screenshots` sur les données du seed.
        screenshots: [
          { src: 'screenshots/courses.png', sizes: '1082x2202', type: 'image/png', form_factor: 'narrow', label: 'La liste de courses, rangée par rayon' },
          { src: 'screenshots/voyage.png', sizes: '1082x2202', type: 'image/png', form_factor: 'narrow', label: 'Un voyage : idées, checklist, réservations et budget' },
          { src: 'screenshots/a-regarder.png', sizes: '1082x2202', type: 'image/png', form_factor: 'narrow', label: 'Les films et séries à regarder ensemble' },
          { src: 'screenshots/depenses.png', sizes: '1082x2202', type: 'image/png', form_factor: 'narrow', label: 'Les dépenses partagées et qui doit quoi' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/*.test.ts'],
  },
})

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // Deliberately NO precache manifest. Precaching is what made two
        // correct deploys look broken: workbox served the previous index.html
        // out of `workbox-precache-v2` indefinitely, so the app kept booting an
        // old bundle until the user cleared site data. Runtime caching alone
        // gives the same offline reach without a manifest that can pin a stale
        // shell.
        globPatterns: [],
        navigateFallback: null,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // The HTML shell: always ask the network first, so a new deploy is
            // picked up the moment there's a connection. The cached copy is a
            // fallback for being offline, never the default.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-shell',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 1 },
              plugins: [
                {
                  // Netlify rewrites every path to the same index.html, so
                  // storing per-URL would cache identical copies and — worse —
                  // leave a deep link like /rules uncached until it had been
                  // visited online. One fixed key means any route opened
                  // offline finds the shell.
                  cacheKeyWillBeUsed: async () => new Request(new URL('/', self.location.origin).href),
                },
              ],
            },
          },
          {
            // Built assets carry a content hash, so a given URL's contents can
            // never change — safe to serve from cache first. A new deploy
            // requests new filenames, which simply miss and fetch.
            urlPattern: ({ url, request }) =>
              url.origin === self.location.origin &&
              /\/assets\//.test(url.pathname) &&
              (request.destination === 'script' || request.destination === 'style'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-assets',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: ({ request }) =>
              request.destination === 'font' || request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-media',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
        // Supabase is explicitly not cached: warbands, campaigns and battles
        // must never be served from a stale copy, and the app already shows a
        // connection banner when a call fails.
        navigationPreload: false,
      },
      manifest: {
        name: 'Mordheim Campaign Manager',
        short_name: 'Mordheim',
        description: 'Warband and campaign manager for Mordheim, including Border Town Burning.',
        start_url: '/',
        display: 'standalone',
        background_color: '#0b0a09',
        theme_color: '#0b0a09',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
});

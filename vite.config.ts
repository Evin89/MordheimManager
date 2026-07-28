import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Installability only — no service worker, so no precache (spec §2).
      //
      // Precaching an app shell made sense when warbands lived in
      // localStorage. Since the move to Supabase every screen that shows your
      // data needs the network anyway, so the cache bought nothing and cost
      // real confusion: a deploy would land on Netlify while the old bundle
      // kept being served from `workbox-precache-v2`, making a correct release
      // look broken until the user cleared site data. `injectRegister: null`
      // stops the registration script being emitted; `selfDestroying` ships a
      // worker whose only job is to unregister itself and delete its caches,
      // which is what frees the browsers that already have one installed.
      selfDestroying: true,
      injectRegister: null,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
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

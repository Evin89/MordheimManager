import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Stamped into the bundle so an issue report says which build it came from.
//
// Every host names this differently, and getting it wrong fails silently — the
// build succeeds and simply reports "dev", which is precisely the case where
// knowing the build mattered. Verified against the live deploy rather than
// assumed: Workers Builds sets WORKERS_CI_COMMIT_SHA, and reading only Pages'
// CF_PAGES_COMMIT_SHA stamped the first Cloudflare deploy as "dev".
//
// Locally there is no commit at all, and "dev" is then the honest answer rather
// than a fake hash.
const COMMIT =
  process.env.WORKERS_CI_COMMIT_SHA ?? // Cloudflare Workers Builds — this deploy
  process.env.CF_PAGES_COMMIT_SHA ?? // Cloudflare Pages
  process.env.COMMIT_REF ?? // Netlify
  process.env.GITHUB_SHA ?? // GitHub Actions
  'dev';
const APP_VERSION = `${pkg.version}+${COMMIT.slice(0, 7)}`;

/** Without these the app cannot reach its database at all. */
const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

/**
 * Refuses to produce a build that cannot work.
 *
 * `import.meta.env` is substituted here, at compile time, so a value supplied
 * only to the *running* host arrives far too late — and the build then succeeds,
 * uploads, and serves an app with no database. That is not a hypothetical: it is
 * how the first Cloudflare deploy went out.
 *
 * The failure is worse than it sounds, because a build missing these produces a
 * byte-identical bundle to the last one that was also missing them — same
 * content, same hash. From the outside, "the build never ran" and "the build ran
 * and still could not see the variables" are indistinguishable. Failing here
 * collapses the two: either the deploy is good, or the build log says exactly
 * which variable was absent.
 *
 * `vite dev` is exempt — a contributor should be able to start the app and read
 * the rules without an account. `ALLOW_UNCONFIGURED_BUILD=1` is the deliberate
 * escape hatch, used to exercise the StartupError screen itself.
 */
function assertConfigured(env: Record<string, string>) {
  const missing = REQUIRED_ENV.filter((key) => !env[key]);
  if (missing.length === 0 || env.ALLOW_UNCONFIGURED_BUILD) return;

  throw new Error(
    [
      '',
      `Refusing to build: ${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} not set.`,
      '',
      'These are substituted into the bundle at build time, so they must be set as',
      'BUILD variables, not as the host\'s runtime variables/secrets:',
      '',
      '  Cloudflare Workers  Settings -> Build -> Build variables and secrets',
      '  Netlify             Site configuration -> Environment variables',
      '  Locally             copy .env.example to .env.local',
      '',
      'Set ALLOW_UNCONFIGURED_BUILD=1 to build anyway (the app will render its',
      '"Not configured" screen instead of starting).',
      '',
    ].join('\n'),
  );
}

export default defineConfig(({ command, mode }) => {
  // Third argument '' loads every variable, not just the VITE_-prefixed ones, so
  // the escape hatch above is visible here too.
  const env = loadEnv(mode, process.cwd(), '');
  if (command === 'build') assertConfigured(env);

  return {
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
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
            // Warbands, campaigns and battles must never come from a stale
            // copy. Nothing below would match a Supabase call today, but this
            // is stated as a rule rather than left to the absence of one — the
            // font/image rule below matches on `destination` alone, and the
            // moment model photos (spec §11) are served from Supabase Storage
            // that would start quietly caching private images.
            urlPattern: ({ url }) =>
              url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in'),
            handler: 'NetworkOnly',
          },
          {
            // Scoped to our own origin and the Google Fonts CDN. Matching on
            // `destination` alone would reach any host that serves an image.
            urlPattern: ({ url, request }) =>
              (url.origin === self.location.origin ||
                url.hostname === 'fonts.gstatic.com' ||
                url.hostname === 'fonts.googleapis.com') &&
              (request.destination === 'font' || request.destination === 'image'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-media',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
        navigationPreload: false,
      },
      manifest: {
        name: 'Mordheim Campaign Manager',
        short_name: 'Mordheim',
        description: 'Warband and campaign manager for Mordheim, including Border Town Burning.',
        // Opens the app, not the marketing landing at `/`. `scope` keeps the
        // installed PWA's navigation inside /app, so a tap that would leave it
        // (a link to the landing) opens in the browser instead.
        start_url: '/app',
        scope: '/app',
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
  };
});

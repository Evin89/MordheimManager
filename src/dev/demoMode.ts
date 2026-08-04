/**
 * Demo mode: fills the app with fabricated data so the screens can be judged at
 * realistic volume.
 *
 * Every read goes to a generated in-memory set instead of Supabase, and every
 * write stays in memory. Nothing reaches the database — a hundred warbands and
 * fifty players seeded into the live project would sit in the same tables as the
 * real campaign, surface in other players' standings and in the public gallery,
 * and take a careful cleanup pass to undo.
 *
 * Only available in `npm run dev`. The check is `import.meta.env.DEV`, which
 * Vite replaces with the literal `false` in a production build, so the guard —
 * and everything behind it — is dropped at build time rather than merely being
 * unreachable at runtime.
 */

const STORAGE_KEY = 'mordheim.demoMode';

/** Read once at module load: flipping this mid-session would leave React Query
 * holding a mix of real and fabricated rows. Toggling reloads the page instead. */
let enabled = false;

if (import.meta.env.DEV) {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('demo');
  if (fromUrl === '1' || fromUrl === 'on') localStorage.setItem(STORAGE_KEY, 'on');
  if (fromUrl === '0' || fromUrl === 'off') localStorage.removeItem(STORAGE_KEY);
  enabled = localStorage.getItem(STORAGE_KEY) === 'on';
}

export function isDemoMode(): boolean {
  return import.meta.env.DEV && enabled;
}

export function setDemoMode(on: boolean): void {
  if (!import.meta.env.DEV) return;
  if (on) localStorage.setItem(STORAGE_KEY, 'on');
  else localStorage.removeItem(STORAGE_KEY);
  // Drop the ?demo= parameter so a reload doesn't switch it straight back on.
  window.location.href = window.location.pathname;
}

import { createClient } from '@supabase/supabase-js';
import { isDemoMode } from '../dev/demoMode';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Which required variables are missing, empty when correctly configured.
 *
 * This used to `throw` right here, at module load. That is the right instinct —
 * fail immediately rather than limp on — but it produced the worst possible
 * symptom: the throw happened before React mounted, so the deployed app was a
 * black rectangle with the explanation only in the console. The first Cloudflare
 * deploy shipped exactly that, and from the outside it was indistinguishable
 * from a broken build.
 *
 * So the check reports instead, and `main.tsx` renders it. A configuration
 * mistake should say what it is on the page, in front of the person who can fix
 * it, not in a place they have to know to look.
 */
export const missingConfig: string[] = [
  ...(url ? [] : ['VITE_SUPABASE_URL']),
  ...(anonKey ? [] : ['VITE_SUPABASE_ANON_KEY']),
];

/**
 * The client stays a real, correctly-typed client in every case, so the fifty-odd
 * modules that import it need no null handling for a state none of them can do
 * anything about.
 *
 * When configuration is missing it is built from placeholders and never used:
 * `main.tsx` renders the error screen instead of the app, so nothing ever calls
 * it. The placeholder host is deliberately unroutable rather than a plausible
 * address — if this is ever reached through some path that skips the guard, the
 * failure should be an obvious local error, not a request to a real machine.
 */
export const supabase = createClient(
  url ?? 'http://supabase-not-configured.invalid',
  anonKey ?? 'missing-anon-key',
  isDemoMode()
    ? {
        /*
         * Demo mode promises that nothing reaches the database, and until now
         * that was very slightly untrue: the client refreshes any session it
         * finds in localStorage the moment it is constructed, before a single
         * screen renders and regardless of the demo branch in AuthProvider. A
         * leftover session from real testing on the same origin therefore fired
         * a token refresh at the live project on every demo page load — usually
         * a 400, since it had long expired.
         *
         * Harmless in effect, misleading in a console: it is exactly the sort of
         * red herring that costs twenty minutes while debugging something else.
         */
        auth: { persistSession: false, autoRefreshToken: false },
      }
    : undefined,
);

/**
 * §26.4.1 — first-run landing.
 *
 * A sign-in by someone who owns no warbands yet should land on warband creation,
 * not a Home screen full of empty shells. "A sign-in" is the moment, not every
 * visit to Home: the flag is set where a sign-in actually starts (password,
 * Google — whose redirect returns to this same tab, so sessionStorage survives
 * it — and a signup that comes back with a session) and consumed once by Home,
 * which is where every sign-in lands unless it was returning somewhere specific.
 *
 * Per-tab convenience state, so sessionStorage, wrapped in try/catch: a private
 * window that throws simply loses the redirect and shows Home as before.
 */

const KEY = 'mordheim.freshSignIn';

export function markFreshSignIn(): void {
  try {
    window.sessionStorage.setItem(KEY, '1');
  } catch {
    /* storage unavailable — the redirect is a nicety */
  }
}

/** Read-and-clear: true only for the first Home render after a sign-in. */
export function consumeFreshSignIn(): boolean {
  try {
    const fresh = window.sessionStorage.getItem(KEY) === '1';
    if (fresh) window.sessionStorage.removeItem(KEY);
    return fresh;
  } catch {
    return false;
  }
}

/** For a sign-in that returns the user to a specific page instead of Home: that
 * destination wins, and the flag must not ambush a later, unrelated Home visit. */
export function clearFreshSignIn(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

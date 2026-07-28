/**
 * Removes the service worker and precache this app used to ship.
 *
 * Precaching an app shell made sense when warbands lived in localStorage. Since
 * the move to Supabase every screen showing your data needs the network anyway,
 * so the cache bought nothing and cost real confusion: a deploy would land while
 * the old bundle kept being served out of `workbox-precache-v2`, making a
 * correct release look broken until the user cleared site data.
 *
 * The build now ships a self-destroying worker, which browsers pick up on their
 * next update check. That handles the registration, but its cache cleanup runs
 * outside `event.waitUntil`, so the worker can be terminated before the deletes
 * finish and the storage is left behind. This runs from the page instead, where
 * nothing can cut it short.
 *
 * Safe to keep running indefinitely: it only acts when there is something to
 * remove, and a page with no controller never reads Cache Storage anyway — the
 * leftovers are wasted disk, not a source of stale content.
 */
export async function clearLegacyServiceWorker(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window) {
      const names = await caches.keys();
      // Scoped to the caches workbox created. Deleting everything would be
      // overreach — another tool may legitimately own a cache on this origin.
      await Promise.all(names.filter((name) => name.startsWith('workbox-')).map((name) => caches.delete(name)));
    }
  } catch {
    // Storage APIs can be unavailable (private mode, locked-down browsers).
    // Cleanup is housekeeping — never let it break startup.
  }
}

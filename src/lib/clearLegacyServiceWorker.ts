/**
 * Deletes the precache this app used to ship.
 *
 * Precaching an app shell made sense when warbands lived in localStorage. Once
 * everything moved to Supabase it bought nothing and cost real confusion: a
 * deploy would land while the old bundle kept being served out of
 * `workbox-precache-v2`, so a correct release looked broken until the user
 * cleared site data.
 *
 * The app now caches at runtime instead, with the HTML shell on NetworkFirst —
 * a new deploy wins as soon as there's a connection, while the rules stay
 * readable offline. That means the worker registration must be left alone.
 * This function used to unregister every worker on the origin, which would now
 * tear down the very one doing the caching, on every page load.
 *
 * Only the old precache buckets are removed. The current worker never consults
 * them, so they're wasted disk rather than a source of stale content — but
 * there's no reason to leave them on someone's phone.
 */
const LEGACY_CACHE_PREFIXES = ['workbox-precache'];

export async function clearLegacyPrecache(): Promise<void> {
  try {
    if (!('caches' in window)) return;
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => LEGACY_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)))
        .map((name) => caches.delete(name)),
    );
  } catch {
    // Storage APIs can be unavailable (private mode, locked-down browsers).
    // Cleanup is housekeeping — never let it break startup.
  }
}

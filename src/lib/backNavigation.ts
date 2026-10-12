/**
 * Where the ← back button goes when there is no in-app history to go back to.
 *
 * BackHeader normally calls `navigate(-1)`. That is right after an in-app hop,
 * but wrong when the screen is the first page of the session — a roster link
 * opened from WhatsApp, a bookmarked hero, a refreshed tab restored by the OS.
 * There, history.back() leaves the app altogether. React Router marks that first
 * entry with `location.key === 'default'`, so BackHeader checks it and sends the
 * player to this screen's parent instead.
 *
 * The parent is the URL with its last segment removed, except where that would
 * land on a path with no route of its own (`/warbands/:id/hero`, `/rosters`).
 */
const SPECIAL_PARENTS: Array<[RegExp, string]> = [
  // Model detail: /warbands/:id/hero/:modelId → /warbands/:id
  [/^(\/warbands\/[^/]+)\/(hero|henchmen|hired-sword)\/[^/]+$/, '$1'],
  // Read-only roster has no list at /rosters; the gallery is its list.
  [/^\/rosters\/[^/]+$/, '/gallery'],
  [/^\/campaign\/warbands\/[^/]+$/, '/campaign'],
  [/^\/rules\/warbands\/[^/]+$/, '/rules'],
  [/^\/solo\/[^/]+$/, '/solo'],
  [/^\/compare$/, '/warbands'],
];

export function parentPath(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  for (const [pattern, replacement] of SPECIAL_PARENTS) {
    if (pattern.test(path)) return path.replace(pattern, replacement);
  }
  const cut = path.lastIndexOf('/');
  return cut > 0 ? path.slice(0, cut) : '/';
}

/** True when this is the first entry of the session: nothing in-app to go back to. */
export function isFirstEntry(locationKey: string): boolean {
  return locationKey === 'default';
}

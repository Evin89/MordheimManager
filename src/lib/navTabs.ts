/**
 * Which navigation destination a path belongs to (§40.1).
 *
 * One ordered table instead of per-tab exceptions. NavLink's own prefix match
 * lit the wrong tab more than once — the battle screens live under
 * `/warbands/:id/…` and lit Warbands, `/campaign` isn't a prefix of
 * `/campaigns` — and every fix was another `activeFor` / `notActiveFor` on one
 * tab. Here the first matching row wins, so specific paths sit above the
 * general ones they'd otherwise fall into.
 *
 * Dependency-free on purpose: `scripts/check-nav-coverage.mjs` bundles this
 * file on its own to check that every route in `App.tsx` lands somewhere.
 */

export type TabId = 'home' | 'warbands' | 'play' | 'campaigns' | 'rules';
/** `account` is the avatar in the header, not a tab in the bar. */
export type NavTarget = TabId | 'account';

type Row = [RegExp, NavTarget];

/** A path segment, or the end of the path: `/rules` claims `/rules/x`, not `/rulesx`. */
const under = (prefix: string) => new RegExp(`^${prefix}(?:/|$)`);

const ROWS: Row[] = [
  // You, and the things only you reach from the avatar.
  [under('/account'), 'account'],
  [under('/admin'), 'account'],

  // Other players are the social side; your own profile is handled before
  // this table runs (it needs the signed-in id).
  [under('/players'), 'campaigns'],
  [under('/campaigns'), 'campaigns'],
  [under('/campaign'), 'campaigns'],

  // A game in progress belongs to Play even though its URL is a warband's.
  [/^\/warbands\/[^/]+\/(?:pre-battle|during-battle|post-battle)$/, 'play'],
  [under('/play'), 'play'],
  [under('/post-battle'), 'play'],
  [under('/solo'), 'play'],
  [under('/map'), 'play'],
  [under('/dice'), 'play'],

  // Everything you build, browse or compare warbands with.
  [under('/warbands'), 'warbands'],
  [under('/trading'), 'warbands'],
  [under('/gallery'), 'warbands'],
  [under('/rosters'), 'warbands'],
  [under('/compare'), 'warbands'],
  [under('/custom-warbands'), 'warbands'],

  [under('/rules'), 'rules'],

  [/^\/$/, 'home'],
];

/**
 * The destination to highlight for `pathname`, or null for a page that
 * belongs nowhere (Not Found). `userId` lets your own profile light the
 * avatar rather than Campaigns.
 */
export function navTargetForPath(pathname: string, userId?: string | null): NavTarget | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (userId && path === `/players/${userId}`) return 'account';
  for (const [pattern, target] of ROWS) {
    if (pattern.test(path)) return target;
  }
  return null;
}

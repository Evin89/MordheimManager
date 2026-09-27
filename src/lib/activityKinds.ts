/**
 * What the activity calendar (§4.9.4.1) counts, in display order.
 *
 * The kinds are the `kind` column returned by `_user_activity()` (migration
 * 0052). An unknown kind from a newer backend is still counted in a day's
 * total and shown under its raw name, so adding one server-side never hides
 * activity from an older client.
 */
export const ACTIVITY_KINDS = [
  'login',
  'battle_reported',
  'warband_edit',
  'warband_created',
  'campaign_joined',
  'rsvp',
  'comment',
  'signup',
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/** One (day, kind, count) row from the RPC. `day` is a `YYYY-MM-DD` local key. */
export type ActivityRow = { day: string; kind: string; n: number };

/**
 * Kinds whose history only starts partway through — before these dates the
 * database has no rows for them, so a quiet stretch is "not tracked", not
 * "inactive". The panel says so under the grid while its window reaches back
 * past a date.
 *
 * - Roster edits: the `warband_edits` trigger log began with migration 0035.
 * - Logins: the `user_visits` day log began with migration 0052. Everyone's
 *   single last-known visit was seeded from `profiles.last_seen_at`, but
 *   nothing earlier exists. ⚠️ Set this to the day 0052 is applied if that
 *   isn't the date below.
 */
export const TRACKED_FROM: Partial<Record<ActivityKind, string>> = {
  warband_edit: '2026-09-13',
  login: '2026-09-27',
};

/**
 * The five shading steps (§4.9.4.1). Fixed thresholds, not quantiles of the
 * player's own data: relative scaling would make two edits in six months look
 * as "hot" as a daily player, which is the misreading this view exists to
 * prevent.
 */
export function heatLevel(total: number): 0 | 1 | 2 | 3 | 4 {
  if (total <= 0) return 0;
  if (total <= 2) return 1;
  if (total <= 5) return 2;
  if (total <= 10) return 3;
  return 4;
}

export const HEAT_STEPS = ['0', '1–2', '3–5', '6–10', '11+'] as const;

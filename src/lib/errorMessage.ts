import { ConcurrencyError } from '../api/errors';
import { strings } from '../strings';

/**
 * Turns any thrown query/mutation error into a message a player can act on.
 *
 * The app funnels every failure through one banner/alert, which historically
 * always said "Connection to Supabase failed" — so a permission rejection or a
 * stale-version conflict read as a network outage, and a report of "it won't let
 * me delete" carried none of the real cause. This is the one place that
 * distinguishes them, by the shape Supabase/PostgREST hands back:
 *
 *  - a `ConcurrencyError` (our own): the row moved under an optimistic edit;
 *  - a Postgres row-level-security refusal (`42501`, or PostgREST's `PGRST301`):
 *    the change was rejected, not lost — usually a stale auth session;
 *  - a Postgres unique-violation (`23505`): the value collides with something
 *    that already exists (e.g. a campaign name you've already used, §10.6);
 *  - a `fetch` that never reached the server (`TypeError: Failed to fetch` and
 *    its browser variants): an actual connection failure;
 *  - anything else: the generic save-may-not-have-gone-through message.
 */
export function describeError(error: unknown): string {
  if (error instanceof ConcurrencyError) return strings.connection.conflict;

  const e = error as { code?: string; message?: string; name?: string } | null;
  const code = e?.code ?? '';
  const message = e?.message ?? '';

  if (code === '42501' || code === 'PGRST301' || /row-level security/i.test(message)) {
    return strings.connection.permission;
  }

  if (code === '23505' || /duplicate key value/i.test(message)) {
    return strings.connection.duplicate;
  }

  if (e?.name === 'TypeError' || /failed to fetch|networkerror|load failed/i.test(message)) {
    return strings.connection.network;
  }

  return strings.connection.lost;
}

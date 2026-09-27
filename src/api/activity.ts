import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';
import { browserTimeZone } from '../lib/calendar';
import type { ActivityRow } from '../lib/activityKinds';

/**
 * The activity calendar's data (§4.9.4.1, migration 0052).
 *
 * Both calls return the same content-blind shape — a day, a kind, a count — and
 * nothing else: no names, no roster, no battle detail. Days are bucketed on the
 * server in the browser's time zone, so a 23:30 battle lands on that evening.
 */

type Row = { day: string; kind: string; n: number };

function toRows(data: unknown): ActivityRow[] {
  return ((data as Row[] | null) ?? []).map((r) => ({ day: r.day, kind: r.kind, n: Number(r.n) }));
}

/** Admin: one player's activity. Gated in the database by `is_admin()`. */
export async function fetchAdminUserActivity(
  userId: string,
  from: string,
  to: string,
): Promise<ActivityRow[]> {
  if (isDemoMode()) return demo.fetchDemoActivity(userId, from, to);
  const { data, error } = await supabase.rpc('admin_user_activity', {
    p_user_id: userId,
    p_from: from,
    p_to: to,
    p_tz: browserTimeZone(),
  });
  if (error) throw error;
  return toRows(data);
}

/** The signed-in player's own activity. The RPC takes no user id — it is always
 * the caller — so there is no parameter here to point at someone else. */
export async function fetchMyActivity(from: string, to: string): Promise<ActivityRow[]> {
  if (isDemoMode()) return demo.fetchDemoActivity('me', from, to);
  const { data, error } = await supabase.rpc('my_activity', {
    p_from: from,
    p_to: to,
    p_tz: browserTimeZone(),
  });
  if (error) throw error;
  return toRows(data);
}

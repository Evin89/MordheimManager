import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';
import { browserTimeZone } from '../lib/calendar';
import type { ActivityItem, ActivityRow } from '../lib/activityKinds';

/**
 * The activity calendar's data (§4.9.4.1, migration 0052).
 *
 * Both calls return the same content-blind shape — a day, a kind, a count — and
 * nothing else: no names, no roster, no battle detail. Days are bucketed on the
 * server in the browser's time zone, so a 23:30 battle lands on that evening.
 *
 * The `…Day` calls (migration 0053) are the tapped day's drill-in: the same
 * counts split by the warband or campaign they belong to. Names only — never a
 * comment body, an event title or anything from inside a roster.
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

type ItemRow = { kind: string; ref_id: string | null; label: string | null; removed: boolean; n: number };

function toItems(data: unknown): ActivityItem[] {
  return ((data as ItemRow[] | null) ?? []).map((r) => ({
    kind: r.kind,
    refId: r.ref_id,
    label: r.label,
    removed: !!r.removed,
    n: Number(r.n),
  }));
}

/** Admin: what one player did on one day, named. */
export async function fetchAdminUserActivityDay(userId: string, day: string): Promise<ActivityItem[]> {
  if (isDemoMode()) return demo.fetchDemoActivityDay(userId, day);
  const { data, error } = await supabase.rpc('admin_user_activity_day', {
    p_user_id: userId,
    p_day: day,
    p_tz: browserTimeZone(),
  });
  if (error) throw error;
  return toItems(data);
}

/** The signed-in player's own day, named. Always the caller, like `my_activity`. */
export async function fetchMyActivityDay(day: string): Promise<ActivityItem[]> {
  if (isDemoMode()) return demo.fetchDemoActivityDay('me', day);
  const { data, error } = await supabase.rpc('my_activity_day', {
    p_day: day,
    p_tz: browserTimeZone(),
  });
  if (error) throw error;
  return toItems(data);
}

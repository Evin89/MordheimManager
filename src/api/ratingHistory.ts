import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';

export type RatingPoint = { rating: number; recordedAt: string };

/**
 * A warband's rating over time (spec §18.3), oldest first.
 *
 * Read-only and RLS-gated by `warband_rating_history_select`, which follows the
 * warband's own read rule — so this resolves for your own warband, a
 * campaign-mate's and any public one, exactly like the roster does. Written only
 * by the 0016 trigger; nothing here inserts.
 */
export async function fetchRatingHistory(warbandId: string): Promise<RatingPoint[]> {
  if (isDemoMode()) return demo.fetchRatingHistory(warbandId);

  const { data, error } = await supabase
    .from('warband_rating_history')
    .select('rating, recorded_at')
    .eq('warband_id', warbandId)
    .order('recorded_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ rating: r.rating as number, recordedAt: r.recorded_at as string }));
}

/**
 * Rating history for several warbands at once — the campaign Standings tab's
 * comparison chart, keyed by warband id (§18.3). One request rather than one
 * per row: RLS still filters it exactly like the single-warband fetch (a
 * batch `.in()` is evaluated per row, same as `.eq()`), so this can never
 * return more than what `fetchRatingHistory` would return for each id in turn
 * — a campaign-mate's warband included, since campaign membership is part of
 * `can_read_warband`'s own rule.
 */
export async function fetchRatingHistoryForWarbands(
  warbandIds: string[],
): Promise<Record<string, RatingPoint[]>> {
  if (warbandIds.length === 0) return {};
  if (isDemoMode()) return demo.fetchRatingHistoryForWarbands(warbandIds);

  const { data, error } = await supabase
    .from('warband_rating_history')
    .select('warband_id, rating, recorded_at')
    .in('warband_id', warbandIds)
    .order('recorded_at', { ascending: true });
  if (error) throw error;

  const grouped: Record<string, RatingPoint[]> = {};
  for (const row of data ?? []) {
    const id = row.warband_id as string;
    (grouped[id] ??= []).push({ rating: row.rating as number, recordedAt: row.recorded_at as string });
  }
  return grouped;
}

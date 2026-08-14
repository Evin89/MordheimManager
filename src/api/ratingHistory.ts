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

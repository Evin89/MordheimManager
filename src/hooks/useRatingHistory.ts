import { useQuery } from '@tanstack/react-query';
import { fetchRatingHistory, fetchRatingHistoryForWarbands } from '../api/ratingHistory';

/** A warband's rating series (spec §18.3). Cheap and rarely-changing, so it
 * leans on the default cache rather than any special invalidation. */
export function useRatingHistoryQuery(warbandId: string | undefined) {
  return useQuery({
    queryKey: ['ratingHistory', warbandId],
    queryFn: () => fetchRatingHistory(warbandId!),
    enabled: !!warbandId,
  });
}

/** Rating history for every warband entered in a campaign, for the Standings
 * tab's comparison chart. Keyed on the sorted id list, not the campaign id, so
 * the query key changes (and refetches) if which warbands are entered changes
 * — the same reasoning as any list-shaped query key elsewhere in the app. */
export function useCampaignRatingHistoryQuery(warbandIds: string[]) {
  const sortedIds = [...warbandIds].sort();
  return useQuery({
    queryKey: ['campaignRatingHistory', sortedIds],
    queryFn: () => fetchRatingHistoryForWarbands(sortedIds),
    enabled: sortedIds.length > 0,
  });
}

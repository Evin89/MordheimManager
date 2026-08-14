import { useQuery } from '@tanstack/react-query';
import { fetchRatingHistory } from '../api/ratingHistory';

/** A warband's rating series (spec §18.3). Cheap and rarely-changing, so it
 * leans on the default cache rather than any special invalidation. */
export function useRatingHistoryQuery(warbandId: string | undefined) {
  return useQuery({
    queryKey: ['ratingHistory', warbandId],
    queryFn: () => fetchRatingHistory(warbandId!),
    enabled: !!warbandId,
  });
}

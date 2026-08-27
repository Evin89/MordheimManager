import { useQuery } from '@tanstack/react-query';
import { fetchWarbandAwards } from '../api/campaignAwards';

/** Every award a warband holds across its campaigns — for its roster screen. */
export function useWarbandAwardsQuery(warbandId: string | undefined) {
  return useQuery({
    queryKey: ['warband-awards', warbandId],
    queryFn: () => fetchWarbandAwards(warbandId!),
    enabled: !!warbandId,
  });
}

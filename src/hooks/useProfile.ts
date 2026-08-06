import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { fetchMyProfile, updateDisplayName } from '../api/profile';

export function useMyProfileQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => fetchMyProfile(user!.id),
    enabled: !!user,
  });
}

/**
 * Renames the signed-in player.
 *
 * Invalidates every query that renders someone's name rather than just the
 * profile itself: the name is denormalised into standings, campaign members,
 * the campaign warband picker and the public gallery through Postgres joins,
 * so without this a player renames themselves and still sees the old name
 * everywhere it actually matters.
 */
export function useUpdateDisplayNameMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (displayName: string) => updateDisplayName(user!.id, displayName),
    onSuccess: () => {
      for (const key of [
        ['profile', user?.id],
        ['campaignMembers'],
        ['standings'],
        ['campaignWarbands'],
        ['publicWarbands'],
      ]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

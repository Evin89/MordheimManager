import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import {
  createCampaignAward,
  deleteCampaignAward,
  fetchCampaignAwards,
} from '../api/campaignAwards';

function awardsKey(campaignId: string | undefined) {
  return ['campaignAwards', campaignId] as const;
}

export function useCampaignAwardsQuery(campaignId: string | undefined) {
  return useQuery({
    queryKey: awardsKey(campaignId),
    queryFn: () => fetchCampaignAwards(campaignId!),
    enabled: !!campaignId,
  });
}

export function useCreateCampaignAwardMutation(campaignId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (fields: { warbandId: string; title: string; note: string }) =>
      createCampaignAward(campaignId!, user!.id, fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: awardsKey(campaignId) }),
  });
  return (
    fields: { warbandId: string; title: string; note: string },
    onDone?: () => void,
  ) => mutation.mutate(fields, { onSuccess: onDone });
}

export function useDeleteCampaignAwardMutation(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => deleteCampaignAward(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: awardsKey(campaignId) }),
  });
  return (id: string) => mutation.mutate(id);
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import {
  createCampaignLogEntry,
  deleteCampaignLogEntry,
  fetchCampaignLog,
} from '../api/campaignLog';

function logKey(campaignId: string | undefined) {
  return ['campaignLog', campaignId] as const;
}

export function useCampaignLogQuery(campaignId: string | undefined) {
  return useQuery({
    queryKey: logKey(campaignId),
    queryFn: () => fetchCampaignLog(campaignId!),
    enabled: !!campaignId,
  });
}

export function useCreateLogEntryMutation(campaignId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields: { title: string; body: string; battleId: string | null }) =>
      createCampaignLogEntry(campaignId!, user!.id, fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: logKey(campaignId) }),
  });
}

export function useDeleteLogEntryMutation(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCampaignLogEntry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: logKey(campaignId) }),
  });
}

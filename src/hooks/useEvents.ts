import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import {
  createCampaignEvent,
  deleteCampaignEvent,
  fetchCampaignEvents,
} from '../api/events';

function eventsKey(campaignId: string | undefined) {
  return ['campaignEvents', campaignId] as const;
}

export function useCampaignEventsQuery(campaignId: string | undefined) {
  return useQuery({
    queryKey: eventsKey(campaignId),
    queryFn: () => fetchCampaignEvents(campaignId!),
    enabled: !!campaignId,
  });
}

export function useCreateEventMutation(campaignId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (fields: {
      title: string;
      eventDateTime: string;
      location: string;
      notes: string;
    }) => createCampaignEvent(campaignId!, user!.id, fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventsKey(campaignId) }),
  });
  return async (fields: {
    title: string;
    eventDateTime: string;
    location: string;
    notes: string;
  }): Promise<string | null> => {
    try {
      await mutation.mutateAsync(fields);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Could not save that event.';
    }
  };
}

export function useDeleteEventMutation(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => deleteCampaignEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventsKey(campaignId) }),
  });
  return (id: string) => mutation.mutate(id);
}

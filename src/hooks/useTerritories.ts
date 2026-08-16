import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTerritory,
  deleteTerritory,
  fetchTerritories,
  setTerritoryController,
} from '../api/territories';

function territoriesKey(campaignId: string | undefined) {
  return ['territories', campaignId] as const;
}

export function useTerritoriesQuery(campaignId: string | undefined) {
  return useQuery({
    queryKey: territoriesKey(campaignId),
    queryFn: () => fetchTerritories(campaignId!),
    enabled: !!campaignId,
  });
}

export function useCreateTerritoryMutation(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (fields: { name: string; kind: string; notes: string }) =>
      createTerritory(campaignId!, fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: territoriesKey(campaignId) }),
  });
  return (
    fields: { name: string; kind: string; notes: string },
    onDone?: () => void,
  ) => mutation.mutate(fields, { onSuccess: onDone });
}

/** Claim, reassign, or release a territory (warbandId null releases it). */
export function useSetTerritoryControllerMutation(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, warbandId }: { id: string; warbandId: string | null }) =>
      setTerritoryController(id, warbandId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: territoriesKey(campaignId) }),
  });
  return (id: string, warbandId: string | null) => mutation.mutate({ id, warbandId });
}

export function useDeleteTerritoryMutation(campaignId: string | undefined) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => deleteTerritory(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: territoriesKey(campaignId) }),
  });
  return (id: string) => mutation.mutate(id);
}

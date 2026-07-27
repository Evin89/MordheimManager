import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { deleteObjective, fetchObjective, saveObjective } from '../api/objectives';
import { BtbObjective } from '../types';
import { strings } from '../strings';

function objectiveKey(warbandId: string | undefined) {
  return ['objective', warbandId] as const;
}

export function useObjectiveQuery(warbandId: string | undefined) {
  return useQuery({
    queryKey: objectiveKey(warbandId),
    queryFn: () => fetchObjective(warbandId!),
    enabled: !!warbandId,
  });
}

export function useSaveObjectiveMutation(warbandId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (patch: Omit<BtbObjective, 'id' | 'warbandId'> | undefined) =>
      patch ? saveObjective(warbandId, user!.id, patch) : deleteObjective(warbandId).then(() => null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: objectiveKey(warbandId) }),
    onError: () => window.alert(strings.connection.lost),
  });
  return (patch: Omit<BtbObjective, 'id' | 'warbandId'> | undefined) => mutation.mutate(patch);
}

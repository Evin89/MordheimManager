import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import {
  WarbandRecord,
  commitBattleUpdate,
  deleteWarband as deleteWarbandApi,
  fetchWarbands,
  insertWarband,
  undoLastBattle as undoLastBattleApi,
  updateWarband,
} from '../api/warbands';
import { ConcurrencyError } from '../api/errors';
import { Warband } from '../types';
import { strings } from '../strings';

function warbandsKey(userId: string | undefined) {
  return ['warbands', userId] as const;
}

export function useWarbandsQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: warbandsKey(user?.id),
    queryFn: () => fetchWarbands(user!.id),
    enabled: !!user,
  });
}

/** Convenience selector: same shape screens got from the old `useAppStore().warbands`. */
export function useWarbandList(): Warband[] {
  const { data } = useWarbandsQuery();
  return data?.map((r) => r.warband) ?? [];
}

export function useWarband(id: string | undefined): Warband | undefined {
  const { data } = useWarbandsQuery();
  return data?.find((r) => r.warband.id === id)?.warband;
}

/** True when this warband has a stored pre-battle snapshot, i.e. the last
 * committed battle can still be undone (replaces the old single-slot
 * `lastBattleSnapshot`, which is now per-warband and server-side). */
export function useCanUndoLastBattle(id: string | undefined): boolean {
  const { data } = useWarbandsQuery();
  return data?.find((r) => r.warband.id === id)?.hasSnapshot ?? false;
}

function useRecordLookup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return (id: string): WarbandRecord | undefined => {
    const records = queryClient.getQueryData<WarbandRecord[]>(warbandsKey(user?.id));
    return records?.find((r) => r.warband.id === id);
  };
}

export function useCreateWarbandMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (warband: Warband) => insertWarband(user!.id, warband),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: warbandsKey(user?.id) }),
  });
  return mutation.mutateAsync;
}

/** Matches the old store's `saveWarband(warband)` signature — looks up the current
 * `updated_at` from cache itself so call sites don't need to track it. */
export function useSaveWarbandMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const getRecord = useRecordLookup();
  const mutation = useMutation({
    mutationFn: async (warband: Warband) => {
      const record = getRecord(warband.id);
      if (!record) throw new Error(`Unknown warband "${warband.id}"`);
      return updateWarband(warband.id, user!.id, warband, record.updatedAt);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: warbandsKey(user?.id) }),
    onError: (err) => {
      if (err instanceof ConcurrencyError) {
        window.alert(err.message);
        queryClient.invalidateQueries({ queryKey: warbandsKey(user?.id) });
      } else {
        window.alert(strings.connection.lost);
      }
    },
  });
  return (warband: Warband) => mutation.mutate(warband);
}

export function useDeleteWarbandMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => deleteWarbandApi(id, user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: warbandsKey(user?.id) }),
  });
  return (id: string) => mutation.mutate(id);
}

export function useCommitBattleWarbandMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const getRecord = useRecordLookup();
  const mutation = useMutation({
    mutationFn: async ({ previous, next }: { previous: Warband; next: Warband }) => {
      const record = getRecord(previous.id);
      if (!record) throw new Error(`Unknown warband "${previous.id}"`);
      return commitBattleUpdate(previous.id, user!.id, previous, next, record.updatedAt);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: warbandsKey(user?.id) }),
    onError: (err) => {
      if (err instanceof ConcurrencyError) {
        window.alert(err.message);
      } else {
        window.alert(strings.connection.lost);
      }
      queryClient.invalidateQueries({ queryKey: warbandsKey(user?.id) });
    },
  });
  return mutation.mutateAsync;
}

export function useUndoLastBattleMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (warbandId: string) => undoLastBattleApi(warbandId, user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: warbandsKey(user?.id) }),
    onError: () => window.alert(strings.connection.lost),
  });
  return (warbandId: string) => mutation.mutate(warbandId);
}

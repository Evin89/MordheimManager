import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import {
  WarbandRecord,
  commitBattleUpdate,
  deleteWarband as deleteWarbandApi,
  fetchSharedWarband,
  fetchWarbands,
  insertWarband,
  setWarbandCampaign,
  setWarbandVisibility,
  undoLastBattle as undoLastBattleApi,
  updateWarband,
} from '../api/warbands';
import { ConcurrencyError } from '../api/errors';
import { Warband, WarbandVisibility } from '../types';
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

/** The sharing settings for one warband — which campaign it's entered in, and
 * who outside that campaign may read it. */
export function useWarbandSharing(id: string | undefined) {
  const { data } = useWarbandsQuery();
  const record = data?.find((r) => r.warband.id === id);
  return { campaignId: record?.campaignId ?? null, visibility: record?.visibility ?? 'private' };
}

export function useSetWarbandCampaignMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ warbandId, campaignId }: { warbandId: string; campaignId: string | null }) =>
      setWarbandCampaign(warbandId, user!.id, campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: warbandsKey(user?.id) });
      // The standings list is exactly "warbands linked to this campaign".
      queryClient.invalidateQueries({ queryKey: ['standings'] });
    },
    onError: () => window.alert(strings.connection.lost),
  });
  return (warbandId: string, campaignId: string | null) => mutation.mutate({ warbandId, campaignId });
}

export function useSetWarbandVisibilityMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ warbandId, visibility }: { warbandId: string; visibility: WarbandVisibility }) =>
      setWarbandVisibility(warbandId, user!.id, visibility),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: warbandsKey(user?.id) }),
    onError: () => window.alert(strings.connection.lost),
  });
  return (warbandId: string, visibility: WarbandVisibility) => mutation.mutate({ warbandId, visibility });
}

/**
 * Another player's roster, read-only. Separate from `useWarbandsQuery` (which
 * is scoped to `owner_id = me`) because this row is reachable only through the
 * campaign-membership branch of the RLS select policy. A null result means the
 * database declined to return it — treat that as "not visible", not an error.
 */
export function useSharedWarbandQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['sharedWarband', id],
    queryFn: () => fetchSharedWarband(id!),
    enabled: !!id,
  });
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

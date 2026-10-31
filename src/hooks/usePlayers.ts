import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import {
  ProfileInput,
  ProfileWarbandRow,
  DIRECTORY_PAGE,
  DirectoryFilters,
  adminClearAvatar,
  adminClearBio,
  adminRemoveFromDirectory,
  fetchInviteOptions,
  fetchMyInvites,
  fetchPendingInvites,
  inviteToCampaign,
  respondToInvite,
  revokeInvite,
  searchPlayers,
  setMyDirectory,
  clearMyAvatar,
  fetchAvatarPaths,
  fetchPlayerHonours,
  fetchPlayerProfile,
  fetchProfileWarbands,
  fetchSharedCampaigns,
  rerollMyAvatar,
  signAvatarUrls,
  updateMyProfile,
  uploadMyAvatar,
} from '../api/players';
import { ImageError, processAvatar } from '../lib/imageProcessing';

const FIVE_MIN = 5 * 60 * 1000;

export function usePlayerProfileQuery(userId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['playerProfile', userId],
    queryFn: () => fetchPlayerProfile(userId!),
    enabled: !!userId && !!user,
    staleTime: FIVE_MIN,
  });
}

export function useProfileWarbandsQuery(userId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profileWarbands', userId],
    queryFn: () => fetchProfileWarbands(userId!),
    enabled: !!userId && !!user,
    staleTime: FIVE_MIN,
  });
}

export function useSharedCampaignsQuery(userId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['sharedCampaigns', userId],
    queryFn: () => fetchSharedCampaigns(userId!),
    enabled: !!userId && !!user,
    staleTime: FIVE_MIN,
  });
}

export function usePlayerHonoursQuery(userId: string | undefined, warbands: ProfileWarbandRow[] | undefined) {
  return useQuery({
    queryKey: ['playerHonours', userId, (warbands ?? []).map((w) => w.id).join(',')],
    queryFn: () => fetchPlayerHonours(warbands ?? []),
    enabled: !!userId && !!warbands,
    staleTime: FIVE_MIN,
  });
}

/**
 * Signed photo URLs for a list of players, by user id.
 *
 * Two requests for the whole list (paths, then one batch signature) rather
 * than two per row. Signed-out viewers get nothing: avatars need an account,
 * and the paths RPC is not granted to anon.
 */
export function useAvatarUrls(userIds: string[]): Record<string, string> {
  const { user } = useAuth();
  const ids = [...new Set(userIds)].sort();
  const { data: paths } = useQuery({
    queryKey: ['avatarPaths', ids.join(',')],
    queryFn: () => fetchAvatarPaths(ids),
    enabled: !!user && ids.length > 0,
    staleTime: FIVE_MIN,
  });
  const pathList = Object.values(paths ?? {}).sort();
  const { data: urls } = useQuery({
    queryKey: ['photoUrls', pathList.join(',')],
    queryFn: () => signAvatarUrls(pathList),
    enabled: pathList.length > 0,
    // Just under the one-hour signature, as for warband photos (usePhotos.ts).
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
  });

  const out: Record<string, string> = {};
  for (const [id, path] of Object.entries(paths ?? {})) {
    const url = urls?.[path];
    if (url) out[id] = url;
  }
  return out;
}

/** Everything that shows a player's name or face, refreshed after an edit. */
function invalidateProfiles(queryClient: ReturnType<typeof useQueryClient>, userId: string | undefined) {
  for (const key of [
    ['profile', userId],
    ['playerProfile', userId],
    ['avatarPaths'],
    ['campaignMembers'],
    ['standings'],
    ['campaignWarbands'],
    ['publicWarbands'],
  ]) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}

export function useUpdateMyProfileMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) => updateMyProfile(user!.id, input),
    onSuccess: () => invalidateProfiles(queryClient, user?.id),
  });
}

/** Returns an error message to show, or null on success. */
export function useAvatarMutations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const done = () => invalidateProfiles(queryClient, user?.id);

  const upload = useMutation({
    mutationFn: async (file: File) => uploadMyAvatar(user!.id, await processAvatar(file)),
    onSuccess: done,
  });
  const clear = useMutation({ mutationFn: clearMyAvatar, onSuccess: done });
  const reroll = useMutation({ mutationFn: rerollMyAvatar, onSuccess: done });

  async function run<T>(fn: () => Promise<T>): Promise<string | null> {
    try {
      await fn();
      return null;
    } catch (err) {
      if (err instanceof ImageError) return err.message;
      return err instanceof Error ? err.message : 'Something went wrong. Try again.';
    }
  }

  return {
    upload: (file: File) => run(() => upload.mutateAsync(file)),
    clear: () => run(() => clear.mutateAsync()),
    reroll: () => run(() => reroll.mutateAsync()),
    busy: upload.isPending || clear.isPending || reroll.isPending,
    uploading: upload.isPending,
  };
}

export function useAdminProfileModeration(userId: string) {
  const queryClient = useQueryClient();
  const done = () => invalidateProfiles(queryClient, userId);
  return {
    clearAvatar: useMutation({ mutationFn: () => adminClearAvatar(userId), onSuccess: done }),
    clearBio: useMutation({ mutationFn: () => adminClearBio(userId), onSuccess: done }),
    removeFromDirectory: useMutation({ mutationFn: () => adminRemoveFromDirectory(userId), onSuccess: done }),
  };
}

// ── Directory & invites (§38.4, §38.5) ──────────────────────────────────────

export function useSetMyDirectoryMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ discoverable, looking }: { discoverable: boolean; looking: boolean }) =>
      setMyDirectory(discoverable, looking),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerProfile', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['directory'] });
    },
  });
}

/** Keyset pages on join date, newest first — the cursor is the last row's
 * `joinedAt`, so a player who signs up mid-scroll doesn't shift the pages. */
export function useDirectoryQuery(filters: DirectoryFilters) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ['directory', filters],
    queryFn: ({ pageParam }) => searchPlayers(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.length < DIRECTORY_PAGE ? undefined : last[last.length - 1].joinedAt),
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

export function useInviteOptionsQuery(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['inviteOptions', userId],
    queryFn: () => fetchInviteOptions(userId!),
    enabled: !!userId && enabled,
  });
}

export function useInviteMutation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, message }: { campaignId: string; message: string }) =>
      inviteToCampaign(campaignId, userId, message),
    onSuccess: (_d, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: ['inviteOptions', userId] });
      queryClient.invalidateQueries({ queryKey: ['pendingInvites', campaignId] });
    },
  });
}

export function useMyInvitesQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['myInvites', user?.id],
    queryFn: fetchMyInvites,
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

export function useRespondToInviteMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ inviteId, accept }: { inviteId: string; accept: boolean }) => respondToInvite(inviteId, accept),
    onSuccess: (_campaignId, { accept }) => {
      queryClient.invalidateQueries({ queryKey: ['myInvites', user?.id] });
      // A new membership changes the campaign list and everything keyed off it.
      if (accept) queryClient.invalidateQueries();
    },
  });
}

export function usePendingInvitesQuery(campaignId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['pendingInvites', campaignId],
    queryFn: () => fetchPendingInvites(campaignId!),
    enabled: !!campaignId && enabled,
  });
}

export function useRevokeInviteMutation(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => revokeInvite(inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pendingInvites', campaignId] }),
  });
}

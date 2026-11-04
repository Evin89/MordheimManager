import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import {
  IssueStatus,
  fetchAdminStats,
  fetchAdminUserBattles,
  fetchAdminUserDetail,
  fetchAdminUsers,
  fetchIsAdmin,
  fetchIssueReports,
  fetchIssueReplies,
  fetchMyIssueReports,
  fetchMyUnreadReplyCount,
  insertIssueReply,
  markMyIssueRepliesRead,
  updateIssueStatus,
} from '../api/issues';
import {
  fetchActivationFunnel,
  fetchRetentionCohorts,
  fetchActivitySeries,
  fetchAcquisitionBreakdown,
  fetchSelfReportBreakdown,
  fetchTimeToActivation,
} from '../api/adminAnalytics';
import { fetchAdminDeletedWarbands, restoreDeletedWarband } from '../api/adminDeletedWarbands';
import { fetchAdminUserWarbands, fetchAdminWarbandRoster } from '../api/adminWarbands';
import {
  fetchAdminCampaigns,
  fetchAdminCampaignContent,
  fetchAdminCampaignDetail,
  fetchStrandedCampaignCount,
} from '../api/adminCampaigns';

/**
 * Whether the signed-in user is an admin.
 *
 * Only ever used to decide what to *render*. The screen being reachable is not
 * the protection — `issue_reports` and `admin_stats()` are admin-gated in the
 * database, so a non-admin who types /admin gets an empty screen and errors,
 * not data.
 */
export function useIsAdminQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['isAdmin', user?.id],
    queryFn: () => fetchIsAdmin(user!.id),
    enabled: !!user,
    // Admin grants are made by hand in the SQL editor and essentially never
    // change during a session.
    staleTime: 5 * 60_000,
  });
}

export function useIssueReportsQuery(status: IssueStatus | 'all') {
  const { data: isAdmin } = useIsAdminQuery();
  return useInfiniteQuery({
    queryKey: ['issueReports', status],
    queryFn: ({ pageParam }) => fetchIssueReports(status, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor,
    enabled: isAdmin === true,
  });
}

export function useAdminStatsQuery() {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({
    queryKey: ['adminStats'],
    queryFn: fetchAdminStats,
    enabled: isAdmin === true,
  });
}

/** §23 growth-insight queries, all admin-gated like the stats above. */
export function useAdminFunnelQuery() {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({ queryKey: ['adminFunnel'], queryFn: fetchActivationFunnel, enabled: isAdmin === true });
}

export function useAdminRetentionQuery() {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({ queryKey: ['adminRetention'], queryFn: () => fetchRetentionCohorts(8), enabled: isAdmin === true });
}

export function useAdminActivitySeriesQuery() {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({ queryKey: ['adminActivitySeries'], queryFn: () => fetchActivitySeries(30), enabled: isAdmin === true });
}

export function useAdminAcquisitionQuery() {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({ queryKey: ['adminAcquisition'], queryFn: () => fetchAcquisitionBreakdown(30), enabled: isAdmin === true });
}

/** §23.2 time-to-activation (migration 0050). */
export function useAdminTimeToActivationQuery() {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({ queryKey: ['adminTimeToActivation'], queryFn: () => fetchTimeToActivation(90), enabled: isAdmin === true });
}

/** §26.7.2 self-reported source (migration 0047). */
export function useAdminSelfReportQuery() {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({ queryKey: ['adminSelfReport'], queryFn: () => fetchSelfReportBreakdown(30), enabled: isAdmin === true });
}

/** Soft-deleted warbands (migration 0054), admin-only. */
export function useAdminDeletedWarbandsQuery() {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({
    queryKey: ['adminDeletedWarbands'],
    queryFn: fetchAdminDeletedWarbands,
    enabled: isAdmin === true,
  });
}

/** §35.4 restore a soft-deleted warband (migration 0065). */
export function useRestoreDeletedWarbandMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreDeletedWarband(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeletedWarbands'] });
      // The owner's lists and the admin counts include it again.
      queryClient.invalidateQueries({ queryKey: ['warbands'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });
}

/** §4.9.4.2 — one player's warbands, soft-deleted included (migration 0056). */
export function useAdminUserWarbandsQuery(userId: string | undefined) {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({
    queryKey: ['adminUserWarbands', userId],
    queryFn: () => fetchAdminUserWarbands(userId!),
    enabled: isAdmin === true && !!userId,
    staleTime: 5 * 60_000,
  });
}

/**
 * §4.9.4.3 — read-only roster for the admin. `staleTime: 0`: every open is a
 * fresh, logged read on the server, so the view log reflects real views.
 */
export function useAdminWarbandRosterQuery(warbandId: string | undefined) {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({
    queryKey: ['adminWarbandRoster', warbandId],
    queryFn: () => fetchAdminWarbandRoster(warbandId!),
    enabled: isAdmin === true && !!warbandId,
    staleTime: 0,
    retry: false,
  });
}

/** §4.9.5 admin campaign list + detail + the stranded-count badge. */
export function useAdminCampaignsQuery(search: string) {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({
    queryKey: ['adminCampaigns', search],
    queryFn: () => fetchAdminCampaigns(search || undefined),
    enabled: isAdmin === true,
  });
}

export function useAdminCampaignDetailQuery(id: string | undefined) {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({
    queryKey: ['adminCampaignDetail', id],
    queryFn: () => fetchAdminCampaignDetail(id!),
    enabled: isAdmin === true && !!id,
  });
}

/** §4.9.8 — the full read-only content. Every fetch writes an audit row, so it
 * is not refetched on focus. */
export function useAdminCampaignContentQuery(id: string | undefined) {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({
    queryKey: ['adminCampaignContent', id],
    queryFn: () => fetchAdminCampaignContent(id!),
    enabled: isAdmin === true && !!id,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useStrandedCampaignCountQuery() {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({
    queryKey: ['strandedCampaigns'],
    queryFn: fetchStrandedCampaignCount,
    enabled: isAdmin === true,
  });
}

/** Per-player activity, paged. Admin-gated in the database, so this stays
 * disabled until the admin check has actually come back true — firing it for a
 * non-admin would only produce a "Not authorised" in the console. */
export function useAdminUsersQuery() {
  const { data: isAdmin } = useIsAdminQuery();
  return useInfiniteQuery({
    queryKey: ['adminUsers'],
    queryFn: ({ pageParam }) => fetchAdminUsers(pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor,
    enabled: isAdmin === true,
  });
}

export function useAdminUserDetailQuery(userId: string | undefined) {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({
    queryKey: ['adminUserDetail', userId],
    queryFn: () => fetchAdminUserDetail(userId!),
    enabled: isAdmin === true && !!userId,
  });
}

export function useAdminUserBattlesQuery(userId: string | undefined) {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({
    queryKey: ['adminUserBattles', userId],
    queryFn: () => fetchAdminUserBattles(userId!),
    enabled: isAdmin === true && !!userId,
  });
}

export function useUpdateIssueStatusMutation() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: IssueStatus }) =>
      updateIssueStatus(id, status),
    onSuccess: () => {
      // Both the list and the open-issue count on the stats panel move.
      queryClient.invalidateQueries({ queryKey: ['issueReports'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });
  return (id: string, status: IssueStatus) => mutation.mutate({ id, status });
}

// ---------------------------------------------------------------------------
// §41 — replies.
// ---------------------------------------------------------------------------

/** Admin: replies for every report on the loaded inbox pages, in one query. */
export function useIssueRepliesQuery(issueIds: string[]) {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({
    queryKey: ['issueReplies', issueIds],
    queryFn: () => fetchIssueReplies(issueIds),
    enabled: isAdmin === true && issueIds.length > 0,
  });
}

export function useSendIssueReplyMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, body }: { issueId: string; body: string }) =>
      insertIssueReply(issueId, user!.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issueReplies'] });
      // In demo mode the admin is also a reporter, so their own view moves too.
      queryClient.invalidateQueries({ queryKey: ['myIssueReports'] });
      queryClient.invalidateQueries({ queryKey: ['myUnreadReplies'] });
    },
  });
}

/** The signed-in player's own reports, with replies. */
export function useMyIssueReportsQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['myIssueReports', user?.id],
    queryFn: fetchMyIssueReports,
    enabled: !!user,
  });
}

/**
 * Unread replies — the dot on the header avatar. Mounted on every screen, so it
 * is cheap (one count) and not eager: a minute stale, refreshed on focus, which
 * is when a player who just got the push comes back to the app.
 */
export function useMyUnreadRepliesQuery() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['myUnreadReplies', user?.id],
    queryFn: fetchMyUnreadReplyCount,
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkRepliesReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (issueId: string) => markMyIssueRepliesRead(issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myUnreadReplies'] });
      queryClient.invalidateQueries({ queryKey: ['issueReplies'] });
    },
  });
}

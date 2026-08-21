import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import {
  IssueStatus,
  fetchAdminStats,
  fetchAdminUserDetail,
  fetchAdminUsers,
  fetchIsAdmin,
  fetchIssueReports,
  updateIssueStatus,
} from '../api/issues';
import {
  fetchActivationFunnel,
  fetchRetentionCohorts,
  fetchActivitySeries,
  fetchAcquisitionBreakdown,
} from '../api/adminAnalytics';
import {
  fetchAdminCampaigns,
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

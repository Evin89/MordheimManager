import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import {
  IssueStatus,
  fetchAdminStats,
  fetchIsAdmin,
  fetchIssueReports,
  updateIssueStatus,
} from '../api/issues';

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

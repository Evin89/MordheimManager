import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { fetchAdminUserActivity, fetchMyActivity } from '../api/activity';
import { useIsAdminQuery } from './useIssues';

/**
 * §4.9.4.1 activity rows. One fetch covers the whole 26-week window; the Month
 * view reads from the same cached rows, so paging months costs nothing.
 *
 * `enabled` lets a collapsed panel skip the query entirely (§12.2 fetch-narrowly).
 */
export function useAdminUserActivityQuery(
  userId: string | undefined,
  from: string,
  to: string,
  enabled = true,
) {
  const { data: isAdmin } = useIsAdminQuery();
  return useQuery({
    queryKey: ['adminUserActivity', userId, from, to],
    queryFn: () => fetchAdminUserActivity(userId!, from, to),
    enabled: enabled && !!userId && isAdmin === true,
    staleTime: 5 * 60_000,
  });
}

/** The signed-in player's own activity. Keyed by user id so an account switch
 * never shows the previous person's calendar from cache. */
export function useMyActivityQuery(from: string, to: string, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['myActivity', user?.id, from, to],
    queryFn: () => fetchMyActivity(from, to),
    enabled: enabled && !!user,
    staleTime: 5 * 60_000,
  });
}

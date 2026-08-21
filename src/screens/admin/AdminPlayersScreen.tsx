import { Link } from 'react-router-dom';
import { useAdminUsersQuery } from '../../hooks/useIssues';
import { strings } from '../../strings';
import { ago } from './shared';

/**
 * §4.9.4 — who is using the app, and how much. Counts per player; no email and
 * no roster contents (§4.9.7). One row per person, columns you scan down.
 */
export default function AdminPlayersScreen() {
  const { data, error, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminUsersQuery();
  const users = data ? data.pages.flatMap((p) => p.rows) : undefined;

  if (isError) {
    return (
      <div className="space-y-1">
        <p className="text-blood-500 text-sm">Could not load players.</p>
        <p className="font-ui text-xs text-bone-400">
          {(error as Error).message} — if this mentions <code>admin_user_overview</code>, migration 0007 has
          not been applied yet.
        </p>
      </div>
    );
  }
  if (!users) return <p className="text-bone-400 text-sm">{strings.common.loading}</p>;
  if (users.length === 0) return <p className="text-bone-400 text-sm">No players yet.</p>;

  return (
    <section className="space-y-2">
      <h2 className="text-bone-100 font-semibold">Players</h2>
      <div className="overflow-x-auto rounded-lg border border-ink-800 bg-ink-900">
        <table className="w-full text-sm tabular-nums lining-nums">
          <thead>
            <tr className="border-b border-ink-700">
              <th scope="col" className="text-left font-ui text-xs uppercase tracking-wide text-bone-400 px-3 py-2">
                Player
              </th>
              <th scope="col" className="text-right font-ui text-xs uppercase tracking-wide text-bone-400 px-2 py-2">
                Warbands
              </th>
              <th scope="col" className="text-right font-ui text-xs uppercase tracking-wide text-bone-400 px-2 py-2">
                Campaigns
              </th>
              <th scope="col" className="text-right font-ui text-xs uppercase tracking-wide text-bone-400 px-2 py-2">
                Battles
              </th>
              <th scope="col" className="text-right font-ui text-xs uppercase tracking-wide text-bone-400 px-3 py-2 whitespace-nowrap">
                Last active
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userId} className="border-b border-ink-800 last:border-b-0">
                <th scope="row" className="text-left font-normal px-3 py-2">
                  <Link
                    to={`/admin/players/${u.userId}`}
                    className="text-ember-400 font-semibold underline-offset-2 hover:underline"
                  >
                    {u.displayName || 'Unnamed'}
                  </Link>
                  {u.isAdmin && (
                    <span className="ml-2 rounded border border-ink-700 px-1.5 py-0.5 font-ui text-[11px] uppercase tracking-wide text-bone-400">
                      admin
                    </span>
                  )}
                  <span className="block font-ui text-xs text-bone-400">joined {ago(u.createdAt)}</span>
                </th>
                <td className="text-right px-2 py-2 text-bone-100">
                  {u.warbands}
                  {u.publicWarbands > 0 && (
                    <span className="font-ui text-xs text-bone-400"> ({u.publicWarbands} public)</span>
                  )}
                </td>
                <td className="text-right px-2 py-2 text-bone-100">{u.campaigns}</td>
                <td className="text-right px-2 py-2 text-bone-100">{u.battles}</td>
                <td className="text-right px-3 py-2 text-bone-400 whitespace-nowrap">{ago(u.lastActive)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasNextPage && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full min-h-[48px] rounded-md border border-ink-700 font-ui text-sm font-semibold text-bone-100 disabled:opacity-50"
        >
          {isFetchingNextPage ? strings.common.loading : strings.warbandList.publicLoadMore}
        </button>
      )}
    </section>
  );
}

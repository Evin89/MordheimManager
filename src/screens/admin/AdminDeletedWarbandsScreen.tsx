import { Link } from 'react-router-dom';
import { useAdminDeletedWarbandsQuery } from '../../hooks/useIssues';
import { strings } from '../../strings';
import { ago } from './shared';

/** Whole days until the nightly purge removes the row (never negative). */
function daysLeft(purgeAt: string): number {
  return Math.max(0, Math.ceil((new Date(purgeAt).getTime() - Date.now()) / 86_400_000));
}

/**
 * Overview of soft-deleted warbands (migrations 0009/0014/0054): who deleted
 * what, when, and how long is left before it is purged for good. Read-only —
 * restoring is still `update warbands set deleted_at = null`.
 */
export default function AdminDeletedWarbandsScreen() {
  const { data: rows, isError, error } = useAdminDeletedWarbandsQuery();

  if (isError) {
    return (
      <div className="space-y-1">
        <p className="text-danger text-sm">Could not load deleted warbands.</p>
        <p className="font-ui text-xs text-bone-400">
          {(error as Error).message} — if this mentions <code>admin_deleted_warbands</code>, migration 0054 has
          not been applied yet.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-bone-100 font-semibold">Deleted warbands{rows ? ` (${rows.length})` : ''}</h2>
      <p className="font-ui text-xs text-bone-400">
        Hidden from players, kept for 30 days, then purged by the nightly job. Metadata only.
      </p>

      {!rows ? (
        <p className="text-bone-400 text-sm">{strings.common.loading}</p>
      ) : rows.length === 0 ? (
        <p className="text-bone-400 text-sm">No deleted warbands.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((w) => {
            const left = daysLeft(w.purge_at);
            return (
              <div key={w.id} className="rounded-lg bg-ink-900 border border-ink-800 p-3 space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-bone-100 font-semibold break-words min-w-0">{w.name}</p>
                  <span
                    className={`font-ui text-xs whitespace-nowrap ${left <= 3 ? 'text-danger' : 'text-bone-400'}`}
                  >
                    {left === 0 ? 'purged tonight' : `${left} day${left === 1 ? '' : 's'} left`}
                  </span>
                </div>
                <p className="font-ui text-xs text-bone-300">
                  {w.warband_type} ·{' '}
                  <Link to={`/admin/players/${w.owner_id}`} className="underline">
                    {w.owner_name ?? 'Unknown player'}
                  </Link>
                  {w.campaign_name ? ` · ${w.campaign_name}` : ''}
                </p>
                <p className="font-ui text-xs text-bone-400">
                  Deleted {ago(w.deleted_at)} ({new Date(w.deleted_at).toLocaleDateString()}) · created{' '}
                  {new Date(w.created_at).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

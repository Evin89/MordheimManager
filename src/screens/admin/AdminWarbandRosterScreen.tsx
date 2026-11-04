import { Link, useParams } from 'react-router-dom';
import { useAdminWarbandRosterQuery } from '../../hooks/useIssues';
import { useEnsureWarbandType } from '../../hooks/useCustomWarbands';
import { useRosterPhotos } from '../../hooks/usePhotos';
import { ReadOnlyRoster } from '../SharedWarbandScreen';
import { strings } from '../../strings';
import { ago } from './shared';

/**
 * §4.9.4.3 — any warband's roster, read-only, for the admin.
 *
 * Reads through `admin_warband_roster` (migration 0056), the one admin function
 * that returns roster content; it writes an `admin_roster_views` row on every
 * call. Renders with the same `ReadOnlyRoster` as the public `/rosters/:id`
 * screen, never the owner's editable roster. BTB objectives, comments and
 * awards are not part of it.
 */
export default function AdminWarbandRosterScreen() {
  const { userId, warbandId } = useParams<{ userId?: string; warbandId: string }>();
  const { data: row, isError, error } = useAdminWarbandRosterQuery(warbandId);
  // Custom warband types resolve the same way the public roster does.
  const { loading: typeLoading } = useEnsureWarbandType(row?.data.warbandType);
  const photos = useRosterPhotos(warbandId);

  return (
    <section className="space-y-6">
      <Link
        to={`/admin/players/${userId ?? row?.owner_id ?? ''}`}
        className="inline-flex items-center min-h-[40px] text-ember-400 text-sm font-semibold"
      >
        {strings.adminRoster.back}
      </Link>

      {/* Pinned, so an admin screen can never be mistaken for the owner's own. */}
      <div className="sticky top-0 z-10 rounded-md border border-ember-500/60 bg-ink-900 px-3 py-2 font-ui text-xs font-semibold uppercase tracking-wide text-ember-400">
        {strings.adminRoster.banner}
      </div>

      {isError && (
        <div className="space-y-1">
          <p className="text-danger text-sm">{strings.adminRoster.loadError}</p>
          <p className="font-ui text-xs text-bone-400">
            {(error as Error).message} — if this mentions <code>admin_warband_roster</code>, migration 0056 has
            not been applied yet.
          </p>
        </div>
      )}

      {!row && !isError && <p className="text-bone-400 text-sm">{strings.common.loading}</p>}

      {row && typeLoading && <p className="text-bone-400 text-sm">{strings.common.loading}</p>}

      {row && !typeLoading && (
        <>
          <p className="font-ui text-xs text-bone-400">
            {row.visibility === 'public' ? strings.adminRoster.public : strings.adminRoster.private}
            {row.campaign_name ? ` · ${row.campaign_name}` : ` · ${strings.adminRoster.noCampaign}`}
            {` · ${strings.adminRoster.updated(ago(row.updated_at))}`}
          </p>
          {row.deleted_at && (
            <p className="rounded-md border border-danger/60 px-3 py-2 font-ui text-xs text-danger">
              {strings.adminRoster.deleted(new Date(row.deleted_at).toLocaleDateString())}
            </p>
          )}
          <ReadOnlyRoster warband={row.data} ownerName={row.owner_name} photos={photos} />
        </>
      )}
    </section>
  );
}

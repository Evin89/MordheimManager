import { Link, useParams } from 'react-router-dom';
import { useAdminUserDetailQuery } from '../hooks/useIssues';
import { getWarbandTypeName } from '../data/warbandRegistry';
import { strings } from '../strings';

function when(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** One activity number, in a small tile. When `to` is given the tile is a link
 * that drills into the detail behind the number. */
function Stat({ label, value, to }: { label: string; value: number | string; to?: string }) {
  const inner = (
    <>
      <p className="font-ui text-[11px] uppercase tracking-wide text-bone-400">
        {label}
        {to && <span className="text-ember-400"> →</span>}
      </p>
      <p className="text-bone-100 text-lg font-semibold tabular-nums lining-nums">{value}</p>
    </>
  );
  const className = 'block rounded-lg border border-ink-800 bg-ink-900 px-3 py-2';
  return to ? (
    <Link to={to} className={`${className} hover:border-ember-500 hover:bg-ink-800`}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

/**
 * One player, from the admin panel.
 *
 * Summary rows only — names, types, ratings, visibility, campaigns. Not the
 * rosters: see migration 0008 for why an admin can count someone's warbands and
 * see what they are without being able to read what is in them.
 */
export default function AdminUserScreen() {
  const { userId } = useParams<{ userId: string }>();
  const { data: user, isError, error } = useAdminUserDetailQuery(userId);

  // Content-only: the admin gate, header and tab strip come from AdminLayout.
  return (
    <section className="space-y-6">
      <Link to="/admin/players" className="inline-flex items-center min-h-[40px] text-ember-400 text-sm font-semibold">
        ← All players
      </Link>

      {isError && (
        <div className="space-y-1">
          <p className="text-blood-500 text-sm">Could not load this player.</p>
          <p className="font-ui text-xs text-bone-400">
            {(error as Error).message} — if this mentions <code>admin_user_detail</code>, migration 0008 has
            not been applied yet.
          </p>
        </div>
      )}

      {!user && !isError && <p className="text-bone-400 text-sm">{strings.common.loading}</p>}

      {user && (
        <>
            <section className="space-y-1">
              <p className="text-bone-100">
                {user.displayName || 'Unnamed'}
                {user.isAdmin && (
                  <span className="ml-2 rounded border border-ink-700 px-1.5 py-0.5 font-ui text-[11px] uppercase tracking-wide text-bone-400">
                    admin
                  </span>
                )}
              </p>
              <p className="font-ui text-xs text-bone-400">Joined {when(user.createdAt)}</p>
            </section>

            <section aria-label="Activity" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Stat label="Battles" value={user.battles} to={`/admin/players/${userId}/battles`} />
              <Stat
                label="Battles / warband"
                value={user.warbands.length ? (user.battles / user.warbands.length).toFixed(1) : '—'}
              />
              <Stat label="New warbands (30d)" value={user.newWarbands30d} />
              <Stat label="New warbands (90d)" value={user.newWarbands90d} />
              <Stat label="Roster edits (30d)" value={user.edits30d} />
              <Stat label="Roster edits (all)" value={user.editsAll} />
            </section>
            <p className="font-ui text-xs text-bone-400 -mt-4">
              Edit counts are since tracking began — older warbands read 0 until next changed.
            </p>

            <section className="space-y-3">
              <h2 className="text-bone-100 font-semibold">
                Warbands{user.warbands.length > 0 && ` (${user.warbands.length})`}
              </h2>
              {user.warbands.length === 0 ? (
                <p className="text-bone-400 text-sm">None yet.</p>
              ) : (
                <div className="rounded-lg border border-ink-800 bg-ink-900 divide-y divide-ink/15">
                  {user.warbands.map((w) => (
                    <div key={w.id} className="px-3 py-2">
                      <div className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-bone-100">{w.name}</span>
                        <span className="shrink-0 font-ui text-sm tabular-nums lining-nums text-bone-400">
                          {strings.warbandList.ratingLabel} {w.rating}
                        </span>
                      </div>
                      <p className="font-ui text-xs text-bone-400">
                        {getWarbandTypeName(w.warbandType)}
                        {' · '}
                        {w.visibility === 'public' ? 'public' : 'private'}
                        {w.campaignName ? ` · ${w.campaignName}` : ' · no campaign'}
                        {' · '}
                        updated {when(w.updatedAt)}
                        {' · '}
                        {w.edits} edit{w.edits === 1 ? '' : 's'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-bone-100 font-semibold">
                Campaigns{user.campaigns.length > 0 && ` (${user.campaigns.length})`}
              </h2>
              {user.campaigns.length === 0 ? (
                <p className="text-bone-400 text-sm">None yet.</p>
              ) : (
                <div className="rounded-lg border border-ink-800 bg-ink-900 divide-y divide-ink/15">
                  {user.campaigns.map((c) => (
                    <div key={c.id} className="px-3 py-2">
                      <div className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-bone-100">{c.name}</span>
                        {c.role === 'campaign_leader' && (
                          <span className="shrink-0 rounded border border-ink-700 px-1.5 py-0.5 font-ui text-[11px] uppercase tracking-wide text-bone-400">
                            leader
                          </span>
                        )}
                      </div>
                      <p className="font-ui text-xs text-bone-400">
                        {c.members} player{c.members === 1 ? '' : 's'}
                        {c.usesBtb && ' · Border Town Burning'}
                        {' · '}
                        joined {when(c.joinedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Says what is missing, so its absence reads as a decision rather
                than an oversight to someone extending this screen later. */}
          <p className="font-ui text-xs text-bone-400">
            Rosters and BTB objectives are not shown here — a warband's contents stay between its
            owner and their campaign-mates.
          </p>
        </>
      )}
    </section>
  );
}

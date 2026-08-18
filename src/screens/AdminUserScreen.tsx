import { Navigate, useParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import { useAdminUserDetailQuery, useIsAdminQuery } from '../hooks/useIssues';
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

/**
 * One player, from the admin panel.
 *
 * Summary rows only — names, types, ratings, visibility, campaigns. Not the
 * rosters: see migration 0008 for why an admin can count someone's warbands and
 * see what they are without being able to read what is in them.
 */
export default function AdminUserScreen() {
  const { userId } = useParams<{ userId: string }>();
  const { data: isAdmin, isPending: adminPending } = useIsAdminQuery();
  const { data: user, isError, error } = useAdminUserDetailQuery(userId);

  if (adminPending) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-bone-400">{strings.common.loading}</p>
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={user?.displayName || 'Player'} />

      <main className="flex-1 px-4 py-4 space-y-6">
        {isError && (
          <div className="space-y-1">
            <p className="text-blood text-sm">Could not load this player.</p>
            <p className="font-ui text-xs text-bone-400">
              {(error as Error).message} — if this mentions <code>admin_user_detail</code>,
              migration 0008 has not been applied yet.
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
      </main>
    </div>
  );
}

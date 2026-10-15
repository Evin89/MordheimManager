import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAdminUserDetailQuery, useAdminUserWarbandsQuery } from '../hooks/useIssues';
import { getWarbandTypeName } from '../data/warbandRegistry';
import { strings } from '../strings';
import { ago } from './admin/shared';
import ActivityPanel, { activityWindow } from '../components/activity/ActivityPanel';
import { useAdminUserActivityDayQuery, useAdminUserActivityQuery } from '../hooks/useActivity';
import { ACTIVITY_REF, type ActivityItem } from '../lib/activityKinds';

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
      <p className="font-ui text-xs uppercase tracking-wide text-bone-400">
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

/** A tapped day's campaigns open that campaign's admin screen; its warbands
 * open the admin's read-only roster (§4.9.4.3). */
function adminHrefFor(userId: string) {
  return (item: ActivityItem): string | null => {
    const ref = ACTIVITY_REF[item.kind];
    if (ref === 'campaign') return `/admin/campaigns/${item.refId}`;
    if (ref === 'warband') return `/admin/players/${userId}/warbands/${item.refId}`;
    return null;
  };
}

/** §4.9.4.1 — when this player actually plays, day by day. The heatmap is counts
 * only; a tapped day adds the warband and campaign names behind the counts —
 * metadata this screen already lists, never content — so §4.9.7 holds. */
function PlayerActivity({ userId }: { userId: string }) {
  const [range] = useState(() => activityWindow());
  const [day, setDay] = useState<string | null>(null);
  const { data, isLoading, error } = useAdminUserActivityQuery(userId, range.from, range.to);
  const dayItems = useAdminUserActivityDayQuery(userId, day);
  return (
    <section aria-label={strings.activity.adminTitle} className="space-y-3">
      <h2 className="text-bone-100 font-semibold">{strings.activity.adminTitle}</h2>
      <ActivityPanel
        rows={data}
        isLoading={isLoading}
        error={error}
        start={range.start}
        end={range.end}
        selected={day}
        onSelect={setDay}
        dayItems={dayItems}
        hrefFor={adminHrefFor(userId)}
      />
    </section>
  );
}

/**
 * §4.9.4.2 — every warband this player owns, soft-deleted ones included (dimmed,
 * at the bottom). Metadata only; each row opens the read-only roster.
 */
function PlayerWarbands({ userId }: { userId: string }) {
  const { data: rows, isError, error } = useAdminUserWarbandsQuery(userId);
  const live = rows?.filter((w) => !w.deleted_at) ?? [];
  return (
    <section className="space-y-3">
      <h2 className="text-bone-100 font-semibold">
        Warbands{live.length > 0 && ` (${live.length})`}
      </h2>
      {isError ? (
        <p className="font-ui text-xs text-danger">
          {(error as Error).message} — if this mentions <code>admin_user_warbands</code>, migration 0056 has
          not been applied yet.
        </p>
      ) : !rows ? (
        <p className="text-bone-400 text-sm">{strings.common.loading}</p>
      ) : rows.length === 0 ? (
        <p className="text-bone-400 text-sm">None yet.</p>
      ) : (
        <div className="rounded-lg border border-ink-800 bg-ink-900 divide-y divide-ink/15">
          {rows.map((w) => (
            <Link
              key={w.id}
              to={`/admin/players/${userId}/warbands/${w.id}`}
              className={`block px-3 py-2 min-h-[44px] hover:bg-ink-800 ${w.deleted_at ? 'opacity-60' : ''}`}
            >
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-bone-100">{w.name}</span>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 font-ui text-xs uppercase tracking-wide ${
                    w.visibility === 'public' ? 'border-ember-500/60 text-ember-400' : 'border-ink-700 text-bone-400'
                  }`}
                >
                  {w.visibility === 'public' ? 'public' : 'private'}
                </span>
                <span className="shrink-0 font-ui text-sm tabular-nums lining-nums text-bone-400">
                  {strings.warbandList.ratingLabel} {w.rating}
                </span>
              </div>
              <p className="font-ui text-xs text-bone-400">
                {getWarbandTypeName(w.warband_type)}
                {w.campaign_name ? ` · ${w.campaign_name}` : ' · no campaign'}
                {' · '}
                {w.deleted_at ? `deleted ${when(w.deleted_at)}` : `last edit ${ago(w.updated_at)}`}
                {' · '}
                {w.edits_30d} edit{w.edits_30d === 1 ? '' : 's'} (30d)
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * One player, from the admin panel.
 *
 * Summary rows — names, types, ratings, visibility, campaigns — with each
 * warband opening the admin's read-only roster (§4.9.4.3, migration 0056).
 * BTB objectives are never reachable from here.
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
          <p className="text-danger text-sm">Could not load this player.</p>
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
                  <span className="ml-2 rounded border border-ink-700 px-1.5 py-0.5 font-ui text-xs uppercase tracking-wide text-bone-400">
                    admin
                  </span>
                )}
              </p>
              <p className="font-ui text-xs text-bone-400">
                Joined {when(user.createdAt)} · last seen {ago(user.lastSeen)}
              </p>
            </section>

            {/* §26.3.1 — auth health, metadata only (never the address). An
                unconfirmed account can't sign in, so "joined, 0 warbands" may be
                a blocked signup rather than a lost interest. */}
            <section aria-label="Sign-in" className="space-y-1">
              <p className="font-ui text-sm">
                <span className="text-bone-400">Email: </span>
                {user.emailConfirmed ? (
                  <span className="text-bone-100">confirmed</span>
                ) : (
                  <span className="font-semibold text-danger">not confirmed — can't sign in</span>
                )}
              </p>
              <p className="font-ui text-sm">
                <span className="text-bone-400">Last sign-in: </span>
                <span className="text-bone-100">
                  {user.lastSignInAt ? `${when(user.lastSignInAt)} (${ago(user.lastSignInAt)})` : 'never'}
                </span>
              </p>
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

            {userId && <PlayerActivity userId={userId} />}

            {userId && <PlayerWarbands userId={userId} />}

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
                          <span className="shrink-0 rounded border border-ink-700 px-1.5 py-0.5 font-ui text-xs uppercase tracking-wide text-bone-400">
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
            Rosters open read-only, and every open is logged (§4.9.4.3). BTB objectives are never shown
            to an admin.
          </p>
        </>
      )}
    </section>
  );
}

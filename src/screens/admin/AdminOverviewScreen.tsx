import { Link } from 'react-router-dom';
import AdminGrowth from '../../components/AdminGrowth';
import {
  useAdminStatsQuery,
  useStrandedCampaignCountQuery,
} from '../../hooks/useIssues';
import { useStoragePurgeQueueQuery } from '../../hooks/usePhotos';
import { getWarbandTypeName } from '../../data/warbandRegistry';
import { strings } from '../../strings';
import { Stat, Signups } from './shared';

/** §4.9.2 — the glance screen: counts, the §23 analytics, and attention badges
 * that carry the counts so the operator doesn't open each screen to find them. */
function AttentionBadge({ to, label, n, urgent }: { to: string; label: string; n: number; urgent: boolean }) {
  return (
    <Link
      to={to}
      className={`rounded-md border px-3 py-2 text-sm font-semibold ${
        n > 0 && urgent
          ? 'border-blood-600 text-blood-500'
          : n > 0
            ? 'border-ember-500/50 text-ember-400'
            : 'border-ink-700 text-bone-400'
      }`}
    >
      {label}: <span className="tabular-nums">{n}</span>
    </Link>
  );
}

export default function AdminOverviewScreen() {
  const { data: stats } = useAdminStatsQuery();
  const { data: queue } = useStoragePurgeQueueQuery(true);
  const { data: stranded } = useStrandedCampaignCountQuery();

  return (
    <>
      {/* Attention counts up top — the full lists live on their own tabs. */}
      <div className="flex flex-wrap gap-2">
        <AttentionBadge to="/admin/issues" label="Open issues" n={stats?.open_issues ?? 0} urgent />
        <AttentionBadge to="/admin/maintenance" label="Purge queue" n={queue?.length ?? 0} urgent={false} />
        <AttentionBadge to="/admin/campaigns" label="Stranded campaigns" n={stranded ?? 0} urgent={false} />
      </div>

      <section className="space-y-3">
        <h2 className="text-bone-100 font-semibold">Overview</h2>
        {!stats ? (
          <p className="text-bone-400 text-sm">{strings.common.loading}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Stat label="Players" value={stats.users} />
              <Stat label="Warbands" value={stats.warbands} />
              <Stat label="Public" value={stats.public_warbands} />
              <Stat label="Campaigns" value={stats.campaigns} />
              <Stat label="Battles" value={stats.battles} />
              <Stat label="Open issues" value={stats.open_issues} />
            </div>

            <Signups data={stats.signups} />

            <div>
              <p className="font-ui text-xs uppercase tracking-wide text-bone-400 mb-2">Warbands by type</p>
              <ul className="space-y-1">
                {stats.warband_types.slice(0, 10).map((row) => (
                  <li key={row.type} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-bone-100">{getWarbandTypeName(row.type)}</span>
                    <span
                      className="h-2 rounded-sm bg-ember-500/70"
                      style={{ width: `${(row.count / Math.max(...stats.warband_types.map((t) => t.count))) * 40}%` }}
                    />
                    <span className="w-8 text-right font-ui text-sm tabular-nums lining-nums text-bone-400">
                      {row.count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>

      <AdminGrowth />
    </>
  );
}

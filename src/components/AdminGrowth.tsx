import {
  useAdminStatsQuery,
  useAdminFunnelQuery,
  useAdminRetentionQuery,
  useAdminActivitySeriesQuery,
  useAdminAcquisitionQuery,
} from '../hooks/useIssues';
import { CohortCell } from '../api/adminAnalytics';

/**
 * §23.5 — the growth panels on /admin: rolling new-user counts with a delta,
 * the activation funnel, retention cohorts, acquisition channels and a daily
 * activity series. All read the admin-gated RPCs (migration 0025) through the
 * hooks; each panel renders only once its data is in, so an un-migrated backend
 * degrades to nothing rather than erroring the screen.
 */

const STAGE_LABEL: Record<string, string> = {
  registered: 'Registered',
  created_warband: 'Created a warband',
  entered_campaign: 'Entered a campaign',
  ran_battle: 'Ran a battle',
};

const CHANNEL_LABEL: Record<string, string> = {
  unknown: 'Unknown',
  discord: 'Discord',
  whatsapp: 'WhatsApp',
  reddit: 'Reddit',
  mordheimer: 'mordheimer.net',
  share: 'Shared link',
  organic_search: 'Search',
  direct: 'Direct',
  other: 'Other',
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-ui text-xs uppercase tracking-wide text-bone-400 mb-2">{children}</p>;
}

function Delta({ now, prev }: { now: number; prev: number }) {
  const diff = now - prev;
  if (diff === 0) return <span className="text-bone-400 text-sm">±0</span>;
  const up = diff > 0;
  return (
    <span className={`text-sm font-semibold ${up ? 'text-verdigris' : 'text-blood-500'}`}>
      {up ? '▲' : '▼'} {Math.abs(diff)} vs prev 7d
    </span>
  );
}

/** Retention grid: cohorts down (signup week), weeks-since across, cell = % active. */
function CohortGrid({ cells }: { cells: CohortCell[] }) {
  if (cells.length === 0) return null;
  const weeks = [...new Set(cells.map((c) => c.weeks_since))].sort((a, b) => a - b);
  const byCohort = new Map<string, { size: number; cells: Map<number, number> }>();
  for (const c of cells) {
    if (!byCohort.has(c.cohort_week)) byCohort.set(c.cohort_week, { size: c.cohort_size, cells: new Map() });
    byCohort.get(c.cohort_week)!.cells.set(c.weeks_since, c.active);
  }
  const cohorts = [...byCohort.keys()].sort();

  return (
    <div className="overflow-x-auto">
      <table className="text-xs tabular-nums lining-nums border-collapse">
        <thead>
          <tr className="text-bone-400">
            <th className="text-left font-semibold pr-3 py-1">Cohort</th>
            <th className="text-right font-semibold px-2 py-1">n</th>
            {weeks.map((w) => (
              <th key={w} className="text-right font-semibold px-2 py-1">
                W{w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((week) => {
            const row = byCohort.get(week)!;
            return (
              <tr key={week} className="border-t border-ink-800">
                <td className="text-bone-200 pr-3 py-1 whitespace-nowrap">{week}</td>
                <td className="text-right text-bone-400 px-2 py-1">{row.size}</td>
                {weeks.map((w) => {
                  const active = row.cells.get(w);
                  if (active === undefined) return <td key={w} className="px-2 py-1" />;
                  const pct = Math.round((active / row.size) * 100);
                  return (
                    <td
                      key={w}
                      className="text-right px-2 py-1 text-bone-100"
                      style={{ backgroundColor: `rgb(220 92 14 / ${Math.max(0.06, pct / 100) * 0.5})` }}
                      title={`${active}/${row.size}`}
                    >
                      {pct}%
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminGrowth() {
  const { data: stats } = useAdminStatsQuery();
  const { data: funnel } = useAdminFunnelQuery();
  const { data: cohorts } = useAdminRetentionQuery();
  const { data: activity } = useAdminActivitySeriesQuery();
  const { data: acquisition } = useAdminAcquisitionQuery();

  const registered = funnel?.[0]?.n ?? 0;
  const activityPeak = Math.max(
    1,
    ...(activity ?? []).flatMap((d) => [d.signups, d.warbands, d.battles]),
  );
  const acqTotal = (acquisition ?? []).reduce((a, r) => a + r.n, 0) || 1;

  return (
    <section className="space-y-6">
      <h2 className="text-bone-100 font-semibold">Growth</h2>

      {/* Rolling new users with a delta against the previous week. */}
      {stats?.new_users_7d !== undefined && (
        <div className="flex items-end gap-6">
          <div>
            <Eyebrow>New users · 7 days</Eyebrow>
            <div className="flex items-baseline gap-2">
              <span className="text-bone-100 text-3xl font-bold tabular-nums">{stats.new_users_7d}</span>
              {stats.new_users_prev_7d !== undefined && (
                <Delta now={stats.new_users_7d} prev={stats.new_users_prev_7d} />
              )}
            </div>
          </div>
          <div>
            <Eyebrow>30 days</Eyebrow>
            <span className="text-bone-200 text-2xl font-bold tabular-nums">{stats.new_users_30d ?? '—'}</span>
          </div>
        </div>
      )}

      {/* Activation funnel — each stage, its count, and the drop from the prior. */}
      {funnel && funnel.length > 0 && (
        <div className="space-y-2">
          <Eyebrow>Activation funnel</Eyebrow>
          {funnel.map((s, i) => {
            const prev = i === 0 ? s.n : funnel[i - 1].n;
            const drop = i === 0 ? 0 : prev > 0 ? Math.round((1 - s.n / prev) * 100) : 0;
            const width = registered > 0 ? (s.n / registered) * 100 : 0;
            return (
              <div key={s.stage} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 text-bone-200">{STAGE_LABEL[s.stage] ?? s.stage}</span>
                <div className="flex-1 h-5 rounded-sm bg-ink-800 overflow-hidden">
                  <div className="h-full bg-ember-500/70" style={{ width: `${Math.max(2, width)}%` }} />
                </div>
                <span className="w-10 text-right tabular-nums text-bone-100">{s.n}</span>
                <span className="w-16 text-right tabular-nums text-bone-400">
                  {i === 0 ? '' : `−${drop}%`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Retention cohorts. */}
      {cohorts && cohorts.length > 0 && (
        <div>
          <Eyebrow>Retention — % active by weeks since signup</Eyebrow>
          <CohortGrid cells={cohorts} />
        </div>
      )}

      {/* Acquisition channels, last 30 days. */}
      {acquisition && acquisition.length > 0 && (
        <div className="space-y-1">
          <Eyebrow>Acquisition — last 30 days</Eyebrow>
          {acquisition.map((r) => (
            <div key={r.channel} className="flex items-center gap-2 text-sm">
              <span className="w-32 shrink-0 text-bone-200">{CHANNEL_LABEL[r.channel] ?? r.channel}</span>
              <span
                className="h-2 rounded-sm bg-ember-500/70"
                style={{ width: `${(r.n / acqTotal) * 100}%` }}
              />
              <span className="w-8 text-right tabular-nums text-bone-400">{r.n}</span>
            </div>
          ))}
        </div>
      )}

      {/* Daily activity — signups / warbands / battles. */}
      {activity && activity.length > 0 && (
        <div>
          <Eyebrow>Activity — last 30 days (signups · warbands · battles)</Eyebrow>
          <div className="flex items-end gap-[3px] h-20">
            {activity.map((d) => (
              <div key={d.day} className="flex-1 flex items-end gap-[1px]" title={`${d.day}: ${d.signups} / ${d.warbands} / ${d.battles}`}>
                <div className="flex-1 rounded-sm bg-ember-500/80" style={{ height: `${(d.signups / activityPeak) * 100}%` }} />
                <div className="flex-1 rounded-sm bg-bone-300/60" style={{ height: `${(d.warbands / activityPeak) * 100}%` }} />
                <div className="flex-1 rounded-sm bg-verdigris/70" style={{ height: `${(d.battles / activityPeak) * 100}%` }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

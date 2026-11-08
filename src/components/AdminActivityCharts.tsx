import { useState } from 'react';
import { useAdminActivityBreakdownQuery } from '../hooks/useIssues';
import type { ActivityBreakdown, ActivityBucket, ActivityKind } from '../api/adminAnalytics';

/**
 * §4.9.9 — player, edit, warband and campaign activity on /admin, as small multiples.
 *
 * One small bar chart per measure rather than one chart with many coloured
 * series: the measures run at very different scales (thousands of edits beside
 * a handful of new campaigns), and separate charts give each its own axis
 * without a dual-axis trick. One hue throughout, so colour never has to carry
 * identity — the title does. Hand-drawn like the rest of the admin charts
 * (§4.9), no plotting library.
 *
 * Each chart shows its total for the range; hovering a bar replaces it with that
 * bucket's value. Every group has a table view for exact numbers and for
 * screen readers, since the bars themselves aren't focusable one by one.
 */

type Range = { id: string; label: string; bucket: ActivityBucket; count: number };

const RANGES: Range[] = [
  { id: '30d', label: '30 days', bucket: 'day', count: 30 },
  { id: '26w', label: '26 weeks', bucket: 'week', count: 26 },
];

type Measure = {
  kind: ActivityKind;
  label: string;
  /** How the range total reads, e.g. "12 different players". */
  total: (n: number) => string;
};

type Group = { title: string; hint: string; measures: Measure[] };

const GROUPS: Group[] = [
  {
    title: 'Players',
    hint: 'Active: opened the app or did anything (warband, edit, battle, join, RSVP, comment) that day. App opens are logged since 27 September 2026 (migration 0052); earlier days count actions only.',
    measures: [
      {
        kind: 'active_players',
        label: 'Active players',
        total: (n) => `${n} different ${n === 1 ? 'player' : 'players'}`,
      },
    ],
  },
  {
    title: 'Edits',
    hint: 'Every saved change to a roster counts as one edit. Recorded since 14 September 2026 (migration 0035).',
    measures: [
      { kind: 'edits', label: 'Warband edits', total: (n) => `${n} edits` },
      {
        kind: 'editors',
        label: 'Players editing',
        total: (n) => `${n} different ${n === 1 ? 'player' : 'players'}`,
      },
    ],
  },
  {
    title: 'Warbands',
    hint: 'Created includes warbands deleted since.',
    measures: [
      { kind: 'warbands_created', label: 'Warbands created', total: (n) => `${n} created` },
      { kind: 'warbands_deleted', label: 'Warbands deleted', total: (n) => `${n} deleted` },
    ],
  },
  {
    title: 'Campaigns',
    hint: 'Active: a battle, a join, a game night, a log entry or a warband edit in that campaign.',
    measures: [
      {
        kind: 'active_campaigns',
        label: 'Active campaigns',
        total: (n) => `${n} different ${n === 1 ? 'campaign' : 'campaigns'}`,
      },
      { kind: 'campaign_battles', label: 'Campaign battles', total: (n) => `${n} reported` },
      { kind: 'campaign_joins', label: 'Players joining', total: (n) => `${n} joins` },
      { kind: 'campaigns_created', label: 'Campaigns created', total: (n) => `${n} created` },
      { kind: 'game_nights', label: 'Game nights planned', total: (n) => `${n} planned` },
    ],
  },
];

/** `YYYY-MM-DD` as a local date, never through UTC (which can shift the day). */
function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatBucket(key: string, bucket: ActivityBucket): string {
  const date = parseDay(key);
  if (bucket === 'week') {
    return `Week of ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  }
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatAxis(key: string): string {
  return parseDay(key).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-ui text-xs uppercase tracking-wide text-bone-400">{children}</p>;
}

function MiniBars({ data, measure }: { data: ActivityBreakdown; measure: Measure }) {
  const [hover, setHover] = useState<number | null>(null);
  const missing = data.series[measure.kind] === undefined;
  const values = data.series[measure.kind] ?? [];
  const peak = Math.max(1, ...values);
  const total = data.totals[measure.kind] ?? 0;
  const first = data.buckets[0];
  const last = data.buckets[data.buckets.length - 1];

  return (
    <figure className="rounded-md border border-ink-800 bg-ink-900 px-3 pt-2 pb-2 space-y-1">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-ui text-sm text-bone-100">{measure.label}</span>
        {/* Reads the hovered bucket, or the range total when nothing is hovered.
            Text tokens only — the bar beside it carries the colour. */}
        <span className="font-ui text-xs tabular-nums lining-nums text-bone-300 text-right" aria-live="polite">
          {missing
            ? 'Needs a newer migration'
            : hover === null
            ? measure.total(total)
            : `${formatBucket(data.buckets[hover], data.bucket)}: ${values[hover]}`}
        </span>
      </figcaption>

      <div className="flex gap-1.5">
        <div
          className="relative flex-1 flex items-end h-16 gap-[2px] border-t border-dashed border-t-ink-700 border-b border-b-ink-700"
          role="img"
          aria-label={`${measure.label}, ${formatBucket(first, data.bucket)} to ${formatBucket(last, data.bucket)}: ${measure.total(total)}, at most ${peak} in one ${data.bucket}.`}
          onMouseLeave={() => setHover(null)}
        >
          {values.map((n, i) => (
            // The whole column is the hover target, not just the bar, so a
            // short bar (or a zero) is as easy to point at as a tall one.
            <div
              key={data.buckets[i]}
              className="flex-1 h-full flex items-end"
              onMouseEnter={() => setHover(i)}
              onTouchStart={() => setHover(i)}
            >
              <div
                className={`w-full rounded-t-[3px] ${hover === i ? 'bg-ember-400' : 'bg-ember-500/80'}`}
                style={{ height: n > 0 ? `max(2px, ${(n / peak) * 100}%)` : 0 }}
              />
            </div>
          ))}
        </div>
        {/* The value scale in its own gutter: the peak at the dashed top line,
            0 at the baseline. Recessive, and never over a bar. */}
        <div
          className="w-6 flex flex-col justify-between font-ui text-[10px] leading-none tabular-nums text-bone-400 -my-[5px]"
          aria-hidden
        >
          <span>{peak}</span>
          <span>0</span>
        </div>
      </div>

      <div className="flex justify-between font-ui text-[10px] text-bone-400 tabular-nums mr-[30px]" aria-hidden>
        <span>{formatAxis(first)}</span>
        <span>{data.bucket === 'week' ? `week of ${formatAxis(last)}` : 'today'}</span>
      </div>
    </figure>
  );
}

function GroupTable({ data, group }: { data: ActivityBreakdown; group: Group }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-ui text-xs text-bone-400 hover:text-bone-200">Show as table</summary>
      <div className="overflow-x-auto mt-2">
        <table className="text-xs tabular-nums lining-nums border-collapse">
          <thead>
            <tr className="text-bone-400">
              <th scope="col" className="text-left font-semibold pr-3 py-1">
                {data.bucket === 'week' ? 'Week of' : 'Day'}
              </th>
              {group.measures.map((m) => (
                <th key={m.kind} scope="col" className="text-right font-semibold px-2 py-1">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...data.buckets.keys()].reverse().map((i) => (
              <tr key={data.buckets[i]} className="border-t border-ink-800">
                <th scope="row" className="text-left font-normal text-bone-200 pr-3 py-1 whitespace-nowrap">
                  {data.bucket === 'week' ? formatAxis(data.buckets[i]) : formatBucket(data.buckets[i], 'day')}
                </th>
                {group.measures.map((m) => (
                  <td key={m.kind} className="text-right text-bone-100 px-2 py-1">
                    {data.series[m.kind]?.[i] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-ink-700">
              <th scope="row" className="text-left font-semibold text-bone-200 pr-3 py-1">
                Range
              </th>
              {group.measures.map((m) => (
                <td key={m.kind} className="text-right font-semibold text-bone-100 px-2 py-1">
                  {data.totals[m.kind] ?? 0}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default function AdminActivityCharts() {
  const [rangeId, setRangeId] = useState(RANGES[0].id);
  const range = RANGES.find((r) => r.id === rangeId) ?? RANGES[0];
  const { data, isError, isLoading } = useAdminActivityBreakdownQuery(range.bucket, range.count);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-bone-100 font-semibold">Activity</h2>
        {/* One range control for every chart below, so they always line up. */}
        <div role="radiogroup" aria-label="Range" className="flex rounded-md border border-ink-700 overflow-hidden">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={r.id === range.id}
              onClick={() => setRangeId(r.id)}
              className={`font-ui text-xs px-3 py-1.5 ${
                r.id === range.id ? 'bg-ink-700 text-bone-100' : 'text-bone-400 hover:text-bone-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <p className="text-bone-400 text-sm">
          Could not load activity. If this mentions admin_activity_breakdown, migration 0068 has not been applied yet.
        </p>
      )}
      {isLoading && <p className="text-bone-400 text-sm">Loading…</p>}

      {data &&
        GROUPS.map((group) => (
          <div key={group.title} className="space-y-2">
            <div>
              <Eyebrow>{group.title}</Eyebrow>
              <p className="font-ui text-xs text-bone-400">{group.hint}</p>
            </div>
            {/* A group with one measure gets the full width rather than half a row. */}
            <div className={`grid grid-cols-1 gap-2 ${group.measures.length > 1 ? 'sm:grid-cols-2' : ''}`}>
              {group.measures.map((m) => (
                <MiniBars key={m.kind} data={data} measure={m} />
              ))}
            </div>
            <GroupTable data={data} group={group} />
          </div>
        ))}
    </section>
  );
}

/** Small pieces shared across the split admin screens (§4.9.1). */

export function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-ink-800 bg-ink-900 px-3 py-2">
      <p className="font-ui text-xs uppercase tracking-wide text-bone-400">{label}</p>
      <p className="font-heading text-2xl tabular-nums lining-nums text-bone-100">{value}</p>
    </div>
  );
}

/** A 30-day series as plain bars — a chart library for one sparkline would be the
 * largest dependency in the app. */
export function Signups({ data }: { data: { day: string; count: number }[] }) {
  const peak = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <p className="font-ui text-xs uppercase tracking-wide text-bone-400 mb-2">Signups — last 30 days</p>
      <div
        className="flex items-end gap-[2px] h-16"
        role="img"
        aria-label={`${data.reduce((a, d) => a + d.count, 0)} signups in the last 30 days`}
      >
        {data.map((d) => (
          <div
            key={d.day}
            title={`${d.day}: ${d.count}`}
            style={{ height: `${Math.max(2, (d.count / peak) * 100)}%` }}
            className="flex-1 rounded-sm bg-ember-500/70"
          />
        ))}
      </div>
    </div>
  );
}

/** How long ago, in the coarsest useful unit — the question is only "still playing?". */
export function ago(iso: string | null): string {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

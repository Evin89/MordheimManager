import { useSearchParams } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import ProfileBlock from '../components/ProfileBlock';
import { strings } from '../strings';
import { useSharedWarbandQuery, useWarbandList } from '../hooks/useWarbands';
import { computeWarbandRating, countModels } from '../lib/rating';
import { getWarbandTypeName } from '../data/warbandRegistry';
import { Warband } from '../types';

/**
 * Two warbands, side by side (spec §20.2).
 *
 * Read-only and entirely client-side. Both ids come off the query string and
 * each resolves through `useSharedWarbandQuery` — the same RLS-gated path the
 * read-only roster uses — so this works for your own warbands, a campaign-mate's,
 * and any public one, and fails for a private warband you can't read exactly as
 * opening it directly would. No new fetch, no new policy: it reuses rows the app
 * already knows how to read.
 */

/** One warband's headline numbers, the row people actually compare. */
function SummaryColumn({ warband }: { warband: Warband }) {
  const rows: [string, string | number][] = [
    [strings.compare.ratingLabel, computeWarbandRating(warband)],
    [strings.compare.goldLabel, `${warband.gold} ${strings.common.gold}`],
    [strings.compare.modelsLabel, countModels(warband)],
    [strings.compare.heroesLabel, warband.heroes.length],
    [strings.compare.henchmenLabel, warband.henchmenGroups.reduce((n, g) => n + g.count, 0)],
    [strings.compare.hiredSwordsLabel, warband.hiredSwords.length],
  ];
  return (
    <div className="rounded-lg bg-ink-900 border border-ink-800 p-4">
      <p className="text-bone-100 font-semibold truncate">{warband.name}</p>
      <p className="text-bone-300 text-sm truncate mb-3">{getWarbandTypeName(warband.warbandType)}</p>
      <dl className="space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2">
            <dt className="text-bone-400 text-sm">{label}</dt>
            <dd className="text-bone-100 text-sm font-semibold tabular-nums lining-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A warband's models as collapsed statlines — the same block the roster uses,
 * so a comparison reads in the app's own language rather than a bespoke grid. */
function RosterColumn({ warband }: { warband: Warband }) {
  const rows = [
    ...warband.heroes.map((h) => ({ id: h.id, name: h.name, sub: h.unitType, stats: h.stats })),
    ...warband.hiredSwords.map((s) => ({ id: s.id, name: s.name, sub: s.type, stats: s.stats })),
    ...warband.henchmenGroups.map((g) => ({
      id: g.id,
      name: `${g.count}× ${g.groupName}`,
      sub: g.unitType,
      stats: g.stats,
    })),
  ];
  return (
    <div className="space-y-2">
      <h2 className="text-bone-100 font-semibold truncate">{warband.name}</h2>
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg bg-ink-900 border border-ink-800 p-3">
          <p className="text-bone-100 text-sm font-semibold truncate">{row.name}</p>
          <p className="text-bone-300 text-xs truncate mb-2">{row.sub}</p>
          <div className="overflow-x-auto">
            <ProfileBlock stats={row.stats} variant="collapsed" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A dropdown of the player's own warbands. When the current value is a warband
 * the player doesn't own (a campaign-mate's, arrived by link), it is shown as a
 * disabled option so the select still reflects what is on screen. */
function WarbandPicker({
  label,
  value,
  onChange,
  own,
  externalName,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  own: Warband[];
  externalName?: string;
}) {
  const valueIsOwn = own.some((w) => w.id === value);
  return (
    <label className="flex flex-col gap-1 flex-1 min-w-0">
      <span className="text-bone-300 text-xs font-semibold uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
      >
        <option value="">{strings.compare.choose}</option>
        {value && !valueIsOwn && (
          <option value={value}>{externalName ?? strings.compare.choose}</option>
        )}
        {own.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function WarbandCompareScreen() {
  const [params, setParams] = useSearchParams();
  const own = useWarbandList();
  const a = params.get('a') ?? '';
  const b = params.get('b') ?? '';

  const { data: warbandA, isLoading: loadingA } = useSharedWarbandQuery(a || undefined);
  const { data: warbandB, isLoading: loadingB } = useSharedWarbandQuery(b || undefined);

  function setSide(side: 'a' | 'b', id: string) {
    const next = new URLSearchParams(params);
    if (id) next.set(side, id);
    else next.delete(side);
    // Replace, not push: sliding between comparisons shouldn't stack a dozen
    // history entries to back out through.
    setParams(next, { replace: true });
  }

  const sameWarband = a && b && a === b;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.compare.title} />

      <main className="flex-1 px-4 py-4 space-y-5">
        <div className="flex gap-3">
          <WarbandPicker
            label={strings.compare.pickLeft}
            value={a}
            onChange={(id) => setSide('a', id)}
            own={own}
            externalName={warbandA?.name}
          />
          <WarbandPicker
            label={strings.compare.pickRight}
            value={b}
            onChange={(id) => setSide('b', id)}
            own={own}
            externalName={warbandB?.name}
          />
        </div>

        {sameWarband && <p className="text-bone-300 text-sm">{strings.compare.sameWarband}</p>}

        {!a && !b && <p className="text-bone-300 text-sm">{strings.compare.pickPrompt}</p>}

        {/* Each side reports its own load and RLS outcome independently, so one
            unreadable warband doesn't blank the other. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {a && (
            <ComparePane loading={loadingA} warband={warbandA} />
          )}
          {b && !sameWarband && (
            <ComparePane loading={loadingB} warband={warbandB} />
          )}
        </div>

        {warbandA && warbandB && !sameWarband && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <RosterColumn warband={warbandA} />
            <RosterColumn warband={warbandB} />
          </div>
        )}
      </main>
    </div>
  );
}

function ComparePane({ loading, warband }: { loading: boolean; warband: Warband | null | undefined }) {
  if (loading) return <p className="text-bone-300 text-sm">{strings.common.loading}</p>;
  if (!warband)
    return (
      <p className="text-bone-200 text-sm rounded-md bg-ink-900 border border-ink-800 p-4">
        {strings.compare.unavailable}
      </p>
    );
  return <SummaryColumn warband={warband} />;
}

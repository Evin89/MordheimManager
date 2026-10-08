import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAllCustomWarbandTypesQuery } from '../../hooks/useCustomWarbands';
import { useAdminStatsQuery } from '../../hooks/useIssues';
import { getWarbandTypeName } from '../../data/warbandNames';
import { isCustomWarbandType } from '../../lib/customWarband';
import { strings } from '../../strings';
import { ago } from './shared';

/**
 * Custom warband types (§21.2): how many there are, who made them, and how many
 * warbands are built on each. The types are readable by anyone (0022); the
 * per-type warband counts come from `admin_stats().warband_types`, which counts
 * every player's live warbands — no new migration needed.
 */
export default function AdminCustomWarbandsScreen() {
  const { data: types, isError, error } = useAllCustomWarbandTypesQuery();
  const { data: stats } = useAdminStatsQuery();

  const usage = useMemo(() => {
    const byType = new Map<string, number>();
    for (const row of stats?.warband_types ?? []) {
      if (isCustomWarbandType(row.type)) byType.set(row.type, row.count);
    }
    return byType;
  }, [stats]);

  if (isError) {
    return <p className="text-blood-500 text-sm">Could not load custom warbands: {(error as Error).message}</p>;
  }
  if (!types) return <p className="text-bone-400 text-sm">{strings.common.loading}</p>;

  const players = new Set(types.map((t) => t.ownerId)).size;
  const known = new Set(types.map((t) => t.typeId));
  const totalWarbands = [...usage.values()].reduce((sum, n) => sum + n, 0);
  // Warbands whose custom type has since been deleted: they still exist, but
  // their type no longer resolves.
  const orphaned = [...usage.entries()].filter(([type]) => !known.has(type)).reduce((sum, [, n]) => sum + n, 0);

  const tiles = [
    { label: 'Custom types', value: types.length },
    { label: 'Players who made one', value: players },
    { label: 'Warbands built on them', value: stats ? totalWarbands : '…' },
  ];

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg bg-ink-900 border border-ink-800 p-3">
            <p className="text-bone-100 text-2xl font-semibold tabular-nums">{tile.value}</p>
            <p className="font-ui text-xs text-bone-400">{tile.label}</p>
          </div>
        ))}
      </div>
      {orphaned > 0 && (
        <p className="font-ui text-xs text-blood-500">
          {orphaned} warband{orphaned === 1 ? ' is' : 's are'} built on a custom type that has since been deleted.
        </p>
      )}
      <p className="font-ui text-xs text-bone-400">
        Players can browse these too, at{' '}
        <Link to="/rules/custom-warbands" className="underline">
          Rules → Custom warbands
        </Link>
        .
      </p>

      {types.length === 0 ? (
        <p className="text-bone-400 text-sm">No custom warband types yet.</p>
      ) : (
        <div className="space-y-2">
          {types.map((c) => {
            const count = usage.get(c.typeId) ?? 0;
            return (
              <div key={c.id} className="rounded-lg bg-ink-900 border border-ink-800 p-3 space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to={`/rules/warbands/${c.typeId}`}
                    className="text-bone-100 font-semibold break-words min-w-0 underline-offset-2 hover:underline"
                  >
                    {c.name}
                  </Link>
                  <span className="font-ui text-xs whitespace-nowrap text-bone-300">
                    {stats ? `${count} warband${count === 1 ? '' : 's'}` : ''}
                  </span>
                </div>
                <p className="font-ui text-xs text-bone-300">
                  Based on {getWarbandTypeName(c.baseType)} ·{' '}
                  <Link to={`/admin/players/${c.ownerId}`} className="underline">
                    {c.ownerName || 'Unknown player'}
                  </Link>
                </p>
                <p className="font-ui text-xs text-bone-400">
                  Created {ago(c.createdAt)}
                  {c.updatedAt !== c.createdAt ? ` · edited ${ago(c.updatedAt)}` : ''}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

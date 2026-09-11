import { useEffect, useMemo, useState } from 'react';
import { OwnedModel } from '../../api/collection';
import { warbandDefinitionsByName, getWarbandDefinition, getWarbandTypeName } from '../../data/warbandRegistry';
import { Button, Field, Select, fieldClasses } from '../ui';

/** One unit row: a label and a count you own, committed on blur / Enter so a
 * quick "8" is one write, not eight. */
function CountRow({
  label,
  isLeader,
  current,
  onCommit,
}: {
  label: string;
  isLeader: boolean;
  current: number;
  onCommit: (n: number) => void;
}) {
  const [val, setVal] = useState(String(current));
  useEffect(() => setVal(current ? String(current) : ''), [current]);

  function commit() {
    const n = Math.max(0, parseInt(val || '0', 10) || 0);
    if (n !== current) onCommit(n);
  }

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-bone-200 text-sm min-w-0">
        {label}
        {isLeader && <span className="ml-2 text-ember-400 text-xs">Leader</span>}
      </span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className={fieldClasses('w-20 min-h-[40px] text-center')}
        aria-label={`How many ${label} you own`}
      />
    </div>
  );
}

/**
 * The owned-models editor: pick a warband type, then set how many of each of its
 * units you own. What you own here is the pool the solo generator draws an enemy
 * from — so it never musters a model you can't put on the table.
 */
export default function ModelLibraryEditor({
  owned,
  onSetCount,
}: {
  owned: OwnedModel[];
  onSetCount: (warbandType: string, unitType: string, count: number) => void;
}) {
  const [selectedType, setSelectedType] = useState('');

  // (warbandType::unitType) -> count, and per-warband totals for the summary.
  const countOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of owned) m.set(`${o.warbandType}::${o.unitType}`, o.count);
    return m;
  }, [owned]);

  const totals = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of owned) m.set(o.warbandType, (m.get(o.warbandType) ?? 0) + o.count);
    return [...m.entries()].filter(([, n]) => n > 0).sort((a, b) => a[0].localeCompare(b[0]));
  }, [owned]);

  const def = selectedType ? getWarbandDefinition(selectedType) : undefined;
  const units = def
    ? [
        ...def.heroSlots.map((s) => ({ unitType: s.unitType, isLeader: s.isLeader })),
        ...def.henchmenTypes.map((h) => ({ unitType: h.unitType, isLeader: false })),
      ]
    : [];
  // A unit type can appear once; dedupe defensively so a repeated slot never
  // renders two rows writing the same key.
  const seen = new Set<string>();
  const uniqueUnits = units.filter((u) => (seen.has(u.unitType) ? false : seen.add(u.unitType)));

  return (
    <div className="space-y-4">
      {totals.length > 0 && (
        <div className="space-y-2">
          <p className="text-bone-400 text-xs uppercase tracking-wide">Your models</p>
          <ul className="flex flex-wrap gap-2">
            {totals.map(([type, n]) => (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    selectedType === type
                      ? 'border-ember-500 text-ember-400'
                      : 'border-ink-700 text-bone-200 hover:bg-ink-800'
                  }`}
                >
                  {getWarbandTypeName(type)} · {n}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Field label="Add or edit a warband type" htmlFor="model-warband-type">
        <Select
          id="model-warband-type"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="">Choose a warband type…</option>
          {warbandDefinitionsByName.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>

      {def && (
        <div className="rounded-md bg-ink-950 border border-ink-800 p-3">
          <p className="text-bone-100 text-sm font-semibold mb-1">{def.name}</p>
          <p className="text-bone-400 text-xs mb-2">
            How many of each you own. Set 0 for units you don’t have.
          </p>
          <div className="divide-y divide-ink-800">
            {uniqueUnits.map((u) => (
              <CountRow
                key={u.unitType}
                label={u.unitType}
                isLeader={u.isLeader}
                current={countOf.get(`${selectedType}::${u.unitType}`) ?? 0}
                onCommit={(n) => onSetCount(selectedType, u.unitType, n)}
              />
            ))}
          </div>
          <div className="pt-3">
            <Button variant="secondary" size="dense" fullWidth={false} onClick={() => setSelectedType('')}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

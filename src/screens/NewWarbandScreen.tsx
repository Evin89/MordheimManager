import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import DisclosureChevron from '../components/DisclosureChevron';
import { Button, TextField } from '../components/ui';
import { strings } from '../strings';
import { getWarbandProvenance, warbandDefinitionsByName } from '../data/warbandRegistry';
import { createWarband } from '../lib/warbandFactory';
import { useCreateWarbandMutation } from '../hooks/useWarbands';

/** Provenance as one short label, e.g. "The New Mordheimer · Grade 1a". */
function provenanceLabel(def: (typeof warbandDefinitionsByName)[number]): string {
  const { source, grade } = getWarbandProvenance(def);
  return grade ? `${source} · ${grade}` : source;
}

/**
 * A search-led, expandable warband-type picker (spec §4.1).
 *
 * Replaces a native `<select>`: at 49 lists the OS picker is a wall of names
 * with no room for a source line and no way to search. This mirrors the Rules
 * Reference — a control that opens to a search field over a scrollable list —
 * so the way you find a warband here matches the way you find a rule there.
 */
function WarbandTypePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = warbandDefinitionsByName.find((d) => d.id === value);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return warbandDefinitionsByName;
    return warbandDefinitionsByName.filter((d) =>
      `${d.name} ${provenanceLabel(d)}`.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 flex items-center justify-between gap-3 text-left focus:outline-none focus:border-ember-500"
      >
        <span className="min-w-0">
          <span className="block text-bone-100 truncate">
            {selected ? selected.name : strings.newWarband.typePlaceholder}
          </span>
          {selected && (
            <span className="block text-bone-400 text-xs truncate">{provenanceLabel(selected)}</span>
          )}
        </span>
        <span className="text-bone-300">
          <DisclosureChevron open={open} className="h-4 w-4" />
        </span>
      </button>

      {open && (
        <div className="mt-1 rounded-md border border-ink-700 bg-ink-900 overflow-hidden">
          <div className="p-2 border-b border-ink-800">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={strings.newWarband.typeSearchPlaceholder}
              className="w-full min-h-[44px] rounded-md bg-ink-950 border border-ink-700 px-3 text-bone-100 placeholder:text-bone-300/50 focus:outline-none focus:border-ember-500"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {results.length === 0 && (
              <li className="px-3 py-3 text-bone-300 text-sm">{strings.newWarband.typeNoMatches}</li>
            )}
            {results.map((d) => {
              const isSelected = d.id === value;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(d.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full min-h-[44px] px-3 py-2 text-left flex flex-col ${
                      isSelected ? 'bg-ink-800 text-ember-400' : 'text-bone-100 hover:bg-ink-800/60'
                    }`}
                  >
                    <span className="truncate font-semibold text-sm">{d.name}</span>
                    <span className="truncate text-xs text-bone-400">{provenanceLabel(d)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function NewWarbandScreen() {
  const navigate = useNavigate();
  const createWarbandOnServer = useCreateWarbandMutation();
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState(warbandDefinitionsByName[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const definition = warbandDefinitionsByName.find((def) => def.id === typeId);

  async function handleCreate() {
    if (!name.trim()) {
      setError(strings.newWarband.nameRequired);
      return;
    }
    if (!definition || saving) return;

    const warband = createWarband(definition, name.trim());
    setSaving(true);
    try {
      // Only navigate once the insert succeeded — the roster screen reads from
      // the server, so routing early would land on a "warband not found" redirect.
      await createWarbandOnServer(warband);
      navigate(`/warbands/${warband.id}`, { replace: true });
    } catch {
      setError(strings.connection.lost);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={strings.newWarband.title} />

      <main className="flex-1 px-4 py-6 space-y-6">
        <div className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" htmlFor="warband-name">
            {strings.newWarband.nameLabel}
          </label>
          <TextField
            id="warband-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder={strings.newWarband.namePlaceholder}
          />
          {error && <p className="text-blood-500 text-sm">{error}</p>}
        </div>

        <div className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" id="warband-type-label">
            {strings.newWarband.typeLabel}
          </label>
          <WarbandTypePicker value={typeId} onChange={setTypeId} />
          {definition && (
            <>
              <p className="text-bone-300 text-sm">
                Starting gold: {definition.startingGold ?? '?'} {strings.common.gold} · Max size:{' '}
                {definition.maxWarbandSize ?? '?'}
              </p>
              <p className="text-bone-400 text-xs">
                {(() => {
                  const { source, grade } = getWarbandProvenance(definition);
                  return grade ? `${source} · ${grade}` : source;
                })()}
              </p>
            </>
          )}
        </div>

        <Button onClick={handleCreate}>{strings.newWarband.createButton}</Button>
      </main>
    </div>
  );
}

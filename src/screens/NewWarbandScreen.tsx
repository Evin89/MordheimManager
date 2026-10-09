import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { capture } from '../lib/posthog';
import BackHeader from '../components/BackHeader';
import GoogleSelfReportCard from '../components/GoogleSelfReportCard';
import DisclosureChevron from '../components/DisclosureChevron';
import { Button, TextField } from '../components/ui';
import { strings } from '../strings';
import { getWarbandProvenance, subfactionLabel, warbandDefinitionsByName } from '../data/warbandRegistry';
import SubfactionChoice from '../components/SubfactionChoice';
import { WarbandDefinition, WarbandGrade } from '../data/types';
import { isCustomWarbandType } from '../lib/customWarband';
import { createWarband } from '../lib/warbandFactory';
import { quickBuildStarterRoster, describeStarter } from '../lib/quickBuild';
import { useCreateWarbandMutation, useWarbandList } from '../hooks/useWarbands';
import { useCustomWarbandTypesQuery } from '../hooks/useCustomWarbands';

/** Provenance as one short label, e.g. "The New Mordheimer · Grade 1a". A custom
 * type is labelled plainly as one rather than echoing its long cloned-from note. */
function provenanceLabel(def: WarbandDefinition): string {
  if (isCustomWarbandType(def.id)) return strings.newWarband.customSectionLabel;
  const { source, grade } = getWarbandProvenance(def);
  return grade ? `${source} · ${grade}` : source;
}

/** A grade, or your own custom types, which have none. */
type GradeFilter = 'all' | 'custom' | WarbandGrade;
const GRADE_ORDER: GradeFilter[] = ['custom', '1a', '1b', '1c', '2a', '2b', '3'];

function gradeOf(def: WarbandDefinition): GradeFilter {
  if (isCustomWarbandType(def.id) || !def.grade) return 'custom';
  return def.grade;
}

function gradeChipLabel(g: GradeFilter): string {
  if (g === 'all') return strings.newWarband.typeGradeAll;
  if (g === 'custom') return strings.newWarband.typeGradeCustom;
  return g;
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
  definitions,
}: {
  value: string;
  onChange: (id: string) => void;
  definitions: WarbandDefinition[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [grade, setGrade] = useState<GradeFilter>('all');
  const selected = definitions.find((d) => d.id === value);

  // Only the grades some list actually has, in grade order, each with its count.
  const gradeOptions = useMemo(() => {
    const counts = new Map<GradeFilter, number>();
    for (const d of definitions) counts.set(gradeOf(d), (counts.get(gradeOf(d)) ?? 0) + 1);
    return GRADE_ORDER.filter((g) => counts.has(g)).map((g) => ({ grade: g, count: counts.get(g)! }));
  }, [definitions]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return definitions.filter(
      (d) =>
        (grade === 'all' || gradeOf(d) === grade) &&
        (!q || `${d.name} ${provenanceLabel(d)}`.toLowerCase().includes(q)),
    );
  }, [query, grade, definitions]);

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
          <div className="p-2 border-b border-ink-800 space-y-2">
            <div
              role="group"
              aria-label={strings.newWarband.typeGradeFilterLabel}
              aria-describedby="warband-grade-hint"
              className="flex flex-wrap gap-1.5"
            >
              {[{ grade: 'all' as GradeFilter, count: definitions.length }, ...gradeOptions].map((o) => {
                const active = grade === o.grade;
                return (
                  <button
                    key={o.grade}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setGrade(o.grade)}
                    className={`min-h-[36px] rounded px-2.5 font-ui text-xs whitespace-nowrap border ${
                      active
                        ? 'bg-ember-500/15 text-ember-400 border-ember-500/40'
                        : 'bg-ink-800 text-bone-300 border-ink-700 hover:text-bone-100'
                    }`}
                  >
                    {gradeChipLabel(o.grade)} <span className="opacity-70">{o.count}</span>
                  </button>
                );
              })}
            </div>
            <p id="warband-grade-hint" className="text-bone-400 text-xs">
              {strings.newWarband.typeGradeHint}
            </p>
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
  const [searchParams] = useSearchParams();
  const createWarbandOnServer = useCreateWarbandMutation();
  const { data: customTypes } = useCustomWarbandTypesQuery();
  const ownedWarbandCount = useWarbandList().length;
  const [name, setName] = useState('');
  // Preselect the type when arrived at from the §5.4 warband reference's "Build
  // this warband →" CTA (`?type=<id>`); fall back to the first list A–Z.
  const preselectType = searchParams.get('type');
  const [typeId, setTypeId] = useState(
    preselectType && warbandDefinitionsByName.some((d) => d.id === preselectType)
      ? preselectType
      : warbandDefinitionsByName[0]?.id ?? '',
  );
  // §28 — the city-state (or similar) for lists that require one.
  const [subfaction, setSubfaction] = useState<string | undefined>(undefined);
  const [subfactionError, setSubfactionError] = useState<string | null>(null);
  const [quickBuild, setQuickBuild] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Your custom types sort to the top, then the bundled lists A–Z.
  const allDefinitions = useMemo(
    () => [...(customTypes ?? []).map((c) => c.definition), ...warbandDefinitionsByName],
    [customTypes],
  );
  const definition = allDefinitions.find((def) => def.id === typeId);

  // Preview the starter for the selected type; reused on create so the roster
  // shown matches what's inserted.
  const starter = useMemo(
    () => (definition ? quickBuildStarterRoster(definition) : null),
    [definition],
  );

  async function handleCreate() {
    if (!name.trim()) {
      setError(strings.newWarband.nameRequired);
      return;
    }
    if (!definition || saving) return;
    const needsSubfaction = (definition.subfactions?.length ?? 0) > 0;
    if (needsSubfaction && !subfaction) {
      // Shown under the choice, next to the button, not up by the name field.
      setSubfactionError(strings.subfaction.required(subfactionLabel(definition)));
      return;
    }

    const warband = createWarband(definition, name.trim(), needsSubfaction ? subfaction : undefined);
    if (quickBuild && starter) {
      // Rebuild here for fresh ids rather than reusing the preview's objects.
      const roster = quickBuildStarterRoster(definition);
      warband.heroes = roster.heroes;
      warband.henchmenGroups = roster.henchmenGroups;
      warband.gold = (definition.startingGold ?? 0) - roster.goldSpent;
    }
    setSaving(true);
    try {
      // Only navigate once the insert succeeded — the roster screen reads from
      // the server, so routing early would land on a "warband not found" redirect.
      await createWarbandOnServer(warband);
      void capture('warband_created', {
        warband_type_id: definition.id,
        quick_build: quickBuild,
        // §26.4.3 — whether this is the account's first warband (the funnel's
        // register → warband step).
        is_first: ownedWarbandCount === 0,
      });
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
        {/* A brand-new Google account lands here first (§26.4.1) and never saw
            the register form's source question, so it's asked here, once. */}
        <GoogleSelfReportCard />
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
          {error && <p className="text-danger text-sm">{error}</p>}
        </div>

        <div className="space-y-2">
          <label className="block text-bone-200 text-sm font-semibold" id="warband-type-label">
            {strings.newWarband.typeLabel}
          </label>
          <WarbandTypePicker
            value={typeId}
            onChange={(id) => {
              setTypeId(id);
              setSubfaction(undefined);
              setSubfactionError(null);
            }}
            definitions={allDefinitions}
          />
          <Link
            to="/custom-warbands"
            className="inline-flex items-center min-h-[44px] text-ember-400 text-sm font-semibold"
          >
            {strings.newWarband.manageCustomLink}
          </Link>
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

        {definition?.subfactions?.length ? (
          <div className="space-y-2">
            <SubfactionChoice
              definition={definition}
              value={subfaction}
              onChange={(id) => {
                setSubfaction(id);
                setSubfactionError(null);
              }}
            />
            {subfactionError && (
              <p role="alert" className="text-danger text-sm">
                {subfactionError}
              </p>
            )}
          </div>
        ) : null}

        {definition && (starter?.heroes.length || starter?.henchmenGroups.length) ? (
          <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-2">
            <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={quickBuild}
                onChange={(e) => setQuickBuild(e.target.checked)}
                className="h-5 w-5 shrink-0 mt-0.5"
              />
              <span>
                <span className="block text-bone-100 font-semibold text-sm">
                  {strings.newWarband.quickBuildLabel}
                </span>
                <span className="block text-bone-400 text-xs">{strings.newWarband.quickBuildHint}</span>
              </span>
            </label>
            {quickBuild && (
              <p className="text-bone-300 text-xs pl-8">
                {strings.newWarband.quickBuildPreview(describeStarter(definition, starter))}
              </p>
            )}
          </div>
        ) : null}

        <Button onClick={handleCreate}>{strings.newWarband.createButton}</Button>
      </main>
    </div>
  );
}

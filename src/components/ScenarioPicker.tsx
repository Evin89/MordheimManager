import {
  ANY_FILTER,
  CatalogScenario,
  GameFit,
  SCENARIO_CATALOG,
  SETTINGS,
  SOURCE_GROUPS,
  ScenarioFilter,
  activeFilterCount,
  filterScenarios,
  groupBySource,
  supportsOneVsOne,
  writtenFor,
} from '../lib/scenarioCatalog';
import { Field, Select } from './ui';

/** An option's text: the name, plus what a player needs to know before picking
 * it — that it needs more than two warbands, or is written for a given warband. */
function optionLabel(s: CatalogScenario): string {
  const notes = [...(supportsOneVsOne(s) ? [] : ['multiplayer']), ...writtenFor(s)];
  return notes.length ? `${s.name} — ${notes.join(', ')}` : s.name;
}

/** A row of tick boxes, one per option, all ticked unless hidden. Unticking
 * hides that option's scenarios; the pills wrap on a phone. */
function CheckGroup<T extends string>({
  legend,
  options,
  hidden,
  onChange,
}: {
  legend: string;
  options: readonly T[];
  hidden: T[];
  onChange: (hidden: T[]) => void;
}) {
  return (
    <fieldset>
      <legend className="text-bone-300 text-sm pb-1">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = !hidden.includes(o);
          return (
            <label
              key={o}
              className={`inline-flex items-center gap-2 min-h-[44px] px-3 rounded-lg border text-sm cursor-pointer select-none ${
                on ? 'border-ember-500 bg-ember-500/10 text-bone-100' : 'border-ink-700 bg-ink-900 text-bone-400'
              }`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => onChange(on ? [...hidden, o] : hidden.filter((h) => h !== o))}
                className="h-4 w-4 accent-ember-500"
              />
              {o}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The Setting / Players / Source filters (and, where there's a game to fit,
 * "only scenarios that fit this game"), with a line saying how many scenarios
 * are showing. Behind a disclosure where space is tight (a form with other
 * fields); `alwaysOpen` lays them out flat where they're the point, as on `/map`.
 * Shared by the scenario picker and the Rules Reference.
 */
export function ScenarioFilterFields({
  idPrefix,
  filter,
  onFilterChange,
  shown,
  fit,
  alwaysOpen = false,
}: {
  idPrefix: string;
  filter: ScenarioFilter;
  onFilterChange: (f: ScenarioFilter) => void;
  /** How many scenarios the filter leaves. */
  shown: number;
  /** The game being set up; offers the "fits this game" option when given. */
  fit?: GameFit;
  alwaysOpen?: boolean;
}) {
  const active = activeFilterCount(filter, !!fit);
  const count = `${shown} of ${SCENARIO_CATALOG.length}`;
  const fields = (
    <>
      <div className="space-y-3 pt-1">
        <CheckGroup
          legend="Setting"
          options={SETTINGS}
          hidden={filter.hiddenSettings}
          onChange={(hiddenSettings) => onFilterChange({ ...filter, hiddenSettings })}
        />
        <CheckGroup
          legend="Source"
          options={SOURCE_GROUPS}
          hidden={filter.hiddenSources}
          onChange={(hiddenSources) => onFilterChange({ ...filter, hiddenSources })}
        />
        <Field label="Players" htmlFor={`${idPrefix}-players`}>
          <Select
            id={`${idPrefix}-players`}
            value={filter.players}
            onChange={(e) => onFilterChange({ ...filter, players: e.target.value as ScenarioFilter['players'] })}
          >
            <option value="any">Any</option>
            <option value="1v1">1v1</option>
            <option value="Multiplayer">Multiplayer</option>
          </Select>
        </Field>
      </div>
      {fit && (
        <label className="flex items-start gap-2 min-h-[44px] pt-2 text-sm text-bone-200">
          <input
            type="checkbox"
            checked={filter.fitsOnly}
            onChange={(e) => onFilterChange({ ...filter, fitsOnly: e.target.checked })}
            className="mt-1 h-4 w-4 accent-ember-500"
          />
          <span>
            Only scenarios that fit this game
            <span className="block text-bone-400 text-xs">
              {fit.players > 2 ? 'Playable with more than two warbands' : 'Playable one-on-one'}, and not written
              for a warband nobody here is playing. The same list “Suggest a scenario” draws from.
            </span>
          </span>
        </label>
      )}
      {active > 0 && (
        <button
          type="button"
          onClick={() => onFilterChange(ANY_FILTER)}
          className="min-h-[44px] text-bone-400 text-xs underline"
        >
          Clear filters
        </button>
      )}
    </>
  );

  if (alwaysOpen) {
    return (
      <div>
        <p className="text-bone-400 text-xs">Showing {count} scenarios</p>
        {fields}
      </div>
    );
  }
  return (
    <details className="group" open={active > 0 || undefined}>
      <summary className="cursor-pointer select-none min-h-[44px] flex items-center gap-1.5 text-ember-400 text-sm font-semibold list-none [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">
          ▸
        </span>
        Filter by setting, source, players{active > 0 ? ` (${active})` : ''} · {count}
      </summary>
      {fields}
    </details>
  );
}

/**
 * The scenario picker shared by the pre-battle, solo and map screens: every
 * scenario in the catalogue, grouped by source, with the filters tucked behind a
 * disclosure. The filter is the caller's state (see `useScenarioFilter`) so the
 * suggester can draw from the same list the player is looking at. The current
 * pick always stays in the list, even when a filter would hide it.
 */
export default function ScenarioPicker({
  id,
  value,
  onChange,
  filter,
  onFilterChange,
  fit,
  placeholder,
  filtersOpen = false,
}: {
  id: string;
  /** Selected scenario id ('' for none). */
  value: string;
  onChange: (id: string) => void;
  filter: ScenarioFilter;
  onFilterChange: (f: ScenarioFilter) => void;
  /** The game being set up; enables the "fits this game" filter. */
  fit?: GameFit;
  /** Text of an empty first option; omit to always have a scenario selected. */
  placeholder?: string;
  /** Show the filters laid out rather than behind a disclosure. */
  filtersOpen?: boolean;
}) {
  const shown = filterScenarios(filter, fit);
  const selected = SCENARIO_CATALOG.find((s) => s.id === value);
  const list = selected && !shown.includes(selected) ? [...shown, selected] : shown;

  return (
    <div className="space-y-2">
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {groupBySource(list).map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {optionLabel(s)}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
      <ScenarioFilterFields
        idPrefix={id}
        filter={filter}
        onFilterChange={onFilterChange}
        shown={shown.length}
        fit={fit}
        alwaysOpen={filtersOpen}
      />
    </div>
  );
}

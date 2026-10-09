import { WarbandDefinition } from '../data/types';
import { subfactionLabel } from '../data/warbandRegistry';
import { getSkillList } from '../lib/skillLookup';
import { parseWarbandSpecialRules } from '../lib/warbandRulesFormat';
import { strings } from '../strings';

/**
 * The §28 choice for lists that have one (the Tilean city-state): one card per
 * option, its rules and how it changes the Heroes' skill lists, so the player
 * reads what they're choosing rather than picking a bare name.
 *
 * Used on the new-warband screen and, once, on the roster of a warband made
 * before the choice existed.
 */
export default function SubfactionChoice({
  definition,
  value,
  onChange,
  name = 'subfaction',
  hideLegend = false,
}: {
  definition: WarbandDefinition;
  value: string | undefined;
  onChange: (id: string) => void;
  /** The radio group's name — unique per screen. */
  name?: string;
  /** Keep the legend for screen readers only, where a heading already names the choice. */
  hideLegend?: boolean;
}) {
  const options = definition.subfactions ?? [];
  const label = subfactionLabel(definition);
  const listName = (id: string) => getSkillList(id)?.name ?? id;

  return (
    <fieldset className="space-y-2">
      <legend className={hideLegend ? 'sr-only' : 'block text-bone-200 text-sm font-semibold mb-2'}>
        {label}
      </legend>
      {options.map((option) => {
        const selected = option.id === value;
        const { lead, rules } = parseWarbandSpecialRules(option.specialRules);
        const lists = Object.entries(option.heroSkillLists ?? {});
        return (
          <label
            key={option.id}
            className={`block rounded-lg border p-3 cursor-pointer ${
              selected ? 'border-ember-500 bg-ember-500/10' : 'border-ink-700 bg-ink-900'
            }`}
          >
            <span className="flex items-center gap-3 min-h-[44px]">
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
                className="h-5 w-5 shrink-0"
              />
              <span className="text-bone-100 font-semibold">{option.name}</span>
            </span>
            <span className="block pl-8 space-y-1 text-bone-300 text-sm">
              {lead.map((p) => (
                <span key={p} className="block">
                  {p}
                </span>
              ))}
              {rules.map((r) => (
                <span key={r.name} className="block">
                  <span className="text-bone-200 font-semibold">{r.name}:</span> {r.text}
                </span>
              ))}
              {lists.map(([unit, keys]) => (
                <span key={unit} className="block text-bone-400 text-xs">
                  {strings.subfaction.skillsLine(unit, keys.map(listName).join(', '))}
                </span>
              ))}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

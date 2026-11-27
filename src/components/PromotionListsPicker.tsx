import { getSkillList } from '../lib/skillLookup';
import { promotionSkillListOptions } from '../lib/ruleEffects';
import { strings } from '../strings';

/**
 * §15 — the skill lists a promoted Henchman takes. Fixed ones (an Ogre's Combat
 * and Strength) are shown, not asked; otherwise the player picks the usual two
 * from the pool his unit's rules allow, and any `extra` list is added on top.
 */
export default function PromotionListsPicker({
  warbandType,
  subfaction,
  unitType,
  chosen,
  onChange,
}: {
  warbandType: string;
  subfaction?: string;
  unitType: string;
  chosen: string[];
  onChange: (lists: string[]) => void;
}) {
  const t = strings.postBattle.advances.promotion;
  const opts = promotionSkillListOptions(warbandType, unitType, subfaction);
  const label = (id: string) => getSkillList(id)?.name ?? id;

  if (opts.fixed) {
    return <p className="text-bone-200 text-sm">{t.fixed([...opts.fixed, ...opts.extra].map(label).join(', '))}</p>;
  }

  return (
    <div className="space-y-1">
      <p className="text-bone-200 text-sm">{t.choose(opts.choose)}</p>
      <div className="flex flex-wrap gap-2">
        {opts.options.map((id) => {
          const on = chosen.includes(id);
          const full = !on && chosen.length >= opts.choose;
          return (
            <button
              key={id}
              type="button"
              disabled={full}
              onClick={() => onChange(on ? chosen.filter((c) => c !== id) : [...chosen, id])}
              aria-pressed={on}
              className={`min-h-[40px] px-3 rounded-md border text-sm font-semibold disabled:opacity-40 ${
                on ? 'border-ember-500 text-ember-400' : 'border-ink-700 text-bone-200'
              }`}
            >
              {label(id)}
            </button>
          );
        })}
      </div>
      {opts.extra.length > 0 && <p className="text-bone-300 text-xs">{t.extra(opts.extra.map(label).join(', '))}</p>}
    </div>
  );
}

import { HOUSE_RULES, isHouseRuleOn } from '../data/houseRules';
import { strings } from '../strings';

/**
 * The house-rules list with an On/Off switch per rule. Used by the campaign's
 * House Rules panel (the leader's settings) and by pre-battle / the wizard's
 * Battle Info step for a personal battle, where the players pick the rules for
 * that one game (§34.2.2). Read-only without `onChange`.
 */
export default function HouseRulesChecklist({
  value,
  onChange,
}: {
  value: Record<string, boolean>;
  onChange?: (next: Record<string, boolean>) => void;
}) {
  const s = strings.campaign.houseRules;

  return (
    <ul className="space-y-2">
      {HOUSE_RULES.map((rule) => {
        const on = isHouseRuleOn(rule, value);
        return (
          <li key={rule.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-bone-100 text-sm">{rule.label}</p>
              <p className="text-bone-400 text-xs">{rule.description}</p>
            </div>
            {onChange ? (
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => onChange({ ...value, [rule.id]: !on })}
                className={`shrink-0 min-h-[32px] px-3 rounded-full border text-xs font-semibold tabular-nums ${
                  on ? 'bg-ember-500 border-ember-500 text-on-accent' : 'border-ink-700 text-bone-400'
                }`}
              >
                {on ? s.on : s.off}
              </button>
            ) : (
              <span className={`shrink-0 text-xs font-semibold ${on ? 'text-ember-400' : 'text-bone-400'}`}>
                {on ? s.on : s.off}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

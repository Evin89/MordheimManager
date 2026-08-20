import { Campaign } from '../types';
import { HOUSE_RULES, isHouseRuleOn } from '../data/houseRules';
import { useSetHouseRulesMutation } from '../hooks/useCampaign';
import { strings } from '../strings';

/**
 * The campaign's optional-rule toggles. The leader sees switches; everyone else
 * sees the same list read-only — it's the shared "what are we playing" the group
 * agreed on. Storage keeps only explicit settings, so a toggle writes the id's
 * boolean and unset ids fall back to the rulebook default (see data/houseRules).
 */
export default function HouseRulesPanel({
  campaign,
  isLeader,
}: {
  campaign: Campaign;
  isLeader: boolean;
}) {
  const setHouseRules = useSetHouseRulesMutation(campaign.id);
  const s = strings.campaign.houseRules;

  function toggle(id: string, on: boolean) {
    setHouseRules({ ...campaign.houseRules, [id]: on });
  }

  return (
    <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
      <h2 className="text-bone-100 font-semibold">{s.section}</h2>
      <p className="text-bone-400 text-xs">{isLeader ? s.leaderHint : s.memberHint}</p>

      <ul className="space-y-2">
        {HOUSE_RULES.map((rule) => {
          const on = isHouseRuleOn(rule, campaign.houseRules);
          return (
            <li key={rule.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-bone-100 text-sm">{rule.label}</p>
                <p className="text-bone-400 text-xs">{rule.description}</p>
              </div>
              {isLeader ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => toggle(rule.id, !on)}
                  className={`shrink-0 min-h-[32px] px-3 rounded-full border text-xs font-semibold tabular-nums ${
                    on
                      ? 'bg-ember-500 border-ember-500 text-on-accent'
                      : 'border-ink-700 text-bone-400'
                  }`}
                >
                  {on ? s.on : s.off}
                </button>
              ) : (
                <span
                  className={`shrink-0 text-xs font-semibold ${on ? 'text-ember-400' : 'text-bone-400'}`}
                >
                  {on ? s.on : s.off}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

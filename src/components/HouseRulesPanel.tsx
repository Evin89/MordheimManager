import { Campaign } from '../types';
import { FRIENDLY_GAMES_KEY, friendliesAllowed } from '../data/houseRules';
import { useSetHouseRulesMutation } from '../hooks/useCampaign';
import { strings } from '../strings';
import HouseRulesChecklist from './HouseRulesChecklist';

/**
 * The campaign's optional-rule toggles. The leader sees switches; everyone else
 * sees the same list read-only — it's the shared "what are we playing" the group
 * agreed on. Storage keeps only explicit settings, so a toggle writes the id's
 * boolean and unset ids fall back to the rulebook default (see data/houseRules).
 *
 * Below it, the §34.2.1 "Allow friendly games" setting — stored in the same map
 * under a reserved key, but a campaign setting rather than a house rule.
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
  const f = strings.campaign.friendlies;
  const allowFriendlies = friendliesAllowed(campaign);

  return (
    <>
      <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
        <h2 className="text-bone-100 font-semibold">{s.section}</h2>
        <p className="text-bone-400 text-xs">{isLeader ? s.leaderHint : s.memberHint}</p>
        <HouseRulesChecklist
          value={campaign.houseRules}
          onChange={isLeader ? (next) => setHouseRules(next) : undefined}
        />
      </section>

      <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-bone-100 font-semibold">{f.allow}</h2>
            <p className="text-bone-400 text-xs">{f.allowHint}</p>
          </div>
          {isLeader ? (
            <button
              type="button"
              role="switch"
              aria-checked={allowFriendlies}
              onClick={() => setHouseRules({ ...campaign.houseRules, [FRIENDLY_GAMES_KEY]: !allowFriendlies })}
              className={`shrink-0 min-h-[32px] px-3 rounded-full border text-xs font-semibold tabular-nums ${
                allowFriendlies ? 'bg-ember-500 border-ember-500 text-on-accent' : 'border-ink-700 text-bone-400'
              }`}
            >
              {allowFriendlies ? s.on : s.off}
            </button>
          ) : (
            <span className={`shrink-0 text-xs font-semibold ${allowFriendlies ? 'text-ember-400' : 'text-bone-400'}`}>
              {allowFriendlies ? s.on : s.off}
            </span>
          )}
        </div>
      </section>
    </>
  );
}

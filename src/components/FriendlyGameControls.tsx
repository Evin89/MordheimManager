import { Campaign } from '../types';
import { defaultHouseRules, friendliesAllowed, isFriendlyGame } from '../data/houseRules';
import { strings } from '../strings';
import HouseRulesChecklist from './HouseRulesChecklist';

/**
 * §34.2.2 — whether this game counts, and (for a personal battle) which house
 * rules the players are using. Shared by pre-battle and the wizard's Battle
 * Info step so the two read the same.
 *
 * One field underneath — `friendly` — phrased from each side so "on" always
 * reads as a normal game:
 * - a warband in a campaign: *Friendly game*, off by default; hidden when the
 *   campaign's leader has turned friendlies off;
 * - a warband in no campaign: *Counts for your roster*, on by default.
 *
 * A personal battle (a friendly, or any warband in no campaign) also gets the
 * house-rules checklist: no campaign supplies them, so the players pick.
 */
export default function FriendlyGameControls({
  campaign,
  friendly,
  houseRules,
  onChange,
}: {
  /** The warband's own campaign (§34.4), or null. */
  campaign: Campaign | null;
  friendly: boolean;
  houseRules: Record<string, boolean> | undefined;
  onChange: (patch: { friendly?: boolean; houseRules?: Record<string, boolean> }) => void;
}) {
  const p = strings.battle.preBattle;
  // A campaign that forbids friendlies shows nothing: its battles are campaign
  // battles and play to the campaign's own house rules.
  if (!friendliesAllowed(campaign)) return null;
  const isFriendly = isFriendlyGame(campaign, friendly);
  const personal = !campaign || isFriendly;

  const switchOn = campaign ? isFriendly : !isFriendly;
  const label = campaign ? p.friendly : p.countsForRoster;
  const hint = campaign ? p.friendlyHint(campaign.name) : p.countsForRosterHint;

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-bone-200 text-sm font-semibold">{label}</p>
          <p className="text-bone-400 text-xs">{hint}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={switchOn}
          aria-label={label}
          onClick={() => onChange({ friendly: !isFriendly })}
          className={`shrink-0 min-h-[32px] px-3 rounded-full border text-xs font-semibold tabular-nums ${
            switchOn ? 'bg-ember-500 border-ember-500 text-on-accent' : 'border-ink-700 text-bone-400'
          }`}
        >
          {switchOn ? strings.campaign.houseRules.on : strings.campaign.houseRules.off}
        </button>
      </div>

      {personal && (
        <details className="rounded-lg bg-ink-900 border border-ink-800 p-3">
          <summary className="min-h-[32px] flex items-center text-bone-200 text-sm font-semibold cursor-pointer">
            {p.houseRulesTitle}
          </summary>
          <div className="pt-2 space-y-2">
            <p className="text-bone-400 text-xs">{p.houseRulesHint}</p>
            <HouseRulesChecklist
              value={houseRules ?? defaultHouseRules()}
              onChange={(next) => onChange({ houseRules: next })}
            />
          </div>
        </details>
      )}
    </section>
  );
}

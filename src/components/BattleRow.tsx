import { useState } from 'react';
import { strings } from '../strings';
import { BattleRecord } from '../types';
import { HOUSE_RULES } from '../data/houseRules';

const RESULT_LABEL: Record<BattleRecord['result'], string> = {
  win: strings.campaign.win,
  loss: strings.campaign.loss,
  draw: strings.campaign.draw,
};

const RESULT_CLASSES: Record<BattleRecord['result'], string> = {
  win: 'border-ember-500 text-ember-400',
  loss: 'border-blood-600 text-danger',
  draw: 'border-ink-700 text-bone-300',
};

/** One logged battle, collapsed to scenario/date/result; tap for the details.
 * Shared by the campaign log and Your Battles on the Battle tab (§34.3). */
export default function BattleRow({
  battle,
  warbandName,
  onDelete,
}: {
  battle: BattleRecord;
  warbandName: string;
  /** Leaders (and the reporter, per the 0005 policy) may remove an entry. */
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // §34.5 — the rules the players ticked for a personal battle, by label.
  const houseRulesUsed = battle.houseRules
    ? HOUSE_RULES.filter((rule) => battle.houseRules?.[rule.id]).map((rule) => rule.label)
    : null;

  return (
    <div className="rounded-lg bg-ink-900 border border-ink-800 p-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-bone-100 font-semibold truncate">{battle.scenario || 'Scenario not recorded'}</p>
          <p className="text-bone-300 text-sm truncate">
            {battle.date} · {warbandName}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {battle.friendly && (
            <span className="text-xs px-2 py-0.5 rounded bg-ink-800 border border-ink-700 text-bone-300">
              {strings.battle.friendlyChip}
            </span>
          )}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${RESULT_CLASSES[battle.result]}`}>
            {RESULT_LABEL[battle.result]}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-ink-800 space-y-1 text-sm">
          {battle.opponents.length > 0 && (
            <p className="text-bone-300">
              <span className="text-bone-200 font-semibold">{strings.campaign.opponentsLabel}: </span>
              {battle.opponents.join(', ')}
            </p>
          )}
          {battle.friendly ? (
            <p className="text-bone-300">{strings.postBattle.friendlyNoChanges}</p>
          ) : (
            <>
              {!!battle.underdogBonus && (
                <p className="text-bone-300">{strings.campaign.underdogBonusLabel(battle.underdogBonus)}</p>
              )}
              {battle.wyrdstoneFound > 0 && (
                <p className="text-bone-300">{strings.campaign.wyrdstoneFoundLabel(battle.wyrdstoneFound)}</p>
              )}
              <p className="text-bone-300">
                <span className="text-bone-200 font-semibold">{strings.common.gold}: </span>
                {strings.campaign.goldChangeLabel(battle.goldChange)}
              </p>
              <p className="text-bone-300">
                <span className="text-bone-200 font-semibold">{strings.campaign.casualtiesLabel}: </span>
                {battle.casualtiesSummary}
              </p>
            </>
          )}
          {houseRulesUsed && (
            <p className="text-bone-300">
              <span className="text-bone-200 font-semibold">{strings.battle.houseRulesUsedLabel}: </span>
              {houseRulesUsed.length > 0 ? houseRulesUsed.join(', ') : strings.battle.houseRulesNone}
            </p>
          )}
          {battle.notes && (
            <p className="text-bone-300">
              <span className="text-bone-200 font-semibold">{strings.campaign.notesForBattleLabel}: </span>
              {battle.notes}
            </p>
          )}

          {/* Behind the disclosure, so it takes a deliberate open-then-tap
              rather than sitting next to the row you were only scanning. */}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="min-h-[44px] text-danger text-sm font-semibold"
            >
              {strings.campaign.deleteBattle}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

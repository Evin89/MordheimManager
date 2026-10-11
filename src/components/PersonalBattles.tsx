import { useState } from 'react';
import BattleRow from './BattleRow';
import ConfirmByTyping from './ConfirmByTyping';
import { SectionHeading } from './ui';
import { strings } from '../strings';
import { useDeleteBattleMutation, usePersonalBattlesQuery } from '../hooks/useCampaign';
import { useWarbandList } from '../hooks/useWarbands';

/**
 * §34.3 — Your Battles: every battle fought outside a campaign, and every
 * friendly. Lives on the Battle tab so it's there whether or not the player is
 * in a campaign; it used to sit in the Campaign tab's empty state and vanished
 * the moment they joined one. Hidden while there's nothing to list.
 */
export default function PersonalBattles() {
  const warbands = useWarbandList();
  const { data: battles } = usePersonalBattlesQuery();
  const deleteBattle = useDeleteBattleMutation(undefined);
  const [confirming, setConfirming] = useState<string | null>(null);

  if (!battles || battles.length === 0) return null;

  function warbandName(id: string): string {
    return warbands.find((w) => w.id === id)?.name ?? strings.campaign.unknownWarband;
  }

  return (
    <section className="space-y-3 pt-4">
      <SectionHeading>{strings.battle.historySection}</SectionHeading>
      <p className="text-bone-300 text-xs">{strings.battle.historyHint}</p>
      <div className="space-y-2">
        {[...battles].reverse().map((battle) => (
          <div key={battle.id} className="space-y-2">
            <BattleRow
              battle={battle}
              warbandName={warbandName(battle.warbandId)}
              onDelete={() => setConfirming(battle.id)}
            />
            {/* Can't be brought back, so type-to-confirm (§10.1), as in the
                campaign log. */}
            {confirming === battle.id && (
              <ConfirmByTyping
                phrase={battle.scenario || battle.date}
                label={strings.campaign.typeNameLabel(battle.scenario || battle.date)}
                action={strings.campaign.deleteBattleAction}
                impact={<p>{strings.battle.deletePersonalBattleConfirm(battle.scenario)}</p>}
                onConfirm={() => {
                  deleteBattle(battle.id);
                  setConfirming(null);
                }}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

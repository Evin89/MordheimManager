import { strings } from '../../strings';
import { getWyrdstoneSellPrice } from '../../lib/wyrdstonePricing';
import { countModels } from '../../lib/rating';
import { previewWarbandAfterDeaths } from './draftHelpers';
import { StepProps } from './types';

export default function StepUpkeep({ warband, draft, updateDraft }: StepProps) {
  const survivingSwords = warband.hiredSwords.filter((s) => {
    const state = draft.hiredSwords[s.id];
    return state && !state.removed;
  });

  const modelCountAfter = countModels(previewWarbandAfterDeaths(warband, draft));
  const sellPrice = getWyrdstoneSellPrice(draft.wyrdstoneSold, modelCountAfter);
  const goldAvailable = warband.gold + sellPrice;
  const totalUpkeepDue = survivingSwords.reduce((sum, s) => {
    const state = draft.hiredSwords[s.id];
    return state?.payUpkeep ? sum + s.upkeep : sum;
  }, 0);

  if (survivingSwords.length === 0) {
    return <p className="text-bone-300 text-sm">{strings.postBattle.upkeep.none}</p>;
  }

  return (
    <div className="space-y-4">
      {totalUpkeepDue > goldAvailable && (
        <p className="text-blood-500 text-sm rounded-md border border-blood-600 p-3">
          {strings.postBattle.upkeep.insufficientGoldWarning(totalUpkeepDue, goldAvailable)}
        </p>
      )}

      {survivingSwords.map((sword) => {
        const state = draft.hiredSwords[sword.id];
        return (
          <div key={sword.id} className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-2">
            <p className="text-bone-100 font-semibold">
              {sword.name} <span className="text-bone-300 font-normal">({sword.type})</span>
            </p>
            <label className="flex items-center gap-2 text-bone-200">
              <input
                type="checkbox"
                checked={state.payUpkeep}
                onChange={(e) => {
                  const payUpkeep = e.target.checked;
                  updateDraft({
                    hiredSwords: {
                      ...draft.hiredSwords,
                      [sword.id]: {
                        ...state,
                        payUpkeep,
                        removed: !payUpkeep,
                        removalReason: !payUpkeep ? 'unpaidUpkeep' : null,
                      },
                    },
                  });
                }}
                className="h-5 w-5"
              />
              {strings.postBattle.upkeep.payToggle(sword.upkeep)}
            </label>
          </div>
        );
      })}
    </div>
  );
}

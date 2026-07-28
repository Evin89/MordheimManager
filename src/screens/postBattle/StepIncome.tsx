import NumberInput from '../../components/NumberInput';
import { strings } from '../../strings';
import { getWyrdstoneSellPrice } from '../../lib/wyrdstonePricing';
import { countModels } from '../../lib/rating';
import { previewWarbandAfterDeaths } from './draftHelpers';
import { StepProps } from './types';

export default function StepIncome({ warband, draft, updateDraft }: StepProps) {
  const totalStash = warband.wyrdstoneShards + draft.wyrdstoneFound;
  const modelCountAfter = countModels(previewWarbandAfterDeaths(warband, draft));
  const sellPrice = getWyrdstoneSellPrice(draft.wyrdstoneSold, modelCountAfter);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="block text-bone-200 text-sm font-semibold" htmlFor="wyrdstone-found">
          {strings.postBattle.income.wyrdstoneFoundLabel}
        </label>
        <NumberInput
          id="wyrdstone-found"
          min={0}
          value={draft.wyrdstoneFound}
          onChange={(wyrdstoneFound) =>
            updateDraft({
              wyrdstoneFound,
              wyrdstoneSold: Math.min(draft.wyrdstoneSold, warband.wyrdstoneShards + wyrdstoneFound),
            })
          }
          className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
        />
        <p className="text-bone-300 text-sm">{strings.postBattle.income.currentStash(totalStash)}</p>
      </div>

      <div className="space-y-2">
        <label className="block text-bone-200 text-sm font-semibold" htmlFor="wyrdstone-sold">
          {strings.postBattle.income.sellLabel}
        </label>
        <NumberInput
          id="wyrdstone-sold"
          min={0}
          max={totalStash}
          value={draft.wyrdstoneSold}
          onChange={(wyrdstoneSold) => updateDraft({ wyrdstoneSold })}
          className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
        />
        <p className="text-ember-400 font-semibold">{strings.postBattle.income.sellPricePreview(sellPrice)}</p>
        <p className="text-bone-300 text-sm">{strings.postBattle.income.keepRest(totalStash - draft.wyrdstoneSold)}</p>
      </div>
    </div>
  );
}

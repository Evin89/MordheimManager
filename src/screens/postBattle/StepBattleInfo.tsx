import { useState } from 'react';
import { strings } from '../../strings';
import scenariosData from '../../data/scenarios.json';
import { BattleResult } from '../../types';
import { StepProps } from './types';

const RESULTS: BattleResult[] = ['win', 'loss', 'draw'];
const RESULT_LABEL: Record<BattleResult, string> = {
  win: strings.postBattle.battleInfo.win,
  loss: strings.postBattle.battleInfo.loss,
  draw: strings.postBattle.battleInfo.draw,
};

export default function StepBattleInfo({ draft, updateDraft }: StepProps) {
  const [useCustomScenario, setUseCustomScenario] = useState(
    draft.scenario !== '' && !scenariosData.scenarios.some((s) => s.name === draft.scenario),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="block text-bone-200 text-sm font-semibold" htmlFor="scenario-select">
          {strings.postBattle.battleInfo.scenarioLabel}
        </label>
        <select
          id="scenario-select"
          value={useCustomScenario ? '__custom__' : draft.scenario}
          onChange={(e) => {
            if (e.target.value === '__custom__') {
              setUseCustomScenario(true);
              updateDraft({ scenario: '' });
            } else {
              setUseCustomScenario(false);
              updateDraft({ scenario: e.target.value });
            }
          }}
          className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
        >
          <option value="">—</option>
          {scenariosData.scenarios.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
          <option value="__custom__">{strings.postBattle.battleInfo.scenarioCustom}</option>
        </select>
        {useCustomScenario && (
          <input
            type="text"
            value={draft.scenario}
            onChange={(e) => updateDraft({ scenario: e.target.value })}
            placeholder={strings.postBattle.battleInfo.scenarioCustomLabel}
            className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 placeholder:text-bone-300/50 focus:outline-none focus:border-ember-500"
          />
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-bone-200 text-sm font-semibold" htmlFor="opponents">
          {strings.postBattle.battleInfo.opponentsLabel}
        </label>
        <input
          id="opponents"
          type="text"
          value={draft.opponents}
          onChange={(e) => updateDraft({ opponents: e.target.value })}
          placeholder={strings.postBattle.battleInfo.opponentsPlaceholder}
          className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 placeholder:text-bone-300/50 focus:outline-none focus:border-ember-500"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-bone-200 text-sm font-semibold">{strings.postBattle.battleInfo.resultLabel}</label>
        <div className="flex gap-2">
          {RESULTS.map((result) => (
            <button
              key={result}
              type="button"
              onClick={() => updateDraft({ result })}
              className={`flex-1 min-h-[48px] rounded-md border font-semibold ${
                draft.result === result ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
              }`}
            >
              {RESULT_LABEL[result]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-bone-200 text-sm font-semibold" htmlFor="battle-date">
          {strings.postBattle.battleInfo.dateLabel}
        </label>
        <input
          id="battle-date"
          type="date"
          value={draft.date}
          onChange={(e) => updateDraft({ date: e.target.value })}
          className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-bone-200 text-sm font-semibold" htmlFor="underdog-bonus">
          {strings.postBattle.battleInfo.underdogLabel}
        </label>
        <input
          id="underdog-bonus"
          type="number"
          inputMode="numeric"
          min={0}
          value={draft.underdogBonus}
          onChange={(e) => updateDraft({ underdogBonus: Math.max(0, Number(e.target.value)) })}
          className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
        />
        <p className="text-bone-300 text-xs">{strings.postBattle.battleInfo.underdogHint}</p>
      </div>

      <div className="space-y-2">
        <label className="block text-bone-200 text-sm font-semibold" htmlFor="battle-notes">
          {strings.postBattle.battleInfo.notesLabel}
        </label>
        <textarea
          id="battle-notes"
          value={draft.notes}
          onChange={(e) => updateDraft({ notes: e.target.value })}
          className="w-full min-h-[80px] rounded-md bg-ink-900 border border-ink-700 px-3 py-2 text-bone-100 focus:outline-none focus:border-ember-500"
        />
      </div>
    </div>
  );
}

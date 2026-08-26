import { useState } from 'react';
import NumberInput from '../../components/NumberInput';
import { Button, TextField, Textarea, Select } from '../../components/ui';
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
        <Select
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
        >
          <option value="">—</option>
          {scenariosData.scenarios.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
          <option value="__custom__">{strings.postBattle.battleInfo.scenarioCustom}</option>
        </Select>
        {useCustomScenario && (
          <TextField
            type="text"
            value={draft.scenario}
            onChange={(e) => updateDraft({ scenario: e.target.value })}
            placeholder={strings.postBattle.battleInfo.scenarioCustomLabel}
          />
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-bone-200 text-sm font-semibold" htmlFor="opponents">
          {strings.postBattle.battleInfo.opponentsLabel}
        </label>
        <TextField
          id="opponents"
          type="text"
          value={draft.opponents}
          onChange={(e) => updateDraft({ opponents: e.target.value })}
          placeholder={strings.postBattle.battleInfo.opponentsPlaceholder}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-bone-200 text-sm font-semibold">{strings.postBattle.battleInfo.resultLabel}</label>
        <div className="flex gap-2">
          {RESULTS.map((result) => (
            <Button
              key={result}
              variant={draft.result === result ? 'primary' : 'secondary'}
              fullWidth={false}
              onClick={() => updateDraft({ result })}
              className="flex-1"
            >
              {RESULT_LABEL[result]}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-bone-200 text-sm font-semibold" htmlFor="battle-date">
          {strings.postBattle.battleInfo.dateLabel}
        </label>
        <TextField
          id="battle-date"
          type="date"
          value={draft.date}
          onChange={(e) => updateDraft({ date: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-bone-200 text-sm font-semibold" htmlFor="underdog-bonus">
          {strings.postBattle.battleInfo.underdogLabel}
        </label>
        <NumberInput
          id="underdog-bonus"
          min={0}
          value={draft.underdogBonus}
          onChange={(underdogBonus) => updateDraft({ underdogBonus })}
          className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
        />
        <p className="text-bone-300 text-xs">{strings.postBattle.battleInfo.underdogHint}</p>
      </div>

      <div className="space-y-2">
        <label className="block text-bone-200 text-sm font-semibold" htmlFor="enemies-taken-out">
          {strings.postBattle.battleInfo.enemiesTakenOutLabel}
        </label>
        <NumberInput
          id="enemies-taken-out"
          min={0}
          value={draft.enemiesTakenOut}
          onChange={(enemiesTakenOut) => updateDraft({ enemiesTakenOut })}
          className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
        />
        <p className="text-bone-300 text-xs">{strings.postBattle.battleInfo.enemiesTakenOutHint}</p>
      </div>

      <div className="space-y-2">
        <label className="block text-bone-200 text-sm font-semibold" htmlFor="battle-notes">
          {strings.postBattle.battleInfo.notesLabel}
        </label>
        <Textarea
          id="battle-notes"
          value={draft.notes}
          onChange={(e) => updateDraft({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}

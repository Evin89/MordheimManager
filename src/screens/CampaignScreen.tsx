import { useState } from 'react';
import { strings } from '../strings';
import { useAppStore } from '../store/useAppStore';
import { generateId } from '../lib/id';
import objectivesData from '../data/btb/objectives.json';
import { BtbObjectivesData } from '../data/types';
import { BattleRecord, BtbObjective, CAMPAIGN_SCHEMA_VERSION, Campaign, Warband } from '../types';

const objectives = (objectivesData as BtbObjectivesData).objectives;

const RESULT_LABEL: Record<BattleRecord['result'], string> = {
  win: strings.campaign.win,
  loss: strings.campaign.loss,
  draw: strings.campaign.draw,
};

const RESULT_CLASSES: Record<BattleRecord['result'], string> = {
  win: 'border-ember-500 text-ember-400',
  loss: 'border-blood-600 text-blood-500',
  draw: 'border-ink-700 text-bone-300',
};

function BattleRow({ battle, warbandName }: { battle: BattleRecord; warbandName: string }) {
  const [expanded, setExpanded] = useState(false);

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
        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded border ${RESULT_CLASSES[battle.result]}`}>
          {RESULT_LABEL[battle.result]}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-ink-800 space-y-1 text-sm">
          {battle.opponents.length > 0 && (
            <p className="text-bone-300">
              <span className="text-bone-200 font-semibold">{strings.campaign.opponentsLabel}: </span>
              {battle.opponents.join(', ')}
            </p>
          )}
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
          {battle.notes && (
            <p className="text-bone-300">
              <span className="text-bone-200 font-semibold">{strings.campaign.notesForBattleLabel}: </span>
              {battle.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ObjectiveCard({ warband, onSave }: { warband: Warband; onSave: (patch: BtbObjective | undefined) => void }) {
  const current = warband.btbObjective;
  const chosen = current ? objectives.find((o) => o.name === current.name) : undefined;

  function updateField(patch: Partial<BtbObjective>) {
    const base: BtbObjective = current ?? { name: '', progress: '', completed: false };
    onSave({ ...base, ...patch });
  }

  return (
    <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
      <p className="text-bone-100 font-semibold">{warband.name}</p>

      <div className="space-y-1">
        <label className="text-bone-300 text-sm">{strings.campaign.objectiveLabel}</label>
        <select
          value={current?.name ?? ''}
          onChange={(e) => {
            const name = e.target.value;
            if (!name) {
              onSave(undefined);
              return;
            }
            updateField({ name });
          }}
          className="w-full min-h-[44px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100"
        >
          <option value="">{strings.campaign.noObjective}</option>
          {objectives.map((o) => (
            <option key={o.id} value={o.name}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {chosen && <p className="text-bone-300 text-xs">{chosen.description}</p>}

      {current && (
        <>
          <div className="space-y-1">
            <label className="text-bone-300 text-sm">{strings.campaign.progressLabel}</label>
            <textarea
              value={current.progress}
              onChange={(e) => updateField({ progress: e.target.value })}
              placeholder={strings.campaign.progressPlaceholder}
              className="w-full min-h-[60px] rounded-md bg-ink-800 border border-ink-700 px-3 py-2 text-bone-100"
            />
          </div>
          <label className="flex items-center gap-2 text-bone-200 text-sm">
            <input
              type="checkbox"
              checked={current.completed}
              onChange={(e) => updateField({ completed: e.target.checked })}
              className="h-4 w-4"
            />
            {strings.campaign.completedLabel}
          </label>
        </>
      )}
    </div>
  );
}

export default function CampaignScreen() {
  const campaign = useAppStore((state) => state.campaign);
  const warbands = useAppStore((state) => state.warbands);
  const saveCampaign = useAppStore((state) => state.saveCampaign);
  const saveWarband = useAppStore((state) => state.saveWarband);

  const [draftName, setDraftName] = useState('My Campaign');
  const [draftUsesBtb, setDraftUsesBtb] = useState(false);

  function startCampaign() {
    const newCampaign: Campaign = {
      id: generateId(),
      schemaVersion: CAMPAIGN_SCHEMA_VERSION,
      name: draftName.trim() || 'My Campaign',
      usesBTB: draftUsesBtb,
      battles: [],
      notes: '',
    };
    saveCampaign(newCampaign);
  }

  function warbandName(id: string): string {
    return warbands.find((w) => w.id === id)?.name ?? strings.campaign.unknownWarband;
  }

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-ink-800">
        <h1 className="text-2xl font-bold text-bone-100 tracking-wide">{strings.campaign.title}</h1>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        {!campaign ? (
          <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
            <h2 className="text-bone-100 font-semibold">{strings.campaign.startTitle}</h2>
            <p className="text-bone-300 text-sm">{strings.campaign.startHint}</p>
            <div className="space-y-1">
              <label className="text-bone-300 text-sm">{strings.campaign.nameLabel}</label>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder={strings.campaign.namePlaceholder}
                className="w-full min-h-[48px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
              />
            </div>
            <label className="flex items-center gap-2 text-bone-200 text-sm">
              <input
                type="checkbox"
                checked={draftUsesBtb}
                onChange={(e) => setDraftUsesBtb(e.target.checked)}
                className="h-4 w-4"
              />
              {strings.campaign.usesBtbLabel}
            </label>
            <button
              type="button"
              onClick={startCampaign}
              className="w-full min-h-[48px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold transition-colors"
            >
              {strings.campaign.startButton}
            </button>
          </section>
        ) : (
          <>
            <section className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-bone-300 text-sm">{strings.campaign.nameLabel}</label>
                <input
                  type="text"
                  value={campaign.name}
                  onChange={(e) => saveCampaign({ ...campaign, name: e.target.value })}
                  className="w-full min-h-[48px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
                />
              </div>
              <label className="flex items-center gap-2 text-bone-200 text-sm">
                <input
                  type="checkbox"
                  checked={campaign.usesBTB}
                  onChange={(e) => saveCampaign({ ...campaign, usesBTB: e.target.checked })}
                  className="h-4 w-4"
                />
                {strings.campaign.usesBtbLabel}
              </label>
              <div className="space-y-1">
                <label className="text-bone-300 text-sm">{strings.campaign.notesLabel}</label>
                <textarea
                  value={campaign.notes}
                  onChange={(e) => saveCampaign({ ...campaign, notes: e.target.value })}
                  className="w-full min-h-[70px] rounded-md bg-ink-800 border border-ink-700 px-3 py-2 text-bone-100 focus:outline-none focus:border-ember-500"
                />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-bone-100 font-semibold">{strings.campaign.battleLogSection}</h2>
              {campaign.battles.length === 0 ? (
                <p className="text-bone-300 text-sm">{strings.campaign.noBattles}</p>
              ) : (
                <div className="space-y-2">
                  {[...campaign.battles]
                    .reverse()
                    .map((battle) => (
                      <BattleRow key={battle.id} battle={battle} warbandName={warbandName(battle.warbandId)} />
                    ))}
                </div>
              )}
            </section>

            {campaign.usesBTB && (
              <section className="space-y-3">
                <h2 className="text-bone-100 font-semibold">{strings.campaign.btbSection}</h2>
                <p className="text-bone-300 text-xs">{strings.campaign.btbHint}</p>
                {warbands.length === 0 ? (
                  <p className="text-bone-300 text-sm">{strings.trading.noWarbands}</p>
                ) : (
                  <div className="space-y-2">
                    {warbands.map((warband) => (
                      <ObjectiveCard
                        key={warband.id}
                        warband={warband}
                        onSave={(btbObjective) => saveWarband({ ...warband, btbObjective })}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

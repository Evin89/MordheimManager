import { useState } from 'react';
import { strings } from '../../strings';
import { getInjuryByRoll, getUniqueInjuries } from '../../lib/injuryLookup';
import { rollD6, rollD66 } from '../../lib/dice';
import { HenchmenGroup, Hero, HiredSword, ModelStatus } from '../../types';
import { HenchmenBattleState, HeroBattleState, HiredSwordBattleState, StepProps } from './types';

const STATUS_OPTIONS: ModelStatus[] = ['active', 'missNextGame', 'dead', 'captured', 'left'];
const uniqueInjuries = getUniqueInjuries();

function HeroInjuryCard({
  hero,
  state,
  onUpdate,
}: {
  hero: Hero;
  state: HeroBattleState;
  onUpdate: (patch: Partial<HeroBattleState>) => void;
}) {
  const [lastRoll, setLastRoll] = useState<{ tens: number; units: number; name: string } | null>(null);

  function applyInjury(name: string, effect: string) {
    const nextInjuries = [...state.injuries, { name, effect }];
    const nextStatus = name === 'Dead' ? 'dead' : name === 'Captured' ? 'captured' : state.resultingStatus;
    onUpdate({ injuries: nextInjuries, resultingStatus: nextStatus });
  }

  function rollInjury() {
    const { tens, units, key } = rollD66();
    const entry = getInjuryByRoll(key);
    if (!entry) return;
    applyInjury(entry.name, entry.effect);
    setLastRoll({ tens, units, name: entry.name });
  }

  return (
    <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
      <p className="text-bone-100 font-semibold">
        {hero.name} <span className="text-bone-300 font-normal">({hero.unitType})</span>
      </p>

      {!state.participated ? (
        <p className="text-bone-300 text-sm">{strings.postBattle.injuries.sittingOut}</p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-bone-200">
            <input
              type="checkbox"
              checked={state.outOfAction}
              onChange={(e) => onUpdate({ outOfAction: e.target.checked })}
              className="h-5 w-5"
            />
            {strings.postBattle.injuries.outOfActionToggle}
          </label>

          {state.outOfAction && (
            <div className="space-y-3 pl-1">
              {state.injuries.map((injury, idx) => (
                <div key={idx} className="rounded-md bg-ink-800 border border-ink-700 p-3">
                  <p className="text-bone-100 font-semibold">{injury.name}</p>
                  {injury.effect && <p className="text-bone-300 text-sm mt-1">{injury.effect}</p>}
                </div>
              ))}

              <button
                type="button"
                onClick={rollInjury}
                className="w-full min-h-[44px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold text-sm"
              >
                {strings.postBattle.injuries.rollD66Button}
              </button>
              {lastRoll && (
                <p className="text-bone-300 text-xs">
                  {strings.postBattle.injuries.d66ResultLabel(lastRoll.tens, lastRoll.units, lastRoll.name)}
                </p>
              )}
              {lastRoll?.name === 'Multiple Injuries' && (
                <p className="text-ember-400 text-xs">{strings.postBattle.injuries.addAnotherRoll}</p>
              )}

              <select
                value=""
                onChange={(e) => {
                  const picked = uniqueInjuries.find((i) => i.name === e.target.value);
                  if (!picked) return;
                  applyInjury(picked.name, picked.effect);
                  setLastRoll(null);
                }}
                className="w-full min-h-[44px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100"
              >
                <option value="">{strings.postBattle.injuries.rollInjury}</option>
                {uniqueInjuries.map((injury) => (
                  <option key={injury.name} value={injury.name}>
                    {injury.name}
                  </option>
                ))}
              </select>

              <div className="space-y-1">
                <label className="text-bone-300 text-sm">{strings.postBattle.injuries.statusLabel}</label>
                <select
                  value={state.resultingStatus}
                  onChange={(e) => onUpdate({ resultingStatus: e.target.value as ModelStatus })}
                  className="w-full min-h-[44px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HenchmenInjuryCard({
  group,
  state,
  onUpdate,
}: {
  group: HenchmenGroup;
  state: HenchmenBattleState;
  onUpdate: (patch: Partial<HenchmenBattleState>) => void;
}) {
  const [lastRolls, setLastRolls] = useState<number[] | null>(null);

  function rollCasualties() {
    if (state.outOfActionCount === 0) return;
    const rolls = Array.from({ length: state.outOfActionCount }, () => rollD6());
    const diedCount = rolls.filter((r) => r <= 2).length;
    setLastRolls(rolls);
    onUpdate({ diedCount });
  }

  return (
    <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
      <p className="text-bone-100 font-semibold">
        {group.groupName}{' '}
        <span className="text-bone-300 font-normal">
          ({group.count}x {group.unitType})
        </span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-bone-300 text-xs uppercase">{strings.postBattle.injuries.henchmenOutOfAction}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={group.count}
            value={state.outOfActionCount}
            onChange={(e) => {
              const outOfActionCount = Math.max(0, Math.min(group.count, Number(e.target.value)));
              setLastRolls(null);
              onUpdate({ outOfActionCount, diedCount: Math.min(state.diedCount, outOfActionCount) });
            }}
            className="min-h-[44px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-bone-300 text-xs uppercase">{strings.postBattle.injuries.henchmenDied}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={state.outOfActionCount}
            value={state.diedCount}
            onChange={(e) => {
              setLastRolls(null);
              onUpdate({ diedCount: Math.max(0, Math.min(state.outOfActionCount, Number(e.target.value))) });
            }}
            className="min-h-[44px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100"
          />
        </label>
      </div>

      {state.outOfActionCount > 0 && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={rollCasualties}
            className="w-full min-h-[44px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold text-sm"
          >
            {strings.postBattle.injuries.rollCasualtiesButton}
          </button>
          {lastRolls && (
            <p className="text-bone-300 text-xs">
              {strings.postBattle.injuries.diceRollsLabel(lastRolls)} —{' '}
              {strings.postBattle.injuries.diedCountResult(lastRolls.filter((r) => r <= 2).length, lastRolls.length)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function HiredSwordInjuryCard({
  sword,
  state,
  onUpdate,
}: {
  sword: HiredSword;
  state: HiredSwordBattleState;
  onUpdate: (patch: Partial<HiredSwordBattleState>) => void;
}) {
  const [lastRoll, setLastRoll] = useState<number | null>(null);

  function rollFate() {
    const roll = rollD6();
    const lost = roll <= 2;
    setLastRoll(roll);
    onUpdate({ removed: lost, removalReason: lost ? 'diedInBattle' : null });
  }

  return (
    <div className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
      <p className="text-bone-100 font-semibold">
        {sword.name} <span className="text-bone-300 font-normal">({sword.type})</span>
      </p>
      {!state.participated ? (
        <p className="text-bone-300 text-sm">{strings.postBattle.injuries.sittingOut}</p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-bone-200">
            <input
              type="checkbox"
              checked={state.outOfAction}
              onChange={(e) => {
                setLastRoll(null);
                onUpdate({ outOfAction: e.target.checked });
              }}
              className="h-5 w-5"
            />
            {strings.postBattle.injuries.outOfActionToggle}
          </label>
          {state.outOfAction && (
            <div className="space-y-2 pl-1">
              <p className="text-bone-300 text-xs">{strings.postBattle.injuries.hiredSwordLostHint}</p>
              <button
                type="button"
                onClick={rollFate}
                className="w-full min-h-[44px] rounded-md bg-ember-500 hover:bg-ember-600 text-ink-950 font-semibold text-sm"
              >
                {strings.postBattle.injuries.rollD6Button}
              </button>
              {lastRoll !== null && (
                <p className="text-bone-300 text-xs">
                  {strings.postBattle.injuries.d6ResultLabel(lastRoll, state.removed)}
                </p>
              )}
              <label className="flex items-center gap-2 text-bone-200">
                <input
                  type="checkbox"
                  checked={state.removed}
                  onChange={(e) => {
                    setLastRoll(null);
                    onUpdate({
                      removed: e.target.checked,
                      removalReason: e.target.checked ? 'diedInBattle' : null,
                    });
                  }}
                  className="h-5 w-5"
                />
                {strings.postBattle.injuries.hiredSwordLostToggle}
              </label>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function StepInjuries({ warband, draft, updateDraft }: StepProps) {
  const participatingHeroes = warband.heroes.filter((h) => draft.heroes[h.id]);
  const participatingSwords = warband.hiredSwords.filter((s) => draft.hiredSwords[s.id]);
  const nothingToShow =
    participatingHeroes.length === 0 && warband.henchmenGroups.length === 0 && participatingSwords.length === 0;

  return (
    <div className="space-y-6">
      {nothingToShow && <p className="text-bone-300 text-sm">{strings.postBattle.injuries.none}</p>}

      {participatingHeroes.map((hero) => (
        <HeroInjuryCard
          key={hero.id}
          hero={hero}
          state={draft.heroes[hero.id]}
          onUpdate={(patch) =>
            updateDraft((current) => ({
              heroes: { ...current.heroes, [hero.id]: { ...current.heroes[hero.id], ...patch } },
            }))
          }
        />
      ))}

      {warband.henchmenGroups.map((group) => {
        const state = draft.henchmenGroups[group.id];
        if (!state) return null;
        return (
          <HenchmenInjuryCard
            key={group.id}
            group={group}
            state={state}
            onUpdate={(patch) =>
              updateDraft((current) => ({
                henchmenGroups: {
                  ...current.henchmenGroups,
                  [group.id]: { ...current.henchmenGroups[group.id], ...patch },
                },
              }))
            }
          />
        );
      })}

      {participatingSwords.map((sword) => (
        <HiredSwordInjuryCard
          key={sword.id}
          sword={sword}
          state={draft.hiredSwords[sword.id]}
          onUpdate={(patch) =>
            updateDraft((current) => ({
              hiredSwords: { ...current.hiredSwords, [sword.id]: { ...current.hiredSwords[sword.id], ...patch } },
            }))
          }
        />
      ))}
    </div>
  );
}

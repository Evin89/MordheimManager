import { strings } from '../../strings';
import { getUniqueInjuries } from '../../lib/injuryLookup';
import { ModelStatus } from '../../types';
import { StepProps } from './types';

const STATUS_OPTIONS: ModelStatus[] = ['active', 'missNextGame', 'dead', 'captured', 'left'];
const uniqueInjuries = getUniqueInjuries();

export default function StepInjuries({ warband, draft, updateDraft }: StepProps) {
  const participatingHeroes = warband.heroes.filter((h) => draft.heroes[h.id]);
  const participatingSwords = warband.hiredSwords.filter((s) => draft.hiredSwords[s.id]);
  const nothingToShow =
    participatingHeroes.length === 0 && warband.henchmenGroups.length === 0 && participatingSwords.length === 0;

  return (
    <div className="space-y-6">
      {nothingToShow && <p className="text-bone-300 text-sm">{strings.postBattle.injuries.none}</p>}

      {participatingHeroes.map((hero) => {
        const state = draft.heroes[hero.id];
        return (
          <div key={hero.id} className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
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
                    onChange={(e) =>
                      updateDraft({
                        heroes: { ...draft.heroes, [hero.id]: { ...state, outOfAction: e.target.checked } },
                      })
                    }
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

                    <select
                      value=""
                      onChange={(e) => {
                        const picked = uniqueInjuries.find((i) => i.name === e.target.value);
                        if (!picked) return;
                        const nextInjuries = [...state.injuries, { name: picked.name, effect: picked.effect }];
                        const nextStatus =
                          picked.name === 'Dead' ? 'dead' : picked.name === 'Captured' ? 'captured' : state.resultingStatus;
                        updateDraft({
                          heroes: {
                            ...draft.heroes,
                            [hero.id]: { ...state, injuries: nextInjuries, resultingStatus: nextStatus },
                          },
                        });
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
                        onChange={(e) =>
                          updateDraft({
                            heroes: {
                              ...draft.heroes,
                              [hero.id]: { ...state, resultingStatus: e.target.value as ModelStatus },
                            },
                          })
                        }
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
      })}

      {warband.henchmenGroups.map((group) => {
        const state = draft.henchmenGroups[group.id];
        if (!state) return null;
        return (
          <div key={group.id} className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
            <p className="text-bone-100 font-semibold">
              {group.groupName} <span className="text-bone-300 font-normal">({group.count}x {group.unitType})</span>
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
                    updateDraft({
                      henchmenGroups: {
                        ...draft.henchmenGroups,
                        [group.id]: {
                          ...state,
                          outOfActionCount,
                          diedCount: Math.min(state.diedCount, outOfActionCount),
                        },
                      },
                    });
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
                  onChange={(e) =>
                    updateDraft({
                      henchmenGroups: {
                        ...draft.henchmenGroups,
                        [group.id]: {
                          ...state,
                          diedCount: Math.max(0, Math.min(state.outOfActionCount, Number(e.target.value))),
                        },
                      },
                    })
                  }
                  className="min-h-[44px] rounded-md bg-ink-800 border border-ink-700 px-3 text-bone-100"
                />
              </label>
            </div>
          </div>
        );
      })}

      {participatingSwords.map((sword) => {
        const state = draft.hiredSwords[sword.id];
        return (
          <div key={sword.id} className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
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
                    onChange={(e) =>
                      updateDraft({
                        hiredSwords: { ...draft.hiredSwords, [sword.id]: { ...state, outOfAction: e.target.checked } },
                      })
                    }
                    className="h-5 w-5"
                  />
                  {strings.postBattle.injuries.outOfActionToggle}
                </label>
                {state.outOfAction && (
                  <div className="space-y-2 pl-1">
                    <p className="text-bone-300 text-xs">{strings.postBattle.injuries.hiredSwordLostHint}</p>
                    <label className="flex items-center gap-2 text-bone-200">
                      <input
                        type="checkbox"
                        checked={state.removed}
                        onChange={(e) =>
                          updateDraft({
                            hiredSwords: {
                              ...draft.hiredSwords,
                              [sword.id]: {
                                ...state,
                                removed: e.target.checked,
                                removalReason: e.target.checked ? 'diedInBattle' : null,
                              },
                            },
                          })
                        }
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
      })}
    </div>
  );
}

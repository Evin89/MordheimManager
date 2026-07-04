import { strings } from '../../strings';
import { StepProps } from './types';

export default function StepDeadCleanup({ warband, draft, updateDraft }: StepProps) {
  const deadHeroes = warband.heroes.filter((h) => {
    const state = draft.heroes[h.id];
    return state && ['dead', 'captured', 'left'].includes(state.resultingStatus) && h.equipment.length > 0;
  });

  const wipedGroups = warband.henchmenGroups.filter((g) => {
    const state = draft.henchmenGroups[g.id];
    return state && state.diedCount >= g.count && g.equipment.length > 0;
  });

  const emptiedGroups = warband.henchmenGroups.filter((g) => {
    const state = draft.henchmenGroups[g.id];
    return state && state.diedCount >= g.count;
  });

  const nothingToShow = deadHeroes.length === 0 && wipedGroups.length === 0 && emptiedGroups.length === 0;

  return (
    <div className="space-y-4">
      {nothingToShow && <p className="text-bone-300 text-sm">{strings.postBattle.deadCleanup.none}</p>}

      {deadHeroes.map((hero) => {
        const state = draft.heroes[hero.id];
        return (
          <div key={hero.id} className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-2">
            <p className="text-bone-100 font-semibold">{hero.name}</p>
            <p className="text-bone-300 text-sm">
              {hero.equipment.length} item{hero.equipment.length === 1 ? '' : 's'}: {hero.equipment.map((e) => e.name).join(', ')}
            </p>
            <p className="text-bone-300 text-sm">{strings.postBattle.deadCleanup.equipmentFate}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  updateDraft({ heroes: { ...draft.heroes, [hero.id]: { ...state, equipmentFate: 'treasury' } } })
                }
                className={`flex-1 min-h-[40px] rounded-md border text-sm font-semibold ${
                  state.equipmentFate === 'treasury' ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
                }`}
              >
                {strings.postBattle.deadCleanup.toTreasury}
              </button>
              <button
                type="button"
                onClick={() => updateDraft({ heroes: { ...draft.heroes, [hero.id]: { ...state, equipmentFate: 'lost' } } })}
                className={`flex-1 min-h-[40px] rounded-md border text-sm font-semibold ${
                  state.equipmentFate === 'lost' ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
                }`}
              >
                {strings.postBattle.deadCleanup.lost}
              </button>
            </div>
          </div>
        );
      })}

      {emptiedGroups.map((group) => {
        const state = draft.henchmenGroups[group.id];
        const hasEquipment = group.equipment.length > 0;
        return (
          <div key={group.id} className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-2">
            <p className="text-bone-100 font-semibold">{strings.postBattle.deadCleanup.henchmenWipedTitle(group.groupName)}</p>
            {hasEquipment && (
              <>
                <p className="text-bone-300 text-sm">
                  {group.equipment.length} item{group.equipment.length === 1 ? '' : 's'}: {group.equipment.map((e) => e.name).join(', ')}
                </p>
                <p className="text-bone-300 text-sm">{strings.postBattle.deadCleanup.equipmentFate}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft({
                        henchmenGroups: { ...draft.henchmenGroups, [group.id]: { ...state, equipmentFateForDead: 'treasury' } },
                      })
                    }
                    className={`flex-1 min-h-[40px] rounded-md border text-sm font-semibold ${
                      state.equipmentFateForDead === 'treasury'
                        ? 'bg-ember-500 text-ink-950 border-ember-500'
                        : 'border-ink-700 text-bone-200'
                    }`}
                  >
                    {strings.postBattle.deadCleanup.toTreasury}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft({
                        henchmenGroups: { ...draft.henchmenGroups, [group.id]: { ...state, equipmentFateForDead: 'lost' } },
                      })
                    }
                    className={`flex-1 min-h-[40px] rounded-md border text-sm font-semibold ${
                      state.equipmentFateForDead === 'lost' ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
                    }`}
                  >
                    {strings.postBattle.deadCleanup.lost}
                  </button>
                </div>
              </>
            )}
            <label className="flex items-center gap-2 text-bone-200 pt-2">
              <input
                type="checkbox"
                checked={state.deleteGroupIfEmpty}
                onChange={(e) =>
                  updateDraft({
                    henchmenGroups: { ...draft.henchmenGroups, [group.id]: { ...state, deleteGroupIfEmpty: e.target.checked } },
                  })
                }
                className="h-5 w-5"
              />
              {strings.postBattle.deadCleanup.deleteGroup}
            </label>
          </div>
        );
      })}
    </div>
  );
}

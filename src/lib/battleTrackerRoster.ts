import type { BattleSession, OutOfActionTally } from '../store/useAppStore';
import type { Warband } from '../types';
import { EMPTY_COUNTS, MODEL_STATES, reconcileGroup } from './turnTracker';
import type { StateCounts } from './turnTracker';

export function trackerRoster(warband: Warband) {
  return [
    ...warband.heroes.filter((hero) => hero.status === 'active')
      .map((hero) => ({ ...hero, key: 'heroIds' as const, count: 1 })),
    ...warband.henchmenGroups.map((group) => ({
      ...group, name: group.groupName, key: 'henchmenCounts' as const, spells: [],
      spellReductions: undefined,
    })),
    ...warband.hiredSwords.filter((sword) => sword.status === 'active')
      .map((sword) => ({ ...sword, unitType: sword.type, key: 'hiredSwordIds' as const, count: 1 })),
  ];
}

export type TrackerModel = ReturnType<typeof trackerRoster>[number];
const states = [...MODEL_STATES, 'rallied'] as const;

export function tallyCount(tally: OutOfActionTally | undefined, { id, key }: TrackerModel): number {
  if (!tally) return 0;
  return key === 'henchmenCounts' ? tally[key][id] ?? 0 : Number(tally[key].includes(id));
}

export function modelCounts(session: BattleSession, model: TrackerModel): StateCounts {
  const counts = { ...EMPTY_COUNTS };
  for (const state of states) counts[state] = tallyCount(session[state], model);
  return reconcileGroup(counts, model.count);
}

export function writeModelCounts(session: BattleSession, { id, key }: TrackerModel, counts: StateCounts) {
  const updated = { ...session };
  for (const state of states) {
    const tally = session[state];
    const count = counts[state];
    const next = {
      heroIds: tally?.heroIds ?? [],
      hiredSwordIds: tally?.hiredSwordIds ?? [],
      henchmenCounts: { ...tally?.henchmenCounts },
    };
    if (key === 'henchmenCounts') {
      if (count) next[key][id] = count;
      else delete next[key][id];
    } else {
      next[key] = next[key].filter((entry) => entry !== id);
      if (count) next[key].push(id);
    }
    updated[state] = next;
  }
  return updated;
}

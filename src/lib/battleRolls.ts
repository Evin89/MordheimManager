import { getInjuryByRoll } from './injuryLookup';
import { setModelState } from './turnTracker';
import type { ModelState, StateCounts } from './turnTracker';
import { underdogFor } from './underdog';
import type { HeroBattleState } from '../screens/postBattle/types';

export type RatingsAtStart = { mine: number; theirs: number | null };

export function battleUnderdog(ratings?: RatingsAtStart) {
  if (!ratings || ratings.theirs === null) return undefined;
  const { mine, theirs } = ratings;
  const result = underdogFor([mine, theirs]);
  if (!result.compared) return undefined;
  return { mine, theirs, gap: result.gap, bonus: result.underdog === 0 ? result.bonus : 0 };
}

// Shared D6 injury mapping for all wound rolls.
export function woundResult(roll: number) {
  return roll <= 2 ? 'knockedDown' : roll <= 4 ? 'stunned' : 'outOfAction';
}

export type WoundSource = Exclude<ModelState, 'outOfAction'> | 'standing';

export function applyGroupWounds(counts: StateCounts, from: WoundSource, to: ModelState, count: number) {
  if (from === to) return counts;
  const next = { ...counts, [to]: counts[to] + count };
  if (from !== 'standing') next[from] -= count;
  return next;
}

export function applyWoundRolls(before: StateCounts, rolls: number[], groupSource?: WoundSource) {
  const results = rolls.map(woundResult);
  let counts = before;
  for (const result of results) {
    if (result === 'outOfAction') continue;
    counts = groupSource
      ? applyGroupWounds(counts, groupSource, result, 1)
      : setModelState(counts, result);
  }
  return { counts, undo: before, results };
}

export function recordSeriousInjury(
  injuries: Record<string, string> | undefined, outOfAction: readonly string[], heroId: string, key: string,
) {
  if (!outOfAction.includes(heroId) || !getInjuryByRoll(key)) return injuries;
  return { ...injuries, [heroId]: key };
}

export function seedTableInjury(state: HeroBattleState, key?: string): HeroBattleState {
  const entry = key && state.participated && state.outOfAction ? getInjuryByRoll(key) : undefined;
  if (!entry) return state;
  return {
    ...state,
    tableInjuryRoll: key,
    injuries: [...state.injuries, { name: entry.name, effect: entry.effect }],
    resultingStatus: injuryStatus(entry.name, state.resultingStatus),
  };
}

export function injuryStatus(name: string, fallback: HeroBattleState['resultingStatus']) {
  return name === 'Dead' ? 'dead' : name === 'Captured' ? 'captured' : fallback;
}

import explorationData from '../data/exploration.json';
import { ExplorationData, ExplorationResult, ExplorationYield } from '../data/types';

const data = explorationData as ExplorationData;

/** The hard cap from the rulebook: however many dice you rolled, at most six count. */
export const MAX_DICE_KEPT = data.procedure.maxDiceKept;

export function getExplorationSource(): string {
  return data.source;
}

/**
 * Dice the warband is entitled to before any skills or equipment: one per Hero who
 * survived without going out of action, plus one for a win. Heroes who sat the game
 * out never searched, so they grant nothing either.
 */
export function baseDiceCount(survivingHeroes: number, won: boolean): number {
  return survivingHeroes + (won ? 1 : 0);
}

/** Shards found for the summed dice, from the rulebook's lookup table. */
export function shardsForTotal(total: number): number {
  for (const row of data.shardsFound.table) {
    if (total >= row.min && (row.max === null || total <= row.max)) return row.shards;
  }
  // Below the first row (an empty dice pool) nothing was searched, so nothing is found.
  return 0;
}

export type ExplorationMatch = {
  result: ExplorationResult;
  face: number;
  count: number;
};

/**
 * Finds the location the kept dice point at, or null if there are no multiples.
 *
 * Ties are broken the way the rulebook says: the most numerous set wins (a triple
 * beats a double), and between two sets of the same size the higher face wins
 * (double 3 beats double 1). A set larger than six can't occur, since at most six
 * dice are ever kept.
 */
export function findMultiple(dice: number[]): ExplorationMatch | null {
  const counts = new Map<number, number>();
  for (const die of dice) counts.set(die, (counts.get(die) ?? 0) + 1);

  let best: { face: number; count: number } | null = null;
  for (const [face, count] of counts) {
    if (count < 2) continue;
    if (!best || count > best.count || (count === best.count && face > best.face)) {
      best = { face, count };
    }
  }
  if (!best) return null;

  const { face, count } = best;
  const result = data.explorationChart.find((r) => r.face === face && r.count === count);
  return result ? { result, face, count } : null;
}

export type ResolvedEffect = {
  effect: string;
  autoYield?: ExplorationYield;
  persistent: boolean;
  /** Set when a warband-specific variant replaced the generic outcome. */
  variantWarbands?: string[];
};

/**
 * The outcome that actually applies to this warband. Several locations are resolved
 * differently by Skaven, Undead, the Possessed, Witch Hunters and the Sisters — the
 * generic entry is only correct for everyone else, so picking it blindly would hand a
 * Skaven player gold they don't get and cost them the gold they do.
 */
export function resolveForWarband(result: ExplorationResult, warbandType: string): ResolvedEffect {
  const variant = result.warbandVariants?.find((v) => v.warbands.includes(warbandType));
  if (variant) {
    return {
      effect: variant.effect,
      autoYield: variant.autoYield,
      persistent: variant.persistent ?? false,
      variantWarbands: variant.warbands,
    };
  }
  return { effect: result.effect, autoYield: result.autoYield, persistent: result.persistent ?? false };
}

/** The sub-table row a D6 landed on, e.g. "3-4" matching a roll of 4. */
export function subTableRowFor(result: ExplorationResult, roll: number) {
  return result.subTable?.entries.find((entry) => {
    const [from, to] = entry.roll.split('-');
    const min = Number(from);
    const max = to === undefined ? min : Number(to);
    return roll >= min && roll <= max;
  });
}

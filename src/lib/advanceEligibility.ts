import { StatIncreases } from '../screens/postBattle/types';
import { StatLine } from '../types';
import xpData from '../data/xpThresholds.json';
import { XpThresholdsData } from '../data/types';

const data = xpData as XpThresholdsData;

function thresholdValues(entries: XpThresholdsData['heroThresholds']): number[] {
  return entries
    .map((e) => e.xp)
    .filter((xp): xp is number => xp !== null)
    .sort((a, b) => a - b);
}

const heroValues = thresholdValues(data.heroThresholds);
const henchmenValues = thresholdValues(data.henchmenThresholds);

/**
 * How many advances a model earned from this battle.
 *
 * An advance is due each time the Experience track crosses a marked box, so
 * this counts thresholds strictly above the pre-battle total and at or below
 * the new one. A warrior who gains 3 XP in one battle and passes two boxes gets
 * two advances; one who gains 3 and passes none gets nothing.
 *
 * The wizard previously offered an advance to every model that gained *any*
 * XP, which is why the step showed far more advances than the campaign should
 * ever hand out.
 */
export function advancesDue(xpBefore: number, xpAfter: number, kind: 'hero' | 'henchmen'): number {
  const values = kind === 'henchmen' ? henchmenValues : heroValues;
  return values.filter((v) => v > xpBefore && v <= xpAfter).length;
}

/** The characteristic value a model would have once staged increases apply. */
export function effectiveStat(
  currentStats: StatLine,
  statIncreases: StatIncreases,
  key: keyof StatLine,
): number {
  return currentStats[key] + (statIncreases[key] ?? 0);
}

/**
 * Whether a characteristic can still be raised.
 *
 * Counts increases already staged in this wizard, not just the saved statline —
 * otherwise two advances in one battle could both be spent on a characteristic
 * with only one point of headroom, pushing it past its racial maximum.
 *
 * A model with no recorded maximums (Hired Swords, whose source lists none) is
 * treated as unconstrained rather than blocked.
 */
export function canIncreaseStat(
  currentStats: StatLine,
  statMaximums: StatLine | undefined,
  statIncreases: StatIncreases,
  key: keyof StatLine,
): boolean {
  if (!statMaximums) return true;
  return effectiveStat(currentStats, statIncreases, key) < statMaximums[key];
}

/** Characteristics already at their racial maximum, for messaging. */
export function maxedStats(
  currentStats: StatLine,
  statMaximums: StatLine | undefined,
  statIncreases: StatIncreases,
  keys: readonly (keyof StatLine)[],
): (keyof StatLine)[] {
  if (!statMaximums) return [];
  return keys.filter((k) => !canIncreaseStat(currentStats, statMaximums, statIncreases, k));
}

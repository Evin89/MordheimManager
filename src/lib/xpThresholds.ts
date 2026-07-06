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

export type AdvanceProgress = {
  nextThreshold: number | null; // null once past the last threshold (maxed out)
  xpToNext: number | null; // remaining XP to reach nextThreshold
  atThreshold: boolean; // current XP is exactly on an advance box
  maxed: boolean; // no further advances available
};

/**
 * Given a model's current total experience, works out its progress toward the next
 * advance, using the thresholds read from the official roster sheet's Experience track.
 * `kind` picks the Hero or Henchman track (Hired Swords use the Hero track).
 */
export function getAdvanceProgress(xp: number, kind: 'hero' | 'henchmen'): AdvanceProgress {
  const values = kind === 'henchmen' ? henchmenValues : heroValues;
  if (values.length === 0) {
    return { nextThreshold: null, xpToNext: null, atThreshold: false, maxed: false };
  }

  const atThreshold = values.includes(xp);
  const next = values.find((v) => v > xp) ?? null;
  if (next === null) {
    return { nextThreshold: null, xpToNext: null, atThreshold, maxed: true };
  }
  return { nextThreshold: next, xpToNext: next - xp, atThreshold, maxed: false };
}

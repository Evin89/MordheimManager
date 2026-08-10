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
 * Every advance threshold on a track, ascending.
 *
 * The printed roster sheet draws these as thick-bordered boxes in the
 * Experience track, so the sheet needs the values themselves rather than the
 * progress summary below. Kept here so the JSON is still read in exactly one
 * place.
 */
export function getAdvanceThresholds(kind: 'hero' | 'henchmen'): number[] {
  return kind === 'henchmen' ? henchmenValues : heroValues;
}

/** How long each track runs on the official sheet: 90 boxes for a Hero across
 * three rows of 30, 14 for a Henchman. Read off the sheet — see the `source`
 * note in xpThresholds.json. */
export const TRACK_LENGTH = { hero: 90, henchmen: 14 } as const;

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

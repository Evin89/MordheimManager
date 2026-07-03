import { NullableStatLine } from '../data/types';
import { StatLine } from '../types';

const STAT_KEYS: (keyof StatLine)[] = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'];

/** Converts a possibly-incomplete data-file stat line into a concrete one, defaulting unverified (null) stats to 0. */
export function resolveStatLine(nullable: NullableStatLine): { stats: StatLine; hadMissingStats: boolean } {
  let hadMissingStats = false;
  const stats = {} as StatLine;
  for (const key of STAT_KEYS) {
    const value = nullable[key];
    if (value === null) {
      hadMissingStats = true;
      stats[key] = 0;
    } else {
      stats[key] = value;
    }
  }
  return { stats, hadMissingStats };
}

export function isAtOrAboveMax(value: number, max: number): boolean {
  return value >= max;
}

export { STAT_KEYS };

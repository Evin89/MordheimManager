import injuriesData from '../data/injuries.json';
import { InjuryTableEntry } from '../data/types';
import { StatLine } from '../types';

/** Collapses the 36-row D66 table down to its unique named results (many rolls share the same outcome text). */
export function getUniqueInjuries(): InjuryTableEntry[] {
  const seen = new Map<string, InjuryTableEntry>();
  for (const entry of injuriesData.table) {
    if (!seen.has(entry.name)) {
      seen.set(entry.name, entry);
    }
  }
  return Array.from(seen.values());
}

/** Looks up the table row for a rolled D66 key, e.g. "24" for tens=2, units=4. */
export function getInjuryByRoll(key: string): InjuryTableEntry | undefined {
  return injuriesData.table.find((entry) => entry.roll === key);
}

/** The characteristic penalty of a named result on the table, if it has one. */
export function injuryStatChange(name: string): Partial<StatLine> | undefined {
  return (injuriesData.table as InjuryTableEntry[]).find((e) => e.name === name)?.statChange;
}

/**
 * Applies (direction 1) or undoes (direction -1) an injury's characteristic
 * change. Never below 0: a profile can't go negative, and undoing a penalty
 * that was clamped then restores at most what the table says.
 */
export function applyInjuryStatChange(
  stats: StatLine,
  change: Partial<StatLine> | undefined,
  direction: 1 | -1 = 1,
): StatLine {
  if (!change) return stats;
  const next = { ...stats };
  for (const [key, delta] of Object.entries(change) as [keyof StatLine, number][]) {
    next[key] = Math.max(0, next[key] + delta * direction);
  }
  return next;
}

/** "−1 T", "−1 M, −1 WS" — for confirm and toast copy. */
export function formatStatChange(change: Partial<StatLine>): string {
  return (Object.entries(change) as [keyof StatLine, number][])
    .map(([key, delta]) => `${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${key}`)
    .join(', ');
}

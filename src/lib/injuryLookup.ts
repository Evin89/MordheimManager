import injuriesData from '../data/injuries.json';
import { InjuryTableEntry } from '../data/types';

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

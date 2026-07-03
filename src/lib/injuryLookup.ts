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

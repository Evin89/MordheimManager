import { WarbandDefinition } from './types';
import maneaters from './warbands/maneaters.json';

// Every playable warband definition, keyed by id. Add new warbands here as
// their data files are populated.
export const warbandDefinitions: WarbandDefinition[] = [maneaters as WarbandDefinition];

export function getWarbandDefinition(id: string): WarbandDefinition | undefined {
  return warbandDefinitions.find((def) => def.id === id);
}

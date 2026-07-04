import { WarbandDefinition } from './types';
import maneaters from './warbands/maneaters.json';
import reiklanders from './warbands/reiklanders.json';
import middenheimers from './warbands/middenheimers.json';
import marienburgers from './warbands/marienburgers.json';
import cultOfThePossessed from './warbands/cult-of-the-possessed.json';
import witchHunters from './warbands/witch-hunters.json';
import sistersOfSigmar from './warbands/sisters-of-sigmar.json';
import undead from './warbands/undead.json';
import skaven from './warbands/skaven.json';

// Every playable warband definition, keyed by id. Add new warbands here as
// their data files are populated.
export const warbandDefinitions: WarbandDefinition[] = [
  maneaters,
  reiklanders,
  middenheimers,
  marienburgers,
  cultOfThePossessed,
  witchHunters,
  sistersOfSigmar,
  undead,
  skaven,
] as WarbandDefinition[];

export function getWarbandDefinition(id: string): WarbandDefinition | undefined {
  return warbandDefinitions.find((def) => def.id === id);
}

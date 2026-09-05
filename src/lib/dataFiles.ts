// A registry of the app's bundled game-data files and their provenance, for the
// "Game data" display on the Account screen (§4.6). Every data file already
// carries `schemaVersion` and `source`, so this is presentation, not plumbing.
//
// Named imports pull only the two strings from each JSON (tree-shaken), so the
// large data blobs themselves don't ride along into the Account route.
import { schemaVersion as advancesV, source as advancesS } from '../data/advances.json';
import { schemaVersion as dramatisV, source as dramatisS } from '../data/dramatisPersonae.json';
import { schemaVersion as equipmentV, source as equipmentS } from '../data/equipment.json';
import { schemaVersion as explorationV, source as explorationS } from '../data/exploration.json';
import { schemaVersion as hiredSwordsV, source as hiredSwordsS } from '../data/hiredSwords.json';
import { schemaVersion as injuriesV, source as injuriesS } from '../data/injuries.json';
import { schemaVersion as racialV, source as racialS } from '../data/racialMaximums.json';
import { schemaVersion as rulesV, source as rulesS } from '../data/rules.json';
import { schemaVersion as scenarioWeightsV, source as scenarioWeightsS } from '../data/scenarioWeights.json';
import { schemaVersion as scenariosV, source as scenariosS } from '../data/scenarios.json';
import { schemaVersion as skillsV, source as skillsS } from '../data/skills.json';
import { schemaVersion as specialRulesV, source as specialRulesS } from '../data/specialRules.json';
import { schemaVersion as spellsV, source as spellsS } from '../data/spells.json';
import { schemaVersion as wyrdstoneV, source as wyrdstoneS } from '../data/wyrdstonePrices.json';
import { schemaVersion as xpV, source as xpS } from '../data/xpThresholds.json';

export type DataFileInfo = { name: string; version: number; source: string };

export const DATA_FILES: DataFileInfo[] = [
  { name: 'Advance tables', version: advancesV, source: advancesS },
  { name: 'Dramatis Personae', version: dramatisV, source: dramatisS },
  { name: 'Equipment', version: equipmentV, source: equipmentS },
  { name: 'Exploration chart', version: explorationV, source: explorationS },
  { name: 'Hired Swords', version: hiredSwordsV, source: hiredSwordsS },
  { name: 'Serious injuries', version: injuriesV, source: injuriesS },
  { name: 'Racial maximums', version: racialV, source: racialS },
  { name: 'Rules reference', version: rulesV, source: rulesS },
  { name: 'Scenarios', version: scenariosV, source: scenariosS },
  { name: 'Scenario weights', version: scenarioWeightsV, source: scenarioWeightsS },
  { name: 'Skills', version: skillsV, source: skillsS },
  { name: 'Special rules', version: specialRulesV, source: specialRulesS },
  { name: 'Spells & prayers', version: spellsV, source: spellsS },
  { name: 'Wyrdstone prices', version: wyrdstoneV, source: wyrdstoneS },
  { name: 'XP thresholds', version: xpV, source: xpS },
].sort((a, b) => a.name.localeCompare(b.name));

/** A compact `{ "Scenarios": 1, … }` map for attaching to a data-error report,
 * so an admin sees exactly which data versions the reporter was running. */
export function dataVersions(): Record<string, number> {
  return Object.fromEntries(DATA_FILES.map((f) => [f.name, f.version]));
}

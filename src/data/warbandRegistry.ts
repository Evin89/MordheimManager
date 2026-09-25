import { ResolvedSpecialRule, WarbandDefinition } from './types';
import { resolveSpecialRules } from '../lib/specialRulesLookup';
import { getCustomWarbandDefinition } from './customWarbandTypes';
import { builtInWarbandNames } from './warbandNames';
import maneaters from './warbands/maneaters.json';
import reiklanders from './warbands/reiklanders.json';
import middenheimers from './warbands/middenheimers.json';
import marienburgers from './warbands/marienburgers.json';
import cultOfThePossessed from './warbands/cult-of-the-possessed.json';
import witchHunters from './warbands/witch-hunters.json';
import sistersOfSigmar from './warbands/sisters-of-sigmar.json';
import undead from './warbands/undead.json';
import skaven from './warbands/skaven.json';
import averlanders from './warbands/averlanders.json';
import beastmenRaiders from './warbands/beastmen-raiders.json';
import carnivalOfChaos from './warbands/carnival-of-chaos.json';
import dwarfTreasureHunters from './warbands/dwarf-treasure-hunters.json';
import kislevites from './warbands/kislevites.json';
import orcMob from './warbands/orc-mob.json';
import ostlanders from './warbands/ostlanders.json';
import blackOrcs from './warbands/black-orcs.json';
import amazonsMordheim from './warbands/amazons-mordheim.json';
import amazonsLustria from './warbands/amazons-lustria.json';
import lizardmen from './warbands/lizardmen.json';
import gunnerySchoolOfNuln from './warbands/gunnery-school-of-nuln.json';
import battleMonksOfCathay from './warbands/battle-monks-of-cathay.json';
import arabianTombRaiders from './warbands/arabian-tomb-raiders.json';
import blackDwarfs from './warbands/black-dwarfs.json';
import bretonnians from './warbands/bretonnians.json';
import bretonnianChapelGuard from './warbands/bretonnian-chapel-guard.json';
import courtOfTheProfanePleasures from './warbands/court-of-the-profane-pleasures.json';
import theCursedCavalcade from './warbands/the-cursed-cavalcade.json';
import darkElves from './warbands/dark-elves.json';
import dwarfRangers from './warbands/dwarf-rangers.json';
import forestGoblins from './warbands/forest-goblins.json';
import hochlandBandits from './warbands/hochland-bandits.json';
import hornedHunters from './warbands/horned-hunters.json';
import imperialOutriders from './warbands/imperial-outriders.json';
import lustrianReavers from './warbands/lustrian-reavers.json';
import maraudersOfChaos from './warbands/marauders-of-chaos.json';
import merchantCaravans from './warbands/merchant-caravans.json';
import mootlanders from './warbands/mootlanders.json';
import nightGoblins from './warbands/night-goblins.json';
import norseExplorers from './warbands/norse-explorers.json';
import outlawsOfStirwoodForest from './warbands/outlaws-of-stirwood-forest.json';
import pirates from './warbands/pirates.json';
import pitFighters from './warbands/pit-fighters.json';
import shadowWarriors from './warbands/shadow-warriors.json';
import skavenOfClanPestilens from './warbands/skaven-of-clan-pestilens.json';
import theRestlessDead from './warbands/the-restless-dead.json';
import theSonsOfHashut from './warbands/the-sons-of-hashut.json';
import tileans from './warbands/tileans.json';
import tombGuardians from './warbands/tomb-guardians.json';

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
  averlanders,
  beastmenRaiders,
  carnivalOfChaos,
  dwarfTreasureHunters,
  kislevites,
  orcMob,
  ostlanders,
  blackOrcs,
  amazonsMordheim,
  amazonsLustria,
  lizardmen,
  gunnerySchoolOfNuln,
  battleMonksOfCathay,
  arabianTombRaiders,
  blackDwarfs,
  bretonnians,
  bretonnianChapelGuard,
  courtOfTheProfanePleasures,
  theCursedCavalcade,
  darkElves,
  dwarfRangers,
  forestGoblins,
  hochlandBandits,
  hornedHunters,
  imperialOutriders,
  lustrianReavers,
  maraudersOfChaos,
  merchantCaravans,
  mootlanders,
  nightGoblins,
  norseExplorers,
  outlawsOfStirwoodForest,
  pirates,
  pitFighters,
  shadowWarriors,
  skavenOfClanPestilens,
  theRestlessDead,
  theSonsOfHashut,
  tileans,
  tombGuardians,
] as WarbandDefinition[];

// Custom types live in their own small module (so the app shell can register
// them without importing this one — see customWarbandTypes.ts); re-exported so
// existing callers keep one import site.
export {
  registerCustomWarbandTypes,
  registerForeignCustomType,
  getCustomWarbandDefinitions,
} from './customWarbandTypes';

export function getWarbandDefinition(id: string): WarbandDefinition | undefined {
  return warbandDefinitions.find((def) => def.id === id) ?? getCustomWarbandDefinition(id);
}

// The name lookup lives in warbandNames.ts, which reads only each data file's
// id and name — so the screens on the first-load path can use it without this
// module's ~400 kB of definitions. Re-exported for everything else.
export { getWarbandTypeName } from './warbandNames';

// Dev-only drift check: the name map globs the warbands folder, while this
// registry lists its files by hand. A file added to one and not the other
// would show a name for a type that can't be built, or a type with no name.
if (import.meta.env.DEV) {
  const registered = new Map(warbandDefinitions.map((d) => [d.id, d.name]));
  const globbed = new Map(builtInWarbandNames.map((w) => [w.id, w.name]));
  for (const [id, name] of registered) {
    if (globbed.get(id) !== name) console.error(`[warbandRegistry] ${id} missing from or renamed in warbandNames`);
  }
  for (const id of globbed.keys()) {
    if (!registered.has(id)) console.error(`[warbandRegistry] src/data/warbands has ${id}, but it isn't registered`);
  }
}

export type WarbandProvenance = {
  /** Where the list comes from, e.g. "Core rulebook". */
  source: string;
  /** Fan-supplement grade where the source states one, else null. */
  grade: string | null;
};

/**
 * Short provenance label for a warband list.
 *
 * Derived from the `source` field each data file already carries rather than a
 * new hand-maintained column — the citation is the authority, so reading it
 * keeps the label honest and means a corrected source can't drift out of sync
 * with a separately stored grade. Unrecognised sources fall back to the raw
 * text's first clause rather than guessing.
 */
export function getWarbandProvenance(definition: WarbandDefinition): WarbandProvenance {
  const raw = definition.source ?? '';
  const grade = /grade[-\s]?1a/i.test(raw) ? 'Grade 1a' : null;

  let source: string;
  if (/border town burning/i.test(raw)) source = 'Border Town Burning';
  else if (/mordheim rulebook/i.test(raw)) source = 'Core rulebook';
  else if (/new mordheimer/i.test(raw)) source = 'The New Mordheimer';
  else source = raw.split(/[,—]/)[0]?.trim() || 'Unknown source';

  return { source, grade };
}

/** Warbands A–Z. The declaration order above follows the order the data files
 * were written, which is meaningless to someone picking from a list. */
// PURE: without it Rollup treats this top-level sort as a possible side effect
// and keeps the whole module — and every warband data file — in any chunk that
// merely imports it, used or not. That's what kept ~400 kB in the entry bundle.
export const warbandDefinitionsByName: WarbandDefinition[] = /* @__PURE__ */ [...warbandDefinitions].sort((a, b) =>
  a.name.localeCompare(b.name),
);

/**
 * The special rules printed in a unit's entry.
 *
 * Resolved from the warband definition rather than stored on the model: these
 * belong to the unit type, not to the individual warrior, so a copy in the
 * saved warband would go stale the day the data file is corrected. Returns an
 * empty list for a unit the definition doesn't know.
 */
export function getUnitSpecialRules(
  warbandType: string,
  unitType: string,
): ResolvedSpecialRule[] {
  const definition = getWarbandDefinition(warbandType);
  if (!definition) return [];
  const unit =
    definition.heroSlots.find((s) => s.unitType === unitType) ??
    definition.henchmenTypes.find((h) => h.unitType === unitType);
  // Shared references are resolved here rather than in the screens, so nothing
  // downstream has to know a rule can be stored two different ways.
  return resolveSpecialRules(unit?.specialRules);
}

/** Whatever text on a unit hasn't been split into named rules yet. */
export function getUnitNotes(warbandType: string, unitType: string): string {
  const definition = getWarbandDefinition(warbandType);
  if (!definition) return '';
  const unit =
    definition.heroSlots.find((s) => s.unitType === unitType) ??
    definition.henchmenTypes.find((h) => h.unitType === unitType);
  return unit?.notes ?? '';
}

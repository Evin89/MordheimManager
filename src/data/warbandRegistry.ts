import { UnitSpecialRule, WarbandDefinition } from './types';
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
] as WarbandDefinition[];

export function getWarbandDefinition(id: string): WarbandDefinition | undefined {
  return warbandDefinitions.find((def) => def.id === id);
}

/**
 * Display name for a stored `warbandType`.
 *
 * Warbands store the definition's slug (`cult-of-the-possessed`), which several
 * screens were rendering straight to the user. Falls back to the raw value so an
 * unrecognised type — a hand-edited import, or a definition removed later — still
 * shows something rather than blanking out.
 */
export function getWarbandTypeName(id: string): string {
  return getWarbandDefinition(id)?.name ?? id;
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
export const warbandDefinitionsByName: WarbandDefinition[] = [...warbandDefinitions].sort((a, b) =>
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
export function getUnitSpecialRules(warbandType: string, unitType: string): UnitSpecialRule[] {
  const definition = getWarbandDefinition(warbandType);
  if (!definition) return [];
  const unit =
    definition.heroSlots.find((s) => s.unitType === unitType) ??
    definition.henchmenTypes.find((h) => h.unitType === unitType);
  return unit?.specialRules ?? [];
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

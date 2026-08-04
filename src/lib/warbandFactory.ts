import { HenchmenTypeDefinition, HeroSlotDefinition, HiredSwordDefinition, WarbandDefinition } from '../data/types';
import { generateId } from './id';
import { resolveStatLine } from './statLine';
import { EquipmentItem, Hero, HenchmenGroup, HiredSword, Warband, WARBAND_SCHEMA_VERSION } from '../types';

/**
 * Every warrior carries a dagger.
 *
 * A core-rulebook freebie ("all warriors are assumed to have a dagger in
 * addition to any other equipment"), which is why it costs nothing and is
 * handed out at creation rather than bought. It's a real equipment entry so it
 * shows on the model and can be seen in the shop's sell list at 0 gc — the
 * alternative, special-casing an invisible weapon, hides a thing that matters
 * in close combat.
 */
export function createFreeDagger(): EquipmentItem {
  return {
    id: generateId(),
    name: 'Dagger',
    category: 'melee',
    cost: 0,
    notes: 'Free — every warrior carries one (rulebook, Equipment).',
  };
}

/**
 * Carries the unit's own rules text onto the model.
 *
 * Each hero slot and henchman type already stores the book's entry for that
 * unit — "Leader: any warrior within 6\" may use his Leadership", "Large",
 * "Ranger: roll two dice for Exploration" — but creating a model dropped it, so
 * abilities a warrior has from the moment you recruit him were nowhere on his
 * card. The text is kept verbatim rather than parsed into structured skills:
 * it's prose in the source, and splitting it would mean deciding which phrases
 * are skills, which are one-off rules, and which are just the hire cost.
 */
function composeModelNotes(sourceNotes: string, statsWarning: boolean): string {
  const parts: string[] = [];
  if (sourceNotes?.trim()) parts.push(sourceNotes.trim());
  if (statsWarning) {
    parts.push('Some stats were not verified in the warband data (defaulted to 0) — check against the rulebook.');
  }
  return parts.join('\n\n');
}

export function createHeroFromSlot(slot: HeroSlotDefinition, name: string): Hero {
  const { stats, hadMissingStats } = resolveStatLine(slot.statLine);
  const { stats: statMaximums, hadMissingStats: maxesMissing } = resolveStatLine(slot.statMaximums);

  return {
    id: generateId(),
    name,
    unitType: slot.unitType,
    isLeader: slot.isLeader,
    isLargeCreature: slot.isLargeCreature,
    stats,
    statMaximums,
    xp: slot.startingXp ?? 0,
    startingXp: slot.startingXp ?? 0,
    advances: [],
    skillLists: slot.skillLists,
    skills: [],
    // Copied from the definition, but left empty of entries: a new caster
    // arrives with a prompt, never with a spell the player didn't choose.
    spellLists: slot.spellLists ?? [],
    spells: [],
    injuries: [],
    equipment: [createFreeDagger()],
    status: 'active',
    notes: composeModelNotes(slot.notes, hadMissingStats || maxesMissing),
  };
}

export function createHenchmenGroupFromType(
  type: HenchmenTypeDefinition,
  groupName: string,
  count: number,
): HenchmenGroup {
  const { stats, hadMissingStats } = resolveStatLine(type.statLine);

  return {
    id: generateId(),
    groupName,
    unitType: type.unitType,
    count,
    isLargeCreature: type.isLargeCreature,
    isAnimal: type.isAnimal,
    stats,
    xp: 0,
    advances: [],
    equipment: [createFreeDagger()],
    notes: composeModelNotes(type.notes, hadMissingStats),
  };
}

/**
 * Hires a Hired Sword onto the roster.
 *
 * `countsTowardMax` is false by the rules: Hired Swords are paid help, not
 * members of the warband, so they don't occupy one of its slots — see
 * `countTowardWarbandSize`, which honours the same distinction.
 *
 * Their starting gear is free text in the data ("Morning star, spiked gauntlet
 * … and helmet"), because the rulebook writes it as prose rather than a list of
 * priced items. It's carried into `notes` verbatim instead of being split into
 * equipment entries, since splitting it would mean guessing at which catalogue
 * item each phrase refers to.
 */
export function createHiredSwordFromDefinition(
  definition: HiredSwordDefinition,
  name: string,
): HiredSword {
  const { stats, hadMissingStats } = resolveStatLine(definition.statLine);
  const notes = [
    definition.equipment ? `Equipment: ${definition.equipment}` : '',
    definition.specialRules ? `Special rules: ${definition.specialRules}` : '',
    definition.ratingBonus ? `Rating: ${definition.ratingBonus}` : '',
    hadMissingStats ? 'Some stats were not verified in the source data (defaulted to 0).' : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    id: generateId(),
    name,
    type: definition.name,
    hireFee: definition.hireFee ?? 0,
    upkeep: definition.upkeep ?? 0,
    isLeader: false,
    isLargeCreature: false,
    countsTowardMax: false,
    stats,
    // The source lists no separate maximums for Hired Swords, so their starting
    // line doubles as the ceiling rather than inventing one.
    statMaximums: stats,
    xp: 0,
    startingXp: 0,
    advances: [],
    skillLists: definition.skillLists,
    skills: [],
    spellLists: definition.spellLists ?? [],
    spells: [],
    injuries: [],
    equipment: [createFreeDagger()],
    status: 'active',
    notes,
  };
}

export function createWarband(definition: WarbandDefinition, name: string): Warband {
  return {
    id: generateId(),
    schemaVersion: WARBAND_SCHEMA_VERSION,
    name,
    warbandType: definition.id,
    gold: definition.startingGold ?? 0,
    wyrdstoneShards: 0,
    treasury: [],
    heroes: [],
    henchmenGroups: [],
    hiredSwords: [],
    notes: '',
  };
}

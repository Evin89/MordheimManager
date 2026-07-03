import { HenchmenTypeDefinition, HeroSlotDefinition, WarbandDefinition } from '../data/types';
import { generateId } from './id';
import { resolveStatLine } from './statLine';
import { Hero, HenchmenGroup, Warband, WARBAND_SCHEMA_VERSION } from '../types';

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
    injuries: [],
    equipment: [],
    status: 'active',
    notes: hadMissingStats || maxesMissing ? 'Some stats were not verified in the warband data (defaulted to 0) — check against the rulebook.' : '',
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
    equipment: [],
    notes: hadMissingStats ? 'Some stats were not verified in the warband data (defaulted to 0) — check against the rulebook.' : '',
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

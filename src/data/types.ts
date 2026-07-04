// Types describing the static game-content data files under /src/data.
// These are separate from the user-data model in /src/types.ts.
//
// Numeric/text fields that have not yet been verified against the rulebook
// or Border Town Burning are typed as nullable and hold "TODO: verify..."
// strings or `null` until the owner fills them in from the books.

import { StatLine } from '../types';

export type NullableStatLine = { [K in keyof StatLine]: number | null };

export type HeroSlotDefinition = {
  id: string;
  unitType: string;
  isLeader: boolean;
  isLargeCreature: boolean;
  maxCount: number | null; // null = unlimited
  cost: number | null;
  startingXp: number | null;
  skillLists: string[]; // keys into skills.json `lists`
  statLine: NullableStatLine;
  statMaximums: NullableStatLine;
  equipmentOptions: string[]; // keys into equipment.json, or category names
  notes: string;
};

export type HenchmenTypeDefinition = {
  id: string;
  unitType: string;
  cost: number | null;
  isAnimal: boolean;
  isLargeCreature: boolean;
  maxCount: number | null;
  statLine: NullableStatLine;
  statMaximums: NullableStatLine;
  equipmentOptions: string[];
  notes: string;
};

export type WarbandExclusiveEquipmentEntry = {
  id: string;
  name: string;
  category: 'melee' | 'missile' | 'armour' | 'misc';
  cost: number | null;
  rarity: number | null; // null = Common (not Rare) for this warband
  restriction: string; // e.g. "Captain only", free text
  rulesText: string;
};

export type WarbandDefinition = {
  id: string;
  name: string;
  source: string; // rulebook/BTB page reference, or TODO
  startingGold: number | null;
  minWarbandSize: number | null;
  maxWarbandSize: number | null;
  heroSlots: HeroSlotDefinition[];
  henchmenTypes: HenchmenTypeDefinition[];
  // Item lists referenced by heroSlots/henchmenTypes `equipmentOptions`.
  // Values are item ids that may point into equipment.json `common`/`rare`
  // (standard gear reused by this warband) or into `exclusiveEquipment` below.
  equipmentLists: Record<string, string[]>;
  // Equipment only this warband may buy (per the source material).
  exclusiveEquipment: WarbandExclusiveEquipmentEntry[];
  specialRules: string;
};

export type EquipmentTableEntry = {
  id: string;
  name: string;
  category: 'melee' | 'missile' | 'armour' | 'misc';
  cost: number | null;
  notes: string;
};

export type RareEquipmentEntry = {
  id: string;
  name: string;
  category: 'melee' | 'missile' | 'armour' | 'misc';
  rarity: number | null;
  priceRange: string | null;
  notes: string;
};

export type EquipmentData = {
  schemaVersion: number;
  source: string;
  categories: string[];
  common: EquipmentTableEntry[];
  rare: RareEquipmentEntry[];
};

export type SkillEntry = {
  id: string;
  name: string;
  effect: string;
};

export type SkillList = {
  name: string;
  skills: SkillEntry[];
};

export type SkillsData = {
  schemaVersion: number;
  source: string;
  lists: Record<string, SkillList>;
  warbandSpecific: Record<string, SkillList>;
};

export type InjuryTableEntry = {
  roll: string; // D66 notation, e.g. "11".."66"
  name: string;
  effect: string;
};

export type InjuriesData = {
  schemaVersion: number;
  source: string;
  table: InjuryTableEntry[];
};

export type AdvanceTableEntry = {
  roll: string;
  result: string;
};

export type AdvancesData = {
  schemaVersion: number;
  source: string;
  heroAdvanceTable: {
    diceType: string;
    entries: AdvanceTableEntry[];
  };
  henchmenAdvanceTable: {
    diceType: string;
    entries: AdvanceTableEntry[];
  };
};

export type XpThresholdEntry = {
  xp: number | null;
  label: string;
};

export type XpThresholdsData = {
  schemaVersion: number;
  source: string;
  heroThresholds: XpThresholdEntry[];
  henchmenThresholds: XpThresholdEntry[];
};

// The core rulebook's selling table is a lookup jointly indexed by how many
// shards are sold at once and the warband's current model count — it is not
// a flat per-shard price. `pricesByWarbandSize` gives the total gc profit
// (after upkeep) for selling that many shards, for each warband-size band.
export type WyrdstonePriceRow = {
  shardsSold: string; // "1".."7", "8+"
  pricesByWarbandSize: {
    '1-3': number;
    '4-6': number;
    '7-9': number;
    '10-12': number;
    '13-15': number;
    '16+': number;
  };
};

export type WyrdstonePricesData = {
  schemaVersion: number;
  source: string;
  table: WyrdstonePriceRow[];
};

export type HiredSwordDefinition = {
  id: string;
  name: string;
  hireFee: number | null;
  upkeep: number | null;
  mayBeHiredBy: string; // free text describing eligible warbands/exceptions
  ratingBonus: string; // free text, e.g. "+22 points, plus 1 per Experience point"
  statLine: NullableStatLine;
  equipment: string;
  skillLists: string[];
  specialRules: string;
  source: string;
};

export type HiredSwordsData = {
  schemaVersion: number;
  source: string;
  hiredSwords: HiredSwordDefinition[];
};

export type DramatisPersonaDefinition = {
  id: string;
  name: string;
  hireFee: number | null;
  upkeep: number | null;
  mayBeHiredBy: string;
  ratingBonus: string;
  statLine: NullableStatLine;
  equipment: string;
  skills: string[];
  specialRules: string;
  source: string;
};

export type DramatisPersonaeData = {
  schemaVersion: number;
  source: string;
  characters: DramatisPersonaDefinition[];
};

export type ScenarioAward = {
  id: string;
  label: string; // e.g. "Winning Leader"
  amount: string; // free text since some are dice-based, e.g. "+2" or "+D3"
  note: string;
};

export type ScenarioDefinition = {
  id: string;
  name: string;
  awards: ScenarioAward[];
};

export type ScenariosData = {
  schemaVersion: number;
  source: string;
  universalAward: ScenarioAward; // the +1 Survives rule, common to every scenario
  scenarios: ScenarioDefinition[];
};

export type BtbObjectiveAchievement = {
  cp: number; // campaign points threshold (thick-bordered box)
  name: string;
  effect: string;
};

export type BtbObjectiveEntry = {
  id: string;
  name: string;
  description: string; // flavour text
  eligibleWarbands: string; // free text list of warbands that may choose this objective
  noAllianceWith: string; // free text, objectives this one cannot ally with
  progressRules: string; // free text describing how Campaign Points (CP) are earned
  achievements: BtbObjectiveAchievement[];
  variantNotes: string; // e.g. "The Black Dwarfs" / "The Strangest Tribes" adaptations
};

export type BtbObjectivesData = {
  schemaVersion: number;
  source: string;
  objectives: BtbObjectiveEntry[];
};

export type BtbDramatisPersonaEntry = {
  id: string;
  name: string;
  hireFee: string; // free text, may include gold crowns and/or Campaign Points
  upkeep: string;
  mayBeHiredBy: string;
  ratingBonus: string;
  statLine: NullableStatLine;
  equipment: string;
  skills: string[];
  specialRules: string;
  notes: string;
};

export type BtbDramatisPersonaeData = {
  schemaVersion: number;
  source: string;
  characters: BtbDramatisPersonaEntry[];
};

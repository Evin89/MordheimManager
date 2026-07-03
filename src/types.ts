// Core data model for the Mordheim Campaign Manager.
// See mordheim-manager-spec.md section 3.1.

export type StatLine = {
  M: number;
  WS: number;
  BS: number;
  S: number;
  T: number;
  W: number;
  I: number;
  A: number;
  Ld: number;
};

export type Injury = {
  id: string;
  name: string; // e.g. "Old Battle Wound"
  effect: string; // short rules text
  dateAcquired: string; // battle reference
  missNextGame?: boolean;
};

export type Advance = {
  id: string;
  type: 'stat' | 'skill';
  detail: string; // "+1 WS" or "Strongman"
  battleRef?: string;
};

export type EquipmentCategory = 'melee' | 'missile' | 'armour' | 'misc';

export type EquipmentItem = {
  id: string;
  name: string;
  category: EquipmentCategory;
  cost?: number;
  notes?: string;
};

export type ModelStatus = 'active' | 'missNextGame' | 'dead' | 'captured' | 'left';

export type Hero = {
  id: string;
  name: string;
  unitType: string; // e.g. "Maneater Captain", "Youngblood"
  isLeader: boolean;
  isLargeCreature: boolean; // counts 20 toward warband rating
  stats: StatLine;
  statMaximums: StatLine; // racial maximums, from warband definition
  xp: number;
  startingXp: number;
  advances: Advance[];
  skillLists: string[]; // which skill tables this hero may use
  skills: string[];
  injuries: Injury[];
  equipment: EquipmentItem[];
  status: ModelStatus;
  notes: string;
};

export type HenchmenGroup = {
  id: string;
  groupName: string;
  unitType: string; // e.g. "Ogres", "Gnoblars", "Sabretusk"
  count: number;
  isLargeCreature: boolean;
  isAnimal: boolean; // animals don't gain XP
  stats: StatLine;
  xp: number; // shared group XP
  advances: Advance[];
  equipment: EquipmentItem[]; // shared loadout
  notes: string;
};

export type HiredSword = {
  id: string;
  name: string;
  type: string;
  hireFee: number;
  upkeep: number;
  isLeader: false;
  isLargeCreature: boolean;
  countsTowardMax: boolean;
  stats: StatLine;
  statMaximums: StatLine;
  xp: number;
  startingXp: number;
  advances: Advance[];
  skillLists: string[];
  skills: string[];
  injuries: Injury[];
  equipment: EquipmentItem[];
  status: ModelStatus;
  notes: string;
};

export type BtbObjective = {
  name: string;
  progress: string; // free text / counters
  completed: boolean;
};

export const WARBAND_SCHEMA_VERSION = 1;

export type Warband = {
  id: string;
  schemaVersion: number;
  name: string;
  warbandType: string; // key into warband definitions data
  gold: number;
  wyrdstoneShards: number;
  treasury: EquipmentItem[]; // stored, unassigned equipment
  heroes: Hero[];
  henchmenGroups: HenchmenGroup[];
  hiredSwords: HiredSword[];
  btbObjective?: BtbObjective;
  notes: string;
};

export type BattleResult = 'win' | 'loss' | 'draw';

export type BattleRecord = {
  id: string;
  date: string;
  scenario: string;
  opponents: string[]; // names/warband types
  result: BattleResult;
  underdogBonus?: number;
  wyrdstoneFound: number;
  goldChange: number;
  casualtiesSummary: string;
  notes: string;
};

export const CAMPAIGN_SCHEMA_VERSION = 1;

export type Campaign = {
  id: string;
  schemaVersion: number;
  name: string; // e.g. "Border Town Burning 2026"
  usesBTB: boolean;
  battles: BattleRecord[];
  notes: string;
};

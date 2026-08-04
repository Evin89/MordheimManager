// Types describing the static game-content data files under /src/data.
// These are separate from the user-data model in /src/types.ts.
//
// Numeric/text fields that have not yet been verified against the rulebook
// or Border Town Burning are typed as nullable and hold "TODO: verify..."
// strings or `null` until the owner fills them in from the books.

import { StatLine } from '../types';

export type NullableStatLine = { [K in keyof StatLine]: number | null };

/** A named special rule as printed in the unit's entry. */
export type UnitSpecialRule = {
  name: string;
  description: string;
};

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
  /**
   * Which racial ceiling this unit advances against — a key into
   * racialMaximums.json. Preferred over `statMaximums` below, which is kept
   * only for units whose race has no published profile.
   *
   * Omitted for anything that cannot gain Experience: a model that never
   * advances has no use for a ceiling, and inventing one implies it could.
   */
  racialProfile?: string;
  /** Per-unit override. Used only where `racialProfile` is absent. */
  statMaximums: NullableStatLine;
  equipmentOptions: string[]; // keys into equipment.json, or category names
  /** Spell/prayer/ritual lists this unit may draw on — ids into spells.json.
   * Absent or empty for a non-caster, which is what suppresses the block. */
  spellLists?: string[];
  /** How many entries the unit starts with. One for most casters; the Warlock
   * hired sword's own entry gives him two. */
  startingSpells?: number;
  notes: string;
  /** Named rules from the unit's entry. Split out of `notes`, which now holds
   * only flavour and data-quality remarks. */
  specialRules?: UnitSpecialRule[];
};

export type HenchmenTypeDefinition = {
  id: string;
  unitType: string;
  cost: number | null;
  isAnimal: boolean;
  isLargeCreature: boolean;
  maxCount: number | null;
  statLine: NullableStatLine;
  /** See HeroSlotDefinition. Absent for animals and anything else that never
   * gains Experience. */
  racialProfile?: string;
  statMaximums: NullableStatLine;
  equipmentOptions: string[];
  notes: string;
  specialRules?: UnitSpecialRule[];
};

export type WarbandExclusiveEquipmentEntry = {
  id: string;
  name: string;
  category: 'melee' | 'missile' | 'armour' | 'misc';
  cost: number | null;
  // Dice-based prices ("80 + 2D6 gc") have no single `cost`, so they're carried
  // as display text instead; the shop parses the fixed part out to prefill the
  // buy field and the player adds their roll. Omit when `cost` is set.
  priceRange?: string | null;
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
  // Flat modifier applied to the 2D6 roll when trying to locate a Rare item
  // (e.g. Marienburg's "+1 when attempting to find rare items"). Omitted/0 for
  // warbands with no such bonus.
  rareItemRollBonus?: number;
};

export type EquipmentTableEntry = {
  id: string;
  name: string;
  category: 'melee' | 'missile' | 'armour' | 'misc';
  cost: number | null;
  notes: string;
  /** See RareEquipmentEntry — same meaning, for fixed-price items. */
  restriction?: string;
  warbandIds?: string[];
  henchmenAllowed?: boolean;
};

export type RareEquipmentEntry = {
  id: string;
  name: string;
  category: 'melee' | 'missile' | 'armour' | 'misc';
  rarity: number | null;
  priceRange: string | null;
  notes: string;
  /** Free-text availability note, e.g. "Pirates only". Shown, not parsed. */
  restriction?: string;
  /**
   * Warband ids that may take this item. Absent means anyone may.
   *
   * Many published items are locked to warbands this app doesn't carry yet
   * (Pirates, Amazons, Tomb Guardians...). Listing the id anyway keeps the item
   * in the catalogue — searchable, and correct the day that warband is added —
   * while `warbandIds` keeps it out of shops it doesn't belong in.
   */
  warbandIds?: string[];
  /**
   * Overrides the Heroes-only rule that governs Miscellaneous Equipment.
   * Only the handful the rules name explicitly — Rain Coat, Winter Furs,
   * Reptile Venom — set this.
   */
  henchmenAllowed?: boolean;
};

export type EquipmentData = {
  schemaVersion: number;
  source: string;
  categories: string[];
  common: EquipmentTableEntry[];
  rare: RareEquipmentEntry[];
};

export type SkillPrerequisite = {
  text: string; // always shown, human-readable — may describe conditions we can't verify (e.g. "Spellcasters only")
  requiresLeader?: boolean; // hard-checkable against Hero.isLeader
  excludedWarbandTypes?: string[]; // hard-checkable against Warband.warbandType
};

export type SkillEntry = {
  id: string;
  name: string;
  effect: string;
  prerequisite?: SkillPrerequisite;
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
  /** See HeroSlotDefinition. */
  racialProfile?: string;
  equipment: string;
  skillLists: string[];
  /** See HeroSlotDefinition. The Warlock is the only Hired Sword who casts. */
  spellLists?: string[];
  startingSpells?: number;
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

/** How many matching dice a result on the Exploration chart needs. */
export type ExplorationMultipleKind = 'double' | 'triple' | 'fourOfAKind' | 'fiveOfAKind' | 'sixOfAKind';

/**
 * The part of a result the app can apply on its own: pure gold and/or wyrdstone,
 * as a dice expression (see `rollDiceExpression`). Absent wherever the outcome is
 * an item, a model, a skill, or conditional on a test — those are reported as text
 * for the player to apply by hand, since the app cannot model them faithfully.
 */
export type ExplorationYield = {
  gold?: string; // e.g. "D6", "2D6", "D6x10", "5D6x5"
  shards?: string; // e.g. "D3"
};

/** A nested D6 roll that decides what a location yields (e.g. the Smithy's weapon table). */
export type ExplorationSubTable = {
  dice: string; // always "D6" in the core rules, kept explicit for future supplements
  entries: { roll: string; result: string; autoYield?: ExplorationYield }[];
};

/** Loot rolled for item-by-item rather than once (Hidden Treasure, Slaughtered Warband). */
export type ExplorationItemChecklist = {
  dice: string;
  // required is "4+", "Auto", etc.
  entries: { item: string; required: string; autoYield?: ExplorationYield }[];
};

export type ExplorationResult = {
  id: string;
  kind: ExplorationMultipleKind;
  face: number; // the repeated dice face, 1-6
  count: number; // how many of that face are needed, 2-6
  combination: string; // display form, e.g. "5 5 5"
  name: string;
  flavour: string;
  effect: string; // the outcome for a warband with no variant of its own
  autoYield?: ExplorationYield;
  /** True when the effect carries into later games (a re-roll from now on, a skill
   * list unlocked, an enemy warband that now hates you) rather than being spent on
   * this post-battle sequence. Those are copied into the warband's own notes. */
  persistent?: boolean;
  subTable?: ExplorationSubTable;
  itemChecklist?: ExplorationItemChecklist;
  // Warbands that resolve this location differently, keyed by warband definition id.
  warbandVariants?: {
    warbands: string[];
    effect: string;
    autoYield?: ExplorationYield;
    persistent?: boolean;
  }[];
};

export type ExplorationData = {
  schemaVersion: number;
  source: string;
  procedure: {
    summary: string;
    steps: string[];
    maxDiceKept: number;
    multiplesTieBreakers: string[];
    notes: string[];
    example: string;
  };
  shardsFound: {
    description: string;
    // max is null on the open-ended top row ("36+").
    table: { diceTotal: string; min: number; max: number | null; shards: number }[];
  };
  explorationChart: ExplorationResult[];
  magicalArtefacts: {
    description: string;
    dice: string;
    entries: { roll: string; name: string; flavour: string; effect: string }[];
  };
};

export type RulesCategoryId =
  | 'core'
  | 'postBattle'
  | 'trading'
  | 'skills'
  | 'injuries'
  | 'scenarios'
  | 'warbandSpecial'
  | 'btb';

export type RulesCategoryDef = {
  id: RulesCategoryId;
  name: string;
  description: string;
};

// Structured weapon/armour stat block, rendered in the rulebook's own layout
// (Range / Strength / SPECIAL RULES with bold names). Entries carrying this
// still keep a plain-text `body` derived from it, for search and fallbacks.
export type WeaponProfile = {
  range?: string; // e.g. "Close Combat", "24\""
  strength?: string; // e.g. "As user", "4", "As user +1"
  notes?: string; // short italic note (e.g. "Every warrior's free starting weapon.")
  specialRules: { name: string; text: string }[];
};

export type RuleEntry = {
  id: string;
  title: string;
  category: RulesCategoryId;
  // Rulebook chapter this entry belongs to (e.g. "Movement", "Trading"), used to
  // group and order entries the way the rulebook itself presents them — see
  // CHAPTER_ORDER in lib/rulesIndex.ts.
  chapter: string;
  // Optional grouping heading within a chapter (e.g. the skill list a skill
  // belongs to: "Combat", "Skavens' Skills"), rendered as a sub-heading.
  subChapter?: string;
  source: string;
  body: string; // plain-text paragraphs, separated by blank lines
  weapon?: WeaponProfile;
  relatedIds?: string[]; // ids of other RuleEntry objects
};

/** What a list is called in its own source, which decides the UI heading —
 * a priest prays, a shaman performs rituals, only a wizard casts spells. */
/**
 * A racial maximum profile: the ceiling a warrior of that race may advance to.
 *
 * Held once, globally, rather than copied onto every unit. Sixty-odd units
 * repeating the same nine Human numbers is sixty places for one of them to be
 * wrong, and seventeen hero slots had no maximums at all because nobody had
 * filled them in.
 */
export type RacialProfile = {
  id: string;
  name: string;
  /** A BS of 0 means the creature cannot shoot at all. */
  statMaximums: StatLine;
  notes?: string;
};

export type RacialMaximumsData = {
  schemaVersion: number;
  source: string;
  notes: string;
  profiles: Record<string, RacialProfile>;
};

export type SpellListKind = 'magic' | 'prayer' | 'ritual';

export type Spell = {
  /** Namespaced by list, e.g. `necromancy.lifestealer`. */
  id: string;
  /** Its number on the list's die. */
  roll: number;
  name: string;
  /**
   * The 2D6 the caster must equal or beat.
   *
   * Null means the entry succeeds automatically and is never rolled for — the
   * Spell of Awakening and Children of the Horned Rat. Deliberately not 0,
   * which would render as a number the player might try to beat.
   */
  difficulty: number | null;
  effect: string;
  /** For entries that resolve on a second roll of their own (Eye of God,
   * Sotec's Blessing). Rendered as a table under the effect text. */
  subTable?: { roll: string; effect: string }[];
  /** Where the source flags a passage as queried or amended by its editors.
   * Carried so a contested rule is visibly contested rather than silently
   * presented as settled. */
  errata?: string;
};

export type SpellList = {
  id: string;
  name: string;
  kind: SpellListKind;
  /** The die rolled against each entry's `roll`. */
  die: string;
  /** Units named by the source as drawing on this list. */
  usedBy: string[];
  notes?: string;
  source: string;
  spells: Spell[];
};

export type SpellsData = {
  schemaVersion: number;
  source: string;
  difficultyNote: string;
  lists: Record<string, SpellList>;
};

export type RulesData = {
  schemaVersion: number;
  source: string;
  categories: RulesCategoryDef[];
  entries: RuleEntry[]; // hand-authored entries only — see lib/rulesIndex.ts for the full merged set
  // Canonical chapter order (matching the rulebook's own structure) used to sort
  // every entry, including ones generated at runtime from other data files.
  chapterOrder: string[];
};

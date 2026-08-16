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
  /**
   * An epitaph, written at the point of death (spec §18.1). Only meaningful on
   * the injury that killed the model — prompted in the post-battle Dead Models
   * step, the one moment it is narratively relevant.
   */
  lastWords?: string;
};

/**
 * One line in a model's equipment history (spec §18.2).
 *
 * Append-only, and distinct from the `equipment` snapshot, which only ever shows
 * what a model holds *now*. Written as a side effect of actions that already
 * exist — buying, selling, the post-battle equipment-to-treasury step — so no
 * one is asked to keep a log by hand.
 */
export type EquipmentLogEntry = {
  id: string;
  itemName: string;
  action: 'acquired' | 'lost' | 'sold' | 'destroyed';
  date: string; // ISO date
  context?: string; // "Found in Exploration", "Sold at half price"
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
  /** A byname shown in parentheses after the given name (spec §18.1). */
  nickname?: string;
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
  /** Spell/prayer/ritual list ids this model may draw on, copied from its unit
   * definition at recruitment so a saved roster stays readable on its own. */
  spellLists: string[];
  /** Entries known, as namespaced ids into spells.json. Mirrors `skills`. */
  spells: string[];
  injuries: Injury[];
  equipment: EquipmentItem[];
  /** Append-only gear history (spec §18.2). Optional: warbands predating the
   * feature simply have none, and it fills forward. */
  equipmentLog?: EquipmentLogEntry[];
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
  equipmentLog?: EquipmentLogEntry[];
  notes: string;
};

export type HiredSword = {
  id: string;
  name: string;
  nickname?: string;
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
  spellLists: string[];
  spells: string[];
  injuries: Injury[];
  equipment: EquipmentItem[];
  equipmentLog?: EquipmentLogEntry[];
  status: ModelStatus;
  notes: string;
};

// Stored in its own `objectives` table (owner-only RLS), never inside the
// Warband blob below — a campaign-mate who can read a shared warband must
// never be able to see its BTB objective, which is secret by the rules.
export type BtbObjective = {
  id: string;
  warbandId: string;
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
  notes: string;
};

export type BattleResult = 'win' | 'loss' | 'draw';

export type BattleRecord = {
  id: string;
  warbandId: string; // which of the user's warbands this record belongs to
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

export type CampaignVisibility = 'public' | 'private';

/** Same two values as CampaignVisibility, but a distinct name because it
 * answers a different question: who outside the campaign may read this roster. */
export type WarbandVisibility = 'public' | 'private';

export type Campaign = {
  id: string;
  name: string; // e.g. "Border Town Burning 2026"
  usesBTB: boolean;
  visibility: CampaignVisibility;
  joinCode: string | null;
  createdBy: string; // user id
  notes: string;
  pinnedAnnouncement: string | null; // §19.3 — leader-pinned banner, null when cleared
  pinnedAnnouncementAt: string | null;
};

/** The leader manages the campaign; everyone else plays in it. Held on the
 * membership row rather than the campaign, so leadership is grantable. */
export type CampaignRole = 'campaign_leader' | 'player';

export type CampaignMember = {
  userId: string;
  role: CampaignRole;
  joinedAt: string;
  displayName: string;
};

/**
 * A warband in the public gallery. Summary only — the owner chose to let others
 * look, which is not the same as handing over the full blob to every client, so
 * the roster itself is fetched separately and read-only when actually opened.
 */
export type PublicWarbandRow = {
  id: string;
  ownerId: string;
  name: string;
  warbandType: string;
  playerName: string;
  rating: number;
};

/**
 * A campaign as it appears in the "my campaigns" overview: the campaign itself,
 * your standing in it, and enough activity to tell a live one from a dead one.
 */
export type CampaignSummary = {
  campaign: Campaign;
  /** Your own role, which is what decides whether you can manage it. */
  role: CampaignRole;
  memberCount: number;
  battleCount: number;
  /** Warbands you personally have entered in this campaign. */
  myWarbandCount: number;
};

/**
 * One row of the standings table.
 *
 * Driven by campaign *membership*, not by warbands: everyone who joined shows
 * up, including the leader and including players who haven't entered a warband
 * yet — those are the people you most need to see, since the table is how you
 * find out who's actually in the campaign. A player with no warband entered has
 * null in the warband fields rather than being omitted.
 *
 * Deliberately not the full Warband blob: this is the at-a-glance view other
 * players are allowed to see. The detailed roster is fetched separately.
 */
export type StandingsRow = {
  ownerId: string;
  playerName: string;
  role: CampaignRole;
  warbandId: string | null;
  warbandName: string | null;
  warbandType: string | null;
  rating: number | null;
  wins: number;
  losses: number;
  draws: number;
};

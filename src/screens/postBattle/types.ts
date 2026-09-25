import { BattleResult, ModelStatus, StatLine, Warband } from '../../types';

export type InjuryPick = {
  name: string;
  effect: string;
};

export type StatIncreases = Partial<Record<keyof StatLine, number>>;

export type HeroBattleState = {
  participated: boolean; // false if the hero was sitting out a "miss next game" penalty
  outOfAction: boolean;
  xpAwarded: number;
  injuries: InjuryPick[];
  resultingStatus: ModelStatus;
  equipmentFate: 'keep' | 'treasury' | 'lost';
  statIncreases: StatIncreases;
  newSkills: string[];
  /** Entries learned in place of a new skill. A caster's advance may be spent
   * on a spell instead, so this is a sibling of `newSkills`, not a subset. */
  newSpells: string[];
  /**
   * An epitaph (spec §18.1), captured when a hero is marked dead. §18.1 planned
   * to store it on the killing Injury, but this app *removes* a dead hero from
   * the roster rather than keeping him — so there is no model left to hang it
   * on. It goes into the battle's casualty summary instead, where a fallen
   * hero's memory belongs: campaign history, not a roster field.
   */
  lastWords?: string;
};

export type HenchmenBattleState = {
  outOfActionCount: number;
  diedCount: number;
  xpAwarded: number;
  equipmentFateForDead: 'treasury' | 'lost';
  deleteGroupIfEmpty: boolean;
  statIncreases: StatIncreases;
  /** "That Lad's Got Talent": one member of the group becomes a Hero. Recorded
   * during the wizard and resolved on commit. */
  ladsGotTalent: boolean;
  /** The two (usually) skill lists chosen for the promoted Hero, from the
   * options his unit's rules allow (ruleEffects). Ignored when the rules fix them. */
  promotionSkillLists?: string[];
};

export type HiredSwordBattleState = {
  participated: boolean;
  outOfAction: boolean;
  removed: boolean;
  removalReason: 'diedInBattle' | 'unpaidUpkeep' | null;
  xpAwarded: number;
  payUpkeep: boolean;
  statIncreases: StatIncreases;
  newSkills: string[];
  /** Entries learned in place of a new skill. A caster's advance may be spent
   * on a spell instead, so this is a sibling of `newSkills`, not a subset. */
  newSpells: string[];
};

/**
 * The post-battle Exploration roll. `dice` holds every die rolled or typed in; only
 * the first six count (`MAX_DICE_KEPT`), which is why `keptIndices` exists rather than
 * simply truncating — the player chooses which six when skills or equipment granted
 * extras. `resolved` is filled once the player accepts the location, so re-rolling the
 * dice can't silently double the gold already staged.
 */
/**
 * An Exploration grant as the player confirmed it, ready to write to the roster
 * at commit: counts rolled, Heroes chosen, the unit resolved. Gold and shards are
 * folded into `resolved.gold` / `resolved.shards` instead.
 */
export type AppliedGrant =
  | { type: 'item'; equipmentId: string; name: string; count: number; notes?: string }
  | { type: 'xp'; heroId: string; amount: number }
  | { type: 'skillList'; heroId: string; list: string }
  | { type: 'skill'; heroId: string; skill: string }
  | { type: 'heroNote'; heroId: string; text: string }
  | { type: 'henchmen'; unitType: string; count: number }
  | { type: 'recruit'; groupId: string };

export type ExplorationState = {
  dice: number[];
  keptIndices: number[];
  resolved: {
    resultId: string;
    subRoll: number | null;
    gold: number;
    shards: number;
    /** Full outcome text, recorded in the battle notes. */
    note: string;
    /** Set when the outcome carries into later games; copied to the warband's notes. */
    persistentNote: string | null;
    /** Roster changes the player confirmed (items, XP, skills, models). Optional:
     * a draft staged before grants existed has none. */
    grants?: AppliedGrant[];
    /** The same, as readable lines for the step's "applied" view. */
    grantLines?: string[];
  } | null;
};

export type PostBattleDraft = {
  scenario: string;
  opponents: string;
  /** §17.2 — the opponent picked from a roster in pre-battle, and the name it was
   * seeded under. Kept only while that name is still in `opponents`, so editing
   * the field to someone else drops the link rather than mis-attributing it. */
  opponentWarbandId: string | null;
  opponentWarbandName: string;
  result: BattleResult;
  date: string;
  underdogBonus: number;
  /** Enemy models this warband took out of action — self-reported, not derivable. */
  enemiesTakenOut: number;
  notes: string;
  heroes: Record<string, HeroBattleState>;
  henchmenGroups: Record<string, HenchmenBattleState>;
  hiredSwords: Record<string, HiredSwordBattleState>;
  wyrdstoneFound: number;
  wyrdstoneSold: number;
  exploration: ExplorationState;
};

export type DraftPatch = Partial<PostBattleDraft> | ((current: PostBattleDraft) => Partial<PostBattleDraft>);

export type StepProps = {
  warband: Warband;
  draft: PostBattleDraft;
  updateDraft: (patch: DraftPatch) => void;
};

export const WIZARD_STEPS = [
  'Battle Info',
  'Injuries',
  'Experience',
  'Advances',
  'Dead Models',
  'Income',
  'Upkeep',
  'Confirm',
] as const;

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
};

export type HenchmenBattleState = {
  outOfActionCount: number;
  diedCount: number;
  xpAwarded: number;
  equipmentFateForDead: 'treasury' | 'lost';
  deleteGroupIfEmpty: boolean;
  statIncreases: StatIncreases;
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
};

export type PostBattleDraft = {
  scenario: string;
  opponents: string;
  result: BattleResult;
  date: string;
  underdogBonus: number;
  notes: string;
  heroes: Record<string, HeroBattleState>;
  henchmenGroups: Record<string, HenchmenBattleState>;
  hiredSwords: Record<string, HiredSwordBattleState>;
  wyrdstoneFound: number;
  wyrdstoneSold: number;
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

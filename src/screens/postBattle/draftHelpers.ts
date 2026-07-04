import { generateId } from '../../lib/id';
import { getWyrdstoneSellPrice } from '../../lib/wyrdstonePricing';
import { countModels } from '../../lib/rating';
import { BattleRecord, HenchmenGroup, Hero, HiredSword, StatLine, Warband } from '../../types';
import { HenchmenBattleState, HeroBattleState, HiredSwordBattleState, PostBattleDraft, StatIncreases } from './types';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyStatIncreases(): StatIncreases {
  return {};
}

export function createInitialDraft(warband: Warband): PostBattleDraft {
  const heroes: Record<string, HeroBattleState> = {};
  for (const hero of warband.heroes) {
    if (hero.status === 'dead' || hero.status === 'captured' || hero.status === 'left') continue;
    heroes[hero.id] = {
      participated: hero.status === 'active',
      outOfAction: false,
      xpAwarded: 0,
      injuries: [],
      resultingStatus: 'active',
      equipmentFate: 'keep',
      statIncreases: emptyStatIncreases(),
      newSkills: [],
    };
  }

  const henchmenGroups: Record<string, HenchmenBattleState> = {};
  for (const group of warband.henchmenGroups) {
    henchmenGroups[group.id] = {
      outOfActionCount: 0,
      diedCount: 0,
      xpAwarded: 0,
      equipmentFateForDead: 'treasury',
      deleteGroupIfEmpty: true,
      statIncreases: emptyStatIncreases(),
    };
  }

  const hiredSwords: Record<string, HiredSwordBattleState> = {};
  for (const sword of warband.hiredSwords) {
    if (sword.status === 'dead' || sword.status === 'captured' || sword.status === 'left') continue;
    hiredSwords[sword.id] = {
      participated: sword.status === 'active',
      outOfAction: false,
      removed: false,
      removalReason: null,
      xpAwarded: 0,
      payUpkeep: true,
      statIncreases: emptyStatIncreases(),
      newSkills: [],
    };
  }

  return {
    scenario: '',
    opponents: '',
    result: 'win',
    date: todayIso(),
    underdogBonus: 0,
    notes: '',
    heroes,
    henchmenGroups,
    hiredSwords,
    wyrdstoneFound: 0,
    wyrdstoneSold: 0,
  };
}

function applyStatIncreases(stats: StatLine, increases: StatIncreases): StatLine {
  const next = { ...stats };
  for (const key of Object.keys(increases) as (keyof StatLine)[]) {
    next[key] = next[key] + (increases[key] ?? 0);
  }
  return next;
}

/** Warband model count after this battle's deaths, used to price wyrdstone sales and preview the rating. */
export function previewWarbandAfterDeaths(warband: Warband, draft: PostBattleDraft): Warband {
  const heroes = warband.heroes.filter((hero) => {
    const state = draft.heroes[hero.id];
    if (!state) return true;
    return state.resultingStatus !== 'dead' && state.resultingStatus !== 'captured' && state.resultingStatus !== 'left';
  });

  const henchmenGroups = warband.henchmenGroups
    .map((group) => {
      const state = draft.henchmenGroups[group.id];
      if (!state) return group;
      const count = Math.max(0, group.count - state.diedCount);
      return { ...group, count };
    })
    .filter((group) => group.count > 0 || !draft.henchmenGroups[group.id]?.deleteGroupIfEmpty);

  const hiredSwords = warband.hiredSwords.filter((sword) => !draft.hiredSwords[sword.id]?.removed);

  return { ...warband, heroes, henchmenGroups, hiredSwords };
}

export function applyDraftToWarband(
  warband: Warband,
  draft: PostBattleDraft,
): { warband: Warband; battleRecord: BattleRecord } {
  let treasury = [...warband.treasury];
  const deadHeroNames: string[] = [];
  const deadHenchmenSummaries: string[] = [];
  const removedSwordNames: string[] = [];

  // Heroes
  const heroes: Hero[] = [];
  for (const hero of warband.heroes) {
    const state = draft.heroes[hero.id];
    if (!state) {
      heroes.push(hero);
      continue;
    }

    if (state.resultingStatus === 'dead' || state.resultingStatus === 'captured' || state.resultingStatus === 'left') {
      if (state.resultingStatus === 'dead') deadHeroNames.push(hero.name);
      if (state.equipmentFate === 'treasury') {
        treasury = [...treasury, ...hero.equipment];
      }
      continue; // removed from roster
    }

    const advances = [...hero.advances];
    for (const key of Object.keys(state.statIncreases) as (keyof StatLine)[]) {
      const amount = state.statIncreases[key] ?? 0;
      for (let i = 0; i < amount; i++) {
        advances.push({ id: generateId(), type: 'stat', detail: `+1 ${key}`, battleRef: draft.scenario });
      }
    }
    for (const skill of state.newSkills) {
      advances.push({ id: generateId(), type: 'skill', detail: skill, battleRef: draft.scenario });
    }

    heroes.push({
      ...hero,
      xp: hero.xp + state.xpAwarded,
      stats: applyStatIncreases(hero.stats, state.statIncreases),
      skills: [...hero.skills, ...state.newSkills],
      advances,
      injuries: [
        ...hero.injuries,
        ...state.injuries.map((injury) => ({
          id: generateId(),
          name: injury.name,
          effect: injury.effect,
          dateAcquired: draft.date,
        })),
      ],
      status: state.participated ? state.resultingStatus : 'active',
    });
  }

  // Henchmen groups
  const henchmenGroups: HenchmenGroup[] = [];
  for (const group of warband.henchmenGroups) {
    const state = draft.henchmenGroups[group.id];
    if (!state) {
      henchmenGroups.push(group);
      continue;
    }

    const newCount = Math.max(0, group.count - state.diedCount);
    if (state.diedCount > 0) {
      deadHenchmenSummaries.push(`${state.diedCount}x ${group.unitType} (${group.groupName})`);
    }

    if (newCount <= 0 && state.deleteGroupIfEmpty) {
      if (state.equipmentFateForDead === 'treasury') {
        treasury = [...treasury, ...group.equipment];
      }
      continue; // group removed from roster
    }

    const advances = [...group.advances];
    for (const key of Object.keys(state.statIncreases) as (keyof StatLine)[]) {
      const amount = state.statIncreases[key] ?? 0;
      for (let i = 0; i < amount; i++) {
        advances.push({ id: generateId(), type: 'stat', detail: `+1 ${key}`, battleRef: draft.scenario });
      }
    }

    henchmenGroups.push({
      ...group,
      count: newCount,
      xp: group.isAnimal ? group.xp : group.xp + state.xpAwarded,
      stats: applyStatIncreases(group.stats, state.statIncreases),
      advances,
    });
  }

  // Hired Swords
  const hiredSwords: HiredSword[] = [];
  let upkeepPaid = 0;
  for (const sword of warband.hiredSwords) {
    const state = draft.hiredSwords[sword.id];
    if (!state) {
      hiredSwords.push(sword);
      continue;
    }

    if (state.removed) {
      removedSwordNames.push(`${sword.name} (${state.removalReason === 'diedInBattle' ? 'died' : 'upkeep unpaid'})`);
      continue;
    }

    if (state.payUpkeep) upkeepPaid += sword.upkeep;

    const advances = [...sword.advances];
    for (const key of Object.keys(state.statIncreases) as (keyof StatLine)[]) {
      const amount = state.statIncreases[key] ?? 0;
      for (let i = 0; i < amount; i++) {
        advances.push({ id: generateId(), type: 'stat', detail: `+1 ${key}`, battleRef: draft.scenario });
      }
    }
    for (const skill of state.newSkills) {
      advances.push({ id: generateId(), type: 'skill', detail: skill, battleRef: draft.scenario });
    }

    hiredSwords.push({
      ...sword,
      xp: sword.xp + state.xpAwarded,
      stats: applyStatIncreases(sword.stats, state.statIncreases),
      skills: [...sword.skills, ...state.newSkills],
      advances,
    });
  }

  const modelCountAfter = countModels({ ...warband, heroes, henchmenGroups, hiredSwords });
  const sellProfit = getWyrdstoneSellPrice(draft.wyrdstoneSold, modelCountAfter);
  const goldChange = sellProfit - upkeepPaid;

  const updatedWarband: Warband = {
    ...warband,
    heroes,
    henchmenGroups,
    hiredSwords,
    treasury,
    gold: warband.gold + goldChange,
    wyrdstoneShards: warband.wyrdstoneShards + draft.wyrdstoneFound - draft.wyrdstoneSold,
  };

  const casualtiesParts: string[] = [];
  if (deadHeroNames.length > 0) casualtiesParts.push(`Heroes lost: ${deadHeroNames.join(', ')}`);
  if (deadHenchmenSummaries.length > 0) casualtiesParts.push(`Henchmen lost: ${deadHenchmenSummaries.join(', ')}`);
  if (removedSwordNames.length > 0) casualtiesParts.push(`Hired Swords lost: ${removedSwordNames.join(', ')}`);

  const battleRecord: BattleRecord = {
    id: generateId(),
    warbandId: warband.id,
    date: draft.date,
    scenario: draft.scenario,
    opponents: draft.opponents
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    result: draft.result,
    underdogBonus: draft.underdogBonus || undefined,
    wyrdstoneFound: draft.wyrdstoneFound,
    goldChange,
    casualtiesSummary: casualtiesParts.join(' · ') || 'No casualties',
    notes: draft.notes,
  };

  return { warband: updatedWarband, battleRecord };
}

function statIncreaseTags(increases: StatIncreases): string[] {
  const tags: string[] = [];
  for (const key of Object.keys(increases) as (keyof StatLine)[]) {
    const amount = increases[key] ?? 0;
    for (let i = 0; i < amount; i++) tags.push(`+1 ${key}`);
  }
  return tags;
}

/** Human-readable bullet points for the final confirmation step. */
export function buildDiffSummary(warband: Warband, draft: PostBattleDraft): string[] {
  const lines: string[] = [];

  for (const hero of warband.heroes) {
    const state = draft.heroes[hero.id];
    if (!state) continue;

    if (!state.participated) {
      lines.push(`${hero.name} sits out this game and returns to active duty afterwards.`);
      continue;
    }

    if (state.resultingStatus === 'dead') {
      lines.push(`${hero.name} dies.`);
      continue;
    }
    if (state.resultingStatus === 'captured') {
      lines.push(`${hero.name} is captured.`);
      continue;
    }
    if (state.resultingStatus === 'left') {
      lines.push(`${hero.name} leaves the warband.`);
      continue;
    }

    if (state.xpAwarded > 0) lines.push(`${hero.name} gains +${state.xpAwarded} XP.`);
    for (const injury of state.injuries) lines.push(`${hero.name} suffers ${injury.name}.`);
    const advanceTags = [...statIncreaseTags(state.statIncreases), ...state.newSkills];
    if (advanceTags.length > 0) lines.push(`${hero.name} advances: ${advanceTags.join(', ')}.`);
    if (state.resultingStatus === 'missNextGame') lines.push(`${hero.name} will miss the next game.`);
  }

  for (const group of warband.henchmenGroups) {
    const state = draft.henchmenGroups[group.id];
    if (!state) continue;

    if (state.diedCount > 0) {
      const wiped = state.diedCount >= group.count && state.deleteGroupIfEmpty;
      lines.push(
        wiped
          ? `${group.groupName} is wiped out (${state.diedCount} lost) and removed from the roster.`
          : `${group.groupName} loses ${state.diedCount} model${state.diedCount === 1 ? '' : 's'}.`,
      );
    }
    if (state.xpAwarded > 0) lines.push(`${group.groupName} gains +${state.xpAwarded} XP.`);
    const advanceTags = statIncreaseTags(state.statIncreases);
    if (advanceTags.length > 0) lines.push(`${group.groupName} advances: ${advanceTags.join(', ')}.`);
  }

  for (const sword of warband.hiredSwords) {
    const state = draft.hiredSwords[sword.id];
    if (!state) continue;

    if (state.removed) {
      lines.push(
        `${sword.name} leaves the warband (${state.removalReason === 'diedInBattle' ? 'lost in battle' : 'upkeep unpaid'}).`,
      );
      continue;
    }
    if (state.xpAwarded > 0) lines.push(`${sword.name} gains +${state.xpAwarded} XP.`);
    const advanceTags = [...statIncreaseTags(state.statIncreases), ...state.newSkills];
    if (advanceTags.length > 0) lines.push(`${sword.name} advances: ${advanceTags.join(', ')}.`);
    if (state.payUpkeep) lines.push(`Pay ${sword.upkeep} gc upkeep to ${sword.name}.`);
  }

  if (draft.wyrdstoneFound > 0) lines.push(`+${draft.wyrdstoneFound} wyrdstone shard${draft.wyrdstoneFound === 1 ? '' : 's'} found.`);
  if (draft.wyrdstoneSold > 0) {
    const modelCountAfter = countModels(previewWarbandAfterDeaths(warband, draft));
    const price = getWyrdstoneSellPrice(draft.wyrdstoneSold, modelCountAfter);
    lines.push(`Sell ${draft.wyrdstoneSold} shard${draft.wyrdstoneSold === 1 ? '' : 's'} for +${price} gc.`);
  }

  return lines;
}

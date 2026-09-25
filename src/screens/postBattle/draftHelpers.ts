import { generateId } from '../../lib/id';
import { getUnitRacialMaximums } from '../../lib/racialMaximums';
import { getSpell } from '../../lib/spellLookup';
import { getWyrdstoneSellPrice } from '../../lib/wyrdstonePricing';
import { countModels } from '../../lib/rating';
import { resolveEquipmentItem } from '../../lib/equipmentLookup';
import { promotionSkillListOptions, unitGainsExperience } from '../../lib/ruleEffects';
import { createHenchmenGroupFromType } from '../../lib/warbandFactory';
import { getWarbandDefinition } from '../../data/warbandRegistry';
import { EquipmentItem } from '../../types';
import { OutOfActionTally } from '../../store/useAppStore';
import { BattleRecord, HenchmenGroup, Hero, HiredSword, StatLine, Warband } from '../../types';
import {
  AppliedGrant,
  HenchmenBattleState,
  HeroBattleState,
  HiredSwordBattleState,
  PostBattleDraft,
  StatIncreases,
} from './types';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyStatIncreases(): StatIncreases {
  return {};
}

/** A spell's name for an advance record. Falls back to the id so a renamed or
 * removed entry still leaves a legible advance rather than a blank one. */
function spellName(spellId: string): string {
  return getSpell(spellId)?.name ?? spellId;
}

/**
 * Fills the Injuries step from what was marked during the battle.
 *
 * Casualties were previously re-entered from memory after the game, which is
 * exactly when memory is worst. Only the out-of-action flags are carried: who
 * *died* is a post-battle roll, so `diedCount` stays at zero and the player
 * still works through the injury table.
 *
 * Everything is re-derived against the current warband rather than trusted:
 * ids that no longer exist are dropped, and group counts are clamped, so a
 * roster edited between the battle and the wizard can't seed nonsense.
 */
export function seedCasualties(
  warband: Warband,
  base: PostBattleDraft,
  tally: OutOfActionTally,
): Pick<PostBattleDraft, 'heroes' | 'henchmenGroups' | 'hiredSwords'> {
  const heroes = { ...base.heroes };
  for (const hero of warband.heroes) {
    if (tally.heroIds.includes(hero.id) && heroes[hero.id]) {
      heroes[hero.id] = { ...heroes[hero.id], outOfAction: true };
    }
  }

  const hiredSwords = { ...base.hiredSwords };
  for (const sword of warband.hiredSwords) {
    if (tally.hiredSwordIds.includes(sword.id) && hiredSwords[sword.id]) {
      hiredSwords[sword.id] = { ...hiredSwords[sword.id], outOfAction: true };
    }
  }

  const henchmenGroups = { ...base.henchmenGroups };
  for (const group of warband.henchmenGroups) {
    const downed = tally.henchmenCounts[group.id];
    if (downed === undefined || !henchmenGroups[group.id]) continue;
    henchmenGroups[group.id] = {
      ...henchmenGroups[group.id],
      outOfActionCount: Math.max(0, Math.min(group.count, downed)),
    };
  }

  return { heroes, henchmenGroups, hiredSwords };
}

/** True when anything was marked during the battle — the Injuries step says so
 * rather than letting prefilled numbers look like they appeared by themselves. */
export function hasCarriedCasualties(tally: OutOfActionTally | undefined): boolean {
  if (!tally) return false;
  return (
    tally.heroIds.length > 0 ||
    tally.hiredSwordIds.length > 0 ||
    Object.values(tally.henchmenCounts).some((n) => n > 0)
  );
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
      newSpells: [],
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
      ladsGotTalent: false,
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
      newSpells: [],
    };
  }

  return {
    scenario: '',
    opponents: '',
    opponentWarbandId: null,
    opponentWarbandName: '',
    result: 'win',
    date: todayIso(),
    underdogBonus: 0,
    enemiesTakenOut: 0,
    notes: '',
    heroes,
    henchmenGroups,
    hiredSwords,
    wyrdstoneFound: 0,
    wyrdstoneSold: 0,
    exploration: { dice: [], keptIndices: [], resolved: null },
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
      if (state.resultingStatus === 'dead') {
        // The epitaph rides along with the name, so a fallen hero's last words
        // land in the campaign's battle log rather than vanishing with him.
        const epitaph = state.lastWords?.trim();
        deadHeroNames.push(epitaph ? `${hero.name} — “${epitaph}”` : hero.name);
      }
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
    // Typed 'skill' deliberately: the advance rolled *was* a new skill, and the
    // caster spent it on a spell instead. A third Advance type would mean a
    // stored-data migration to record something the detail already says.
    for (const spellId of state.newSpells) {
      advances.push({
        id: generateId(),
        type: 'skill',
        detail: spellName(spellId),
        battleRef: draft.scenario,
      });
    }

    heroes.push({
      ...hero,
      xp: hero.xp + state.xpAwarded,
      stats: applyStatIncreases(hero.stats, state.statIncreases),
      skills: [...hero.skills, ...state.newSkills],
      spells: [...hero.spells, ...state.newSpells],
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
  /** Filled by "That Lad's Got Talent" results; appended to `heroes` below. */
  const promotedHeroes: Hero[] = [];
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

    const groupXp = unitGainsExperience(warband.warbandType, group) ? group.xp + state.xpAwarded : group.xp;
    const groupStats = applyStatIncreases(group.stats, state.statIncreases);

    // "That Lad's Got Talent": one member leaves the group and joins the
    // Heroes, keeping the characteristics and Experience he had as a Henchman.
    // His skill lists come from his unit's rule effects (ruleEffects): fixed by
    // the rules where they say so, otherwise the two the player picked in the
    // Advances step, plus any list the rules add on top.
    const promotion = promotionSkillListOptions(warband.warbandType, group.unitType);
    const promotedLists = [
      ...(promotion.fixed ?? (state.promotionSkillLists ?? []).slice(0, promotion.choose)),
      ...promotion.extra,
    ];
    if (state.ladsGotTalent && newCount > 0) {
      promotedHeroes.push({
        id: generateId(),
        name: `${group.unitType} (promoted)`,
        unitType: group.unitType,
        isLeader: false,
        isLargeCreature: group.isLargeCreature,
        stats: groupStats,
        // The racial ceiling for his unit type, not the stats he happens to
        // have. Using his own line froze the promoted model permanently: every
        // stat already sat at its "maximum", so he could never advance again.
        statMaximums: getUnitRacialMaximums(warband.warbandType, group.unitType) ?? groupStats,
        xp: groupXp,
        startingXp: groupXp,
        advances: [],
        skillLists: promotedLists,
        skills: [],
        // A promoted Henchman is not a caster: which lists a warband's Heroes
        // may use varies, and none of them grant magic on promotion. Left empty
        // for the same reason as `skillLists` — the player sets it if the
        // warband's own rules say otherwise.
        spellLists: [],
        spells: [],
        injuries: [],
        equipment: [],
        status: 'active',
        notes:
          `Promoted from ${group.groupName} by "That Lad's Got Talent" after ${draft.scenario || 'a battle'}. ` +
          (promotedLists.length > 0
            ? 'Check his starting equipment — the rulebook decides it per warband.'
            : 'Set his skill lists and starting equipment — the rulebook decides these per warband.'),
      });
    }

    henchmenGroups.push({
      ...group,
      // The promoted lad is no longer part of the group.
      count: state.ladsGotTalent ? Math.max(0, newCount - 1) : newCount,
      xp: groupXp,
      stats: groupStats,
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
    // Typed 'skill' deliberately: the advance rolled *was* a new skill, and the
    // caster spent it on a spell instead. A third Advance type would mean a
    // stored-data migration to record something the detail already says.
    for (const spellId of state.newSpells) {
      advances.push({
        id: generateId(),
        type: 'skill',
        detail: spellName(spellId),
        battleRef: draft.scenario,
      });
    }

    hiredSwords.push({
      ...sword,
      xp: sword.xp + state.xpAwarded,
      stats: applyStatIncreases(sword.stats, state.statIncreases),
      skills: [...sword.skills, ...state.newSkills],
      spells: [...sword.spells, ...state.newSpells],
      advances,
    });
  }

  // Promotions join the Heroes; the total model count is unchanged, since each
  // promoted lad left his group in the same step.
  const allHeroes = [...heroes, ...promotedHeroes];

  const modelCountAfter = countModels({ ...warband, heroes: allHeroes, henchmenGroups, hiredSwords });
  const sellProfit = getWyrdstoneSellPrice(draft.wyrdstoneSold, modelCountAfter);
  const explorationGold = draft.exploration.resolved?.gold ?? 0;
  const goldChange = sellProfit - upkeepPaid + explorationGold;

  // A location whose effect outlasts this battle is written into the warband's own
  // notes, since there is nowhere else for it to live — the app doesn't model a
  // standing exploration re-roll or an enemy warband that now hates you.
  const persistentNote = draft.exploration.resolved?.persistentNote;
  const notes = persistentNote ? [warband.notes, persistentNote].filter(Boolean).join('\n') : warband.notes;

  // §15 — the roster changes the player confirmed from the Exploration result.
  const explored = applyExplorationGrants(
    warband.warbandType,
    { heroes: allHeroes, henchmenGroups, treasury },
    draft.exploration.resolved?.grants ?? [],
  );

  const updatedWarband: Warband = {
    ...warband,
    heroes: explored.heroes,
    henchmenGroups: explored.henchmenGroups,
    hiredSwords,
    treasury: explored.treasury,
    notes,
    gold: warband.gold + goldChange,
    wyrdstoneShards: warband.wyrdstoneShards + draft.wyrdstoneFound - draft.wyrdstoneSold,
  };

  const casualtiesParts: string[] = [];
  if (deadHeroNames.length > 0) casualtiesParts.push(`Heroes lost: ${deadHeroNames.join(', ')}`);
  if (deadHenchmenSummaries.length > 0) casualtiesParts.push(`Henchmen lost: ${deadHenchmenSummaries.join(', ')}`);
  if (removedSwordNames.length > 0) casualtiesParts.push(`Hired Swords lost: ${removedSwordNames.join(', ')}`);

  // Deaths only — the structured mirror of the summary above: dead heroes, dead
  // henchmen, and hired swords that fell (not those dropped for unpaid upkeep).
  // Captured/retired heroes leave the roster but aren't casualties, so they don't count.
  let modelsLost = 0;
  for (const state of Object.values(draft.heroes)) if (state.resultingStatus === 'dead') modelsLost++;
  for (const state of Object.values(draft.henchmenGroups)) modelsLost += state.diedCount;
  for (const state of Object.values(draft.hiredSwords)) {
    if (state.removed && state.removalReason === 'diedInBattle') modelsLost++;
  }

  const opponentList = draft.opponents
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const battleRecord: BattleRecord = {
    id: generateId(),
    warbandId: warband.id,
    date: draft.date,
    scenario: draft.scenario,
    opponents: opponentList,
    opponentWarbandIds:
      draft.opponentWarbandId && opponentList.includes(draft.opponentWarbandName.trim())
        ? { [draft.opponentWarbandName.trim()]: draft.opponentWarbandId }
        : undefined,
    result: draft.result,
    underdogBonus: draft.underdogBonus || undefined,
    wyrdstoneFound: draft.wyrdstoneFound,
    goldChange,
    casualtiesSummary: casualtiesParts.join(' · ') || 'No casualties',
    modelsLost: modelsLost || undefined,
    enemiesTakenOut: draft.enemiesTakenOut || undefined,
    notes: [draft.notes, draft.exploration.resolved?.note].filter(Boolean).join('\n'),
  };

  return { warband: updatedWarband, battleRecord };
}

/**
 * Writes confirmed Exploration grants onto the post-battle roster: items into the
 * treasury, Experience and skills onto the chosen Heroes, free models into (or as)
 * a Henchman group. Pure — the same inputs always give the same roster. A grant
 * aimed at a Hero who's no longer on the roster is skipped rather than guessed.
 */
function applyExplorationGrants(
  warbandType: string,
  roster: { heroes: Hero[]; henchmenGroups: HenchmenGroup[]; treasury: EquipmentItem[] },
  grants: AppliedGrant[],
): { heroes: Hero[]; henchmenGroups: HenchmenGroup[]; treasury: EquipmentItem[] } {
  if (grants.length === 0) return roster;
  const definition = getWarbandDefinition(warbandType);
  let heroes = roster.heroes;
  let henchmenGroups = roster.henchmenGroups;
  let treasury = roster.treasury;

  const updateHero = (id: string, fn: (h: Hero) => Hero) => {
    heroes = heroes.map((h) => (h.id === id ? fn(h) : h));
  };

  for (const g of grants) {
    switch (g.type) {
      case 'item': {
        const catalogue = resolveEquipmentItem(g.equipmentId, definition);
        for (let i = 0; i < g.count; i += 1) {
          treasury = [
            ...treasury,
            {
              id: generateId(),
              name: g.name,
              category: catalogue?.category ?? 'misc',
              ...(catalogue?.cost != null ? { cost: catalogue.cost } : {}),
              ...(g.notes ? { notes: g.notes } : {}),
            },
          ];
        }
        break;
      }
      case 'xp':
        updateHero(g.heroId, (h) => ({ ...h, xp: h.xp + g.amount }));
        break;
      case 'skillList':
        updateHero(g.heroId, (h) => (h.skillLists.includes(g.list) ? h : { ...h, skillLists: [...h.skillLists, g.list] }));
        break;
      case 'skill':
        updateHero(g.heroId, (h) => (h.skills.includes(g.skill) ? h : { ...h, skills: [...h.skills, g.skill] }));
        break;
      case 'heroNote':
        updateHero(g.heroId, (h) => ({ ...h, notes: [h.notes, g.text].filter(Boolean).join('\n') }));
        break;
      case 'henchmen': {
        const existing = henchmenGroups.find((grp) => grp.unitType === g.unitType);
        if (existing) {
          henchmenGroups = henchmenGroups.map((grp) =>
            grp.id === existing.id ? { ...grp, count: grp.count + g.count } : grp,
          );
        } else {
          const type = definition?.henchmenTypes.find((t) => t.unitType === g.unitType);
          if (type) henchmenGroups = [...henchmenGroups, createHenchmenGroupFromType(type, type.unitType, g.count)];
        }
        break;
      }
      case 'recruit':
        henchmenGroups = henchmenGroups.map((grp) => (grp.id === g.groupId ? { ...grp, count: grp.count + 1 } : grp));
        break;
    }
  }
  return { heroes, henchmenGroups, treasury };
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
    const advanceTags = [
      ...statIncreaseTags(state.statIncreases),
      ...state.newSkills,
      ...state.newSpells.map(spellName),
    ];
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
    const advanceTags = [
      ...statIncreaseTags(state.statIncreases),
      ...state.newSkills,
      ...state.newSpells.map(spellName),
    ];
    if (advanceTags.length > 0) lines.push(`${sword.name} advances: ${advanceTags.join(', ')}.`);
    if (state.payUpkeep) lines.push(`Pay ${sword.upkeep} gc upkeep to ${sword.name}.`);
  }

  const explored = draft.exploration.resolved;
  if (explored) {
    lines.push(explored.note);
    if (explored.gold > 0) lines.push(`Exploration loot: +${explored.gold} gc.`);
    if (explored.persistentNote) lines.push(`Added to the warband's notes: ${explored.persistentNote}`);
  }

  if (draft.wyrdstoneFound > 0) lines.push(`+${draft.wyrdstoneFound} wyrdstone shard${draft.wyrdstoneFound === 1 ? '' : 's'} found.`);
  if (draft.wyrdstoneSold > 0) {
    const modelCountAfter = countModels(previewWarbandAfterDeaths(warband, draft));
    const price = getWyrdstoneSellPrice(draft.wyrdstoneSold, modelCountAfter);
    lines.push(`Sell ${draft.wyrdstoneSold} shard${draft.wyrdstoneSold === 1 ? '' : 's'} for +${price} gc.`);
  }

  return lines;
}

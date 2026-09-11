import { WarbandDefinition } from '../../data/types';
import { Warband, StatLine, EquipmentItem } from '../../types';
import { createWarband, createHeroFromSlot, createHenchmenGroupFromType } from '../warbandFactory';
import { resolveEquipmentItem, ResolvedEquipmentItem } from '../equipmentLookup';
import { generateId } from '../id';

/**
 * The app-built AI opponent for a solo game. Everything here — how the enemy
 * warband is composed and how it behaves — is APP-ORIGINAL, not part of the
 * Mordheim rules, and is surfaced as suggestions badged as such. Only the
 * statlines and costs it draws on are sourced (from the warband definitions).
 *
 * Ported from the Mord Hive solo kit; MM and Mord Hive share the warband schema
 * (heroSlots / henchmenTypes / equipmentLists), so the build logic is the
 * original, with the flavour reskinned to Mordheim (wyrdstone, gold crowns).
 */

/**
 * Picks a sensible loadout for an AI model from its unit's own equipment lists —
 * a real weapon (and armour) so the opponent is a threat and its wargear is
 * something the solo player can see and run. Drawn only from sourced items;
 * every model keeps its free dagger on top of these.
 *
 * A shooter (BS at least its WS, and 3+) also takes a missile weapon. Deliberately
 * modest: one melee weapon capped at 30 gc where possible, the cheapest missile,
 * the cheapest armour — enough to fight, not a gilded elite.
 */
function equipNpcModel(def: WarbandDefinition, equipmentOptions: string[], stats: StatLine): EquipmentItem[] {
  const ids = new Set<string>();
  for (const listId of equipmentOptions) for (const id of def.equipmentLists[listId] ?? []) ids.add(id);
  const items = [...ids]
    .map((id) => resolveEquipmentItem(id, def))
    .filter((i): i is ResolvedEquipmentItem => !!i && i.cost !== null);

  const isDagger = (i: ResolvedEquipmentItem) => i.name.trim().toLowerCase() === 'dagger';
  const byCostAsc = (a: ResolvedEquipmentItem, b: ResolvedEquipmentItem) => (a.cost ?? 0) - (b.cost ?? 0);
  const melee = items.filter((i) => i.category === 'melee' && !isDagger(i));
  const missile = items.filter((i) => i.category === 'missile');
  const armour = items.filter((i) => i.category === 'armour');

  const chosen: ResolvedEquipmentItem[] = [];
  const pickMelee =
    [...melee].filter((i) => (i.cost ?? 0) <= 30).sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0] ??
    [...melee].sort(byCostAsc)[0];
  if (pickMelee) chosen.push(pickMelee);
  const shooter = stats.BS >= stats.WS && stats.BS >= 3;
  if (shooter && missile.length) chosen.push([...missile].sort(byCostAsc)[0]);
  if (armour.length) chosen.push([...armour].sort(byCostAsc)[0]);

  return chosen.map((i) => ({ id: generateId(), name: i.name, category: i.category, cost: i.cost ?? 0, notes: i.notes }));
}

/**
 * Builds a full-strength enemy warband from a sourced list, spending toward a
 * gold-crown budget: the mandatory leader, then one of each other Hero it can
 * afford, then the cheapest henchmen filled toward the size cap. Deterministic
 * enough to be fair, fuller than a "quick start" since an opponent should be a
 * real threat. Names are auto-assigned; each model is armed from its own
 * equipment list (see equipNpcModel) so it can actually fight.
 */
export function buildNpcWarband(def: WarbandDefinition, budget = 500): Warband {
  const warband = createWarband(def, `${def.name} (AI)`);
  let gold = budget;
  const sizeCap = def.maxWarbandSize ?? 20;
  let size = 0;

  const leaderSlot = def.heroSlots.find((s) => s.isLeader);
  if (leaderSlot) {
    const hero = createHeroFromSlot(leaderSlot, leaderSlot.unitType);
    hero.equipment.push(...equipNpcModel(def, leaderSlot.equipmentOptions, hero.stats));
    warband.heroes.push(hero);
    gold = Math.max(0, gold - (leaderSlot.cost ?? 0));
    size += 1;
  }

  // One of each affordable non-leader hero, cheapest first, keeping henchmen headroom.
  const otherHeroes = def.heroSlots
    .filter((s) => !s.isLeader && s.cost !== null)
    .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0));
  for (const slot of otherHeroes) {
    if (size >= sizeCap) break;
    const cost = slot.cost ?? 0;
    if (cost > gold - 40) continue;
    const hero = createHeroFromSlot(slot, slot.unitType);
    hero.equipment.push(...equipNpcModel(def, slot.equipmentOptions, hero.stats));
    warband.heroes.push(hero);
    gold -= cost;
    size += 1;
  }

  // Fill toward the cap with the cheapest henchman type (in groups of up to 5).
  const cheapest = def.henchmenTypes
    .filter((t) => (t.cost ?? 0) > 0)
    .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))[0];
  if (cheapest) {
    const cost = cheapest.cost as number;
    let n = 0;
    const perTypeCap = cheapest.maxCount ?? Number.POSITIVE_INFINITY;
    while (size < sizeCap && n < perTypeCap && gold >= cost) {
      gold -= cost;
      size += 1;
      n += 1;
    }
    // Split into groups of 5, as the rules recruit henchmen. Each group shares a
    // loadout drawn from its own equipment list.
    let remaining = n;
    let groupIndex = 1;
    while (remaining > 0) {
      const g = Math.min(5, remaining);
      const group = createHenchmenGroupFromType(cheapest, `${cheapest.unitType} ${groupIndex}`, g);
      group.equipment.push(...equipNpcModel(def, cheapest.equipmentOptions, group.stats));
      warband.henchmenGroups.push(group);
      remaining -= g;
      groupIndex += 1;
    }
  }

  warband.gold = gold;
  return warband;
}

/**
 * Builds an enemy warband constrained to the models the player OWNS (§solo
 * collection): never more of a unit than `owned` lists, never a unit owned 0 of.
 * Spends toward the budget within those counts — the leader first (if owned),
 * then heroes cheapest-first, then henchmen — so the result is a force you can
 * actually put on the table. Falls back to nothing if the pool is empty.
 */
export function buildNpcFromCollection(
  def: WarbandDefinition,
  owned: Record<string, number>,
  budget = 500,
): Warband {
  const warband = createWarband(def, `${def.name} (AI)`);
  let gold = budget;
  const sizeCap = def.maxWarbandSize ?? 20;
  let size = 0;
  const ownedOf = (unitType: string) => owned[unitType] ?? 0;

  const leaderSlot = def.heroSlots.find((s) => s.isLeader);
  if (leaderSlot && ownedOf(leaderSlot.unitType) >= 1 && size < sizeCap) {
    const hero = createHeroFromSlot(leaderSlot, leaderSlot.unitType);
    hero.equipment.push(...equipNpcModel(def, leaderSlot.equipmentOptions, hero.stats));
    warband.heroes.push(hero);
    gold = Math.max(0, gold - (leaderSlot.cost ?? 0));
    size += 1;
  }

  // Other heroes: cheapest first, up to the number owned (and the slot's own cap).
  const otherHeroes = def.heroSlots
    .filter((s) => !s.isLeader && s.cost !== null && ownedOf(s.unitType) > 0)
    .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0));
  for (const slot of otherHeroes) {
    const cap = Math.min(ownedOf(slot.unitType), slot.maxCount ?? Number.POSITIVE_INFINITY);
    const cost = slot.cost ?? 0;
    for (let i = 0; i < cap && size < sizeCap && gold >= cost; i++) {
      const hero = createHeroFromSlot(slot, slot.unitType);
      hero.equipment.push(...equipNpcModel(def, slot.equipmentOptions, hero.stats));
      warband.heroes.push(hero);
      gold -= cost;
      size += 1;
    }
  }

  // Henchmen: cheapest first, up to the number owned, split into groups of 5.
  const henchTypes = def.henchmenTypes
    .filter((t) => (t.cost ?? 0) > 0 && ownedOf(t.unitType) > 0)
    .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0));
  for (const type of henchTypes) {
    const cap = Math.min(ownedOf(type.unitType), type.maxCount ?? Number.POSITIVE_INFINITY);
    const cost = type.cost as number;
    let n = 0;
    while (size < sizeCap && n < cap && gold >= cost) {
      gold -= cost;
      size += 1;
      n += 1;
    }
    let remaining = n;
    let groupIndex = 1;
    while (remaining > 0) {
      const g = Math.min(5, remaining);
      const group = createHenchmenGroupFromType(type, `${type.unitType} ${groupIndex}`, g);
      group.equipment.push(...equipNpcModel(def, type.equipmentOptions, group.stats));
      warband.henchmenGroups.push(group);
      remaining -= g;
      groupIndex += 1;
    }
  }

  warband.gold = gold;
  return warband;
}

// --- Temperament & hidden agenda (app-original solo-mode flavour) ---

export type NpcTemperament = 'aggressive' | 'cautious' | 'cunning' | 'frenzied';

export const TEMPERAMENT_LABELS: Record<NpcTemperament, string> = {
  aggressive: 'Aggressive',
  cautious: 'Cautious',
  cunning: 'Cunning',
  frenzied: 'Frenzied',
};

export const TEMPERAMENT_HINTS: Record<NpcTemperament, string> = {
  aggressive: 'Presses forward and charges at every opening.',
  cautious: 'Uses cover, holds firing lines, commits only when it must.',
  cunning: 'Flanks, isolates, and picks off the weak and the lone.',
  frenzied: 'Throws itself at the nearest foe with no regard for losses.',
};

/**
 * The enemy's secret objective. Known to the app but hidden from the solo player
 * until revealed (at battle's end) — it's what gives the AI opponent a sense of
 * purpose beyond "kill everything". App-original, not rules content.
 */
export type NpcAgenda = {
  temperament: NpcTemperament;
  /** Short title, shown when revealed. */
  objective: string;
  /** How the opponent "wins" its own game, shown when revealed. */
  reveal: string;
};

const AGENDA_POOL: Omit<NpcAgenda, 'temperament'>[] = [
  { objective: 'Secure the Find', reveal: 'Hold the central objective when the dust settles — the wyrdstone is all that matters.' },
  { objective: 'Decapitation', reveal: 'Put the enemy leader out of action; the rest can scatter.' },
  { objective: 'Smash and Grab', reveal: 'Grab what wyrdstone it can and quit the field before it bleeds out.' },
  { objective: 'Bloodletting', reveal: 'Take as many of the enemy out of action as possible — a message written in bodies.' },
  { objective: 'Hold the Ruins', reveal: 'Control more of the standing buildings than the enemy at the end.' },
  { objective: 'Probe and Withdraw', reveal: 'Test the enemy, then rout on its own terms before losing a third of the warband.' },
];

const TEMPERAMENTS: NpcTemperament[] = ['aggressive', 'cautious', 'cunning', 'frenzied'];

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Rolls a hidden agenda + temperament for a freshly generated opponent. */
export function generateAgenda(): NpcAgenda {
  return { temperament: pick(TEMPERAMENTS), ...pick(AGENDA_POOL) };
}

export type NpcActor = {
  name: string;
  unitType: string;
  isLeader: boolean;
  isAnimal: boolean;
  stats: StatLine;
};

/**
 * A per-turn activation suggestion for one enemy model. A deliberately simple,
 * transparent heuristic — role first, then a shooting/melee lean read off the
 * profile, with pressure ramping over the game, then shaded by the warband's
 * temperament. Guidance for a solo player, never an authoritative move; it is
 * app-original, not rules content.
 */
export function suggestNpcAction(actor: NpcActor, turn: number, temperament: NpcTemperament = 'aggressive'): string {
  const base = baseAction(actor, turn);
  const flavour = temperamentRider(actor, temperament);
  return flavour ? `${base} ${flavour}` : base;
}

function baseAction(actor: NpcActor, turn: number): string {
  if (actor.isAnimal) {
    return 'Move the full distance toward the nearest enemy and charge if it can reach — no fear, no hesitation.';
  }
  if (actor.isLeader) {
    return turn <= 2
      ? 'Hold a central position where it can lend its Leadership; push behind the front.'
      : 'Commit: advance with the pack, staying close enough to keep models in command range, and charge a weakened target.';
  }
  const shooter = actor.stats.BS >= actor.stats.WS && actor.stats.BS >= 3;
  if (shooter) {
    return turn <= 2
      ? 'Take up a firing position with a clear line of sight and shoot the nearest visible enemy.'
      : 'Hold the firing line and shoot the most dangerous or closest target; fall back a step if charged.';
  }
  return turn <= 1
    ? 'Advance the full distance toward the nearest enemy, using cover where possible.'
    : 'Charge the nearest enemy in reach; otherwise advance to threaten a charge next turn.';
}

function temperamentRider(actor: NpcActor, temperament: NpcTemperament): string {
  switch (temperament) {
    case 'aggressive':
      return actor.isLeader ? '' : 'Favour the charge over the safe move.';
    case 'cautious':
      return 'Stay in cover and give ground rather than take a bad fight.';
    case 'cunning':
      return 'Prefer an isolated, wounded, or lone target over the nearest one.';
    case 'frenzied':
      return 'Go for the throat regardless of the odds.';
    default:
      return '';
  }
}

/** Aggregate difficulty label from a budget, shown when generating an opponent. */
export function difficultyForBudget(budget: number): string {
  if (budget <= 350) return 'Skirmish';
  if (budget <= 550) return 'Even';
  return 'Overwhelming';
}

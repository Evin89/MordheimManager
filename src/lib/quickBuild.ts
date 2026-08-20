import { WarbandDefinition } from '../data/types';
import { Hero, HenchmenGroup } from '../types';
import { createHeroFromSlot, createHenchmenGroupFromType } from './warbandFactory';

/**
 * A legal starter roster for a freshly-created warband (spec §21 QoL).
 *
 * Not the rulebook's named "suggested warband" — that text isn't in the data —
 * but a sensible, legal skeleton the player edits: the required leader, one of
 * each other hero the budget comfortably allows, and a core of the cheapest
 * henchmen filled toward a modest starting size. Deliberately leaves gold on the
 * table rather than spending every crown, because a starter is a base to build
 * on, not a finished warband. Deterministic, and stays inside every limit the
 * warband check enforces (starting gold, per-unit caps, maximum size).
 *
 * Fighters are auto-named after their unit type; the player renames on the
 * roster. Models arrive with only the free dagger — buying weapons is the first
 * thing a player wants to decide themselves.
 */

/** Keep enough back for at least a couple of the cheapest henchmen when taking heroes. */
const HENCHMEN_HEADROOM = 60;
/** The size a starter fills toward when the budget allows — a playable core, not the cap. */
const TARGET_SIZE = 8;

export type QuickBuildResult = {
  heroes: Hero[];
  henchmenGroups: HenchmenGroup[];
  goldSpent: number;
};

export function quickBuildStarterRoster(def: WarbandDefinition): QuickBuildResult {
  const startingGold = def.startingGold ?? 0;
  let gold = startingGold;
  const heroes: Hero[] = [];
  const henchmenGroups: HenchmenGroup[] = [];
  const sizeCap = def.maxWarbandSize ?? Number.POSITIVE_INFINITY;
  let size = 0; // heroes + henchmen — Hired Swords aren't part of a starter

  // 1. The leader — the one mandatory hero. Added even if its price is missing
  //    from the data (a warband must have one); gold never goes below zero.
  const leaderSlot = def.heroSlots.find((s) => s.isLeader);
  if (leaderSlot && size < sizeCap) {
    heroes.push(createHeroFromSlot(leaderSlot, leaderSlot.unitType));
    gold = Math.max(0, gold - (leaderSlot.cost ?? 0));
    size += 1;
  }

  // 2. One of each other hero, cheapest first, while it still leaves room for a
  //    henchman core and stays within the size cap. (Per-unit caps on heroes are
  //    respected trivially: one each, never more.)
  const otherHeroSlots = def.heroSlots
    .filter((s) => !s.isLeader && s.cost !== null && (s.maxCount === null || s.maxCount > 0))
    .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0));
  for (const slot of otherHeroSlots) {
    if (size >= sizeCap) break;
    const cost = slot.cost ?? 0;
    if (cost > gold - HENCHMEN_HEADROOM) continue;
    heroes.push(createHeroFromSlot(slot, slot.unitType));
    gold -= cost;
    size += 1;
  }

  // 3. A core of the single cheapest henchman type, filled toward TARGET_SIZE
  //    (or the warband's minimum, or the size cap — whichever is tighter),
  //    limited by budget and the type's own cap.
  const cheapest = def.henchmenTypes
    .filter((t) => t.cost !== null && (t.cost ?? 0) > 0)
    .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))[0];
  if (cheapest) {
    const cost = cheapest.cost as number;
    const target = Math.min(sizeCap, Math.max(def.minWarbandSize ?? 0, TARGET_SIZE));
    const count = Math.max(
      0,
      Math.min(
        Math.floor(gold / cost), // budget
        cheapest.maxCount ?? Number.POSITIVE_INFINITY, // per-type cap
        sizeCap - size, // overall size cap
        Math.max(0, target - size), // don't overshoot the modest target
      ),
    );
    if (count > 0) {
      henchmenGroups.push(createHenchmenGroupFromType(cheapest, cheapest.unitType, count));
      gold -= count * cost;
    }
  }

  return { heroes, henchmenGroups, goldSpent: startingGold - gold };
}

/** A one-line human summary of a starter — for the confirmation UI before creating. */
export function describeStarter(def: WarbandDefinition, result: QuickBuildResult): string {
  const parts: string[] = [];
  for (const h of result.heroes) parts.push(h.unitType);
  for (const g of result.henchmenGroups) parts.push(`${g.count}× ${g.unitType}`);
  const models = result.heroes.length + result.henchmenGroups.reduce((n, g) => n + g.count, 0);
  const goldLeft = (def.startingGold ?? 0) - result.goldSpent;
  if (parts.length === 0) return 'Nothing to build for this warband.';
  return `${parts.join(', ')} — ${models} model${models === 1 ? '' : 's'}, ${goldLeft} gc left to spend.`;
}

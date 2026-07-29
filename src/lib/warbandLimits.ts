import { WarbandDefinition, HenchmenTypeDefinition, HeroSlotDefinition } from '../data/types';
import { Warband } from '../types';

const ACTIVE_STATUSES = new Set(['active', 'missNextGame']);

/**
 * Models counting toward the warband's maximum size.
 *
 * Hired Swords are excluded: by the rules they're hired help rather than
 * members of the warband, and don't take up a slot. This is deliberately
 * *not* `countModels` from `rating.ts`, which includes them because rating
 * asks a different question — how dangerous is this warband — and a Hired
 * Sword absolutely counts for that.
 */
export function countTowardWarbandSize(warband: Warband): number {
  let count = 0;
  for (const hero of warband.heroes) {
    if (ACTIVE_STATUSES.has(hero.status)) count += 1;
  }
  for (const group of warband.henchmenGroups) {
    count += group.count;
  }
  return count;
}

/** How many more models will fit, or null when the warband has no maximum. */
export function remainingWarbandCapacity(
  warband: Warband,
  definition: WarbandDefinition,
): number | null {
  if (definition.maxWarbandSize === null) return null;
  return Math.max(0, definition.maxWarbandSize - countTowardWarbandSize(warband));
}

/** How many more of this hero type may be recruited, or null when unlimited. */
export function remainingHeroSlots(warband: Warband, slot: HeroSlotDefinition): number | null {
  if (slot.maxCount === null) return null;
  const taken = warband.heroes.filter(
    (h) => h.unitType === slot.unitType && ACTIVE_STATUSES.has(h.status),
  ).length;
  return Math.max(0, slot.maxCount - taken);
}

/** How many more of this henchman type may be recruited, or null when unlimited. */
export function remainingHenchmenSlots(
  warband: Warband,
  type: HenchmenTypeDefinition,
): number | null {
  if (type.maxCount === null) return null;
  const taken = warband.henchmenGroups
    .filter((g) => g.unitType === type.unitType)
    .reduce((sum, g) => sum + g.count, 0);
  return Math.max(0, type.maxCount - taken);
}

/**
 * The most of this henchman type that can actually be added right now: the
 * tighter of its own per-type limit, the warband's overall size limit, and
 * what the treasury can pay for.
 *
 * Returning a single number keeps the caller from having to re-derive which
 * limit bit — the UI just needs to know where to stop.
 */
export function maxAffordableHenchmen(
  warband: Warband,
  definition: WarbandDefinition,
  type: HenchmenTypeDefinition,
): number {
  const limits: number[] = [];

  const perType = remainingHenchmenSlots(warband, type);
  if (perType !== null) limits.push(perType);

  const capacity = remainingWarbandCapacity(warband, definition);
  if (capacity !== null) limits.push(capacity);

  // A cost of null means the data is incomplete for this unit; don't invent a
  // price and don't block recruiting on one either.
  if (type.cost !== null && type.cost > 0) limits.push(Math.floor(warband.gold / type.cost));

  return limits.length === 0 ? Number.POSITIVE_INFINITY : Math.max(0, Math.min(...limits));
}

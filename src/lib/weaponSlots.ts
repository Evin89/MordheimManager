import { EquipmentItem } from '../types';

/**
 * "Each warrior you recruit can be armed with up to two close combat weapons
 * (in addition to his free dagger), up to two different missile weapons and any
 * armour chosen from the appropriate list. For these purposes, a brace of
 * pistols counts as a single missile weapon."
 */
export const MAX_MELEE = 2;
export const MAX_MISSILE_TYPES = 2;

/**
 * The dagger every warrior starts with, which sits outside the two-weapon
 * limit. Identified by being a cost-free Dagger: a *bought* dagger costs money
 * and does count, so name alone would be wrong. Only one is ever exempt.
 */
function isFreeDagger(item: EquipmentItem): boolean {
  return item.name.trim().toLowerCase() === 'dagger' && (item.cost ?? 0) === 0;
}

export type SlotUsage = {
  melee: number;
  /** Distinct missile weapons, not entries — see `missileNames`. */
  missileTypes: number;
  missileNames: string[];
  freeDaggerExempt: boolean;
};

export function countWeaponSlots(equipment: EquipmentItem[]): SlotUsage {
  let exempt = false;
  let melee = 0;
  for (const item of equipment) {
    if (item.category !== 'melee') continue;
    // Exempt only the first free dagger; a second one is a real weapon.
    if (!exempt && isFreeDagger(item)) {
      exempt = true;
      continue;
    }
    melee += 1;
  }

  // "Up to two *different* missile weapons", and a brace counts as one. Both
  // fall out of counting distinct names: a brace is bought as a single entry,
  // and a second pistol is the same weapon rather than another slot.
  const missileNames = [
    ...new Set(
      equipment.filter((i) => i.category === 'missile').map((i) => i.name.trim().toLowerCase()),
    ),
  ];

  return { melee, missileTypes: missileNames.length, missileNames, freeDaggerExempt: exempt };
}

export type SlotVerdict = { allowed: true } | { allowed: false; reason: 'meleeFull' | 'missileFull' };

/**
 * Whether one more of `item` fits. Armour and miscellaneous gear are unlimited —
 * the rules cap close combat and missile weapons only.
 */
export function canAddWeapon(
  equipment: EquipmentItem[],
  item: { name: string; category: EquipmentItem['category'] },
): SlotVerdict {
  const usage = countWeaponSlots(equipment);

  if (item.category === 'melee') {
    return usage.melee >= MAX_MELEE ? { allowed: false, reason: 'meleeFull' } : { allowed: true };
  }

  if (item.category === 'missile') {
    // Another of a weapon already carried takes no new slot — that is what
    // makes a second pistol a brace rather than a third weapon.
    if (usage.missileNames.includes(item.name.trim().toLowerCase())) return { allowed: true };
    return usage.missileTypes >= MAX_MISSILE_TYPES
      ? { allowed: false, reason: 'missileFull' }
      : { allowed: true };
  }

  return { allowed: true };
}

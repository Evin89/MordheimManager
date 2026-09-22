import { ModelStatus, Warband } from '../types';
import hiredSwordsData from '../data/hiredSwords.json';
import { HiredSwordsData } from '../data/types';

// Warband rating per spec section 3.2: (number of models x 5) + accumulated XP,
// with large creatures counting 20 instead of 5. Dead/captured/left models are
// no longer part of the warband and are excluded.
//
// Hired Swords have their own flat rating bonus per the rulebook (e.g. a Pit
// Fighter is "+22, plus 1 per XP") instead of the generic 5/20-per-model rule —
// looked up by `sword.type`, which `createHiredSwordFromDefinition` sets to the
// definition's own `name`, so the two can't drift apart. A sword whose type
// doesn't resolve (a custom or renamed entry, or the data changing under an
// existing warband) falls back to the generic formula rather than guessing at
// a bonus or silently contributing nothing.
const HIRED_SWORD_BONUS = new Map(
  (hiredSwordsData as HiredSwordsData).hiredSwords
    .filter((hs) => hs.ratingFlatBonus != null)
    .map((hs) => [hs.name, hs.ratingFlatBonus!]),
);

const ACTIVE_STATUSES = new Set(['active', 'missNextGame']);

/**
 * Whether a model is still part of the warband.
 *
 * "Misses next game" counts: he is injured, not gone. Dead, captured and left
 * models are out, which is why they neither add to the rating nor belong on a
 * roster sheet you carry to the table. Exported so the sheet and the rating
 * agree on who is in the warband instead of each keeping its own list.
 */
export function isInWarband(status: ModelStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function computeWarbandRating(warband: Warband): number {
  let rating = 0;

  for (const hero of warband.heroes) {
    if (!ACTIVE_STATUSES.has(hero.status)) continue;
    rating += (hero.isLargeCreature ? 20 : 5) + hero.xp;
  }

  for (const group of warband.henchmenGroups) {
    // `group.xp` is the Experience of *each* member — a Henchmen group advances
    // together and every model in it carries the same value — so it counts once
    // per model, exactly like the 5-per-model part. Counting it once for the
    // whole group understated a group of five veterans by four times their XP.
    rating += ((group.isLargeCreature ? 20 : 5) + group.xp) * group.count;
  }

  for (const sword of warband.hiredSwords) {
    if (!ACTIVE_STATUSES.has(sword.status)) continue;
    const flatBonus = HIRED_SWORD_BONUS.get(sword.type) ?? (sword.isLargeCreature ? 20 : 5);
    rating += flatBonus + sword.xp;
  }

  return rating;
}

export function countModels(warband: Warband): number {
  let count = 0;
  for (const hero of warband.heroes) {
    if (ACTIVE_STATUSES.has(hero.status)) count += 1;
  }
  for (const group of warband.henchmenGroups) {
    count += group.count;
  }
  for (const sword of warband.hiredSwords) {
    if (ACTIVE_STATUSES.has(sword.status)) count += 1;
  }
  return count;
}

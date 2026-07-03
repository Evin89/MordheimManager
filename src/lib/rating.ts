import { Warband } from '../types';

// Warband rating per spec section 3.2: (number of models x 5) + accumulated XP,
// with large creatures counting 20 instead of 5. Dead/captured/left models are
// no longer part of the warband and are excluded.
//
// Hired Swords have their own flat rating bonus per the rulebook (e.g. a Pit
// Fighter is "+22, plus 1 per XP") rather than the flat 5/20-per-model rule,
// but that bonus isn't wired to individual Hired Sword records yet, so they
// are approximated here using the same 5/20-per-model formula as everyone
// else. Revisit once hiredSwords.json data is linked to warband instances.
const ACTIVE_STATUSES = new Set(['active', 'missNextGame']);

export function computeWarbandRating(warband: Warband): number {
  let rating = 0;

  for (const hero of warband.heroes) {
    if (!ACTIVE_STATUSES.has(hero.status)) continue;
    rating += (hero.isLargeCreature ? 20 : 5) + hero.xp;
  }

  for (const group of warband.henchmenGroups) {
    rating += (group.isLargeCreature ? 20 : 5) * group.count + group.xp;
  }

  for (const sword of warband.hiredSwords) {
    if (!ACTIVE_STATUSES.has(sword.status)) continue;
    rating += (sword.isLargeCreature ? 20 : 5) + sword.xp;
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

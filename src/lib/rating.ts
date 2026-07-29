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
    // `group.xp` is the Experience of *each* member — a Henchmen group advances
    // together and every model in it carries the same value — so it counts once
    // per model, exactly like the 5-per-model part. Counting it once for the
    // whole group understated a group of five veterans by four times their XP.
    rating += ((group.isLargeCreature ? 20 : 5) + group.xp) * group.count;
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

import { BattleRecord } from '../types';

/**
 * Per the rulebook (Warbands, "weapons and armour"): rare items may be bought
 * freely when first assembling a warband, but after its first game the only
 * way to get more is to roll to locate them. We treat "has this warband
 * fought yet" as the dividing line, checked against the campaign's battle log
 * rather than a separate flag so it can't drift out of sync.
 *
 * Battles live in their own table now, so callers pass the list from
 * `useBattlesQuery` — which is `undefined` while it's still loading. We treat
 * that as "not yet fought", the same as the old code did for a null campaign.
 */
export function hasFoughtFirstBattle(warbandId: string, battles: BattleRecord[] | undefined): boolean {
  return battles?.some((b) => b.warbandId === warbandId) ?? false;
}

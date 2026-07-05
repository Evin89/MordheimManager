import { Campaign } from '../types';

/**
 * Per the rulebook (Warbands, "weapons and armour"): rare items may be bought
 * freely when first assembling a warband, but after its first game the only
 * way to get more is to roll to locate them. We treat "has this warband
 * fought yet" as the dividing line, checked against the campaign log rather
 * than a separate flag so it can't drift out of sync.
 */
export function hasFoughtFirstBattle(warbandId: string, campaign: Campaign | null): boolean {
  return campaign?.battles.some((b) => b.warbandId === warbandId) ?? false;
}

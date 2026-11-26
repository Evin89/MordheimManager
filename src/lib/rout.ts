import type { Warband } from '../types';
import type { OutOfActionTally } from '../store/useAppStore';

/** Count the models on the table at the start of this battle. */
export function countBattleModels(warband: Warband): number {
  return warband.heroes.filter((hero) => hero.status === 'active').length
    + warband.hiredSwords.filter((sword) => sword.status === 'active').length
    + warband.henchmenGroups.reduce((sum, group) => sum + group.count, 0);
}

export function countDown(tally: OutOfActionTally): number {
  return tally.heroIds.length + tally.hiredSwordIds.length
    + Object.values(tally.henchmenCounts).reduce((sum, count) => sum + count, 0);
}

export function routTestRequired(down: number, total: number): boolean {
  return total > 0 && down * 4 >= total;
}

type FallbackReason = 'leaderOutOfAction' | 'leaderStunned' | 'leaderNotPlaying' | 'noLeader';

export type RoutLeadership =
  | { ld: number; source: 'leader'; name: string }
  | { ld: number; source: 'fallback'; name: string; reason: FallbackReason }
  | { ld: null; source: 'none' };

/** Use the leader when available, then the highest eligible Leadership. */
export function routLeadership(
  warband: Warband, outOfAction: OutOfActionTally, stunned: OutOfActionTally,
): RoutLeadership {
  const leader = warband.heroes.find((hero) => hero.isLeader === true);
  let reason: FallbackReason;
  if (!leader) reason = 'noLeader';
  else if (leader.status !== 'active') reason = 'leaderNotPlaying';
  else if (outOfAction.heroIds.includes(leader.id)) reason = 'leaderOutOfAction';
  else if (stunned.heroIds.includes(leader.id)) reason = 'leaderStunned';
  else return { ld: leader.stats.Ld, source: 'leader', name: leader.name };

  const candidates = [
    ...warband.heroes
      .filter((hero) => hero.status === 'active' && !outOfAction.heroIds.includes(hero.id)
        && !stunned.heroIds.includes(hero.id))
      .map((hero) => ({ ld: hero.stats.Ld, name: hero.name })),
    ...warband.hiredSwords
      .filter((sword) => sword.status === 'active' && !outOfAction.hiredSwordIds.includes(sword.id)
        && !stunned.hiredSwordIds.includes(sword.id))
      .map((sword) => ({ ld: sword.stats.Ld, name: sword.name })),
    ...warband.henchmenGroups
      .filter((group) => group.count > (outOfAction.henchmenCounts[group.id] ?? 0)
        + (stunned.henchmenCounts[group.id] ?? 0))
      .map((group) => ({ ld: group.stats.Ld, name: group.groupName })),
  ];
  // Stable sort keeps the candidate order on ties.
  const best = candidates.sort((a, b) => b.ld - a.ld)[0];
  return best ? { ...best, source: 'fallback', reason } : { ld: null, source: 'none' };
}

/** Clear overlapping marks and cap each group's stunned count at its survivors. */
export function reconcileStunned(
  warband: Warband, outOfAction: OutOfActionTally, stunned: OutOfActionTally,
): OutOfActionTally {
  const henchmenCounts: Record<string, number> = {};
  for (const group of warband.henchmenGroups) {
    const remaining = Math.max(0, group.count - (outOfAction.henchmenCounts[group.id] ?? 0));
    const count = Math.min(remaining, stunned.henchmenCounts[group.id] ?? 0);
    if (count > 0) henchmenCounts[group.id] = count;
  }
  return {
    heroIds: stunned.heroIds.filter((id) => !outOfAction.heroIds.includes(id)),
    hiredSwordIds: stunned.hiredSwordIds.filter((id) => !outOfAction.hiredSwordIds.includes(id)),
    henchmenCounts,
  };
}

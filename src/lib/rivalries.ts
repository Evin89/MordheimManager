import { BattleRecord } from '../types';

/**
 * A running head-to-head against one opponent (spec §17.2).
 *
 * Keyed by opponent **name**, not warband id. §17.2 assumed a match "by warband
 * id", but `BattleRecord.opponents` is `string[]` — the names typed or picked in
 * the pre-battle flow, never the opponent's warband id. So a rivalry is grouped
 * by the name as recorded, which is what the data actually holds. (The persisted
 * `nemesisWarbandId` field §17.2 also proposed is not built for the same reason:
 * there is no id to point at until the battle record starts capturing the
 * opponent's warband id, a separate change to the pre-battle flow.)
 */
export type RivalryRecord = {
  opponentName: string;
  wins: number;
  losses: number;
  draws: number;
  battles: number;
  lastBattleDate: string;
};

/**
 * One warband's rivalries, most-fought first.
 *
 * `battles` should be that warband's battles (filtered by `warbandId`). A battle
 * can list several opponents, and each takes the battle's result — a three-way
 * game you won counts as a win against both opponents, which is how anyone at the
 * table would tally it.
 */
export function computeRivalries(battles: BattleRecord[]): RivalryRecord[] {
  const byOpponent = new Map<string, RivalryRecord>();

  for (const b of battles) {
    for (const raw of b.opponents) {
      const name = raw.trim();
      if (!name) continue;
      const rivalry =
        byOpponent.get(name) ??
        { opponentName: name, wins: 0, losses: 0, draws: 0, battles: 0, lastBattleDate: '' };

      rivalry.battles += 1;
      if (b.result === 'win') rivalry.wins += 1;
      else if (b.result === 'loss') rivalry.losses += 1;
      else rivalry.draws += 1;
      if (b.date > rivalry.lastBattleDate) rivalry.lastBattleDate = b.date;

      byOpponent.set(name, rivalry);
    }
  }

  return [...byOpponent.values()].sort(
    (a, z) => z.battles - a.battles || z.lastBattleDate.localeCompare(a.lastBattleDate),
  );
}

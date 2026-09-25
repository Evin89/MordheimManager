import { BattleRecord, BattleResult } from '../types';

/** One game in a head-to-head log — enough to recognise it and read the swing. */
export type RivalryMatch = {
  battleId: string;
  date: string;
  scenario: string;
  result: BattleResult;
  wyrdstoneFound: number;
};

/**
 * A running head-to-head against one opponent (spec §17.2).
 *
 * Keyed by the opponent's **warband id** when the battle recorded one (an
 * opponent picked from a roster in pre-battle — `opponentWarbandIds`), else by
 * the name as recorded (typed opponents, and every battle from before ids were
 * captured). Name-only history is folded into an id-keyed rivalry of the same
 * name, so a rivalry doesn't split in two on the day ids started being saved.
 */
export type RivalryRecord = {
  /** The opponent's warband id, when any battle in the rivalry captured it —
   * what makes it eligible to be marked as a nemesis. */
  opponentWarbandId: string | null;
  /** The most recent name the opponent was recorded under. */
  opponentName: string;
  wins: number;
  losses: number;
  draws: number;
  battles: number;
  lastBattleDate: string;
  /** Wyrdstone this warband found across the rivalry — the "shards swung" total.
   * Only the viewer's own finds are in the log, so this is one side of it. */
  wyrdstoneFound: number;
  /** Every game against this opponent, newest first — the full head-to-head. */
  matches: RivalryMatch[];
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

  // Oldest first, so the name a rivalry ends up with is the latest one used.
  const ordered = [...battles].sort((a, z) => a.date.localeCompare(z.date));

  for (const b of ordered) {
    for (const raw of b.opponents) {
      const name = raw.trim();
      if (!name) continue;
      const id = b.opponentWarbandIds?.[name] ?? null;
      const key = id ? `id:${id}` : `name:${name}`;
      const rivalry =
        byOpponent.get(key) ??
        {
          opponentWarbandId: id,
          opponentName: name,
          wins: 0,
          losses: 0,
          draws: 0,
          battles: 0,
          lastBattleDate: '',
          wyrdstoneFound: 0,
          matches: [],
        };

      rivalry.opponentName = name;
      rivalry.battles += 1;
      if (b.result === 'win') rivalry.wins += 1;
      else if (b.result === 'loss') rivalry.losses += 1;
      else rivalry.draws += 1;
      if (b.date > rivalry.lastBattleDate) rivalry.lastBattleDate = b.date;
      rivalry.wyrdstoneFound += b.wyrdstoneFound;
      rivalry.matches.push({
        battleId: b.id,
        date: b.date,
        scenario: b.scenario,
        result: b.result,
        wyrdstoneFound: b.wyrdstoneFound,
      });

      byOpponent.set(key, rivalry);
    }
  }

  // Fold name-only history into an id-keyed rivalry recorded under that name.
  for (const [key, named] of byOpponent) {
    if (!key.startsWith('name:')) continue;
    const target = [...byOpponent.values()].find(
      (r) => r.opponentWarbandId !== null && r.opponentName === named.opponentName,
    );
    if (!target) continue;
    target.wins += named.wins;
    target.losses += named.losses;
    target.draws += named.draws;
    target.battles += named.battles;
    target.wyrdstoneFound += named.wyrdstoneFound;
    target.matches.push(...named.matches);
    if (named.lastBattleDate > target.lastBattleDate) target.lastBattleDate = named.lastBattleDate;
    byOpponent.delete(key);
  }

  for (const rivalry of byOpponent.values()) {
    rivalry.matches.sort((a, z) => z.date.localeCompare(a.date));
  }

  return [...byOpponent.values()].sort(
    (a, z) => z.battles - a.battles || z.lastBattleDate.localeCompare(a.lastBattleDate),
  );
}

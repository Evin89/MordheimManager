import { BattleRecord, StandingsRow } from '../types';

/**
 * Campaign awards (spec §17.4) — aggregates over data that already exists, with
 * no table and no write. An award is a *snapshot* of the standings as they are
 * now, not an achievement locked in: nothing here persists, and it recomputes on
 * every Standings load from the `battles` array already fetched.
 */
export type CampaignAward = {
  id: string;
  title: string;
  holderWarbandId: string;
  holderWarbandName: string;
  /** Pre-formatted, since each award's unit differs ("14 shards", "3 in a row"). */
  value: string;
};

/** A warband id -> display name lookup, built from the standings the screen
 * already has, so an award can name its holder without a second fetch. */
function nameLookup(standings: StandingsRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of standings) {
    if (row.warbandId && row.warbandName) map.set(row.warbandId, row.warbandName);
  }
  return map;
}

/** The warband with the largest total of some per-battle number, or null when no
 * battle contributed a positive value (so "Most wyrdstone" doesn't crown someone
 * with zero). */
function topBySum(
  battles: BattleRecord[],
  value: (b: BattleRecord) => number,
): { warbandId: string; total: number } | null {
  const totals = new Map<string, number>();
  for (const b of battles) {
    totals.set(b.warbandId, (totals.get(b.warbandId) ?? 0) + value(b));
  }
  let best: { warbandId: string; total: number } | null = null;
  for (const [warbandId, total] of totals) {
    if (total > 0 && (!best || total > best.total)) best = { warbandId, total };
  }
  return best;
}

/** Longest run of consecutive wins for any warband, in date order. */
function longestWinStreak(battles: BattleRecord[]): { warbandId: string; streak: number } | null {
  const byWarband = new Map<string, BattleRecord[]>();
  for (const b of battles) {
    byWarband.set(b.warbandId, [...(byWarband.get(b.warbandId) ?? []), b]);
  }

  let best: { warbandId: string; streak: number } | null = null;
  for (const [warbandId, list] of byWarband) {
    const ordered = [...list].sort((a, z) => a.date.localeCompare(z.date));
    let run = 0;
    let peak = 0;
    for (const b of ordered) {
      run = b.result === 'win' ? run + 1 : 0;
      if (run > peak) peak = run;
    }
    if (peak > 1 && (!best || peak > best.streak)) best = { warbandId, streak: peak };
  }
  return best;
}

/**
 * Every award that currently has a holder, in a stable order.
 *
 * "Bloodiest" (most models lost) is deliberately absent: it needs a structured
 * casualty count, and `casualtiesSummary` is free text today (§3.1). Counting
 * models out of a prose sentence would be a guess dressed as a statistic, so the
 * award waits for the data rather than inventing it — the spec's own open
 * question, resolved by leaving it out.
 */
export function computeAwards(
  battles: BattleRecord[],
  standings: StandingsRow[],
  strings: {
    mostWyrdstone: string;
    mostWyrdstoneValue: (n: number) => string;
    longestStreak: string;
    longestStreakValue: (n: number) => string;
    mostBattles: string;
    mostBattlesValue: (n: number) => string;
    highestRating: string;
    highestRatingValue: (n: number) => string;
  },
): CampaignAward[] {
  const names = nameLookup(standings);
  const named = (id: string) => names.get(id) ?? '';
  const awards: CampaignAward[] = [];

  const wyrdstone = topBySum(battles, (b) => b.wyrdstoneFound);
  if (wyrdstone && named(wyrdstone.warbandId)) {
    awards.push({
      id: 'most-wyrdstone',
      title: strings.mostWyrdstone,
      holderWarbandId: wyrdstone.warbandId,
      holderWarbandName: named(wyrdstone.warbandId),
      value: strings.mostWyrdstoneValue(wyrdstone.total),
    });
  }

  const streak = longestWinStreak(battles);
  if (streak && named(streak.warbandId)) {
    awards.push({
      id: 'longest-streak',
      title: strings.longestStreak,
      holderWarbandId: streak.warbandId,
      holderWarbandName: named(streak.warbandId),
      value: strings.longestStreakValue(streak.streak),
    });
  }

  const fought = topBySum(battles, () => 1);
  if (fought && named(fought.warbandId)) {
    awards.push({
      id: 'most-battles',
      title: strings.mostBattles,
      holderWarbandId: fought.warbandId,
      holderWarbandName: named(fought.warbandId),
      value: strings.mostBattlesValue(fought.total),
    });
  }

  // Highest rating reads the denormalised column the standings already carry
  // (§3.2) — no computation, just the top of the table, and only when a rating
  // is actually recorded.
  const rated = [...standings]
    .filter((r) => r.warbandId && r.warbandName && r.rating !== null)
    .sort((a, z) => (z.rating ?? 0) - (a.rating ?? 0))[0];
  if (rated && rated.rating !== null) {
    awards.push({
      id: 'highest-rating',
      title: strings.highestRating,
      holderWarbandId: rated.warbandId!,
      holderWarbandName: rated.warbandName!,
      value: strings.highestRatingValue(rated.rating),
    });
  }

  return awards;
}

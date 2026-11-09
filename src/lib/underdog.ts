/**
 * The underdog bonus (spec §43.6).
 *
 * The bands come from the rulebook's Experience chapter (Mordheim Rulebook,
 * Complete Edition, p.104 — the same source as the `underdog-bonus` entry in
 * `data/rules.json`). This file is the one place the numbers live: the event
 * sheet, the post-battle hint text and the pairing screen all read them from
 * here, so they can't drift apart.
 *
 * Dependency-free, so `scripts/test-pairing.mjs` can bundle it on its own.
 */

/** Gap upper bound (inclusive) → bonus XP per surviving model. */
export const UNDERDOG_BANDS: readonly { from: number; to: number; bonus: number }[] = [
  { from: 0, to: 50, bonus: 0 },
  { from: 51, to: 75, bonus: 1 },
  { from: 76, to: 100, bonus: 2 },
  { from: 101, to: 150, bonus: 3 },
  { from: 151, to: 300, bonus: 4 },
  { from: 301, to: Number.POSITIVE_INFINITY, bonus: 5 },
];

/** The bonus for a rating gap. */
export function underdogBonusForGap(gap: number): number {
  const g = Math.abs(gap);
  for (const band of UNDERDOG_BANDS) if (g <= band.to) return band.bonus;
  return 5;
}

export type UnderdogResult = {
  /** Index of the warband that gets the bonus, or null when there's none. */
  underdog: number | null;
  bonus: number;
  gap: number;
  /** The two ratings compared: [lower, the one it's compared with]. */
  compared: [number, number] | null;
};

/**
 * Two warbands: the lower-rated one gets the bonus for the gap.
 * Several warbands (mordheimer.net, *Multiplayer Games* — "Chaos on the
 * Streets"): compare the lowest rating with the next-lowest; only the lowest
 * can be the underdog. Ratings that aren't known (NaN) make the result unknown.
 */
export function underdogFor(ratings: number[]): UnderdogResult {
  if (ratings.length < 2 || ratings.some((r) => !Number.isFinite(r))) {
    return { underdog: null, bonus: 0, gap: 0, compared: null };
  }
  const order = ratings.map((r, i) => ({ r, i })).sort((a, b) => a.r - b.r);
  const lowest = order[0];
  const next = order[1];
  const gap = next.r - lowest.r;
  const bonus = underdogBonusForGap(gap);
  return { underdog: bonus > 0 ? lowest.i : null, bonus, gap, compared: [lowest.r, next.r] };
}

/** "0–50: 0 · 51–75: +1 · …" — the table as one line, for footers and hints. */
export function underdogTableText(): string {
  return UNDERDOG_BANDS.map((b) => {
    const range = Number.isFinite(b.to) ? `${b.from}–${b.to}` : `${b.from}+`;
    return `${range}: ${b.bonus === 0 ? '0' : `+${b.bonus}`}`;
  }).join(' · ');
}

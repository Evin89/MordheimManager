/**
 * Pairing for the event sheet (spec §43.5.8), and the pre-battle "fair pairing"
 * sort.
 *
 * A pure function: the same input and seed always give the same tables, so a
 * reprint, or the same round paired on a second phone, matches. Dependency-free
 * on purpose, so `scripts/test-pairing.mjs` can bundle and exercise it alone.
 *
 * Rules (§43.5.3):
 *  - one player's two warbands never meet (never relaxed);
 *  - no rematches within the event, and optionally no mirror matches — relaxed
 *    in that order (mirror first, then rematch) when they can't all be met, and
 *    the table says so in `warnings`;
 *  - backtracking rather than greedy pairing, so the last two warbands aren't a
 *    forced rematch when an earlier swap would have avoided it.
 */

export type PairingMethod = 'rating' | 'swiss' | 'random';
export type PairingWarning = 'rematch' | 'mirror' | 'pairedDown';

export type PairingWarband = {
  id: string;
  ownerId: string;
  type: string;
  /** Current rating, from the warband row. */
  rating: number;
  /** Swiss record so far: win 1, draw ½, loss 0, bye 1. */
  points: number;
  /** Warband ids met earlier in this event. */
  opponents: string[];
  /** Times this warband was paired down a score group (Swiss). */
  pairedDown: number;
  byes: number;
};

export type PairingInput = {
  warbands: PairingWarband[];
  method: PairingMethod;
  /** 2 = head-to-head tables; 'multi' = tables of 3–4 (a multiplayer round). */
  tableSize: 2 | 'multi';
  odd: 'threeWay' | 'bye';
  avoidRematch: boolean;
  avoidMirror: boolean;
  seed: number;
};

export type PairingTable = { warbandIds: string[]; warnings: PairingWarning[] };
export type PairingResult = { tables: PairingTable[]; bye?: string };

/* ---------------------------------------------------------------- random */

/** mulberry32 — small, fast, good enough for shuffling a few dozen warbands. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ---------------------------------------------------------------- order */

/**
 * The order warbands are taken in. Rating: highest first. Swiss: most points
 * first, then rating. Random: shuffled. Ties are broken by the seeded shuffle,
 * never by input order, so the caller's list order can't bias the result.
 */
function orderFor(warbands: PairingWarband[], method: PairingMethod, rand: () => number): PairingWarband[] {
  // Shuffle from a canonical order (by id), so the caller's list order can't
  // change the result — two phones listing warbands differently still agree.
  const canonical = [...warbands].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const shuffled = shuffle(canonical, rand);
  if (method === 'random') return shuffled;
  const rank = new Map(shuffled.map((w, i) => [w.id, i]));
  return canonical.sort((a, b) => {
    if (method === 'swiss' && b.points !== a.points) return b.points - a.points;
    if (b.rating !== a.rating) return b.rating - a.rating;
    return rank.get(a.id)! - rank.get(b.id)!;
  });
}

/* ---------------------------------------------------------------- pairs */

type Level = 0 | 1 | 2; // 0: all rules · 1: mirrors allowed · 2: rematches allowed too

function blocked(a: PairingWarband, b: PairingWarband, input: PairingInput, level: Level): boolean {
  if (a.ownerId === b.ownerId) return true;
  if (input.avoidRematch && level < 2 && (a.opponents.includes(b.id) || b.opponents.includes(a.id))) return true;
  if (input.avoidMirror && level < 1 && a.type === b.type) return true;
  return false;
}

function cost(a: PairingWarband, b: PairingWarband, method: PairingMethod, pos: Map<string, number>): number {
  if (method === 'random') return Math.abs(pos.get(a.id)! - pos.get(b.id)!);
  const ratingGap = Math.abs(a.rating - b.rating);
  if (method === 'rating') return ratingGap;
  // Swiss: stay in the score group; a pair-down is expensive, a second one for
  // the same warband more so.
  const pointsGap = Math.abs(a.points - b.points);
  const downTwice = pointsGap > 0 && (a.pairedDown > 0 || b.pairedDown > 0) ? 1 : 0;
  return pointsGap * 100_000 + downTwice * 1_000_000 + ratingGap;
}

const STEP_LIMIT = 200_000;

/** Backtracking pairing of an even-sized ordered list; null when impossible. */
function pairAll(order: PairingWarband[], input: PairingInput, level: Level): [PairingWarband, PairingWarband][] | null {
  const pos = new Map(order.map((w, i) => [w.id, i]));
  const used = new Set<string>();
  const pairs: [PairingWarband, PairingWarband][] = [];
  let steps = 0;

  const solve = (): boolean => {
    if (++steps > STEP_LIMIT) return false;
    const first = order.find((w) => !used.has(w.id));
    if (!first) return true;
    used.add(first.id);
    const candidates = order
      .filter((w) => !used.has(w.id) && !blocked(first, w, input, level))
      .sort((x, y) => cost(first, x, input.method, pos) - cost(first, y, input.method, pos) || pos.get(x.id)! - pos.get(y.id)!);
    for (const c of candidates) {
      used.add(c.id);
      pairs.push([first, c]);
      if (solve()) return true;
      pairs.pop();
      used.delete(c.id);
    }
    used.delete(first.id);
    return false;
  };

  return solve() ? pairs : null;
}

function warningsFor(members: PairingWarband[], input: PairingInput): PairingWarning[] {
  const out = new Set<PairingWarning>();
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i];
      const b = members[j];
      if (a.opponents.includes(b.id) || b.opponents.includes(a.id)) out.add('rematch');
      if (input.avoidMirror && a.type === b.type) out.add('mirror');
      if (input.method === 'swiss' && a.points !== b.points) out.add('pairedDown');
    }
  }
  return [...out];
}

/** Try the levels in order; never fails while a same-owner-free pairing exists. */
function pairWithRelaxing(order: PairingWarband[], input: PairingInput): [PairingWarband, PairingWarband][] | null {
  for (const level of [0, 1, 2] as Level[]) {
    const pairs = pairAll(order, input, level);
    if (pairs) return pairs;
  }
  return null;
}

/* ---------------------------------------------------------------- multi */

/** Table sizes for a multiplayer round: as many 4s as fit, 3s to even it out (10 → 4+3+3). */
export function multiplayerTableSizes(n: number): number[] {
  if (n <= 0) return [];
  if (n <= 4) return [n];
  const tables = Math.ceil(n / 4);
  const base = Math.floor(n / tables);
  const extra = n % tables;
  return Array.from({ length: tables }, (_, i) => base + (i < extra ? 1 : 0));
}

function pairMulti(order: PairingWarband[], input: PairingInput): PairingTable[] {
  const sizes = multiplayerTableSizes(order.length);
  const tables: PairingWarband[][] = [];
  let at = 0;
  for (const size of sizes) {
    tables.push(order.slice(at, at + size));
    at += size;
  }
  // One player's two warbands never share a table: swap the later one with the
  // nearest warband at another table that doesn't create the same problem.
  const ownerClash = (t: PairingWarband[], w: PairingWarband) => t.some((x) => x !== w && x.ownerId === w.ownerId);
  for (let ti = 0; ti < tables.length; ti++) {
    for (let wi = 0; wi < tables[ti].length; wi++) {
      const w = tables[ti][wi];
      if (!ownerClash(tables[ti], w)) continue;
      let swapped = false;
      for (let d = 1; d < tables.length && !swapped; d++) {
        for (const tj of [ti + d, ti - d]) {
          if (tj < 0 || tj >= tables.length || swapped) continue;
          for (let wj = 0; wj < tables[tj].length; wj++) {
            const other = tables[tj][wj];
            const a = [...tables[ti]];
            const b = [...tables[tj]];
            a[wi] = other;
            b[wj] = w;
            if (!ownerClash(a, other) && !ownerClash(b, w)) {
              tables[ti] = a;
              tables[tj] = b;
              swapped = true;
              break;
            }
          }
        }
      }
    }
  }
  return tables.map((t) => ({ warbandIds: t.map((w) => w.id), warnings: warningsFor(t, input) }));
}

/* ---------------------------------------------------------------- main */

export function pairRound(input: PairingInput): PairingResult {
  const rand = seededRandom(input.seed);
  const order = orderFor(input.warbands, input.method, rand);

  if (order.length === 0) return { tables: [] };
  if (input.tableSize === 'multi') return { tables: pairMulti(order, input) };
  if (order.length === 1) return { tables: [], bye: order[0].id };

  const odd = order.length % 2 === 1;

  if (odd && input.odd === 'bye') {
    // A different warband each round: the fewest byes so far, then the bottom
    // of the order (lowest score, lowest rating) — the one with least to lose.
    const fewest = Math.min(...order.map((w) => w.byes));
    const eligible = order.filter((w) => w.byes === fewest);
    for (const bye of [...eligible].reverse()) {
      const rest = order.filter((w) => w.id !== bye.id);
      const pairs = pairWithRelaxing(rest, input);
      if (pairs) return { tables: pairs.map((p) => ({ warbandIds: p.map((w) => w.id), warnings: warningsFor(p, input) })), bye: bye.id };
    }
    return { tables: [], bye: undefined };
  }

  if (odd) {
    // Three-way table: leave one out (from the bottom up), pair the rest, then
    // seat it at the table that suits it best.
    for (const extra of [...order].reverse()) {
      const rest = order.filter((w) => w.id !== extra.id);
      const pairs = pairWithRelaxing(rest, input);
      if (!pairs) continue;
      const fits = pairs
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.every((w) => w.ownerId !== extra.ownerId));
      if (fits.length === 0) continue;
      const avg = (p: PairingWarband[]) => p.reduce((s, w) => s + w.rating, 0) / p.length;
      const pts = (p: PairingWarband[]) => p.reduce((s, w) => s + w.points, 0) / p.length;
      fits.sort((x, y) => {
        if (input.method === 'swiss') {
          const dp = Math.abs(pts(x.p) - extra.points) - Math.abs(pts(y.p) - extra.points);
          if (dp !== 0) return dp;
        }
        return Math.abs(avg(x.p) - extra.rating) - Math.abs(avg(y.p) - extra.rating) || x.i - y.i;
      });
      const target = fits[0].i;
      const tables = pairs.map((p, i) => {
        const members = i === target ? [...p, extra] : p;
        return { warbandIds: members.map((w) => w.id), warnings: warningsFor(members, input) };
      });
      return { tables };
    }
    return { tables: [] };
  }

  const pairs = pairWithRelaxing(order, input);
  if (!pairs) return { tables: [] };
  return { tables: pairs.map((p) => ({ warbandIds: p.map((w) => w.id), warnings: warningsFor(p, input) })) };
}

/**
 * The pre-battle screen's "fair pairing" list: every candidate, closest rating
 * first. The same notion of fair as `method: 'rating'`, for one warband.
 */
export function byClosestRating<T extends { rating: number }>(myRating: number, candidates: T[]): T[] {
  return [...candidates].sort((a, b) => Math.abs(a.rating - myRating) - Math.abs(b.rating - myRating));
}

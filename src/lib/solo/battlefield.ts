// A generated battlefield (a suggested board, not a prescribed one), deterministic
// from a seed. Works in inches, so the board can be any table size (2'/3'/4' by
// any of those). Places the player's owned terrain at real footprint, joins river
// pieces into one continuous river, and shades per-scenario deployment zones.
//
// App-original terrain suggestion — move the pieces to fit the table you own.
// Fords, bends and bridges are a later refinement (see the solo notes).

import scenariosData from '../../data/scenarios.json';

export type TerrainCategory = 'building' | 'forest' | 'water' | 'hill' | 'barricade' | 'other';

/** A placed piece. `index` is its legend number (0 = anonymous fallback block). */
export type PlacedTerrain = {
  x: number;
  y: number;
  w: number;
  h: number;
  category: TerrainCategory;
  label: string;
  index: number;
};

/** One continuous river through a set of points. It's only as long as the river
 * pieces the player owns: it spans the board when they have enough, otherwise it
 * runs from one edge or floats in the middle. `startAtEdge`/`endAtEdge` say which
 * ends meet the board edge (drawn flat, aligned to it) versus stop short (drawn
 * with a rounded end). */
export type RiverFeature = {
  points: { x: number; y: number }[];
  width: number;
  label: string;
  index: number;
  startAtEdge: boolean;
  endAtEdge: boolean;
};

export type Marker = { x: number; y: number; label: string; kind: 'objective' | 'wyrdstone' };
export type ZoneRole = 'a' | 'b' | 'defender' | 'attacker';
export type Zone = { label: string; x: number; y: number; w: number; h: number; role: ZoneRole };

export type Battlefield = {
  /** Board dimensions in inches. */
  width: number;
  depth: number;
  pieces: PlacedTerrain[];
  rivers: RiverFeature[];
  markers: Marker[];
  zones: Zone[];
  seed: number;
};

/** Structural subset of the collection's TerrainPiece (keeps this lib decoupled). */
export type BattlefieldTerrain = {
  category: TerrainCategory;
  name: string;
  width: number | null;
  depth: number | null;
  quantity: number;
};

export type GenerateOptions = {
  /** Board size in inches. Defaults to a 4'×4' table. */
  widthIn?: number;
  depthIn?: number;
  terrain?: BattlefieldTerrain[];
};

/** Terrain density: about one piece per square foot of table — the common
 * wargaming guideline — so a small board isn't over-crowded and a big one isn't
 * bare. A placed river counts as one of those pieces. */
const pieceBudgetFor = (W: number, D: number) => Math.max(1, Math.round((W / 12) * (D / 12)));

/** mulberry32 — a tiny seeded PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect, pad = 1.5) =>
  a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;

// Which markers a scenario needs is read from the scenario data itself, so the
// board shows the right counters "if needed" without a second hand-kept list:
//  - wyrdstone counters when the scenario deals in wyrdstone (Wyrdstone Hunt),
//  - an objective/treasure marker when it turns on a find or a chest (Defend the
//    Find, Hidden Treasure).
const scenarioText = new Map<string, string>(
  scenariosData.scenarios.map((s) => [
    s.id,
    `${s.name} ${s.awards.map((a) => `${a.id} ${a.label}`).join(' ')}`.toLowerCase(),
  ]),
);
const needsWyrdstone = (id: string): boolean => (scenarioText.get(id) ?? '').includes('wyrdstone');
const needsObjective = (id: string): boolean => {
  const t = scenarioText.get(id) ?? '';
  return t.includes('find') || t.includes('chest') || t.includes('treasure');
};

/**
 * Per-scenario deployment zones, in inches, from the Mordheim scenario rules:
 *  - most scenarios: both warbands within 8" of opposite table edges
 *  - Street Fight: opposite short ends, within 6"
 *  - Defend the Find: defender within 6" of centre; attacker within 8" of any edge
 *  - Breakthrough: defender central (>8" from any edge); attacker within 8" of one edge
 *  - Surprise Attack: defender in the centre; attacker enters from every edge
 * Suggested placements — move to fit the table.
 */
function deploymentZones(scenarioId: string, W: number, D: number): Zone[] {
  const edgeFrame = (): Zone[] => [
    { label: 'Attacker', x: 0, y: 0, w: W, h: 8, role: 'attacker' },
    { label: '', x: 0, y: D - 8, w: W, h: 8, role: 'attacker' },
    { label: '', x: 0, y: 8, w: 8, h: D - 16, role: 'attacker' },
    { label: '', x: W - 8, y: 8, w: 8, h: D - 16, role: 'attacker' },
  ];

  switch (scenarioId) {
    case 'streetFight':
      return [
        { label: 'Deployment A', x: 0, y: 0, w: 6, h: D, role: 'a' },
        { label: 'Deployment B', x: W - 6, y: 0, w: 6, h: D, role: 'b' },
      ];
    case 'defendTheFind': {
      const s = 12; // within 6" of centre
      return [{ label: 'Defender', x: W / 2 - s / 2, y: D / 2 - s / 2, w: s, h: s, role: 'defender' }, ...edgeFrame()];
    }
    case 'surpriseAttack': {
      const s = 16;
      return [{ label: 'Defender', x: W / 2 - s / 2, y: D / 2 - s / 2, w: s, h: s, role: 'defender' }, ...edgeFrame()];
    }
    case 'breakthrough':
      return [
        { label: 'Defender', x: 8, y: 8, w: Math.max(2, W - 16), h: Math.max(2, D - 16), role: 'defender' },
        { label: 'Attacker', x: 0, y: D - 8, w: W, h: 8, role: 'attacker' },
      ];
    default: // Skirmish, Wyrdstone Hunt, Chance Encounter, Hidden Treasure, Occupy
      return [
        { label: 'Deployment A', x: 0, y: 0, w: W, h: 8, role: 'a' },
        { label: 'Deployment B', x: 0, y: D - 8, w: W, h: 8, role: 'b' },
      ];
  }
}

function place(rand: () => number, existing: Rect[], w: number, h: number, W: number, D: number, m: number): Rect | null {
  for (let attempt = 0; attempt < 60; attempt++) {
    const x = m + rand() * Math.max(0.1, W - 2 * m - w);
    const y = m + rand() * Math.max(0.1, D - 2 * m - h);
    const rect = { x, y, w, h };
    if (existing.some((b) => overlaps(rect, b))) continue;
    return rect;
  }
  return null;
}

/** Split owned water into rivers (which join into one) and ponds (kept apart).
 * A water piece counts as a river if it's *named* one — intent wins — or, as a
 * fallback, if it's long and thin. All rivers merge into a single feature. */
function isRiver(t: BattlefieldTerrain): boolean {
  if (t.category !== 'water') return false;
  // Named a river (River, Rivers, River bend…) → intent wins.
  if (/river/i.test(t.name)) return true;
  // Otherwise treat clearly long, thin water as a river.
  const long = Math.max(t.width ?? 0, t.depth ?? 0);
  const short = Math.min(t.width ?? 0, t.depth ?? 0) || 1;
  return long / short >= 2 && long >= 10;
}

export function generateBattlefield(seed: number, scenarioId: string, opts: GenerateOptions = {}): Battlefield {
  const W = opts.widthIn ?? 48;
  const D = opts.depthIn ?? 48;
  const terrain = opts.terrain ?? [];
  const rand = rng(seed);
  const margin = Math.min(W, D) * 0.06;

  const rects: Rect[] = [];
  const pieces: PlacedTerrain[] = [];
  const rivers: RiverFeature[] = [];
  let index = 1;

  // ── One continuous river, if the player owns any river-shaped water ──
  const riverPieces = terrain.filter(isRiver);
  if (riverPieces.length > 0) {
    const widths = riverPieces.map((r) => Math.min(r.width ?? 4, r.depth ?? 4)).sort((a, b) => a - b);
    const width = Math.max(3, Math.min(8, widths[Math.floor(widths.length / 2)] || 4));
    // A left→right meander (or top→bottom on a portrait board). It's only as long
    // as the pieces owned: total = each piece's long side × how many you have.
    const horizontal = W >= D;
    const span = horizontal ? W : D; // board length along the river's axis
    const cross = horizontal ? D : W;
    const owned = riverPieces.reduce((sum, r) => {
      const long = Math.max(r.width ?? 0, r.depth ?? 0);
      const q = Math.max(1, Math.min(r.quantity, 6));
      return sum + long * q;
    }, 0);
    const len = owned > 0 ? Math.min(span, owned) : span;
    const full = len >= span - 0.01;

    // Where the (shorter-than-board) river sits: from the near edge, the far
    // edge, or floating in the middle.
    let start = 0;
    if (!full) {
      const roll = rand();
      if (roll < 0.34) start = 0;
      else if (roll < 0.68) start = span - len;
      else start = (span - len) * (0.2 + rand() * 0.6);
    }
    const end = start + len;
    const startAtEdge = start <= 0.01;
    const endAtEdge = end >= span - 0.01;

    const pts: { x: number; y: number }[] = [];
    const steps = 4;
    const clamp = (v: number) => Math.max(width, Math.min(cross - width, v));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const along = start + t * len;
      const jitter = (rand() - 0.5) * cross * 0.4;
      const c = clamp(cross / 2 + jitter);
      if (horizontal) pts.push({ x: along, y: c });
      else pts.push({ x: c, y: along });
    }
    // Push an edge-touching end just past the board, so the map clips it into a
    // straight cut flush with the boundary (a butt cap alone leaves an angled
    // overshoot). Ends that stop short keep their exact point for a rounded tip.
    const overshoot = width;
    if (horizontal) {
      if (startAtEdge) pts[0].x = -overshoot;
      if (endAtEdge) pts[pts.length - 1].x = span + overshoot;
    } else {
      if (startAtEdge) pts[0].y = -overshoot;
      if (endAtEdge) pts[pts.length - 1].y = span + overshoot;
    }
    rivers.push({ points: pts, width, label: 'River', index: index++, startAtEdge, endAtEdge });
    // Block building placement near the river.
    for (const p of pts) rects.push({ x: p.x - width, y: p.y - width, w: width * 2, h: width * 2 });
  }

  // ── Owned pieces (ponds + everything non-river), or anonymous fallback ──
  // Both honour the density budget; the river (if any) has already used a slot.
  const remainingBudget = Math.max(0, pieceBudgetFor(W, D) - rivers.length);
  if (terrain.length > 0) {
    const placeable = terrain.filter((t) => !isRiver(t));
    const expanded: BattlefieldTerrain[] = [];
    for (const t of placeable) {
      const q = Math.max(1, Math.min(t.quantity, 6));
      for (let i = 0; i < q; i++) expanded.push(t);
    }
    expanded.sort(() => rand() - 0.5);
    for (const t of expanded.slice(0, remainingBudget)) {
      const w = Math.max(2, t.width ?? 6);
      const h = Math.max(2, t.depth ?? t.width ?? 6);
      const rect = place(rand, rects, w, h, W, D, margin);
      if (!rect) continue;
      rects.push(rect);
      pieces.push({ ...rect, category: t.category, label: t.name, index: index++ });
    }
  } else {
    const target = remainingBudget;
    for (let i = 0; i < target; i++) {
      const w = 4 + rand() * 7;
      const h = 4 + rand() * 7;
      const rect = place(rand, rects, w, h, W, D, margin);
      if (!rect) continue;
      rects.push(rect);
      pieces.push({ ...rect, category: 'building', label: '', index: 0 });
    }
  }

  // ── Objective / wyrdstone markers ──
  const markers: Marker[] = [];
  if (needsObjective(scenarioId)) markers.push({ x: W / 2, y: D / 2, label: 'Objective', kind: 'objective' });
  if (needsWyrdstone(scenarioId)) {
    const shards = 3 + Math.floor(rand() * 2);
    for (let i = 0; i < shards; i++) {
      markers.push({ x: margin + rand() * (W - 2 * margin), y: margin + rand() * (D - 2 * margin), label: 'Wyrdstone', kind: 'wyrdstone' });
    }
  }

  const zones = deploymentZones(scenarioId, W, D);

  return { width: W, depth: D, pieces, rivers, markers, zones, seed };
}

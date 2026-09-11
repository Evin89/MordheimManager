// A generated battlefield for a solo game (a suggested board, not a prescribed
// one). Deterministic from a seed so it survives a reload and can be re-rolled.
//
// When the player has a terrain library (§solo collection), the board is laid
// out from the pieces they actually own — each scaled to its real footprint,
// drawn by category, and numbered so it maps back to a legend. Without a library
// it falls back to anonymous ruined blocks, as before. App-original terrain
// suggestion — move the pieces to fit the table you own.

export type TerrainCategory = 'building' | 'forest' | 'water' | 'hill' | 'other';

/** A placed piece on the board. `index` is its legend number (0 = an anonymous
 * fallback block, with no library entry to point at). */
export type PlacedTerrain = {
  x: number;
  y: number;
  w: number;
  h: number;
  category: TerrainCategory;
  label: string;
  index: number;
};

export type Marker = { x: number; y: number; label: string; kind: 'objective' | 'wyrdstone' };
export type Zone = { label: string; x: number; y: number; w: number; h: number };

export type Battlefield = {
  size: number; // board is size×size units (a nominal 4'×4')
  pieces: PlacedTerrain[];
  markers: Marker[];
  zones: Zone[];
  seed: number;
};

/** What generateBattlefield needs from a terrain piece — a structural subset of
 * the collection's TerrainPiece, so this lib stays decoupled from the API layer. */
export type BattlefieldTerrain = {
  category: TerrainCategory;
  name: string;
  width: number | null;
  depth: number | null;
  quantity: number;
};

const BOARD = 100; // units
const BOARD_INCHES = 48; // a nominal 4'×4' table
const MARGIN = 6;
const MAX_PIECES = 14; // keep the board readable however big the library is

/** mulberry32 — a tiny seeded PRNG, so a given seed always draws the same board. */
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
const overlaps = (a: Rect, b: Rect, pad = 3) =>
  a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;

const centralScenarios = new Set(['defendTheFind']);
const wyrdstoneScenarios = new Set(['wyrdstoneHunt']);

/** Try to drop a w×h rect on the board without piling onto an existing one or the
 * kept-clear centre; returns the placement or null after a bounded search. */
function place(
  rand: () => number,
  existing: Rect[],
  w: number,
  h: number,
  keepCentreClear: boolean,
): Rect | null {
  for (let attempt = 0; attempt < 60; attempt++) {
    const x = MARGIN + Math.floor(rand() * Math.max(1, BOARD - 2 * MARGIN - w));
    const y = MARGIN + Math.floor(rand() * Math.max(1, BOARD - 2 * MARGIN - h));
    const rect = { x, y, w, h };
    if (keepCentreClear && overlaps(rect, { x: 40, y: 40, w: 20, h: 20 }, 0)) continue;
    if (existing.some((b) => overlaps(rect, b))) continue;
    return rect;
  }
  return null;
}

function markersAndZones(rand: () => number, scenarioId: string) {
  const markers: Marker[] = [];
  if (centralScenarios.has(scenarioId)) {
    markers.push({ x: 50, y: 50, label: 'Objective', kind: 'objective' });
  }
  if (wyrdstoneScenarios.has(scenarioId)) {
    const shards = 3 + Math.floor(rand() * 2); // 3–4
    for (let i = 0; i < shards; i++) {
      markers.push({
        x: MARGIN + Math.floor(rand() * (BOARD - 2 * MARGIN)),
        y: MARGIN + Math.floor(rand() * (BOARD - 2 * MARGIN)),
        label: 'Wyrdstone',
        kind: 'wyrdstone',
      });
    }
  }
  const zones: Zone[] =
    scenarioId === 'defendTheFind'
      ? [
          { label: 'Defender (within 6" of the objective)', x: 35, y: 35, w: 30, h: 30 },
          { label: 'Attacker (any table edge)', x: 0, y: 0, w: BOARD, h: 8 },
        ]
      : [
          { label: 'Deployment A', x: 0, y: 0, w: BOARD, h: 10 },
          { label: 'Deployment B', x: 0, y: BOARD - 10, w: BOARD, h: 10 },
        ];
  return { markers, zones };
}

/**
 * Build a board. With `terrain` (the owned library), it places those pieces at
 * their real footprint, numbered for a legend; otherwise it scatters anonymous
 * ruined blocks. Same seed → same board either way.
 */
export function generateBattlefield(
  seed: number,
  scenarioId: string,
  terrain?: BattlefieldTerrain[],
): Battlefield {
  const rand = rng(seed);
  const keepCentre = centralScenarios.has(scenarioId);
  const placed: PlacedTerrain[] = [];
  const rects: Rect[] = [];

  if (terrain && terrain.length > 0) {
    // Inches → board units, then place each owned piece (capped for readability).
    const scale = BOARD / BOARD_INCHES;
    const expanded: BattlefieldTerrain[] = [];
    for (const t of terrain) {
      const q = Math.max(1, Math.min(t.quantity, 6));
      for (let i = 0; i < q; i++) expanded.push(t);
    }
    // Deterministic shuffle so the seed governs which pieces land where.
    expanded.sort(() => rand() - 0.5);

    let index = 1;
    for (const t of expanded.slice(0, MAX_PIECES)) {
      const w = Math.max(5, Math.round((t.width ?? 6) * scale));
      const h = Math.max(5, Math.round((t.depth ?? t.width ?? 6) * scale));
      const rect = place(rand, rects, w, h, keepCentre);
      if (!rect) continue;
      rects.push(rect);
      placed.push({ ...rect, category: t.category, label: t.name, index: index++ });
    }
  } else {
    // Fallback: anonymous ruined blocks, unnumbered.
    const target = 8 + Math.floor(rand() * 4); // 8–11
    for (let i = 0; i < target; i++) {
      const w = 10 + Math.floor(rand() * 16);
      const h = 10 + Math.floor(rand() * 16);
      const rect = place(rand, rects, w, h, keepCentre);
      if (!rect) continue;
      rects.push(rect);
      placed.push({ ...rect, category: 'building', label: '', index: 0 });
    }
  }

  const { markers, zones } = markersAndZones(rand, scenarioId);
  return { size: BOARD, pieces: placed, markers, zones, seed };
}

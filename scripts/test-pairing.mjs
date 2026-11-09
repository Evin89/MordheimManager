/**
 * Fixtures for the event-sheet pairing and underdog helpers (spec §43.5.8,
 * §43.6). Bundles the two dependency-free modules with esbuild and checks them
 * with node:assert — no test runner needed, same approach as
 * check-nav-coverage.mjs.
 *
 *   node scripts/test-pairing.mjs
 */

import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function load(file) {
  const out = await build({
    entryPoints: [resolve(root, file)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
  });
  const code = out.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

const { pairRound, multiplayerTableSizes, seededRandom } = await load('src/lib/pairing.ts');
const { underdogBonusForGap, underdogFor, underdogTableText } = await load('src/lib/underdog.ts');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

/* ------------------------------------------------------------ fixtures */

const TYPES = ['reiklanders', 'skaven', 'undead', 'witch-hunters', 'marienburgers', 'middenheimers', 'possessed', 'sisters'];

function makeWarbands(n, seed = 1) {
  const rand = seededRandom(seed);
  return Array.from({ length: n }, (_, i) => ({
    id: `w${i}`,
    ownerId: `p${i}`,
    type: TYPES[i % TYPES.length],
    rating: 100 + Math.floor(rand() * 150),
    points: 0,
    opponents: [],
    pairedDown: 0,
    byes: 0,
  }));
}

const base = { tableSize: 2, odd: 'threeWay', avoidRematch: true, avoidMirror: false, seed: 42 };

/** Play a round: record opponents, give points by a seeded coin. */
function play(warbands, result, seed) {
  const rand = seededRandom(seed);
  const byId = new Map(warbands.map((w) => [w.id, { ...w, opponents: [...w.opponents] }]));
  for (const t of result.tables) {
    for (const a of t.warbandIds) for (const b of t.warbandIds) if (a !== b) byId.get(a).opponents.push(b);
    const winner = t.warbandIds[Math.floor(rand() * t.warbandIds.length)];
    const draw = rand() < 0.15;
    for (const id of t.warbandIds) byId.get(id).points += draw ? 0.5 : id === winner ? 1 : 0;
    if (t.warnings.includes('pairedDown')) {
      const top = t.warbandIds.map((id) => byId.get(id)).sort((x, y) => y.points - x.points)[0];
      top.pairedDown += 1;
    }
  }
  if (result.bye) {
    byId.get(result.bye).byes += 1;
    byId.get(result.bye).points += 1;
  }
  return [...byId.values()];
}

function allIds(result) {
  return [...result.tables.flatMap((t) => t.warbandIds), ...(result.bye ? [result.bye] : [])].sort();
}

function noSameOwner(result, warbands) {
  const owner = new Map(warbands.map((w) => [w.id, w.ownerId]));
  for (const t of result.tables) {
    const owners = t.warbandIds.map((id) => owner.get(id));
    assert.equal(new Set(owners).size, owners.length, `same owner at a table: ${t.warbandIds}`);
  }
}

/* ------------------------------------------------------------ underdog */

test('underdog bands (rulebook p.104)', () => {
  assert.equal(underdogBonusForGap(0), 0);
  assert.equal(underdogBonusForGap(50), 0);
  assert.equal(underdogBonusForGap(51), 1);
  assert.equal(underdogBonusForGap(75), 1);
  assert.equal(underdogBonusForGap(76), 2);
  assert.equal(underdogBonusForGap(100), 2);
  assert.equal(underdogBonusForGap(101), 3);
  assert.equal(underdogBonusForGap(150), 3);
  assert.equal(underdogBonusForGap(151), 4);
  assert.equal(underdogBonusForGap(300), 4);
  assert.equal(underdogBonusForGap(301), 5);
  assert.equal(underdogBonusForGap(-62), 1);
});

test('underdog: two warbands', () => {
  assert.deepEqual(underdogFor([142, 204]), { underdog: 0, bonus: 1, gap: 62, compared: [142, 204] });
  assert.equal(underdogFor([178, 161]).underdog, null);
});

test('underdog: multiplayer compares lowest with next-lowest', () => {
  // mordheimer.net example: 176, 195, 123 → 123 vs 176, gap 53 → +1 for the 123.
  assert.deepEqual(underdogFor([176, 195, 123]), { underdog: 2, bonus: 1, gap: 53, compared: [123, 176] });
  assert.equal(underdogFor([188, 176, 171, 152]).bonus, 0);
});

test('underdog table text', () => {
  assert.equal(underdogTableText(), '0–50: 0 · 51–75: +1 · 76–100: +2 · 101–150: +3 · 151–300: +4 · 301+: +5');
});

/* ------------------------------------------------------------ pairing */

for (const method of ['rating', 'swiss', 'random']) {
  test(`20 warbands × 3 rounds, ${method}: everyone plays, no rematches, no same owner`, () => {
    let wbs = makeWarbands(20, 7);
    const met = new Set();
    for (let r = 0; r < 3; r++) {
      const result = pairRound({ ...base, method, warbands: wbs, seed: 100 + r });
      assert.equal(result.tables.length, 10);
      assert.deepEqual(allIds(result), wbs.map((w) => w.id).sort());
      noSameOwner(result, wbs);
      for (const t of result.tables) {
        const key = [...t.warbandIds].sort().join('-');
        assert.ok(!met.has(key), `rematch ${key} in round ${r + 1}`);
        assert.ok(!t.warnings.includes('rematch'));
        met.add(key);
      }
      wbs = play(wbs, result, 900 + r);
    }
  });
}

test('rating: closest ratings meet', () => {
  const wbs = [
    { id: 'a', ownerId: 'pa', type: 'x', rating: 300, points: 0, opponents: [], pairedDown: 0, byes: 0 },
    { id: 'b', ownerId: 'pb', type: 'x', rating: 100, points: 0, opponents: [], pairedDown: 0, byes: 0 },
    { id: 'c', ownerId: 'pc', type: 'x', rating: 290, points: 0, opponents: [], pairedDown: 0, byes: 0 },
    { id: 'd', ownerId: 'pd', type: 'x', rating: 110, points: 0, opponents: [], pairedDown: 0, byes: 0 },
  ];
  const result = pairRound({ ...base, method: 'rating', warbands: wbs });
  const sets = result.tables.map((t) => [...t.warbandIds].sort().join(''));
  assert.deepEqual(sets.sort(), ['ac', 'bd']);
});

test('swiss: pairs inside score groups', () => {
  const wbs = makeWarbands(8, 3).map((w, i) => ({ ...w, points: i < 4 ? 1 : 0 }));
  const result = pairRound({ ...base, method: 'swiss', warbands: wbs });
  const pts = new Map(wbs.map((w) => [w.id, w.points]));
  for (const t of result.tables) {
    assert.equal(pts.get(t.warbandIds[0]), pts.get(t.warbandIds[1]));
    assert.ok(!t.warnings.includes('pairedDown'));
  }
});

test('swiss: an odd score group pairs one down', () => {
  const wbs = makeWarbands(6, 4).map((w, i) => ({ ...w, points: i < 3 ? 1 : 0 }));
  const result = pairRound({ ...base, method: 'swiss', warbands: wbs });
  assert.equal(result.tables.filter((t) => t.warnings.includes('pairedDown')).length, 1);
});

test('same seed, same tables; different seed may differ (random)', () => {
  const wbs = makeWarbands(12, 5);
  const a = pairRound({ ...base, method: 'random', warbands: wbs, seed: 9 });
  const b = pairRound({ ...base, method: 'random', warbands: [...wbs].reverse(), seed: 9 });
  assert.deepEqual(a, b);
});

test('one player with two warbands never meets themselves', () => {
  const wbs = makeWarbands(6, 6).map((w, i) => ({ ...w, ownerId: i < 2 ? 'same' : w.ownerId, rating: 150 + (i < 2 ? i : 50 + i) }));
  for (const method of ['rating', 'swiss', 'random']) {
    const result = pairRound({ ...base, method, warbands: wbs });
    noSameOwner(result, wbs);
  }
});

test('21 warbands, three-way: 9 tables of 2 and 1 of 3', () => {
  const wbs = makeWarbands(21, 8);
  const result = pairRound({ ...base, method: 'rating', warbands: wbs });
  const sizes = result.tables.map((t) => t.warbandIds.length).sort();
  assert.deepEqual(sizes, [2, 2, 2, 2, 2, 2, 2, 2, 2, 3]);
  assert.deepEqual(allIds(result), wbs.map((w) => w.id).sort());
});

test('21 warbands, bye: a different warband sits out each round', () => {
  let wbs = makeWarbands(21, 9);
  const byes = [];
  for (let r = 0; r < 4; r++) {
    const result = pairRound({ ...base, odd: 'bye', method: 'swiss', warbands: wbs, seed: r });
    assert.ok(result.bye);
    assert.equal(result.tables.length, 10);
    byes.push(result.bye);
    wbs = play(wbs, result, 50 + r);
  }
  assert.equal(new Set(byes).size, byes.length);
});

test('6 warbands × 5 rounds: still pairs, warns on rematches, never same owner', () => {
  let wbs = makeWarbands(6, 10);
  let rematchWarnings = 0;
  for (let r = 0; r < 7; r++) {
    const result = pairRound({ ...base, method: 'rating', warbands: wbs, seed: r });
    assert.equal(result.tables.length, 3);
    noSameOwner(result, wbs);
    rematchWarnings += result.tables.filter((t) => t.warnings.includes('rematch')).length;
    wbs = play(wbs, result, 70 + r);
  }
  // 6 warbands have 5 possible opponents each, so 7 rounds must repeat.
  assert.ok(rematchWarnings > 0);
});

test('mirror matches avoided when asked', () => {
  const wbs = makeWarbands(4, 11).map((w, i) => ({ ...w, type: i < 2 ? 'skaven' : 'undead', rating: 100 + i }));
  const result = pairRound({ ...base, avoidMirror: true, method: 'rating', warbands: wbs });
  for (const t of result.tables) assert.ok(!t.warnings.includes('mirror'));
});

test('multiplayer table sizes', () => {
  assert.deepEqual(multiplayerTableSizes(10), [4, 3, 3]);
  assert.deepEqual(multiplayerTableSizes(18), [4, 4, 4, 3, 3]);
  assert.deepEqual(multiplayerTableSizes(20), [4, 4, 4, 4, 4]);
  assert.deepEqual(multiplayerTableSizes(9), [3, 3, 3]);
  assert.deepEqual(multiplayerTableSizes(4), [4]);
});

test('multiplayer round: 10 warbands → 4 + 3 + 3, no same owner', () => {
  const wbs = makeWarbands(10, 12).map((w, i) => ({ ...w, ownerId: i % 5 === 0 ? 'twice' : w.ownerId }));
  const result = pairRound({ ...base, tableSize: 'multi', method: 'rating', warbands: wbs });
  assert.deepEqual(result.tables.map((t) => t.warbandIds.length), [4, 3, 3]);
  noSameOwner(result, wbs);
  assert.deepEqual(allIds(result), wbs.map((w) => w.id).sort());
});

console.log(`pairing: ${passed} checks passed`);

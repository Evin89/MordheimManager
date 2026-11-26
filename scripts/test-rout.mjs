import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build, transform } from 'esbuild';

const bundle = await build({
  stdin: {
    contents: readFileSync(new URL('../src/lib/rout.ts', import.meta.url), 'utf8'),
    sourcefile: 'rout.ts',
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'neutral',
});
const { countBattleModels, countDown, routTestRequired, routLeadership, reconcileStunned } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const tally = (heroIds = [], henchmenCounts = {}, hiredSwordIds = []) => ({ heroIds, henchmenCounts, hiredSwordIds });
const hero = (id, Ld, options = {}) => ({ id, name: id, stats: { Ld }, status: 'active', ...options });
const group = (id, Ld, count) => ({ id, groupName: id, stats: { Ld }, count });
const warband = (heroes, henchmenGroups, hiredSwords = []) => ({ heroes, henchmenGroups, hiredSwords });
const leader = hero('Leader', 5, { isLeader: true });
const captain = hero('Captain', 7);
const recruit = hero('Recruit', 6);
const groupOfThree = group('Group', 8, 3);
const band = warband([leader, captain, recruit], [groupOfThree]);
const empty = tally();
const fallback = (ld, name, reason) => ({ ld, name, reason, source: 'fallback' });
let passed = 0;

function test(name, check) {
  try {
    check();
    passed++;
  } catch (error) {
    console.error(name);
    throw error;
  }
}

test('Only out-of-action models count toward the quarter threshold', () => {
  const twelve = warband([leader], [group('Group', 8, 11)]);
  const total = countBattleModels(twelve);
  assert.equal(total, 12);
  assert.equal(routTestRequired(countDown(tally([], { Group: 3 })), total), true);
  const down = tally([], { Group: 2 });
  const stunned = tally([], { Group: 3 });
  assert.equal(routTestRequired(countDown(down), total), false);
  assert.equal(countDown(stunned), 3);
  assert.equal(routTestRequired(countDown(down), countBattleModels(twelve)), false);
  assert.equal(routTestRequired(0, 0), false);
});

test('Sitting-out models are excluded from the total', () => {
  const sittingOut = hero('Sitting out', 10, { status: 'missNextGame' });
  const thirteen = warband([leader, sittingOut], [group('Group', 8, 11)]);
  assert.equal(countBattleModels(thirteen), 12);
  assert.equal(routTestRequired(3, countBattleModels(thirteen)), true);
});

test('An available leader takes precedence over higher Leadership', () => {
  assert.deepEqual(routLeadership(band, empty, empty), { ld: 5, name: 'Leader', source: 'leader' });
});

const down = tally(['Leader', 'Captain'], { Group: 2 });

test('A group with one able member can provide fallback Leadership', () => {
  assert.deepEqual(routLeadership(band, down, empty), fallback(8, 'Group', 'leaderOutOfAction'));
});

test('A group whose last member is stunned cannot provide Leadership', () => {
  assert.deepEqual(routLeadership(band, down, tally([], { Group: 1 })), fallback(6, 'Recruit', 'leaderOutOfAction'));
});

test('A stunned leader is replaced by an eligible fighter', () => {
  const sword = hero('Sword', 9);
  const hired = warband([leader, captain, recruit], [groupOfThree], [sword]);
  assert.deepEqual(routLeadership(hired, empty, tally(['Leader'])), fallback(9, 'Sword', 'leaderStunned'));
  assert.deepEqual(routLeadership(hired, tally(['Captain'], { Group: 3 }), tally(['Leader'], {}, ['Sword'])),
    fallback(6, 'Recruit', 'leaderStunned'));
});

test('A sitting-out leader and no leader have distinct reasons', () => {
  const absent = warband([{ ...leader, status: 'missNextGame' }, recruit], []);
  assert.deepEqual(routLeadership(absent, empty, empty), fallback(6, 'Recruit', 'leaderNotPlaying'));
  assert.deepEqual(routLeadership(warband([recruit], []), empty, empty), fallback(6, 'Recruit', 'noLeader'));
});

test('Captured fighters cannot provide Leadership', () => {
  const captive = hero('Captive', 10, { status: 'captured' });
  assert.deepEqual(routLeadership(warband([captive, recruit], []), empty, empty),
    fallback(6, 'Recruit', 'noLeader'));
});

test('No roll is available when everyone is down or stunned', () => {
  assert.deepEqual(routLeadership(band, down, tally(['Recruit'], { Group: 1 })), { ld: null, source: 'none' });
});

test('Reconciliation removes overlap and caps a group at its survivors', () => {
  const stunned = tally(['Leader', 'Recruit'], { Group: 2 }, ['Sword']);
  assert.deepEqual(reconcileStunned(band, tally(['Leader'], { Group: 2 }, ['Sword']), stunned),
    tally(['Recruit'], { Group: 1 }));
  assert.deepEqual(reconcileStunned(band, tally([], { Group: 3 }), tally([], { Group: 1 })), empty);
});

test('Ties retain hero, hired sword, then group and roster order', () => {
  const tied = warband([captain, hero('Second', 7)], [group('Group', 7, 1)], [hero('Sword', 7)]);
  assert.deepEqual(routLeadership(tied, empty, empty), fallback(7, 'Captain', 'noLeader'));
  assert.deepEqual(routLeadership(tied, tally(['Captain', 'Second']), empty), fallback(7, 'Sword', 'noLeader'));
});

const betaFlags = await transform(readFileSync(new URL('../src/lib/betaFlags.ts', import.meta.url), 'utf8'), { loader: 'ts' });
const { isStunnedBetaOn, setStunnedBeta } =
  await import(`data:text/javascript;base64,${Buffer.from(betaFlags.code).toString('base64')}`);

test('The stunned beta defaults off and safely persists on this device', () => {
  const key = 'mordheim.beta.stunnedTracking';
  const storage = new Map();
  assert.equal(isStunnedBetaOn(), false);
  globalThis.window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  };
  try {
    setStunnedBeta(true);
    assert.equal(storage.get(key), '1');
    assert.equal(isStunnedBetaOn(), true);
    setStunnedBeta(false);
    assert.equal(storage.has(key), false);
    assert.equal(isStunnedBetaOn(), false);
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage unavailable'); } });
    assert.equal(isStunnedBetaOn(), false);
    assert.doesNotThrow(() => setStunnedBeta(true));
    assert.doesNotThrow(() => setStunnedBeta(false));
  } finally {
    delete globalThis.window;
  }
});

console.log(`rout: ${passed} checks passed`);

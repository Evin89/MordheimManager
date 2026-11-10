/**
 * Fixtures for §45: the free dagger and a dead model's gear. Bundles the real
 * modules with esbuild and checks them with node:assert — no test runner,
 * same approach as test-pairing.mjs.
 *
 *   node scripts/test-free-dagger.mjs
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
    platform: 'node',
    loader: { '.json': 'json' },
    logLevel: 'silent',
    // Vite's import.meta.glob (the warband registry) has no Node equivalent;
    // an empty registry is enough here, nothing below looks a warband up.
    // import.meta.env likewise: a production build's flags.
    define: { 'import.meta.glob': '__noGlob', 'import.meta.env': '{"DEV":false,"PROD":true}' },
    banner: { js: 'const __noGlob = () => ({});' },
  });
  const code = out.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

const { isFreeDagger, withoutFreeDaggers } = await load('src/lib/freeDagger.ts');
const { countWeaponSlots } = await load('src/lib/weaponSlots.ts');
const { createFreeDagger } = await load('src/lib/warbandFactory.ts');
const { createInitialDraft, applyDraftToWarband } = await load('src/screens/postBattle/draftHelpers.ts');

// §45.1 — one definition.
const free = createFreeDagger();
const bought = { id: 'b', name: 'Dagger', category: 'melee', cost: 2 };
const sword = { id: 's', name: 'Sword', category: 'melee', cost: 10 };
assert.equal(isFreeDagger(free), true, 'the factory dagger is free');
assert.equal(isFreeDagger(bought), false, 'a bought dagger is not');
assert.equal(isFreeDagger({ id: 'x', name: 'Dagger ', category: 'melee', cost: 0 }), true, 'trailing space');
assert.equal(isFreeDagger({ id: 'x', name: 'dagger', category: 'melee' }), true, 'lower case, no cost');
assert.equal(isFreeDagger(sword), false, 'a sword is not');
assert.deepEqual(withoutFreeDaggers([free, sword, bought]).map((e) => e.id), ['s', 'b']);

// The weapon limits still exempt exactly one free dagger.
assert.equal(countWeaponSlots([free, sword]).melee, 1, 'free dagger outside the two-weapon limit');
assert.equal(countWeaponSlots([free, { ...free, id: 'f2' }, sword]).melee, 2, 'a second free dagger counts');
assert.equal(countWeaponSlots([bought, sword]).melee, 2, 'a bought dagger counts');

// §45.3 — post-battle.
function hero(id, equipment) {
  return {
    id, name: id, unitType: 'Champion', isLeader: false, stats: { M: 4, WS: 4, BS: 4, S: 3, T: 3, W: 1, I: 4, A: 1, Ld: 7 },
    statMaximums: { M: 4, WS: 6, BS: 6, S: 4, T: 4, W: 3, I: 6, A: 4, Ld: 9 }, xp: 8, startingXp: 8, advances: [],
    skillLists: [], skills: [], spellLists: [], spells: [], injuries: [], equipment, status: 'active', notes: '',
  };
}
const warband = {
  id: 'w', name: 'Test', warbandType: 'reiklanders', gold: 0, wyrdstoneShards: 0, treasury: [], notes: '',
  heroes: [hero('dead', [createFreeDagger(), { ...sword, id: 's1' }]), hero('captured', [createFreeDagger(), { ...sword, id: 's2' }])],
  henchmenGroups: [{
    id: 'g', groupName: 'Swordsmen', unitType: 'Swordsman', count: 2, stats: hero('x', []).stats, xp: 0, advances: [],
    equipment: [createFreeDagger(), { ...sword, id: 's3' }], notes: '',
  }],
  hiredSwords: [],
};
const draft = createInitialDraft(warband);
draft.heroes.dead = { ...draft.heroes.dead, resultingStatus: 'dead', equipmentFate: 'treasury' };
draft.heroes.captured = { ...draft.heroes.captured, resultingStatus: 'captured', equipmentFate: 'treasury' };
draft.henchmenGroups.g = { ...draft.henchmenGroups.g, diedCount: 2, deleteGroupIfEmpty: true };
// A draft saved before §45 still carries the old field; it must be ignored.
draft.henchmenGroups.g.equipmentFateForDead = 'treasury';

const { warband: after } = applyDraftToWarband(warband, draft);
assert.deepEqual(after.treasury.map((e) => e.id), ['s2'], 'only the captured hero\'s sword reaches the treasury');
assert.equal(after.heroes.length, 0, 'both heroes leave the roster');
assert.equal(after.henchmenGroups.length, 0, 'the wiped group is removed');

console.log('free dagger: all checks passed');

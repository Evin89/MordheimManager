import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { outputFiles } = await build({
  stdin: {
    contents: `
      export * from './src/lib/battleRolls';
      export * from './src/lib/battleWizardSteps';
      export { EMPTY_COUNTS } from './src/lib/turnTracker';
      export { createInitialDraft, seedCasualties } from './src/screens/postBattle/draftHelpers';
    `,
    resolveDir: root,
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  // The draft helpers import the warband registry, whose Vite glob isn't needed here.
  define: { 'import.meta.glob': '__noGlob', 'import.meta.env': '{"DEV":false,"PROD":true}' },
  banner: { js: 'const __noGlob = () => ({});' },
});
const {
  applyGroupWounds, applyWoundRolls, battleUnderdog, recordSeriousInjury, woundResult, EMPTY_COUNTS,
  wizardStep, wizardSteps, visitedWizardSteps, wizardProgress, createInitialDraft, seedCasualties,
} = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

assert.deepEqual([1, 2, 3, 4, 5, 6].map(woundResult), [
  'knockedDown', 'knockedDown', 'stunned', 'stunned', 'outOfAction', 'outOfAction',
]);
const stunned = applyWoundRolls(EMPTY_COUNTS, [3]);
assert.equal(stunned.counts.stunned, 1);
assert.deepEqual(stunned.undo, EMPTY_COUNTS);
assert.deepEqual(applyWoundRolls(stunned.counts, [6]).counts, stunned.counts);
const group = applyWoundRolls(EMPTY_COUNTS, [1, 4, 6], 'standing');
assert.deepEqual(group.counts, { ...EMPTY_COUNTS, knockedDown: 1, stunned: 1 });

const downedGroup = applyWoundRolls({ ...EMPTY_COUNTS, knockedDown: 2 }, [4, 6], 'knockedDown');
assert.deepEqual(downedGroup.counts, { ...EMPTY_COUNTS, knockedDown: 1, stunned: 1 });
assert.deepEqual(applyGroupWounds(downedGroup.counts, 'knockedDown', 'outOfAction', 1),
  { ...EMPTY_COUNTS, stunned: 1, outOfAction: 1 });

const heroes = ['a', 'b'].map((id) => ({ id, status: 'active' }));
const warband = { heroes, henchmenGroups: [], hiredSwords: [] };
const tally = { heroIds: ['a'], henchmenCounts: {}, hiredSwordIds: [] };
assert.equal(recordSeriousInjury(undefined, tally.heroIds, 'b', '22'), undefined);
assert.equal(recordSeriousInjury(undefined, tally.heroIds, 'a', '99'), undefined);
const seriousInjuries = recordSeriousInjury(undefined, tally.heroIds, 'a', '22');
assert.deepEqual(seriousInjuries, { a: '22' });
const casualties = seedCasualties(warband, createInitialDraft(warband), tally, seriousInjuries);
assert.equal(casualties.heroes.a.tableInjuryRoll, '22');
assert.equal(casualties.heroes.a.injuries[0].name, 'Leg Wound');
assert.deepEqual(casualties.heroes.b.injuries, []);

assert.deepEqual(battleUnderdog({ mine: 142, theirs: 231 }), { mine: 142, theirs: 231, gap: 89, bonus: 2 });
assert.equal(battleUnderdog({ mine: 231, theirs: 142 }).bonus, 0);
assert.equal(battleUnderdog({ mine: 142, theirs: null }), undefined);

const campaign = wizardSteps(false);
assert.equal(campaign.length, 8);
assert.equal(campaign[3], 'exploration');
assert.equal(wizardStep(3, false), 'advances');
assert.equal(wizardStep(4, false), 'deadModels');
assert.equal(wizardStep(5, false), 'exploration');
assert.deepEqual(visitedWizardSteps(3, false), ['info', 'injuries', 'experience', 'advances']);
assert.deepEqual(wizardProgress({ step: 'advances', draft: {} }), [5, 8]);
assert.deepEqual(wizardSteps(true), ['info', 'confirm']);
assert.equal(wizardStep(1, true), 'confirm');
assert.deepEqual(wizardProgress({ step: 1, draft: { friendly: true } }), [2, 2]);

console.log('Battle flow checks passed.');

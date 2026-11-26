import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const source = readFileSync(new URL('../src/lib/turnTracker.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
const {
  nextStep, prevStep, isMyTurn, EMPTY_COUNTS, applyRecovery, undoRecovery, standUp,
  setModelState, reconcileGroup, shootingBlockers, shootingCount, canCast,
} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

function sequence(firstPlayer, expected) {
  const steps = expected.map(([turn, phase]) => ({ turn, phase }));
  assert.equal(prevStep({ ...steps[0], firstPlayer }), null);
  for (let i = 1; i < steps.length; i++) {
    assert.deepEqual(nextStep({ ...steps[i - 1], firstPlayer }), steps[i]);
    assert.deepEqual(prevStep({ ...steps[i], firstPlayer }), steps[i - 1]);
    assert.equal(isMyTurn(steps[i].turn, firstPlayer), steps[i].phase !== 'opponent');
  }
}
sequence('me', [
  [1, 'pregame'], [1, 'start'], [1, 'recovery'], [1, 'movement'], [1, 'shooting'],
  [1, 'combat'], [2, 'opponent'], [3, 'start'],
]);
sequence('them', [
  [1, 'pregame'], [1, 'opponent'], [2, 'start'], [2, 'recovery'], [2, 'movement'],
  [2, 'shooting'], [2, 'combat'], [3, 'opponent'], [4, 'start'],
]);

const stunned = setModelState(EMPTY_COUNTS, 'stunned');
const heroRecovery = applyRecovery(stunned);
assert.equal(heroRecovery.counts.stunned, 0);
assert.equal(heroRecovery.counts.knockedDown, 1);
assert.deepEqual(undoRecovery(heroRecovery.counts, heroRecovery.undo), stunned);
assert.equal(standUp(heroRecovery.counts, heroRecovery.undo.knockedDown, true).knockedDown, 1);

const down = setModelState(EMPTY_COUNTS, 'knockedDown');
const downRecovery = applyRecovery(down);
assert.equal(standUp(downRecovery.counts, downRecovery.undo.knockedDown, true).knockedDown, 0);
assert.equal(standUp(downRecovery.counts, downRecovery.undo.knockedDown, false).knockedDown, 1);
const group = { ...EMPTY_COUNTS, stunned: 2, knockedDown: 1 };
const groupRecovery = applyRecovery(group);
assert.deepEqual(groupRecovery.counts, { ...EMPTY_COUNTS, knockedDown: 3 });
assert.deepEqual(undoRecovery(groupRecovery.counts, groupRecovery.undo), group);
assert.equal(standUp(groupRecovery.counts, groupRecovery.undo.knockedDown, true).knockedDown, 2);

for (const state of ['stunned', 'knockedDown', 'fleeing']) {
  assert.deepEqual(setModelState(setModelState(EMPTY_COUNTS, state), 'outOfAction'),
    { ...EMPTY_COUNTS, outOfAction: 1 });
}
assert.deepEqual(reconcileGroup({ outOfAction: 2, stunned: 2, knockedDown: 1, fleeing: 2, rallied: 0 }, 3),
  { ...EMPTY_COUNTS, outOfAction: 2, stunned: 1 });

for (const state of ['knockedDown', 'stunned', 'fleeing', 'rallied']) {
  const counts = { ...EMPTY_COUNTS, [state]: 1 };
  assert.deepEqual(shootingBlockers(counts), [state]);
  assert.equal(shootingCount(counts, 1), 0);
  assert.equal(canCast(counts), state === 'rallied');
}
assert.equal(shootingCount({ ...EMPTY_COUNTS, knockedDown: 2, rallied: 1 }, 5), 2);

console.log('turn tracker: sequence, recovery, state and eligibility checks passed');

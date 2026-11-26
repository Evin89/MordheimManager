// node scripts/test-changelog-discord.mjs — checks for post-changelog-discord.mjs.
import assert from 'node:assert/strict';
import { newEntries, buildPayloads, ABOUT_URL } from './post-changelog-discord.mjs';

const old = [
  { date: '2026-11-16', title: 'A', description: 'a' },
  { date: '2026-11-10', title: 'B', description: 'b' },
];

// Only entries that are new on date + title, oldest first.
const next = [
  { date: '2026-11-22', title: 'D', description: 'd' },
  { date: '2026-11-20', title: 'C', description: 'c' },
  ...old,
];
assert.deepEqual(newEntries(old, next).map((e) => e.title), ['C', 'D']);

// Same title on another date counts as new; an edited description does not.
assert.deepEqual(newEntries(old, [{ date: '2026-11-17', title: 'A' }, ...old]).map((e) => e.date), ['2026-11-17']);
assert.equal(newEntries(old, [{ ...old[0], description: 'changed' }, old[1]]).length, 0);
assert.equal(newEntries(old, old).length, 0);

// Payloads: max 10 embeds each, mentions off, link to the About page, clipped.
const many = Array.from({ length: 23 }, (_, i) => ({ date: '2026-11-22', title: `T${i}`, description: 'x'.repeat(5000) }));
const payloads = buildPayloads(many);
assert.deepEqual(payloads.map((p) => p.embeds.length), [10, 10, 3]);
for (const p of payloads) assert.deepEqual(p.allowed_mentions, { parse: [] });
assert.equal(payloads[0].embeds[0].url, ABOUT_URL);
assert.equal(payloads[0].embeds[0].description.length, 4096);
assert.equal(buildPayloads([]).length, 0);

console.log('post-changelog-discord: all checks passed');

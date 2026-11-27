import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = await build({
  entryPoints: [resolve(root, 'src/lib/promotion.ts')],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'neutral',
  define: { 'import.meta.env.DEV': 'false' },
  // Vite normally expands the registry's display-name globs. These checks only
  // use roster counts and can run with an empty display-name index.
  banner: { js: 'import.meta.glob = () => ({});' },
});
const code = out.outputFiles[0].text;
const { MAX_HEROES, heroCount, canPromote } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);

const warband = {
  heroes: ['active', 'active', 'active', 'active', 'missNextGame', 'dead', 'captured', 'left']
    .map((status) => ({ status })),
  hiredSwords: [{ status: 'active' }],
};

assert.equal(MAX_HEROES, 6);
assert.equal(heroCount(warband), 5);
assert.equal(canPromote(warband), true);
warband.heroes.push({ status: 'active' });
assert.equal(heroCount(warband), 6);
assert.equal(canPromote(warband), false);

console.log('Promotion checks passed.');

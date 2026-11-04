/**
 * Every route lands somewhere in the navigation (spec §40.1).
 *
 * Reads the route table out of `src/App.tsx`, fills each `:param` with a
 * placeholder, and asks `navTargetForPath` (src/lib/navTabs.ts) which
 * destination it lights. A route that maps to nothing fails the build, so a
 * new screen can't ship as a page where no tab is lit and the player loses
 * their place — the bug §39 fixed for profiles and §40 for everything else.
 *
 * Routes outside the app shell (sign-in flow, the design sandbox) and the
 * catch-all are expected to map to nothing and are listed below.
 *
 *   node scripts/check-nav-coverage.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const OUTSIDE_SHELL = new Set(['/login', '/register', '/forgot-password', '/reset-password', '/design', '*']);

// --- Collect route paths, resolving nesting (`/admin` + its children). ---
// A small scanner rather than one regex: `element={guarded(<AdminLayout />)}`
// puts a `>` inside the attributes, so the tag ends at the first `>` outside
// braces. Redirect-only routes (`element={<Navigate … />}`) are skipped — they
// never render, so they light nothing by design.
const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
const paths = [];
const parents = [];
let i = 0;
while (i < app.length) {
  if (app.startsWith('</Route>', i)) {
    parents.pop();
    i += 8;
    continue;
  }
  if (!app.startsWith('<Route', i) || !/\s/.test(app[i + 6])) {
    i++;
    continue;
  }
  let j = i + 6;
  let depth = 0;
  while (j < app.length) {
    const c = app[j];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) break;
    j++;
  }
  const attrs = app.slice(i + 6, j);
  const selfClosing = attrs.trimEnd().endsWith('/');
  const pathMatch = attrs.match(/\bpath="([^"]+)"/);
  const isIndex = /\bindex\b/.test(attrs);
  const redirect = /element=\{<Navigate\b/.test(attrs);
  const parent = parents.at(-1) ?? '';
  let full = null;
  if (pathMatch) {
    const p = pathMatch[1];
    full = p.startsWith('/') || p === '*' ? p : `${parent}/${p}`;
  } else if (isIndex) {
    full = parent;
  }
  if (full && !redirect) paths.push(full);
  if (!selfClosing) parents.push(full ?? parent);
  i = j + 1;
}

if (paths.length < 20) {
  console.error(`check-nav-coverage: only found ${paths.length} routes in App.tsx — the parser needs updating.`);
  process.exit(1);
}

// --- Load navTargetForPath without a TypeScript toolchain at runtime. ---
const bundled = await build({
  entryPoints: [resolve(root, 'src/lib/navTabs.ts')],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const { navTargetForPath } = mod;

let failures = 0;
for (const path of paths) {
  if (OUTSIDE_SHELL.has(path)) continue;
  const concrete = path.replace(/:[A-Za-z]+/g, 'x1');
  const target = navTargetForPath(concrete, 'me');
  if (!target) {
    console.error(`  ✗ ${path} lights no navigation destination`);
    failures++;
  }
}

// Own profile lights the avatar; someone else's lights Campaigns.
const own = navTargetForPath('/players/me', 'me');
const other = navTargetForPath('/players/someone', 'me');
if (own !== 'account' || other !== 'campaigns') {
  console.error(`  ✗ profile split broken: own=${own}, other=${other}`);
  failures++;
}

if (failures) {
  console.error(`check-nav-coverage: ${failures} problem(s) across ${paths.length} routes.`);
  process.exit(1);
}
if (process.argv.includes("--list")) console.log(paths.join("\n"));
console.log(`check-nav-coverage: ${paths.length} routes, every in-shell route lights a destination.`);

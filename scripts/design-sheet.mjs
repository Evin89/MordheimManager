/**
 * Generates the design sheets embedded in spec §13.5.
 *
 * Reads the theme tokens straight out of `src/index.css` and emits one SVG per
 * theme into `docs/design/`. Nothing here is hand-drawn or hand-copied: the
 * swatch hexes come from the stylesheet, and the contrast ratios are computed
 * from those same values rather than transcribed from the comments beside them.
 * A token edited in the CSS and not re-run shows up as a diff, and a token
 * change that breaks WCAG AA shows up as a FAIL on the sheet.
 *
 * The sheet is a reference for the spec, not a replacement for `/design` —
 * fonts can't load inside an <img>-embedded SVG, so the type scale shows the
 * sizes and names the families rather than pretending to render them. Interactive
 * states (focus rings, editable cells, hover) live in the sandbox only.
 *
 *   npm run design-sheet
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(root, 'docs/design');

const THEMES = [
  { id: 'grimdark', label: 'Grimdark', selector: /:root,\s*\[data-theme='grimdark'\]\s*\{([\s\S]*?)\}/ },
  { id: 'parchment', label: 'Rulebook (parchment)', selector: /\[data-theme='parchment'\]\s*\{([\s\S]*?)\}/ },
];

/** `--color-ink: 34 26 18;` → { ink: [34, 26, 18] } */
function readTokens(css, selector) {
  const block = css.match(selector);
  if (!block) throw new Error(`Theme block not found for ${selector}`);
  const tokens = {};
  for (const [, name, value] of block[1].matchAll(/--color-([\w-]+):\s*([\d\s]+);/g)) {
    tokens[name] = value.trim().split(/\s+/).map(Number);
  }
  return tokens;
}

const hex = (rgb) => `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/** WCAG relative luminance. */
function luminance([r, g, b]) {
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;

// The statline shown on the sheet. A real unit rather than filler, so the
// column widths are tested against values the app actually renders.
const STATS = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'];
const CAPTAIN = ['4', '4', '4', '3', '3', '1', '4', '1', '8'];
const MAXIMUMS = ['4', '6', '6', '4', '4', '3', '6', '4', '9'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function sheet(theme, tokens) {
  const c = (name) => hex(tokens[name]);
  const rgb = (name) => tokens[name];

  const pairs = [
    ['ink on parchment', 'ink', 'parchment'],
    ['ink on parchment-raised', 'ink', 'parchment-raised'],
    ['ink-faded on parchment', 'ink-faded', 'parchment'],
    ['accent on parchment', 'accent', 'parchment'],
    ['on-accent on accent', 'on-accent', 'accent'],
    // Verdigris always carries white, in both themes. Listed because the first
    // draft of this sheet guessed `parchment-raised` instead and produced a
    // 3.95:1 failure that exists nowhere in the app — a reminder that the sheet
    // has to render what the components render, not a plausible substitute.
    ['white on verdigris', null, 'verdigris'],
  ].map(([label, fg, bg]) => ({
    label,
    fg,
    bg,
    ratio: contrast(fg ? rgb(fg) : [255, 255, 255], rgb(bg)),
  }));

  const swatches = ['parchment', 'parchment-raised', 'ink', 'ink-faded', 'accent', 'verdigris'];

  const W = 880;
  const body = [];
  const push = (s) => body.push(s);

  const text = (x, y, str, { size = 14, fill = c('ink'), family = 'Georgia, serif', weight = 'normal', anchor = 'start', spacing = 0, style = 'normal' } = {}) =>
    `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" font-style="${style}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}">${esc(str)}</text>`;

  const UI = 'system-ui, -apple-system, Segoe UI, sans-serif';

  push(text(32, 52, `Mordheim Campaign Manager — ${theme.label}`, { size: 26, spacing: 1 }));
  push(text(32, 74, 'Generated from src/index.css by scripts/design-sheet.mjs — spec §5.1–5.3', { size: 12, fill: c('ink-faded'), family: UI }));

  // --- Colour tokens -------------------------------------------------------
  let y = 108;
  push(text(32, y, 'COLOUR TOKENS', { size: 11, family: UI, weight: 'bold', fill: c('ink-faded'), spacing: 1.5 }));
  y += 16;
  swatches.forEach((name, i) => {
    const x = 32 + i * 138;
    push(`<rect x="${x}" y="${y}" width="126" height="58" fill="${c(name)}" stroke="${c('ink')}" stroke-width="1.5"/>`);
    push(text(x, y + 76, name, { size: 12, family: UI, weight: 'bold' }));
    push(text(x, y + 92, c(name), { size: 11, family: UI, fill: c('ink-faded') }));
  });

  // --- Contrast ------------------------------------------------------------
  y += 128;
  push(text(32, y, 'MEASURED CONTRAST — WCAG AA NEEDS 4.5:1 FOR NORMAL TEXT', { size: 11, family: UI, weight: 'bold', fill: c('ink-faded'), spacing: 1.5 }));
  y += 22;
  pairs.forEach((p, i) => {
    const x = 32 + (i % 3) * 280;
    const row = y + Math.floor(i / 3) * 30;
    const pass = p.ratio >= AA;
    push(text(x, row, p.label, { size: 13, family: UI }));
    push(text(x + 196, row, `${p.ratio.toFixed(2)}:1`, { size: 13, family: UI, weight: 'bold', anchor: 'end' }));
    push(text(x + 204, row, pass ? 'PASS' : 'FAIL', {
      size: 11,
      family: UI,
      weight: 'bold',
      fill: pass ? c('verdigris') : c('accent'),
    }));
  });

  // --- Profile block, full -------------------------------------------------
  y += 84;
  push(text(32, y, 'PROFILE BLOCK — FULL (§5.3)', { size: 11, family: UI, weight: 'bold', fill: c('ink-faded'), spacing: 1.5 }));
  y += 14;
  const cell = 58;
  const tableW = cell * STATS.length;
  const headH = 26;
  const rowH = 32;

  push(`<rect x="32" y="${y}" width="${tableW}" height="${headH + rowH}" fill="${c('parchment-raised')}" stroke="${c('ink')}" stroke-width="2"/>`);
  // The thin inner rule the spec calls for, inset from the heavy border.
  push(`<rect x="35.5" y="${y + 3.5}" width="${tableW - 7}" height="${headH + rowH - 7}" fill="none" stroke="${c('ink')}" stroke-width="0.75" opacity="0.5"/>`);
  push(`<line x1="32" y1="${y + headH}" x2="${32 + tableW}" y2="${y + headH}" stroke="${c('ink')}" stroke-width="1.25"/>`);
  STATS.forEach((s, i) => {
    const x = 32 + i * cell;
    if (i > 0) push(`<line x1="${x}" y1="${y + 4}" x2="${x}" y2="${y + headH + rowH - 4}" stroke="${c('ink')}" stroke-width="0.5" opacity="0.4"/>`);
    push(text(x + cell / 2, y + 18, s.toUpperCase(), { size: 12, family: UI, weight: 'bold', anchor: 'middle', spacing: 0.8 }));
    push(text(x + cell / 2, y + headH + 22, CAPTAIN[i], { size: 17, anchor: 'middle' }));
  });
  push(text(32 + tableW + 20, y + 18, 'Mercenary Captain', { size: 17 }));
  push(text(32 + tableW + 20, y + 40, 'Reiklander Mercenaries', { size: 12, fill: c('ink-faded'), family: UI }));
  push(text(32 + tableW + 20, y + 58, 'tabular-nums · lining-nums', { size: 11, fill: c('ink-faded'), family: UI }));

  // --- Profile block, at maximum -------------------------------------------
  y += headH + rowH + 44;
  push(text(32, y, 'AT THE RACIAL MAXIMUM — FLAGGED, NEVER SILENTLY REFUSED', { size: 11, family: UI, weight: 'bold', fill: c('ink-faded'), spacing: 1.5 }));
  y += 14;
  push(`<rect x="32" y="${y}" width="${tableW}" height="${headH + rowH}" fill="${c('parchment-raised')}" stroke="${c('ink')}" stroke-width="2"/>`);
  push(`<line x1="32" y1="${y + headH}" x2="${32 + tableW}" y2="${y + headH}" stroke="${c('ink')}" stroke-width="1.25"/>`);
  STATS.forEach((s, i) => {
    const x = 32 + i * cell;
    push(`<rect x="${x + 1}" y="${y + headH + 1}" width="${cell - 2}" height="${rowH - 2}" fill="${c('accent')}" opacity="0.14"/>`);
    if (i > 0) push(`<line x1="${x}" y1="${y + 4}" x2="${x}" y2="${y + headH + rowH - 4}" stroke="${c('ink')}" stroke-width="0.5" opacity="0.4"/>`);
    push(text(x + cell / 2, y + 18, s.toUpperCase(), { size: 12, family: UI, weight: 'bold', anchor: 'middle', spacing: 0.8 }));
    push(text(x + cell / 2, y + headH + 22, MAXIMUMS[i], { size: 17, anchor: 'middle', fill: c('accent'), weight: 'bold' }));
  });

  // --- Type scale ----------------------------------------------------------
  y += headH + rowH + 44;
  push(text(32, y, 'TYPE SCALE (§5.2, §5.4) — FAMILIES NAMED; SVG CANNOT LOAD THEM', { size: 11, family: UI, weight: 'bold', fill: c('ink-faded'), spacing: 1.5 }));
  y += 30;
  push(text(32, y, 'Display 30px — titles only', { size: 30, spacing: 1.5 }));
  push(text(560, y, 'Pirata One · ≥24px, never body', { size: 11, family: UI, fill: c('ink-faded') }));
  y += 30;
  push(text(32, y, 'Heading serif 20px — sections, unit names', { size: 20 }));
  push(text(560, y, 'IM Fell English', { size: 11, family: UI, fill: c('ink-faded') }));
  y += 26;
  push(text(32, y, 'Body 16px — running text sits at the §5.4 floor and no lower.', { size: 16 }));
  push(text(560, y, 'Alegreya', { size: 11, family: UI, fill: c('ink-faded') }));
  y += 22;
  push(text(32, y, 'UI sans 14px — buttons, labels, table headers', { size: 14, family: UI }));
  push(text(560, y, 'Alegreya Sans', { size: 11, family: UI, fill: c('ink-faded') }));
  y += 20;
  push(text(32, y, 'Smallest permitted: 12px, and never for anything you must read to act.', { size: 12, family: UI, fill: c('ink-faded') }));

  // --- Actions -------------------------------------------------------------
  y += 34;
  const btn = (x, label, fill, fg, stroke) =>
    `<rect x="${x}" y="${y}" width="150" height="48" rx="6" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="1.5"` : ''}/>` +
    text(x + 75, y + 30, label, { size: 14, family: UI, weight: 'bold', fill: fg, anchor: 'middle' });
  push(btn(32, 'Primary action', c('accent'), c('on-accent')));
  push(btn(198, 'Secondary', 'none', c('ink'), c('ink')));
  push(btn(364, 'Confirm', c('verdigris'), '#FFFFFF'));
  push(text(538, y + 30, '48px — the §5.4 minimum touch target', { size: 11, family: UI, fill: c('ink-faded') }));

  // The canvas follows the content rather than a guessed constant: an added row
  // would otherwise be silently clipped, since an <img>-embedded SVG crops to
  // its viewBox with no scrollbar to hint that anything is missing.
  const H = y + 48 + 32;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(theme.label)} design tokens, profile block and type scale">
  <rect width="${W}" height="${H}" fill="${c('parchment')}"/>
${body.map((l) => `  ${l}`).join('\n')}
</svg>
`;
}

const css = readFileSync(resolve(root, 'src/index.css'), 'utf8');
mkdirSync(OUT_DIR, { recursive: true });

let failures = 0;
for (const theme of THEMES) {
  const tokens = readTokens(css, theme.selector);
  writeFileSync(resolve(OUT_DIR, `${theme.id}.svg`), sheet(theme, tokens));

  // Re-assert §5.1's contrast requirement on every run. The sheet renders a
  // FAIL badge, but a silent file nobody opens is not a check.
  for (const [fg, bg] of [['ink', 'parchment'], ['on-accent', 'accent'], [null, 'verdigris']]) {
    const ratio = contrast(fg ? tokens[fg] : [255, 255, 255], tokens[bg]);
    const ok = ratio >= AA;
    if (!ok) failures += 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${theme.id.padEnd(10)} ${fg ?? 'white'} on ${bg}: ${ratio.toFixed(2)}:1`);
  }
  console.log(`      wrote docs/design/${theme.id}.svg`);
}

if (failures > 0) {
  console.error(`\n${failures} contrast pair(s) below WCAG AA (${AA}:1).`);
  process.exit(1);
}

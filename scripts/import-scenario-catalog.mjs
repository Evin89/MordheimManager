// Generates src/data/scenarioCatalog.json — every scenario in the mordheimer.net
// dataset (MordheimerData/Sourcedata `scenarios.json`), normalised for the app.
//
// The source is a flat list of { title, link, tags, campaignSetting, playerMode,
// source, author, description }. It carries no deployment or terrain data; the
// app derives a *generic* board layout from the tags (see lib/scenarioCatalog.ts).
// What this script fixes on the way in:
//  - a stable `id`: the core-rulebook nine keep the ids `scenarios.json` already
//    uses (so their hand-coded deployment zones still apply); everything else
//    takes its unique mordheimer.net slug, since titles repeat (two Ambushes,
//    two Breakthroughs, two Caravans, two Haunted Treasures);
//  - a display `name` that tells those repeats apart (source, then author);
//  - player modes split out of the "1v1,Multiplayer" tag and the "Multiplayer #28"
//    typo, and "Set in …" / player-mode tags dropped from `tags` (they have fields);
//  - a "None" description read as no description;
//  - `link` made an absolute URL to the full scenario text.
//
// Run with `npm run import:scenarios [path/to/scenarios.json]`. Defaults to a
// sibling checkout at ../Mordheimer/Sourcedata. The output is committed.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const input = resolve(process.argv[2] ?? resolve(root, '../Mordheimer/Sourcedata/scenarios.json'));
const output = resolve(root, 'src/data/scenarioCatalog.json');

// The file ships with a UTF-8 BOM.
const raw = JSON.parse(readFileSync(input, 'utf8').replace(/^﻿/, ''));
const core = JSON.parse(readFileSync(resolve(root, 'src/data/scenarios.json'), 'utf8')).scenarios;
const coreIdByName = new Map(core.map((s) => [s.name, s.id]));

const MODES = ['1v1', 'Multiplayer'];

const entries = raw.map((s) => {
  const rawTags = s.tags.flatMap((t) => t.split(',')).map((t) => t.trim()).filter(Boolean);
  const modeText = [s.playerMode, ...rawTags].join(',');
  const playerModes = MODES.filter((m) => modeText.includes(m));
  const tags = [...new Set(rawTags.filter((t) => !MODES.includes(t) && !t.startsWith('Set in ')))];
  const slug = s.link.split('/').filter(Boolean).pop();
  const isCore = s.source === 'Mordheim Rulebook' && coreIdByName.has(s.title);
  const description = s.description && s.description.trim() !== 'None' ? s.description.trim() : null;
  return {
    id: isCore ? coreIdByName.get(s.title) : slug,
    title: s.title,
    name: s.title,
    core: isCore,
    setting: s.campaignSetting,
    playerModes,
    source: s.source,
    author: s.author,
    description,
    tags,
    url: `https://mordheimer.net${s.link}`,
  };
});

// Disambiguate repeated titles: by source first, then by author. The core nine
// keep their plain name (see below).
const byTitle = Map.groupBy
  ? Map.groupBy(entries, (e) => e.title)
  : entries.reduce((m, e) => m.set(e.title, [...(m.get(e.title) ?? []), e]), new Map());
for (const group of byTitle.values()) {
  if (group.length < 2) continue;
  for (const e of group) {
    // A core scenario keeps its plain name — the battle log stores scenarios by it.
    if (e.core) continue;
    const sameSource = group.filter((o) => o.source === e.source).length > 1;
    e.name = `${e.title} (${sameSource ? e.author : e.source})`;
  }
}

const ids = new Set();
for (const e of entries) {
  if (ids.has(e.id)) throw new Error(`Duplicate scenario id: ${e.id}`);
  ids.add(e.id);
}
const missingCore = core.filter((c) => !ids.has(c.id));
if (missingCore.length) throw new Error(`Core scenarios not found in source: ${missingCore.map((c) => c.name).join(', ')}`);

writeFileSync(
  output,
  JSON.stringify(
    {
      schemaVersion: 1,
      source:
        'MordheimerData/Sourcedata scenarios.json (mordheimer.net), imported by scripts/import-scenario-catalog.mjs: title, source, author, setting, player modes, a one-line description and tags for 101 scenarios. No deployment, terrain or page data — the battlefield generator draws a generic board from the tags for all but the nine core-rulebook scenarios.',
      scenarios: entries,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Wrote ${entries.length} scenarios (${entries.filter((e) => e.core).length} core) to ${output}`);

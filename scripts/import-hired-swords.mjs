// Generates src/data/hiredSwords.json — every Hired Sword in the mordheimer.net
// dataset (MordheimerData/Sourcedata `hiredSwords.json`), normalised for the app.
//
// The seven core-rulebook entries were transcribed by hand from the rulebook
// before this import existed; their curated text and ids are kept as they are
// (saved warbands and the rating table look them up by name). They only gain
// what the source adds: grade, permitted warbands, race and a link.
// Everything else is converted. What this script fixes on the way in:
//  - the scraped `<Tooltip>`, `<a>`, `<em>`, `<br />` and `<table>` markup,
//    with tables flattened to one "cell — cell" line per row and the source's
//    ❓/✏️ FAQ and errata markers dropped;
//  - names in the source's own casing ("Priest Of Morr") put back in title case;
//  - costs that aren't gold ("2 treasures", "1 wyrdstone", "70 +3D6") kept as
//    text next to whatever number can honestly be read out of them;
//  - stat lines with a qualifier ("1(2)", "4(3)", "3*") reduced to their base
//    number, with the printed value carried into the rules text;
//  - mounts and companions (the Freelancer's warhorse, the Cursed Hillman's
//    wolf form) moved from extra stat lines into the rules text;
//  - the source's warband names mapped to the app's warband ids.
// The Priest of Morr and the Wolf Priest of Ulric are left out: their entries
// cost "Hero" — each replaces one of the warband's Heroes rather than being
// hired, so they aren't Hired Swords in the app's sense.
//
// Run with `npm run import:hired-swords [path/to/hiredSwords.json]`. Defaults to
// a sibling checkout at ../Mordheimer/Sourcedata. The output is committed.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const input = resolve(process.argv[2] ?? resolve(root, '../Mordheimer/Sourcedata/hiredSwords.json'));
const output = resolve(root, 'src/data/hiredSwords.json');

const raw = JSON.parse(readFileSync(input, 'utf8').replace(/^﻿/, ''));
// The hand-transcribed core seven, read back from the committed output (which
// is why the rest of that file is ignored: it's this script's own work).
const CURATED = ['pitFighter', 'ogreBodyguard', 'halflingScout', 'warlock', 'freelancer', 'elfRanger', 'dwarfTrollSlayer'];
const existing = JSON.parse(readFileSync(output, 'utf8')).hiredSwords.filter((h) => CURATED.includes(h.id));
const existingById = new Map(existing.map((h) => [h.id, h]));
if (existing.length !== CURATED.length) throw new Error('A curated core Hired Sword is missing from the output file');

const SKIPPED = new Set(['priest-of-morr', 'wolf-priest-of-ulric']);

// The source's warband names → the app's warband ids. Names the app has no
// warband for (Mazzalupo, Nipponese Expedition, Ostermarkers…) are dropped.
const warbandIds = new Map(
  readdirSync(resolve(root, 'src/data/warbands')).map((f) => {
    const w = JSON.parse(readFileSync(resolve(root, 'src/data/warbands', f), 'utf8'));
    return [w.id, w.id];
  }),
);
const WARBAND_ALIASES = {
  'Averlanders': 'averlanders',
  'Bretonnian Knights': 'bretonnians',
  'Marienburgers': 'marienburgers',
  'Middenheimers': 'middenheimers',
  'Ostlanders': 'ostlanders',
  'Reiklanders': 'reiklanders',
  'Skaven': 'skaven',
  'Undead': 'undead',
  'Sons of Hashut:': 'the-sons-of-hashut',
  'Night Goblins (web)': 'night-goblins',
};
function warbandId(name) {
  if (WARBAND_ALIASES[name]) return WARBAND_ALIASES[name];
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return warbandIds.get(slug) ?? null;
}

const RACES = {
  human: 'human', elf: 'elf', dwarf: 'dwarf', ogre: 'ogre', halfling: 'halfling',
  orc: 'orc', skink: 'skink', hobgoblin: 'hobgoblin', goblin: 'goblin', beastman: 'ungor',
};
const RACE_OVERRIDES = { 'black-orc-overseer': 'blackOrc' };

// Casters, wired to spells.json. Starting counts are the entry's own words;
// where it doesn't give one, none is set.
const SPELLS = {
  'elf-mage': { spellLists: ['spellsOfTheDjedhi'], startingSpells: 3 },
  'norse-shaman': { spellLists: ['norseRunes'], startingSpells: 2 },
  'warrior-priest-of-sigmar': { spellLists: ['prayersOfSigmar'] },
  'witch': { spellLists: ['charmsAndHexes'], startingSpells: 2 },
  'fallen-sister': { spellLists: ['lesserMagic'], startingSpells: 1 },
};

const SKILL_LISTS = ['combat', 'shooting', 'academic', 'strength', 'speed'];
const STAT_KEYS = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'];

function camel(slug) {
  return slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function titleCase(name) {
  return name
    .replace(/^The /, '')
    .replace(/ (Of|The|And) /g, (m) => m.toLowerCase());
}

function clean(html) {
  if (!html) return '';
  let s = html
    // FAQ/errata markers: a ❓ or ✏️ tooltip in a <sup>.
    .replace(/<sup>.*?<\/sup>/gs, '')
    .replace(/<table>(.*?)<\/table>/gs, (_, t) =>
      '\n' +
      [...t.matchAll(/<tr>(.*?)<\/tr>/gs)]
        .map(([, row]) => [...row.matchAll(/<t[hd]>(.*?)<\/t[hd]>/gs)].map(([, c]) => c.trim()).join(' — '))
        .join('\n') +
      '\n',
    )
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/p>\s*<p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    // Markdown left in the scrape: [text](link), *emphasis*.
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1$2')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function number(text) {
  const m = String(text).match(/^\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

// A price in gold crowns, or null when it's paid in something else ("2
// treasures", "1 wyrdstone") or not at all ("n/a").
function gold(text) {
  return /treasure|wyrdstone/i.test(text) ? null : number(text);
}

function profileLine(p) {
  return STAT_KEYS.map((k) => `${k}${p[k.toLowerCase()]}`).join(' ');
}

const notes = [];

function convert(slug, v) {
  const profiles = Array.isArray(v.statblock) ? v.statblock : [v.statblock];
  const [main, ...extra] = profiles;
  const statLine = {};
  const qualified = [];
  for (const k of STAT_KEYS) {
    const value = main[k.toLowerCase()];
    const n = typeof value === 'number' ? value : number(value);
    if (n === null) throw new Error(`${slug}: unreadable ${k} "${value}"`);
    statLine[k] = n;
    if (typeof value !== 'number') qualified.push(`${k} ${value}`);
  }

  const name = titleCase(v.name);
  const hireFee = gold(v.cost);
  const upkeep = gold(v.upkeep);
  const rating = number(v.rating);

  const rules = [];
  if (qualified.length) rules.push(`Profile as printed: ${qualified.join(', ')} — see the rules below.`);
  if (main.save) rules.push(`Armour save: ${main.save}.`);
  for (const p of extra) rules.push(`${p.title}: ${profileLine(p)}`);
  const skillText = clean(v.skillText);
  if (skillText) rules.push(`Skills: ${skillText}`);
  for (const r of v.specialRules) rules.push(`${clean(r.rulename)}: ${clean(r.ruleFull)}`);
  if (v.specialSkills.length) {
    rules.push(
      'Special skills (may be chosen instead of a normal skill):\n' +
        v.specialSkills.map((s) => `${clean(s.rulename)}: ${clean(s.ruleFull)}`).join('\n'),
    );
  }
  const admonition = clean(v.admonitions);
  if (admonition) rules.push(`Note: ${admonition}`);

  const entry = {
    id: camel(slug),
    name,
    hireFee,
    upkeep,
    ...(String(hireFee) !== String(v.cost).trim() ? { hireFeeText: v.cost.trim() } : {}),
    ...(String(upkeep) !== String(v.upkeep).trim() ? { upkeepText: v.upkeep.trim() } : {}),
    mayBeHiredBy: clean(v.permissiontext),
    permittedWarbands: permitted(v),
    ratingBonus: rating === null ? '' : `+${rating} points, plus 1 point per Experience point he has.`,
    ...(rating === null ? {} : { ratingFlatBonus: rating }),
    statLine,
    ...racial(slug, v),
    equipment: clean(v.equipment),
    skillLists: SKILL_LISTS.filter((l) => v.skillAccess[l]),
    ...(SPELLS[slug] ?? {}),
    specialRules: rules.join('\n\n'),
    grade: v.grade,
    source: v.source,
    url: `https://mordheimer.net${v.link}`,
  };
  if (rating === null) notes.push(`${name}: no rating in the source — falls back to the generic formula.`);
  if (hireFee === null) notes.push(`${name}: hire fee "${v.cost}" isn't gold — recorded as text, 0 gc charged.`);
  return entry;
}

function permitted(v) {
  return [...new Set(v.permittedWarbands.map(warbandId).filter(Boolean))].sort();
}

function racial(slug, v) {
  const id = RACE_OVERRIDES[slug] ?? RACES[v.race];
  return id ? { racialProfile: id } : {};
}

const hiredSwords = [];
for (const [slug, v] of Object.entries(raw)) {
  if (SKIPPED.has(slug)) continue;
  const id = camel(slug);
  const curated = existingById.get(id);
  if (curated) {
    // Keep the hand-transcribed entry; add only what the source knows and it doesn't.
    hiredSwords.push({
      ...curated,
      permittedWarbands: permitted(v),
      ...(curated.racialProfile ? {} : racial(slug, v)),
      grade: v.grade,
      url: `https://mordheimer.net${v.link}`,
    });
  } else {
    hiredSwords.push(convert(slug, v));
  }
}

const missing = existing.filter((e) => !hiredSwords.some((h) => h.id === e.id));
if (missing.length) throw new Error(`Curated entries not in the source: ${missing.map((m) => m.id).join(', ')}`);
const names = new Set();
for (const h of hiredSwords) {
  if (names.has(h.name)) throw new Error(`Duplicate name: ${h.name}`);
  names.add(h.name);
}

writeFileSync(
  output,
  JSON.stringify(
    {
      schemaVersion: 1,
      source:
        'Core seven transcribed from the Mordheim rulebook (Part 3, Hired Swords, p.106-109); the rest imported from MordheimerData/Sourcedata hiredSwords.json (mordheimer.net) by scripts/import-hired-swords.mjs, markup stripped. Grade is Broheim\'s (core, 1a, 1b, 1c, 2a). The Priest of Morr and Wolf Priest of Ulric are left out: they replace a Hero rather than being hired.',
      hiredSwords,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Wrote ${hiredSwords.length} Hired Swords to ${output}`);
for (const n of notes) console.log(`  ${n}`);

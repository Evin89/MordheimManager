import catalog from '../data/scenarioCatalog.json';

/**
 * Every scenario in the mordheimer.net dataset (101), imported by
 * `scripts/import-scenario-catalog.mjs`. The core-rulebook nine carry the ids
 * `scenarios.json` uses, and keep their hand-coded deployment in the battlefield
 * generator. Everything else gets a *generic* board read off its tags — the
 * dataset has no deployment or terrain data, so the layout is a sensible default
 * for the scenario's type, never the scenario's own setup.
 */
export type CatalogScenario = {
  id: string;
  title: string;
  /** Display name — the title, disambiguated where titles repeat. */
  name: string;
  core: boolean;
  setting: string;
  playerModes: string[];
  source: string;
  author: string;
  description: string | null;
  tags: string[];
  /** The full scenario text on mordheimer.net. */
  url: string;
};

/** The generic setup a non-core scenario is drawn with, from its tags. */
export type GenericLayout = 'traverse' | 'attackerDefender' | 'multiplayer' | 'brawl';

export const SCENARIO_CATALOG = catalog.scenarios as CatalogScenario[];

const byId = new Map(SCENARIO_CATALOG.map((s) => [s.id, s]));

export function getCatalogScenario(id: string): CatalogScenario | undefined {
  return byId.get(id);
}

export const supportsOneVsOne = (s: CatalogScenario) => s.playerModes.includes('1v1');
export const supportsMultiplayer = (s: CatalogScenario) => s.playerModes.includes('Multiplayer');

/** Player counts the board can be drawn for: two for a 1v1-only scenario, three
 * or four for a multiplayer-only one, two to four for one that plays both ways. */
export function playerCountsFor(s: CatalogScenario | undefined): number[] {
  if (!s || !supportsMultiplayer(s)) return [2];
  return supportsOneVsOne(s) ? [2, 3, 4] : [3, 4];
}

/**
 * Which generic layout a scenario's tags point to. First match wins:
 *  - Traverse the Board → one warband crosses to an exit edge, the other blocks
 *    the middle (the Breakthrough pattern)
 *  - Attacker/Defender → defender in the centre, attackers round every edge (the
 *    Defend the Find pattern)
 *  - more than two players → a table corner each
 *  - anything else → opposite long edges (the Skirmish pattern)
 */
export function genericLayoutFor(s: CatalogScenario, players = 2): GenericLayout {
  if (s.tags.includes('Traverse the Board')) return 'traverse';
  if (s.tags.includes('Attacker/Defender')) return 'attackerDefender';
  if (players > 2) return 'multiplayer';
  return 'brawl';
}

export const GENERIC_LAYOUT_LABEL: Record<GenericLayout, string> = {
  traverse: 'cross the board',
  attackerDefender: 'attacker vs defender',
  multiplayer: 'a corner each',
  brawl: 'opposite edges',
};

/** Counters the generic board places, read off the tags. */
export function genericCounters(s: CatalogScenario): { wyrdstone: boolean; objective: 'Treasure' | 'Objective' | null } {
  const t = new Set(s.tags);
  const objective = t.has('Treasure')
    ? 'Treasure'
    : t.has('Objective') || t.has('Objective Building')
      ? 'Objective'
      : null;
  return { wyrdstone: t.has('Wyrdstone Tokens'), objective };
}

/** Tags that change the game but that the board can't draw — listed under the
 * map so the player knows to read the full rules for them. */
const UNDRAWN_TAGS: Record<string, string> = {
  'Hostile NPC': 'hostile NPCs',
  'Escort NPC': 'an NPC to escort',
  'Friendly NPC': 'friendly NPCs',
  'Turn Limit': 'a turn limit',
  Reserves: 'reserves',
  Search: 'searching buildings',
  Hazards: 'hazards',
  'Low Visibility': 'low visibility',
  Underground: 'an underground board',
  Interior: 'an interior board',
  'Objective Building': 'an objective building',
};

export function undrawnRules(s: CatalogScenario): string[] {
  return s.tags.map((t) => UNDRAWN_TAGS[t]).filter((x): x is string => !!x);
}

// ── Picking a scenario ──────────────────────────────────────────────────────

/** Where a scenario was published, coarsely — the picker's groups and its
 * Source filter. The core nine come first. */
export const SOURCE_GROUPS = ['Mordheim rulebook', 'Town Cryer', 'Fanatic', 'Archive Pestilen', 'Other'] as const;
export type SourceGroup = (typeof SOURCE_GROUPS)[number];

export function sourceGroupOf(s: CatalogScenario): SourceGroup {
  if (s.core) return 'Mordheim rulebook';
  if (s.source.startsWith('Town Cryer')) return 'Town Cryer';
  if (s.source.startsWith('Fanatic')) return 'Fanatic';
  if (s.source === 'Archive Pestilen') return 'Archive Pestilen';
  return 'Other';
}

/** Every setting in the catalogue, most-used first (Mordheim, The Empire, …). */
export const SETTINGS = (() => {
  const counts = new Map<string, number>();
  for (const s of SCENARIO_CATALOG) counts.set(s.setting, (counts.get(s.setting) ?? 0) + 1);
  return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)!);
})();

export type ScenarioFilter = {
  /** Settings and sources ticked *off* — stored as exclusions so a setting or
   * source the catalogue gains later shows up ticked, not silently hidden. */
  hiddenSettings: string[];
  hiddenSources: SourceGroup[];
  players: 'any' | '1v1' | 'Multiplayer';
  /** Only scenarios that fit the game being set up (see `fitsGame`). Ignored
   * where there's no game to fit, e.g. the Rules Reference or `/map`. */
  fitsOnly: boolean;
};
export const ANY_FILTER: ScenarioFilter = { hiddenSettings: [], hiddenSources: [], players: 'any', fitsOnly: false };

/** How many of a filter's options are set — for a "Filter (2)" badge. */
export function activeFilterCount(f: ScenarioFilter, withFit = false): number {
  return [f.hiddenSettings.length > 0, f.players !== 'any', f.hiddenSources.length > 0, withFit && f.fitsOnly].filter(Boolean)
    .length;
}

export function matchesFilter(s: CatalogScenario, f: ScenarioFilter): boolean {
  return (
    !f.hiddenSettings.includes(s.setting) &&
    (f.players === 'any' || s.playerModes.includes(f.players)) &&
    !f.hiddenSources.includes(sourceGroupOf(s))
  );
}

/** Scenarios grouped by source, each group sorted by name; empty groups dropped. */
export function groupBySource(list: CatalogScenario[]): { label: SourceGroup; scenarios: CatalogScenario[] }[] {
  return SOURCE_GROUPS.map((label) => ({
    label,
    scenarios: list.filter((s) => sourceGroupOf(s) === label).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.scenarios.length > 0);
}

/**
 * Scenarios written for a particular warband ("Warband - Witch Hunters": Witch
 * Hunters vs any warband). Each tag maps to the warband types that can fill that
 * side. "Chaos" is read broadly as any Chaos-aligned warband.
 */
const WARBAND_TAGS: Record<string, { label: string; types: string[] }> = {
  'Warband - Cult of the Possessed': { label: 'Cult of the Possessed', types: ['cult-of-the-possessed'] },
  'Warband - Witch Hunters': { label: 'Witch Hunters', types: ['witch-hunters'] },
  'Warband - Sisters of Sigmar': { label: 'Sisters of Sigmar', types: ['sisters-of-sigmar'] },
  'Warband - Skaven': { label: 'Skaven', types: ['skaven', 'skaven-of-clan-pestilens'] },
  'Warband - Undead': { label: 'Undead', types: ['undead', 'the-restless-dead'] },
  'Warband - Marienburgers': { label: 'Marienburgers', types: ['marienburgers'] },
  'Warband - Reiklanders': { label: 'Reiklanders', types: ['reiklanders'] },
  'Warband - Orcs': { label: 'Orcs', types: ['orc-mob', 'black-orcs'] },
  'Warband - Chaos': {
    label: 'Chaos',
    types: ['cult-of-the-possessed', 'marauders-of-chaos', 'carnival-of-chaos', 'beastmen-raiders', 'court-of-the-profane-pleasures', 'the-sons-of-hashut'],
  },
};

/** The warbands a scenario is written for, as display labels ([] = any). */
export function writtenFor(s: CatalogScenario): string[] {
  return s.tags.map((t) => WARBAND_TAGS[t]?.label).filter((x): x is string => !!x);
}

/** What's known about the game being set up, for "does this scenario fit?". */
export type GameFit = { players: number; warbandTypes: string[] };

/** Whether a scenario suits the game: it plays at this many warbands, and a
 * warband-specific scenario has one of its warbands on the table. */
export function fitsGame(s: CatalogScenario, fit: GameFit): boolean {
  const modeOk = fit.players > 2 ? supportsMultiplayer(s) : supportsOneVsOne(s);
  if (!modeOk) return false;
  const needed = s.tags.flatMap((t) => WARBAND_TAGS[t]?.types ?? []);
  return needed.length === 0 || needed.some((t) => fit.warbandTypes.includes(t));
}

/** The scenarios a filter leaves — what a picker lists and the suggester draws
 * from. `fit` applies only when the filter asks for it. */
export function filterScenarios(f: ScenarioFilter, fit?: GameFit): CatalogScenario[] {
  return SCENARIO_CATALOG.filter((s) => matchesFilter(s, f) && (!fit || !f.fitsOnly || fitsGame(s, fit)));
}

/** The scenario a picker starts on: Skirmish, unless a remembered filter hides
 * it — then the first one the filter shows (in the picker's own order). */
export function defaultScenarioId(f: ScenarioFilter): string {
  const shown = filterScenarios(f);
  if (shown.some((s) => s.id === 'skirmish')) return 'skirmish';
  return groupBySource(shown)[0]?.scenarios[0]?.id ?? 'skirmish';
}

/** Look a scenario up by the name the battle log stores. */
const byName = new Map(SCENARIO_CATALOG.map((s) => [s.name, s]));
export function getCatalogScenarioByName(name: string): CatalogScenario | undefined {
  return byName.get(name);
}

/** The Rules Reference entry id for each scenario: `scenario-<title>`, or
 * `scenario-<name>` for the second of a repeated title — the ids the reference
 * has always used, so bookmarks and cross-links keep working. */
const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const ruleIds = new Map<string, string>();
{
  const used = new Set<string>();
  for (const s of SCENARIO_CATALOG) {
    let id = `scenario-${slugify(s.title)}`;
    if (used.has(id)) id = `scenario-${slugify(s.name)}`;
    used.add(id);
    ruleIds.set(s.id, id);
  }
}
export function scenarioRuleId(s: CatalogScenario): string {
  return ruleIds.get(s.id) ?? `scenario-${slugify(s.name)}`;
}

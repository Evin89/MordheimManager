import rulesData from '../data/rules.json';
import skillsData from '../data/skills.json';
import injuriesData from '../data/injuries.json';
import scenariosData from '../data/scenarios.json';
import btbObjectivesData from '../data/btb/objectives.json';
import btbDramatisPersonaeData from '../data/btb/dramatisPersonae.json';
import { warbandDefinitions } from '../data/warbandRegistry';
import { getUniqueInjuries } from './injuryLookup';
import {
  BtbDramatisPersonaeData,
  BtbObjectivesData,
  RuleEntry,
  RulesCategoryDef,
  RulesCategoryId,
  RulesData,
  ScenariosData,
  SkillsData,
} from '../data/types';

const typedRules = rulesData as RulesData;
const typedSkills = skillsData as unknown as SkillsData;
const typedScenarios = scenariosData as ScenariosData;
const typedBtbObjectives = btbObjectivesData as BtbObjectivesData;
const typedBtbDramatisPersonae = btbDramatisPersonaeData as BtbDramatisPersonaeData;

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// A handful of skills reference a broader rule this app already has a dedicated entry for.
const SKILL_CROSS_LINKS: Record<string, string[]> = {
  wyrdstoneHunter: ['exploration-wyrdstone'],
  streetwise: ['buying-rare-items'],
  haggle: ['selling-equipment'],
};

// Warbands sourced from the Border Town Burning supplement rather than the core
// rulebook's Warbands chapter (currently just Maneaters) — grouped into the BTB
// chapter instead of "Warbands".
const BTB_WARBAND_IDS = new Set(['maneaters']);

function skillEntries(): RuleEntry[] {
  const entries: RuleEntry[] = [];
  for (const [key, list] of Object.entries(typedSkills.lists)) {
    for (const skill of list.skills) {
      entries.push({
        id: `skill-${key}-${skill.id}`,
        title: skill.name,
        category: 'skills',
        chapter: 'Skills',
        source: `${list.name} skill list — ${typedSkills.source}`,
        body: skill.prerequisite ? `${skill.effect}\n\nPrerequisite: ${skill.prerequisite.text}` : skill.effect,
        relatedIds: SKILL_CROSS_LINKS[skill.id],
      });
    }
  }
  for (const list of Object.values(typedSkills.warbandSpecific)) {
    for (const skill of list.skills) {
      entries.push({
        id: `skill-${slugify(list.name)}-${skill.id}`,
        title: skill.name,
        category: 'skills',
        chapter: 'Skills',
        source: list.name,
        body: skill.prerequisite ? `${skill.effect}\n\nPrerequisite: ${skill.prerequisite.text}` : skill.effect,
      });
    }
  }
  return entries;
}

function injuryEntries(): RuleEntry[] {
  return getUniqueInjuries().map((injury) => ({
    id: `injury-${slugify(injury.name)}`,
    title: injury.name,
    category: 'injuries',
    chapter: 'Serious Injuries',
    source: injuriesData.source,
    body: injury.effect,
  }));
}

function scenarioEntries(): RuleEntry[] {
  return typedScenarios.scenarios.map((s) => ({
    id: `scenario-${s.id}`,
    title: s.name,
    category: 'scenarios',
    chapter: 'Scenarios',
    source: typedScenarios.source,
    body: [
      "This app only tracks this scenario's Experience awards, not its full terrain/deployment/victory-condition text.",
      ...s.awards.map((a) => `${a.amount} — ${a.label}${a.note ? ` (${a.note})` : ''}`),
      `${typedScenarios.universalAward.amount} — ${typedScenarios.universalAward.label} (applies to every scenario)`,
    ].join('\n'),
  }));
}

function warbandSpecialEntries(): RuleEntry[] {
  return warbandDefinitions.map((w) => ({
    id: `warband-${w.id}`,
    title: w.name,
    category: BTB_WARBAND_IDS.has(w.id) ? 'btb' : 'warbandSpecial',
    chapter: BTB_WARBAND_IDS.has(w.id) ? 'Border Town Burning' : 'Warbands',
    source: w.source,
    body: w.specialRules || 'No special rules recorded for this warband.',
  }));
}

function btbObjectiveEntries(): RuleEntry[] {
  return typedBtbObjectives.objectives.map((o) => ({
    id: `btb-objective-${o.id}`,
    title: o.name,
    category: 'btb',
    chapter: 'Border Town Burning',
    source: typedBtbObjectives.source,
    body: [
      o.description,
      `Eligible warbands: ${o.eligibleWarbands}`,
      o.noAllianceWith ? `Cannot ally with: ${o.noAllianceWith}` : '',
      `Progress: ${o.progressRules}`,
      o.achievements.length
        ? `Achievements:\n${o.achievements.map((a) => `${a.cp} CP — ${a.name}: ${a.effect}`).join('\n')}`
        : '',
      o.variantNotes,
    ]
      .filter(Boolean)
      .join('\n\n'),
  }));
}

function btbDramatisPersonaEntries(): RuleEntry[] {
  return typedBtbDramatisPersonae.characters.map((c) => ({
    id: `btb-persona-${c.id}`,
    title: c.name,
    category: 'btb',
    chapter: 'Border Town Burning',
    source: typedBtbDramatisPersonae.source,
    body: [
      `Hire fee: ${c.hireFee} — Upkeep: ${c.upkeep}`,
      `May be hired by: ${c.mayBeHiredBy}`,
      `Rating bonus: ${c.ratingBonus}`,
      `Equipment: ${c.equipment}`,
      c.skills.length ? `Skills: ${c.skills.join(', ')}` : '',
      c.specialRules,
      c.notes,
    ]
      .filter(Boolean)
      .join('\n\n'),
  }));
}

const CHAPTER_ORDER = typedRules.chapterOrder;

function chapterRank(chapter: string): number {
  const index = CHAPTER_ORDER.indexOf(chapter);
  return index === -1 ? CHAPTER_ORDER.length : index;
}

const allEntries: RuleEntry[] = [
  ...typedRules.entries,
  ...skillEntries(),
  ...injuryEntries(),
  ...scenarioEntries(),
  ...warbandSpecialEntries(),
  ...btbObjectiveEntries(),
  ...btbDramatisPersonaEntries(),
].sort((a, b) => chapterRank(a.chapter) - chapterRank(b.chapter));

const entriesById = new Map(allEntries.map((entry) => [entry.id, entry]));

export function getRulesCategories(): RulesCategoryDef[] {
  return typedRules.categories;
}

export function getAllRuleEntries(): RuleEntry[] {
  return allEntries;
}

function getEntriesByChapters(chapters: string[]): RuleEntry[] {
  const set = new Set(chapters);
  return allEntries.filter((entry) => set.has(entry.chapter));
}

// Chapter groupings mirrored into their most relevant app tab, so e.g. the Warbands
// tab can show "how to build a warband" rules right next to the warbands themselves,
// without duplicating the underlying entries — the Rules tab still has everything too.
export function getWarbandsTabRuleEntries(): RuleEntry[] {
  return getEntriesByChapters(['Warbands']);
}

export function getTradingTabRuleEntries(): RuleEntry[] {
  return getEntriesByChapters(['Trading', 'Hired Swords']);
}

export function getCampaignTabRuleEntries(): RuleEntry[] {
  return getEntriesByChapters(['Campaigns', 'Serious Injuries', 'Experience', 'Income', 'Border Town Burning']);
}

export function getSkillsTabRuleEntries(): RuleEntry[] {
  return getEntriesByChapters(['Skills']);
}

export function getRuleEntry(id: string): RuleEntry | undefined {
  return entriesById.get(id);
}

export function getEntriesByCategory(categoryId: RulesCategoryId): RuleEntry[] {
  return allEntries.filter((entry) => entry.category === categoryId);
}

export type RuleSearchResult = {
  entry: RuleEntry;
  score: number;
  snippet: string;
  matchStart: number;
  matchEnd: number;
  matchedInTitle: boolean;
};

/**
 * Lightweight offline search: exact substring in the title ranks highest, an exact
 * substring in the body returns a highlighted snippet, and otherwise falls back to
 * "all query words appear somewhere" so word order/typos in a multi-word query still
 * surface a result. No external search library — this is small enough to hand-roll
 * and keeps the Rules Reference fully bundled/offline.
 */
export function searchRules(query: string): RuleSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: RuleSearchResult[] = [];
  for (const entry of allEntries) {
    const titleLower = entry.title.toLowerCase();
    const bodyLower = entry.body.toLowerCase();

    const titleIdx = titleLower.indexOf(q);
    if (titleIdx !== -1) {
      results.push({
        entry,
        score: 100 - titleIdx,
        snippet: entry.title,
        matchStart: titleIdx,
        matchEnd: titleIdx + q.length,
        matchedInTitle: true,
      });
      continue;
    }

    const bodyIdx = bodyLower.indexOf(q);
    if (bodyIdx !== -1) {
      const snippetStart = Math.max(0, bodyIdx - 40);
      const snippetEnd = Math.min(entry.body.length, bodyIdx + q.length + 60);
      const prefix = snippetStart > 0 ? '…' : '';
      const suffix = snippetEnd < entry.body.length ? '…' : '';
      const snippet = prefix + entry.body.slice(snippetStart, snippetEnd).replace(/\s+/g, ' ') + suffix;
      results.push({
        entry,
        score: 50,
        snippet,
        matchStart: bodyIdx - snippetStart + prefix.length,
        matchEnd: bodyIdx - snippetStart + prefix.length + q.length,
        matchedInTitle: false,
      });
      continue;
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length > 1 && tokens.every((t) => titleLower.includes(t) || bodyLower.includes(t))) {
      results.push({
        entry,
        score: 10,
        snippet: entry.body.slice(0, 100) + (entry.body.length > 100 ? '…' : ''),
        matchStart: 0,
        matchEnd: 0,
        matchedInTitle: false,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

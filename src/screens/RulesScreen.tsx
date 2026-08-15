import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  X,
  ChevronRight,
  ChevronDown,
  Dices,
  Ruler,
  RefreshCw,
  Footprints,
  Crosshair,
  Swords,
  HeartCrack,
  Brain,
  Shield,
  Package,
  Sparkles,
  Users,
  ScrollText,
  Skull,
  Star,
  Zap,
  Map as MapIcon,
  Coins,
  ShoppingBag,
  UserPlus,
  Flame,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import DiceRoller from '../components/DiceRoller';
import { strings } from '../strings';
import { RuleSearchResult, getAllRuleEntries, searchRules } from '../lib/rulesIndex';
import { RuleEntry, RulesCategoryId } from '../data/types';

/**
 * The standalone Rules Reference (§4.8), redesigned for density and inline
 * drill-in.
 *
 * The browse is a chapter accordion: each of the rulebook's ~20 chapters is a
 * row that expands in place to its entries, which link on to `/rules/:id`. A
 * coarse filter above narrows the ~20 chapters to a handful of groups, and the
 * dice roller (§20.1) is embedded here rather than on a page of its own, since
 * this is the reference you have open at the table.
 *
 * The category *data* is real (`rulesIndex`); the layout is what changed. Icons
 * are per chapter. Search stays a flat, highlighted result list — collapsing
 * matches into chapters would hide the very thing you searched for.
 */

/** The coarse groups above the accordion. The rulebook's own eight categories
 * are finer than useful as a top-level filter, so they fold into five, with
 * Magic pulled out of Core because people look for it by name. */
type GroupId = 'all' | 'core' | 'magic' | 'postbattle' | 'trading' | 'warbands';

const GROUPS: { id: GroupId; label: string }[] = [
  { id: 'all', label: strings.rules.allCategories },
  { id: 'core', label: strings.rules.groupCore },
  { id: 'magic', label: strings.rules.groupMagic },
  { id: 'postbattle', label: strings.rules.groupPostBattle },
  { id: 'trading', label: strings.rules.groupTrading },
  { id: 'warbands', label: strings.rules.groupWarbands },
];

/** Which coarse group a chapter belongs to. Magic is special-cased out of Core;
 * everything else follows its category. */
function groupForChapter(chapter: string, category: RulesCategoryId): Exclude<GroupId, 'all'> {
  if (chapter === 'Magic') return 'magic';
  if (category === 'core') return 'core';
  if (category === 'trading') return 'trading';
  if (category === 'postBattle' || category === 'injuries' || category === 'skills') {
    return 'postbattle';
  }
  return 'warbands'; // warbandSpecial, scenarios, btb
}

/** A chapter's icon. The rulebook's chapters are a fixed set, so this is a plain
 * lookup with a book fallback for anything new the data grows. */
const CHAPTER_ICONS: Record<string, LucideIcon> = {
  Characteristics: Ruler,
  'The Turn': RefreshCw,
  Movement: Footprints,
  Shooting: Crosshair,
  'Close Combat': Swords,
  'Wounds & Injuries': HeartCrack,
  'Leadership & Psychology': Brain,
  'Weapons & Armour': Shield,
  'Miscellaneous Equipment': Package,
  Magic: Sparkles,
  Warbands: Users,
  Campaigns: ScrollText,
  'Serious Injuries': Skull,
  Experience: Star,
  Skills: Zap,
  Scenarios: MapIcon,
  Income: Coins,
  Trading: ShoppingBag,
  'Hired Swords': UserPlus,
  'Border Town Burning': Flame,
};

type Chapter = { chapter: string; category: RulesCategoryId; entries: RuleEntry[] };

function Highlighted({ text, start, end }: { text: string; start: number; end: number }) {
  if (start === end) return <>{text}</>;
  return (
    <>
      {text.slice(0, start)}
      <mark className="bg-ember-500 text-ink-950 rounded-sm">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

function firstLine(body: string): string {
  const line = body.split('\n').find((l) => l.trim().length > 0) ?? '';
  return line.length > 100 ? `${line.slice(0, 100)}…` : line;
}

/** One chapter row: icon, name, entry count, and — when open — its entries. */
function ChapterRow({
  chapter,
  open,
  onToggle,
}: {
  chapter: Chapter;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = CHAPTER_ICONS[chapter.chapter] ?? BookOpen;
  return (
    <div className="border-b border-ink-800">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full min-h-[56px] flex items-center gap-3 px-4 text-left transition-colors ${
          open ? 'bg-ink-800' : 'hover:bg-ink-900'
        }`}
      >
        <Icon
          size={20}
          strokeWidth={1.75}
          className={open ? 'text-ember-400' : 'text-ink-faded'}
          aria-hidden="true"
        />
        <span
          className={`flex-1 font-ui font-semibold tracking-wide ${
            open ? 'text-ember-400' : 'text-bone-100'
          }`}
        >
          {chapter.chapter}
        </span>
        <span
          className={`shrink-0 min-w-[26px] text-center rounded-full px-2 py-0.5 font-ui text-sm font-semibold tabular-nums lining-nums ${
            open ? 'bg-ember-500/15 text-ember-400' : 'border border-ink-800 text-ink-faded'
          }`}
        >
          {chapter.entries.length}
        </span>
        {open ? (
          <ChevronDown size={18} className="text-ink-faded shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight size={18} className="text-ink-faded shrink-0" aria-hidden="true" />
        )}
      </button>

      {open && (
        <ul className="pb-2">
          {chapter.entries.map((entry) => (
            <li key={entry.id}>
              <Link
                to={`/rules/${entry.id}`}
                className="flex items-center gap-2 min-h-[44px] py-2 pr-4 pl-[50px] ml-6 border-l-2 border-ember-500/70 hover:bg-ink-900 transition-colors"
              >
                <span className="flex-1 font-body text-bone-100">{entry.title}</span>
                <ChevronRight size={15} className="text-ink-faded shrink-0" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SearchResults({ results }: { results: RuleSearchResult[] }) {
  return (
    <>
      <p className="px-4 pt-3 pb-1 font-ui text-xs text-ink-faded tracking-wide">
        {strings.rules.resultCount(results.length)}
      </p>
      {results.length === 0 && (
        <p className="px-4 py-6 font-body text-bone-300">{strings.rules.noResults}</p>
      )}
      {results.map((result) => (
        <Link
          key={result.entry.id}
          to={`/rules/${result.entry.id}`}
          className="block px-4 py-3 border-b border-ink-800 hover:bg-ink-900 transition-colors"
        >
          <p className="font-body text-bone-100">
            {result.matchedInTitle ? (
              <Highlighted text={result.entry.title} start={result.matchStart} end={result.matchEnd} />
            ) : (
              result.entry.title
            )}
          </p>
          <p className="font-ui text-sm text-bone-300 mt-0.5">
            {result.matchedInTitle ? (
              firstLine(result.entry.body)
            ) : (
              <Highlighted text={result.snippet} start={result.matchStart} end={result.matchEnd} />
            )}
          </p>
        </Link>
      ))}
    </>
  );
}

export default function RulesScreen() {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<GroupId>('all');
  const [diceOpen, setDiceOpen] = useState(false);

  // Chapters in the rulebook's canonical order — `getAllRuleEntries` is already
  // chapter-sorted, so first-seen insertion order is the order to show.
  const chapters = useMemo<Chapter[]>(() => {
    const byChapter = new Map<string, Chapter>();
    for (const entry of getAllRuleEntries()) {
      const existing = byChapter.get(entry.chapter);
      if (existing) existing.entries.push(entry);
      else byChapter.set(entry.chapter, { chapter: entry.chapter, category: entry.category, entries: [entry] });
    }
    return [...byChapter.values()];
  }, []);

  const [openChapter, setOpenChapter] = useState<string | null>(chapters[0]?.chapter ?? null);

  const searchResults = useMemo<RuleSearchResult[] | null>(
    () => (query.trim() ? searchRules(query) : null),
    [query],
  );

  const visibleChapters =
    group === 'all'
      ? chapters
      : chapters.filter((c) => groupForChapter(c.chapter, c.category) === group);

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 pt-6 pb-3">
        <h1 className="text-4xl leading-none text-bone-100">{strings.rules.title}</h1>
      </header>

      {/* Search is the hero: at a table you usually know the word. */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2.5 h-[50px] px-3.5 rounded-xl bg-ink-900 border border-ink-800 focus-within:border-ember-500 transition-colors">
          <Search size={19} className="text-ink-faded shrink-0" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={strings.rules.searchPlaceholder}
            className="flex-1 min-w-0 bg-transparent border-none outline-none font-body text-lg text-bone-100 placeholder:text-ink-faded"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={strings.common.cancel}
              className="shrink-0 flex items-center min-h-[44px] px-1 text-ink-faded"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* The dice roller lives here rather than a page of its own — this is the
          reference open at the table. Collapsed until wanted; the real DiceRoller
          component, the same one the battle screen embeds. */}
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={() => setDiceOpen((v) => !v)}
          aria-expanded={diceOpen}
          className="w-full h-[46px] flex items-center gap-3 px-3.5 rounded-lg bg-ink-900 border border-ink-800"
        >
          <Dices size={19} className="text-ember-400 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-left font-ui font-semibold text-bone-100">
            {strings.rules.diceRoller}
          </span>
          {diceOpen ? (
            <ChevronDown size={18} className="text-ink-faded" aria-hidden="true" />
          ) : (
            <ChevronRight size={18} className="text-ink-faded" aria-hidden="true" />
          )}
        </button>
        {diceOpen && (
          <div className="mt-3 rounded-lg bg-ink-900 border border-ink-800 p-3">
            <DiceRoller compact />
          </div>
        )}
      </div>

      {/* Coarse filter. Hidden while searching, where a flat result list makes a
          category chip meaningless. */}
      {!searchResults && (
        <div className="relative mb-1">
          <div className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroup(g.id)}
                className={`shrink-0 min-h-[36px] px-4 rounded-lg font-ui text-sm font-semibold whitespace-nowrap ${
                  group === g.id
                    ? 'bg-ember-500 text-ink-950'
                    : 'bg-ink-900 border border-ink-800 text-bone-200'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          {/* Edge fade signals the strip scrolls, so a clipped chip doesn't read
              as broken. */}
          <div className="pointer-events-none absolute top-0 right-0 h-full w-7 bg-gradient-to-r from-transparent to-ink-950" />
        </div>
      )}

      <main className="flex-1 border-t border-ink-800">
        {searchResults ? (
          <SearchResults results={searchResults} />
        ) : (
          visibleChapters.map((chapter) => (
            <ChapterRow
              key={chapter.chapter}
              chapter={chapter}
              open={openChapter === chapter.chapter}
              onToggle={() => setOpenChapter(openChapter === chapter.chapter ? null : chapter.chapter)}
            />
          ))
        )}
      </main>
    </div>
  );
}

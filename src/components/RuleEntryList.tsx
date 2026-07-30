import { useState } from 'react';
import { Link } from 'react-router-dom';
import DisclosureChevron from './DisclosureChevron';
import WeaponProfileView from './WeaponProfileView';
import { getCostForRuleId } from '../lib/weaponRules';
import { RuleEntry } from '../data/types';

function firstLine(body: string): string {
  const line = body.split('\n').find((l) => l.trim().length > 0) ?? '';
  return line.length > 100 ? `${line.slice(0, 100)}…` : line;
}

/** An entry whose chapter opts into inline expansion: tap to reveal the full body
 * in place (a dropdown) rather than navigating to its detail page. */
function ExpandableEntry({ entry }: { entry: RuleEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg bg-ink-900 border border-ink-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-2 p-4 text-left hover:border-ink-700"
        aria-expanded={open}
      >
        <span className="text-ember-400 mt-1">
          <DisclosureChevron open={open} />
        </span>
        <span className="min-w-0">
          <span className="block text-bone-100 font-semibold">{entry.title}</span>
          {!open && <span className="block text-bone-300 text-sm mt-1">{firstLine(entry.body)}</span>}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pl-10 space-y-2">
          {entry.weapon ? (
            <WeaponProfileView profile={entry.weapon} {...getCostForRuleId(entry.id)} />
          ) : (
            <p className="text-bone-200 text-sm whitespace-pre-line">{entry.body}</p>
          )}
          <Link to={`/rules/${entry.id}`} className="inline-block text-ember-400 text-xs font-semibold">
            Open full entry →
          </Link>
        </div>
      )}
    </div>
  );
}

/** A chapter-grouped, tappable list of rule entries — shared by the Rules tab and the
 * rules sections embedded in Warbands/Trading/Campaign/Skills. Entries whose chapter is
 * listed in `inlineExpandChapters` expand in place instead of navigating. */
type Chapter = { name: string; entries: RuleEntry[] };

/** Groups consecutive entries by chapter, preserving the rulebook ordering the
 * index already applies. */
function toChapters(entries: RuleEntry[]): Chapter[] {
  const chapters: Chapter[] = [];
  for (const entry of entries) {
    const last = chapters[chapters.length - 1];
    if (last && last.name === entry.chapter) last.entries.push(entry);
    else chapters.push({ name: entry.chapter, entries: [entry] });
  }
  return chapters;
}

export default function RuleEntryList({
  entries,
  emptyMessage,
  inlineExpandChapters,
  collapsible = false,
}: {
  entries: RuleEntry[];
  emptyMessage: string;
  inlineExpandChapters?: string[];
  /**
   * Collapse each chapter to a tappable heading. The full reference runs to
   * hundreds of entries, so scrolling to a chapter costs more than opening it;
   * the short embedded lists in Warbands/Trading/Campaign are better left open.
   */
  collapsible?: boolean;
}) {
  // A single chapter starts open even when collapsible — there's nothing to
  // scroll past, so collapsing it would only add a tap.
  const chapters = toChapters(entries);
  const [openChapters, setOpenChapters] = useState<Set<string>>(
    () => new Set(chapters.length <= 1 ? chapters.map((c) => c.name) : []),
  );

  if (entries.length === 0) {
    return <p className="text-bone-300 text-sm">{emptyMessage}</p>;
  }

  const expandSet = new Set(inlineExpandChapters ?? []);

  function toggleChapter(name: string) {
    setOpenChapters((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function renderEntries(chapterEntries: RuleEntry[]) {
    return chapterEntries.map((entry, i) => {
      const showSubChapterHeading =
        !!entry.subChapter && (i === 0 || entry.subChapter !== chapterEntries[i - 1]?.subChapter);
      return (
        <div key={entry.id}>
          {showSubChapterHeading && (
            <h4 className="text-bone-200 text-xs font-semibold tracking-wide pt-2 pb-1">{entry.subChapter}</h4>
          )}
          {expandSet.has(entry.chapter) ? (
            <ExpandableEntry entry={entry} />
          ) : (
            <Link
              to={`/rules/${entry.id}`}
              className="block rounded-lg bg-ink-900 border border-ink-800 p-4 hover:border-ink-700 transition-colors"
            >
              <p className="text-bone-100 font-semibold">{entry.title}</p>
              <p className="text-bone-300 text-sm mt-1">{firstLine(entry.body)}</p>
            </Link>
          )}
        </div>
      );
    });
  }

  return (
    <div className="space-y-2">
      {chapters.map((chapter) => {
        const open = !collapsible || openChapters.has(chapter.name);
        return (
          <div key={chapter.name} className="space-y-2">
            {collapsible ? (
              <button
                type="button"
                onClick={() => toggleChapter(chapter.name)}
                aria-expanded={open}
                className="w-full flex items-center gap-2 pt-3 pb-1 text-left"
              >
                <span className="text-ember-400">
                  <DisclosureChevron open={open} />
                </span>
                <span className="inline-flex items-center min-h-[44px] text-ember-400 text-xs font-semibold uppercase tracking-wide flex-1">
                  {chapter.name}
                </span>
                <span className="text-bone-400 text-xs tabular-nums">{chapter.entries.length}</span>
              </button>
            ) : (
              <h3 className="inline-flex items-center min-h-[44px] text-ember-400 text-xs font-semibold uppercase tracking-wide pt-3 pb-1">
                {chapter.name}
              </h3>
            )}
            {open && <div className="space-y-2">{renderEntries(chapter.entries)}</div>}
          </div>
        );
      })}
    </div>
  );
}

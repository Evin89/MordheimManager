import { useState } from 'react';
import { Link } from 'react-router-dom';
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
        <span className={`text-ember-400 text-xs mt-1 transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
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
export default function RuleEntryList({
  entries,
  emptyMessage,
  inlineExpandChapters,
}: {
  entries: RuleEntry[];
  emptyMessage: string;
  inlineExpandChapters?: string[];
}) {
  if (entries.length === 0) {
    return <p className="text-bone-300 text-sm">{emptyMessage}</p>;
  }

  const expandSet = new Set(inlineExpandChapters ?? []);

  return (
    <div className="space-y-2">
      {entries.map((entry, i) => {
        const showChapterHeading = entry.chapter !== entries[i - 1]?.chapter;
        const showSubChapterHeading =
          !!entry.subChapter && (showChapterHeading || entry.subChapter !== entries[i - 1]?.subChapter);
        return (
          <div key={entry.id}>
            {showChapterHeading && (
              <h3 className="text-ember-400 text-xs font-semibold uppercase tracking-wide pt-3 pb-1">
                {entry.chapter}
              </h3>
            )}
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
      })}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { RuleEntry } from '../data/types';

function firstLine(body: string): string {
  const line = body.split('\n').find((l) => l.trim().length > 0) ?? '';
  return line.length > 100 ? `${line.slice(0, 100)}…` : line;
}

/** A chapter-grouped, tappable list of rule entries — shared by the Rules tab and the
 * rules sections embedded in Warbands/Trading/Campaign/Skills. */
export default function RuleEntryList({ entries, emptyMessage }: { entries: RuleEntry[]; emptyMessage: string }) {
  if (entries.length === 0) {
    return <p className="text-bone-300 text-sm">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, i) => {
        const showChapterHeading = entry.chapter !== entries[i - 1]?.chapter;
        return (
          <div key={entry.id}>
            {showChapterHeading && (
              <h3 className="text-ember-400 text-xs font-semibold uppercase tracking-wide pt-3 pb-1">
                {entry.chapter}
              </h3>
            )}
            <Link
              to={`/rules/${entry.id}`}
              className="block rounded-lg bg-ink-900 border border-ink-800 p-4 hover:border-ink-700 transition-colors"
            >
              <p className="text-bone-100 font-semibold">{entry.title}</p>
              <p className="text-bone-300 text-sm mt-1">{firstLine(entry.body)}</p>
            </Link>
          </div>
        );
      })}
    </div>
  );
}

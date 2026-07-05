import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { strings } from '../strings';
import { RuleSearchResult, getAllRuleEntries, getEntriesByCategory, getRulesCategories, searchRules } from '../lib/rulesIndex';
import { RulesCategoryId } from '../data/types';

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

export default function RulesScreen() {
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<RulesCategoryId | 'all'>('all');
  const categories = getRulesCategories();

  const searchResults: RuleSearchResult[] | null = useMemo(() => {
    if (!query.trim()) return null;
    return searchRules(query);
  }, [query]);

  const browsedEntries = useMemo(() => {
    if (categoryId === 'all') return getAllRuleEntries();
    return getEntriesByCategory(categoryId);
  }, [categoryId]);

  return (
    <div className="min-h-full flex flex-col">
      <header className="px-4 pt-6 pb-4 border-b border-ink-800">
        <h1 className="text-2xl font-bold text-bone-100 tracking-wide">{strings.rules.title}</h1>
      </header>

      <div className="px-4 pt-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={strings.rules.searchPlaceholder}
          className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 text-bone-100 focus:outline-none focus:border-ember-500"
        />
      </div>

      {!searchResults && (
        <div className="px-4 pt-3 flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setCategoryId('all')}
            className={`shrink-0 min-h-[36px] px-3 rounded-md border text-xs font-semibold ${
              categoryId === 'all' ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
            }`}
          >
            {strings.rules.allCategories}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryId(cat.id)}
              className={`shrink-0 min-h-[36px] px-3 rounded-md border text-xs font-semibold ${
                categoryId === cat.id ? 'bg-ember-500 text-ink-950 border-ember-500' : 'border-ink-700 text-bone-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      <main className="flex-1 px-4 py-4 space-y-2">
        {searchResults ? (
          <>
            <p className="text-bone-300 text-xs">{strings.rules.resultCount(searchResults.length)}</p>
            {searchResults.length === 0 && <p className="text-bone-300 text-sm">{strings.rules.noResults}</p>}
            {searchResults.map((result) => (
              <Link
                key={result.entry.id}
                to={`/rules/${result.entry.id}`}
                className="block rounded-lg bg-ink-900 border border-ink-800 p-4 hover:border-ink-700 transition-colors"
              >
                <p className="text-bone-100 font-semibold">
                  {result.matchedInTitle ? (
                    <Highlighted text={result.entry.title} start={result.matchStart} end={result.matchEnd} />
                  ) : (
                    result.entry.title
                  )}
                </p>
                <p className="text-bone-300 text-sm mt-1">
                  {result.matchedInTitle ? (
                    firstLine(result.entry.body)
                  ) : (
                    <Highlighted text={result.snippet} start={result.matchStart} end={result.matchEnd} />
                  )}
                </p>
              </Link>
            ))}
          </>
        ) : (
          <>
            {browsedEntries.length === 0 && (
              <p className="text-bone-300 text-sm">{strings.rules.noEntriesInCategory}</p>
            )}
            {browsedEntries.map((entry) => (
              <Link
                key={entry.id}
                to={`/rules/${entry.id}`}
                className="block rounded-lg bg-ink-900 border border-ink-800 p-4 hover:border-ink-700 transition-colors"
              >
                <p className="text-bone-100 font-semibold">{entry.title}</p>
                <p className="text-bone-300 text-sm mt-1">{firstLine(entry.body)}</p>
              </Link>
            ))}
          </>
        )}
      </main>
    </div>
  );
}

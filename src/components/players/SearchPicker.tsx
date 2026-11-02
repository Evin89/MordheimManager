import { useMemo, useState } from 'react';
import DisclosureChevron from '../DisclosureChevron';

export type PickerOption = { id: string; label: string };

/**
 * A small search-led picker for long lists (country, warband type).
 *
 * Same shape as the warband-type picker on New Warband (§4.1): a button that
 * opens to a search field over a scrollable list. A native `<select>` of 250
 * countries is a wall of names on a phone with no way to type "ned".
 */
export default function SearchPicker({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  noMatches,
  id,
}: {
  value: string;
  onChange: (id: string) => void;
  options: PickerOption[];
  placeholder: string;
  searchPlaceholder: string;
  /** Label of the "none" choice at the top of the list. */
  emptyLabel: string;
  noMatches: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.id === value);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [query, options]);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setQuery('');
  }

  return (
    <div>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full min-h-[48px] rounded-md bg-ink-900 border border-ink-700 px-3 flex items-center justify-between gap-3 text-left focus:outline-none focus:border-ember-500"
      >
        <span className={`truncate ${selected ? 'text-bone-100' : 'text-ink-faded'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="text-bone-300">
          <DisclosureChevron open={open} className="h-4 w-4" />
        </span>
      </button>

      {open && (
        <div className="mt-1 rounded-md border border-ink-700 bg-ink-900 overflow-hidden">
          <div className="p-2 border-b border-ink-800">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full min-h-[44px] rounded-md bg-ink-950 border border-ink-700 px-3 text-bone-100 placeholder:text-ink-faded focus:outline-none focus:border-ember-500"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {!query && (
              <li>
                <button
                  type="button"
                  onClick={() => choose('')}
                  className="w-full min-h-[44px] px-3 py-2 text-left text-bone-300 italic hover:bg-ink-800/60"
                >
                  {emptyLabel}
                </button>
              </li>
            )}
            {results.length === 0 && <li className="px-3 py-3 text-bone-300 text-sm">{noMatches}</li>}
            {results.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => choose(o.id)}
                  className={`w-full min-h-[44px] px-3 py-2 text-left text-sm font-semibold ${
                    o.id === value ? 'bg-ink-800 text-ember-400' : 'text-bone-100 hover:bg-ink-800/60'
                  }`}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

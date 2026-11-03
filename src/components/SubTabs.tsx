import { Link } from 'react-router-dom';

export type SubTab = {
  label: string;
  active: boolean;
  /** A sibling route (Campaigns · Players, a campaign's tabs)… */
  to?: string;
  /** …or in-page state (Warbands' Mine · Gallery · Rules, the Trading Post). */
  onSelect?: () => void;
};

const BASE =
  'flex-1 min-w-0 min-h-[40px] inline-flex items-center justify-center rounded-md border px-1 text-xs sm:text-sm font-semibold truncate transition-colors';
const ON = 'bg-ember-500 text-on-accent border-ember-500';
const OFF = 'border-ink-700 text-bone-200 hover:bg-ink-800';

/**
 * A screen's sub-tabs (§40.3) — one look and one place for all of them: inside
 * the header, under the title, as `TabHeader` / `BackHeader` children. Warbands,
 * Campaigns, a campaign and the Trading Post each spelled their own row
 * before, at two sizes and in two places (inside and below the header).
 *
 * Route tabs replace history, so Back leaves the section rather than stepping
 * through every tab looked at.
 */
export default function SubTabs({ items }: { items: SubTab[] }) {
  return (
    <nav className="flex gap-2">
      {items.map((item) =>
        item.to ? (
          <Link
            key={item.label}
            to={item.to}
            replace
            aria-current={item.active ? 'page' : undefined}
            className={`${BASE} ${item.active ? ON : OFF}`}
          >
            {item.label}
          </Link>
        ) : (
          <button
            key={item.label}
            type="button"
            onClick={item.onSelect}
            aria-pressed={item.active}
            className={`${BASE} ${item.active ? ON : OFF}`}
          >
            {item.label}
          </button>
        ),
      )}
    </nav>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminUsersQuery } from '../../hooks/useIssues';
import type { AdminUserRow } from '../../api/issues';
import { strings } from '../../strings';
import { ago } from './shared';

/**
 * §4.9.4 — who is using the app, and how much. Counts per player; no email and
 * no roster contents (§4.9.7). One row per person, columns you scan down — and
 * sort by: every header is a sort control.
 */

type SortKey = 'player' | 'warbands' | 'campaigns' | 'battles' | 'new' | 'edits' | 'seen' | 'active';
type SortDir = 'asc' | 'desc';

type Column = {
  key: SortKey;
  label: string;
  /** The name column is a row header, left-aligned; the counts are right-aligned. */
  align: 'left' | 'right';
  /** Text sorts A→Z first; numbers and dates sort highest/newest first. */
  defaultDir: SortDir;
  title?: string;
};

const COLUMNS: Column[] = [
  { key: 'player', label: 'Player', align: 'left', defaultDir: 'asc' },
  { key: 'warbands', label: 'Warbands', align: 'right', defaultDir: 'desc' },
  { key: 'campaigns', label: 'Campaigns', align: 'right', defaultDir: 'desc' },
  { key: 'battles', label: 'Battles', align: 'right', defaultDir: 'desc' },
  { key: 'new', label: 'New 30d', align: 'right', defaultDir: 'desc', title: 'Warbands created in the last 30 days' },
  { key: 'edits', label: 'Edits 30d', align: 'right', defaultDir: 'desc', title: 'Roster edits in the last 30 days (since edit tracking began)' },
  {
    key: 'seen',
    label: 'Last seen',
    align: 'right',
    defaultDir: 'desc',
    title: 'Latest of: opening the app, a warband edit, a battle report, or signing up. The same value behind the Overview’s “Online today” and “Active · 7d”.',
  },
  {
    key: 'active',
    label: 'Last edit',
    align: 'right',
    defaultDir: 'desc',
    title: 'Most recent warband edit — not presence. See “Last seen” and the Overview’s “Online today” for who has opened the app.',
  },
];

/** Ascending comparison for one key; the caller applies the direction. Nulls in
 * "last edit" always sort to the bottom, whichever way the column is pointed.
 * "Last seen" has no nulls — signup is its floor (§26.1). */
function compareAsc(a: AdminUserRow, b: AdminUserRow, key: SortKey): number {
  switch (key) {
    case 'player':
      return (a.displayName || '').localeCompare(b.displayName || '', undefined, { sensitivity: 'base' });
    case 'warbands':
      return a.warbands - b.warbands;
    case 'campaigns':
      return a.campaigns - b.campaigns;
    case 'battles':
      return a.battles - b.battles;
    case 'new':
      return a.newWarbands30d - b.newWarbands30d;
    case 'edits':
      return a.edits30d - b.edits30d;
    case 'seen':
      return Date.parse(a.lastSeen) - Date.parse(b.lastSeen);
    case 'active': {
      const av = a.lastActive ? Date.parse(a.lastActive) : null;
      const bv = b.lastActive ? Date.parse(b.lastActive) : null;
      if (av === null && bv === null) return 0;
      if (av === null) return 1; // handled before the direction flip, so nulls stay last
      if (bv === null) return -1;
      return av - bv;
    }
  }
}

/** ▲ / ▼ when this column drives the sort; a faint ↕ otherwise, to signal it can. */
function SortCaret({ state }: { state: SortDir | null }) {
  return (
    <span aria-hidden className={state ? 'text-bone-200' : 'text-bone-500/60'}>
      {state === 'asc' ? '▲' : state === 'desc' ? '▼' : '↕'}
    </span>
  );
}

export default function AdminPlayersScreen() {
  const { data, error, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminUsersQuery();
  const users = data ? data.pages.flatMap((p) => p.rows) : undefined;

  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  const sorted = useMemo(() => {
    if (!users || !sort) return users;
    const dir = sort.dir === 'asc' ? 1 : -1;
    // The null handling in `active` must not be flipped by direction, so it lives
    // inside compareAsc as ±1 and we only apply `dir` to real orderings.
    return [...users].sort((a, b) => {
      const primary = compareAsc(a, b, sort.key);
      if (primary !== 0) {
        const nullPinned = sort.key === 'active' && (a.lastActive === null || b.lastActive === null);
        return nullPinned ? primary : primary * dir;
      }
      // Stable tiebreak so equal rows don't shuffle between renders.
      return a.userId.localeCompare(b.userId);
    });
  }, [users, sort]);

  function onSort(col: Column) {
    setSort((prev) =>
      prev?.key === col.key
        ? { key: col.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key: col.key, dir: col.defaultDir },
    );
  }

  if (isError) {
    return (
      <div className="space-y-1">
        <p className="text-blood-500 text-sm">Could not load players.</p>
        <p className="font-ui text-xs text-bone-400">
          {(error as Error).message} — if this mentions <code>admin_user_overview</code>, migration 0007 has
          not been applied yet.
        </p>
      </div>
    );
  }
  if (!sorted) return <p className="text-bone-400 text-sm">{strings.common.loading}</p>;
  if (sorted.length === 0) return <p className="text-bone-400 text-sm">No players yet.</p>;

  return (
    <section className="space-y-2">
      <h2 className="text-bone-100 font-semibold">Players</h2>
      {/* §26.2 — on a phone the table scrolls sideways, so the player column and
          the header row stick (both inside this one scroll container) and every
          row stays attributable. Opaque ink-900 backgrounds so scrolled cells
          never show through; a plain 1px rule, no shadow fade. The table is
          border-separate because collapsed borders don't travel with a sticky
          cell — so the row rules live on the cells, not the <tr>. */}
      <div className="max-h-[75vh] overflow-auto rounded-lg border border-ink-800 bg-ink-900">
        <table className="w-full border-separate border-spacing-0 text-sm tabular-nums lining-nums">
          <thead>
            <tr>
              {COLUMNS.map((col) => {
                const state = sort?.key === col.key ? sort.dir : null;
                const first = col.key === 'player';
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={state === 'asc' ? 'ascending' : state === 'desc' ? 'descending' : 'none'}
                    className={`${col.align === 'left' ? 'text-left px-3' : 'text-right px-2'} sticky top-0 bg-ink-900 border-b border-ink-700 font-ui text-xs uppercase tracking-wide text-bone-400 py-0 whitespace-nowrap ${
                      first ? 'left-0 z-30 border-r' : 'z-20'
                    }`}
                    title={col.title}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(col)}
                      className={`flex w-full min-h-[40px] items-center gap-1 py-2 uppercase tracking-wide ${
                        col.align === 'left' ? 'justify-start' : 'justify-end'
                      } ${state ? 'text-bone-100' : 'text-bone-400'} hover:text-bone-100`}
                    >
                      <span>{col.label}</span>
                      <SortCaret state={state} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="[&>tr>*]:border-b [&>tr>*]:border-ink-800 [&>tr:last-child>*]:border-b-0">
            {sorted.map((u) => (
              <tr key={u.userId}>
                <th scope="row" className="sticky left-0 z-10 bg-ink-900 border-r !border-r-ink-700 text-left font-normal px-3 py-2">
                  {/* Capped at ~40% of the viewport: long names wrap, never widen it. */}
                  <div className="max-w-[40vw] break-words">
                    <Link
                      to={`/admin/players/${u.userId}`}
                      className="text-ember-400 font-semibold underline-offset-2 hover:underline"
                    >
                      {u.displayName || 'Unnamed'}
                    </Link>
                    {u.isAdmin && (
                      <span className="ml-2 rounded border border-ink-700 px-1.5 py-0.5 font-ui text-[11px] uppercase tracking-wide text-bone-400">
                        admin
                      </span>
                    )}
                    {/* §26.3.1 — can't sign in until the emailed link is clicked. */}
                    {!u.emailConfirmed && (
                      <span
                        title="Email never confirmed — this account can't sign in"
                        className="ml-2 rounded border border-blood-600 px-1.5 py-0.5 font-ui text-[11px] uppercase tracking-wide text-blood-500"
                      >
                        unconfirmed
                      </span>
                    )}
                    <span className="block font-ui text-xs text-bone-400">joined {ago(u.createdAt)}</span>
                  </div>
                </th>
                <td className="text-right px-2 py-2 text-bone-100">
                  {u.warbands}
                  {u.publicWarbands > 0 && (
                    <span className="font-ui text-xs text-bone-400"> ({u.publicWarbands} public)</span>
                  )}
                </td>
                <td className="text-right px-2 py-2 text-bone-100">{u.campaigns}</td>
                <td className="text-right px-2 py-2 text-bone-100">{u.battles}</td>
                <td className="text-right px-2 py-2 text-bone-100">
                  {u.newWarbands30d > 0 ? u.newWarbands30d : <span className="text-bone-400">—</span>}
                </td>
                <td className="text-right px-2 py-2 text-bone-100">
                  {u.edits30d > 0 ? u.edits30d : <span className="text-bone-400">—</span>}
                </td>
                <td className="text-right px-2 py-2 whitespace-nowrap text-bone-100">{ago(u.lastSeen)}</td>
                <td className="text-right px-3 py-2 text-bone-400 whitespace-nowrap">{ago(u.lastActive)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasNextPage && (
        <>
          {sort && (
            <p className="font-ui text-xs text-bone-400">
              Sorting the {sorted.length} loaded players — load more to include the rest.
            </p>
          )}
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full min-h-[48px] rounded-md border border-ink-700 font-ui text-sm font-semibold text-bone-100 disabled:opacity-50"
          >
            {isFetchingNextPage ? strings.common.loading : strings.warbandList.publicLoadMore}
          </button>
        </>
      )}
    </section>
  );
}

import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import BackHeader from '../components/BackHeader';
import DisclosureChevron from './../components/DisclosureChevron';
import { IssueReport, IssueStatus } from '../api/issues';
import {
  useAdminStatsQuery,
  useAdminUsersQuery,
  useIsAdminQuery,
  useIssueReportsQuery,
  useUpdateIssueStatusMutation,
} from '../hooks/useIssues';
import { getWarbandTypeName } from '../data/warbandRegistry';
import { strings } from '../strings';

const FILTERS: { id: IssueStatus | 'all'; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'triaged', label: 'Triaged' },
  { id: 'closed', label: 'Closed' },
  { id: 'all', label: 'All' },
];

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-ink/25 bg-parchment-raised px-3 py-2">
      <p className="font-ui text-xs uppercase tracking-wide text-ink-faded">{label}</p>
      <p className="font-heading text-2xl tabular-nums lining-nums text-ink">{value}</p>
    </div>
  );
}

/** A 30-day signup series as plain bars. A chart library for one sparkline
 * would be the largest dependency in the app. */
function Signups({ data }: { data: { day: string; count: number }[] }) {
  const peak = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <p className="font-ui text-xs uppercase tracking-wide text-ink-faded mb-2">
        Signups — last 30 days
      </p>
      <div className="flex items-end gap-[2px] h-16" role="img" aria-label={`${data.reduce((a, d) => a + d.count, 0)} signups in the last 30 days`}>
        {data.map((d) => (
          <div
            key={d.day}
            title={`${d.day}: ${d.count}`}
            style={{ height: `${Math.max(2, (d.count / peak) * 100)}%` }}
            className="flex-1 rounded-sm bg-blood/70"
          />
        ))}
      </div>
    </div>
  );
}

function ReportRow({
  report,
  onStatus,
}: {
  report: IssueReport;
  onStatus: (status: IssueStatus) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-ink/15 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full min-h-[44px] flex items-start gap-2 py-2 text-left"
      >
        <span className="pt-1">
          <DisclosureChevron open={open} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-ink">{report.message}</span>
          <span className="block font-ui text-xs text-ink-faded">
            {report.path} · {new Date(report.createdAt).toLocaleString()}
          </span>
        </span>
        <span className="shrink-0 rounded border border-ink/40 px-1.5 py-0.5 font-ui text-xs uppercase tracking-wide text-ink-faded">
          {report.status}
        </span>
      </button>

      {open && (
        <div className="pb-3 pl-6 pr-1 space-y-3">
          <dl className="font-ui text-xs text-ink-faded space-y-1">
            <div>
              <dt className="inline font-semibold">Build: </dt>
              <dd className="inline">{report.appVersion || '—'}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Reporter: </dt>
              {/* Anonymous is a real, expected case, not a missing value. */}
              <dd className="inline">{report.reporterId ?? 'anonymous'}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Agent: </dt>
              <dd className="inline break-all">{report.userAgent || '—'}</dd>
            </div>
          </dl>

          {Object.keys(report.context).length > 0 && (
            <pre className="overflow-x-auto rounded-md border border-ink/25 bg-parchment p-2 font-ui text-xs text-ink">
              {JSON.stringify(report.context, null, 2)}
            </pre>
          )}

          <div className="flex flex-wrap gap-2">
            {(['open', 'triaged', 'closed'] as IssueStatus[])
              .filter((s) => s !== report.status)
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onStatus(s)}
                  className="min-h-[44px] px-3 rounded-md border border-ink/40 font-ui text-sm font-semibold text-ink"
                >
                  Mark {s}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** How long ago, in the coarsest useful unit. An exact timestamp is noise when
 * the question is only "is this person still playing". */
function ago(iso: string | null): string {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/**
 * Who is using the app, and how much.
 *
 * Counts per player, no email and no roster contents — see migration 0007 for
 * what is deliberately excluded. Read as a table because that is what it is:
 * one row per person, columns you scan down.
 */
function UserOverview() {
  const { data, error, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAdminUsersQuery();
  const users = data ? data.pages.flatMap((p) => p.rows) : undefined;

  // Names the likely cause rather than spinning forever. This section depends on
  // a function added in migration 0007, so "works locally, empty in production"
  // is the predictable failure until that has been pushed.
  if (isError) {
    return (
      <div className="space-y-1">
        <p className="text-blood text-sm">Could not load players.</p>
        <p className="font-ui text-xs text-ink-faded">
          {(error as Error).message} — if this mentions <code>admin_user_overview</code>, migration
          0007 has not been applied yet.
        </p>
      </div>
    );
  }

  if (!users) return <p className="text-ink-faded text-sm">{strings.common.loading}</p>;
  if (users.length === 0) return <p className="text-ink-faded text-sm">No players yet.</p>;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border-2 border-ink bg-parchment-raised">
        <table className="w-full text-sm tabular-nums lining-nums">
          <thead>
            <tr className="border-b border-ink/40">
              <th scope="col" className="text-left font-ui text-xs uppercase tracking-wide text-ink-faded px-3 py-2">
                Player
              </th>
              <th scope="col" className="text-right font-ui text-xs uppercase tracking-wide text-ink-faded px-2 py-2">
                Warbands
              </th>
              <th scope="col" className="text-right font-ui text-xs uppercase tracking-wide text-ink-faded px-2 py-2">
                Campaigns
              </th>
              <th scope="col" className="text-right font-ui text-xs uppercase tracking-wide text-ink-faded px-2 py-2">
                Battles
              </th>
              <th scope="col" className="text-right font-ui text-xs uppercase tracking-wide text-ink-faded px-3 py-2 whitespace-nowrap">
                Last active
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userId} className="border-b border-ink/15 last:border-b-0">
                <th scope="row" className="text-left font-normal px-3 py-2">
                  <span className="text-ink">{u.displayName || 'Unnamed'}</span>
                  {u.isAdmin && (
                    <span className="ml-2 rounded border border-ink/40 px-1.5 py-0.5 font-ui text-[11px] uppercase tracking-wide text-ink-faded">
                      admin
                    </span>
                  )}
                  <span className="block font-ui text-xs text-ink-faded">
                    joined {ago(u.createdAt)}
                  </span>
                </th>
                <td className="text-right px-2 py-2 text-ink">
                  {u.warbands}
                  {u.publicWarbands > 0 && (
                    <span className="font-ui text-xs text-ink-faded"> ({u.publicWarbands} public)</span>
                  )}
                </td>
                <td className="text-right px-2 py-2 text-ink">{u.campaigns}</td>
                <td className="text-right px-2 py-2 text-ink">{u.battles}</td>
                <td className="text-right px-3 py-2 text-ink-faded whitespace-nowrap">
                  {ago(u.lastActive)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasNextPage && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full min-h-[48px] rounded-md border border-ink/40 font-ui text-sm font-semibold text-ink disabled:opacity-50"
        >
          {isFetchingNextPage ? strings.common.loading : strings.warbandList.publicLoadMore}
        </button>
      )}
    </div>
  );
}

/**
 * The admin view: the issue inbox and aggregate statistics.
 *
 * Aggregates only, by decision — no row access to anyone's warband, and
 * objectives are untouched. `admin_stats()` counts in the database precisely so
 * the numbers don't require handing the client the rows behind them.
 *
 * Hiding this route is not the security boundary; the database policies are.
 * The redirect below is so a non-admin doesn't sit on a screen of errors.
 */
export default function AdminScreen() {
  const { data: isAdmin, isPending } = useIsAdminQuery();
  const [filter, setFilter] = useState<IssueStatus | 'all'>('open');
  const {
    data: reportPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useIssueReportsQuery(filter);
  const reports = reportPages ? reportPages.pages.flatMap((p) => p.rows) : undefined;
  const { data: stats } = useAdminStatsQuery();
  const setStatus = useUpdateIssueStatusMutation();

  if (isPending) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-ink-faded">{strings.common.loading}</p>
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title="Admin" />

      <main className="flex-1 px-4 py-4 space-y-6">
        <section className="space-y-3">
          <h2 className="text-ink font-semibold">Overview</h2>
          {!stats ? (
            <p className="text-ink-faded text-sm">{strings.common.loading}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Stat label="Players" value={stats.users} />
                <Stat label="Warbands" value={stats.warbands} />
                <Stat label="Public" value={stats.public_warbands} />
                <Stat label="Campaigns" value={stats.campaigns} />
                <Stat label="Battles" value={stats.battles} />
                <Stat label="Open issues" value={stats.open_issues} />
              </div>

              <Signups data={stats.signups} />

              <div>
                <p className="font-ui text-xs uppercase tracking-wide text-ink-faded mb-2">
                  Warbands by type
                </p>
                <ul className="space-y-1">
                  {stats.warband_types.slice(0, 10).map((row) => (
                    <li key={row.type} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {getWarbandTypeName(row.type)}
                      </span>
                      <span
                        className="h-2 rounded-sm bg-blood/70"
                        style={{
                          width: `${(row.count / Math.max(...stats.warband_types.map((t) => t.count))) * 40}%`,
                        }}
                      />
                      <span className="w-8 text-right font-ui text-sm tabular-nums lining-nums text-ink-faded">
                        {row.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-ink font-semibold">Players</h2>
          <UserOverview />
        </section>

        <section className="space-y-3">
          <h2 className="text-ink font-semibold">Reported issues</h2>

          <div className="flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`flex-1 min-h-[44px] rounded-md border font-ui text-sm font-semibold ${
                  filter === f.id
                    ? 'bg-blood text-on-accent border-blood'
                    : 'border-ink/40 text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {!reports ? (
            <p className="text-ink-faded text-sm">{strings.common.loading}</p>
          ) : reports.length === 0 ? (
            <p className="text-ink-faded text-sm">Nothing here.</p>
          ) : (
            <div className="rounded-lg border-2 border-ink bg-parchment-raised px-3">
              {reports.map((report) => (
                <ReportRow
                  key={report.id}
                  report={report}
                  onStatus={(status) => setStatus(report.id, status)}
                />
              ))}
            </div>
          )}

          {hasNextPage && (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full min-h-[48px] rounded-md border border-ink/40 font-ui text-sm font-semibold text-ink disabled:opacity-50"
            >
              {isFetchingNextPage ? strings.common.loading : strings.warbandList.publicLoadMore}
            </button>
          )}
        </section>
      </main>
    </div>
  );
}

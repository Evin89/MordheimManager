import { useState } from 'react';
import DisclosureChevron from '../../components/DisclosureChevron';
import { IssueReport, IssueStatus } from '../../api/issues';
import { useIssueReportsQuery, useUpdateIssueStatusMutation } from '../../hooks/useIssues';
import { strings } from '../../strings';

const FILTERS: { id: IssueStatus | 'all'; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'triaged', label: 'Triaged' },
  { id: 'closed', label: 'Closed' },
  { id: 'all', label: 'All' },
];

function ReportRow({
  report,
  onStatus,
}: {
  report: IssueReport;
  onStatus: (status: IssueStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-ink-800 last:border-b-0">
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
          <span className="block text-bone-100">{report.message}</span>
          <span className="block font-ui text-xs text-bone-400">
            {report.path} · {new Date(report.createdAt).toLocaleString()}
          </span>
        </span>
        <span className="shrink-0 rounded border border-ink-700 px-1.5 py-0.5 font-ui text-xs uppercase tracking-wide text-bone-400">
          {report.status}
        </span>
      </button>

      {open && (
        <div className="pb-3 pl-6 pr-1 space-y-3">
          <dl className="font-ui text-xs text-bone-400 space-y-1">
            <div>
              <dt className="inline font-semibold">Build: </dt>
              <dd className="inline">{report.appVersion || '—'}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Reporter: </dt>
              <dd className="inline">{report.reporterId ?? 'anonymous'}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Agent: </dt>
              <dd className="inline break-all">{report.userAgent || '—'}</dd>
            </div>
          </dl>

          {Object.keys(report.context).length > 0 && (
            <pre className="overflow-x-auto rounded-md border border-ink-800 bg-ink-950 p-2 font-ui text-xs text-bone-100">
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
                  className="min-h-[44px] px-3 rounded-md border border-ink-700 font-ui text-sm font-semibold text-bone-100"
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

/** §4.9.3 — the issue inbox, now its own route fetching only its own rows. */
export default function AdminIssuesScreen() {
  const [filter, setFilter] = useState<IssueStatus | 'all'>('open');
  const { data: reportPages, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useIssueReportsQuery(filter);
  const reports = reportPages ? reportPages.pages.flatMap((p) => p.rows) : undefined;
  const setStatus = useUpdateIssueStatusMutation();

  return (
    <section className="space-y-3">
      <h2 className="text-bone-100 font-semibold">Reported issues</h2>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`flex-1 min-h-[44px] rounded-md border font-ui text-sm font-semibold ${
              filter === f.id ? 'bg-ember-500 text-on-accent border-ember-500' : 'border-ink-700 text-bone-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!reports ? (
        <p className="text-bone-400 text-sm">{strings.common.loading}</p>
      ) : reports.length === 0 ? (
        <p className="text-bone-400 text-sm">Nothing here.</p>
      ) : (
        <div className="rounded-lg border border-ink-800 bg-ink-900 px-3">
          {reports.map((report) => (
            <ReportRow key={report.id} report={report} onStatus={(status) => setStatus(report.id, status)} />
          ))}
        </div>
      )}

      {hasNextPage && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="w-full min-h-[48px] rounded-md border border-ink-700 font-ui text-sm font-semibold text-bone-100 disabled:opacity-50"
        >
          {isFetchingNextPage ? strings.common.loading : strings.warbandList.publicLoadMore}
        </button>
      )}
    </section>
  );
}

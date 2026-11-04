import { useEffect, useRef } from 'react';
import BackHeader from '../../components/BackHeader';
import { MyIssueReport } from '../../api/issues';
import { useMarkRepliesReadMutation, useMyIssueReportsQuery } from '../../hooks/useIssues';
import { strings } from '../../strings';

const s = strings.myReports;

function date(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function ReportCard({ report }: { report: MyIssueReport }) {
  return (
    <article className="rounded-lg bg-ink-900 border border-ink-800 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <p className="flex-1 min-w-0 text-bone-100 whitespace-pre-line">{report.message}</p>
        <span className="shrink-0 rounded border border-ink-700 px-1.5 py-0.5 font-ui text-xs uppercase tracking-wide text-bone-400">
          {s.status[report.status] ?? report.status}
        </span>
      </div>
      <p className="font-ui text-xs text-bone-400">
        {s.reported(date(report.createdAt))} · {report.path}
      </p>

      {report.replies.length === 0 ? (
        <p className="text-bone-400 text-sm">{s.noReply}</p>
      ) : (
        <ul className="space-y-2">
          {report.replies.map((reply) => (
            <li
              key={reply.id}
              // Unread as of opening this screen: the highlight stays while you
              // read, even though the server already counts it as read.
              className={`rounded-md border p-3 space-y-1 ${
                reply.readAt ? 'border-ink-800 bg-ink-950' : 'border-ember-500 bg-ink-950'
              }`}
            >
              <p className="flex items-center gap-2 font-ui text-xs text-bone-400">
                <span className="font-semibold text-bone-200">{s.replyFrom}</span>
                <span>{date(reply.createdAt)}</span>
                {!reply.readAt && <span className="font-semibold text-ember-400">{s.newBadge}</span>}
              </p>
              <p className="text-bone-100 text-sm whitespace-pre-line">{reply.body}</p>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/**
 * §41 — a player's own reports, with the admin's replies. Reached from
 * Account → Your reports and from the reply push. Opening the screen marks
 * every reply shown as read, which clears the dot on the avatar.
 */
export default function MyReportsScreen() {
  const { data: reports, isLoading } = useMyIssueReportsQuery();
  const markRead = useMarkRepliesReadMutation();
  const marked = useRef(new Set<string>());

  useEffect(() => {
    for (const report of reports ?? []) {
      if (marked.current.has(report.id)) continue;
      if (report.replies.some((r) => !r.readAt)) {
        marked.current.add(report.id);
        markRead.mutate(report.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  return (
    <div className="min-h-full flex flex-col">
      <BackHeader title={s.title} />
      <main className="flex-1 px-4 py-6 space-y-4">
        <p className="text-bone-300 text-sm">{s.intro}</p>
        {isLoading ? (
          <p className="text-bone-400 text-sm">{strings.common.loading}</p>
        ) : !reports || reports.length === 0 ? (
          <p className="text-bone-400 text-sm">{s.empty}</p>
        ) : (
          reports.map((report) => <ReportCard key={report.id} report={report} />)
        )}
      </main>
    </div>
  );
}

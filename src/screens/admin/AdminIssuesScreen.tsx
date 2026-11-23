import { useState } from 'react';
import { Link } from 'react-router-dom';
import DisclosureChevron from '../../components/DisclosureChevron';
import { IssuePatch, IssueReply, IssueReport, IssueStatus } from '../../api/issues';
import {
  useIssueRepliesQuery,
  useIssueReportsQuery,
  useSendIssueReplyMutation,
  useUpdateIssueMutation,
} from '../../hooks/useIssues';
import { strings } from '../../strings';

/** The warband a report was filed from, when its route had one (`:warbandId`). */
function warbandIdFrom(context: Record<string, unknown>): string | null {
  const params = context.params as Record<string, unknown> | undefined;
  const id = params?.warbandId;
  return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

/** Plain-text dump of a report, for pasting into a bug tracker or Claude Code. */
function reportAsText(report: IssueReport): string {
  const lines = [
    `Issue ${report.id} [${report.status}]`,
    '',
    report.message,
    '',
    `Path: ${report.path}`,
    `Filed: ${new Date(report.createdAt).toISOString()}`,
    `Build: ${report.appVersion || '—'}`,
    `Reporter: ${report.reporterId ? `${report.reporterName || 'Unnamed player'} (${report.reporterId})` : 'anonymous'}`,
    `Agent: ${report.userAgent || '—'}`,
  ];
  if (Object.keys(report.context).length > 0) {
    lines.push('', 'Context:', JSON.stringify(report.context, null, 2));
  }
  return lines.join('\n');
}

/**
 * §41 — the way back to the reporter. Replies sent so far, oldest first, with
 * whether the reporter has read each; then a box to send another. An anonymous
 * report says so instead of offering a box nobody would read.
 */
function ReplySection({ report, replies }: { report: IssueReport; replies: IssueReply[] }) {
  const r = strings.adminReplies;
  const [body, setBody] = useState('');
  const send = useSendIssueReplyMutation();

  return (
    <div className="space-y-2">
      <p className="font-ui text-xs font-semibold uppercase tracking-wide text-bone-400">{r.heading}</p>
      {replies.length > 0 && (
        <ul className="space-y-2">
          {replies.map((reply) => (
            <li key={reply.id} className="rounded-md border border-ink-800 bg-ink-950 p-2 space-y-1">
              <p className="text-bone-100 text-sm whitespace-pre-line">{reply.body}</p>
              <p className="font-ui text-xs text-bone-400">
                {new Date(reply.createdAt).toLocaleString()} ·{' '}
                {reply.readAt ? r.read(new Date(reply.readAt).toLocaleString()) : r.unread}
              </p>
            </li>
          ))}
        </ul>
      )}

      {report.reporterId ? (
        <>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={r.placeholder}
            className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-base text-bone-100 placeholder:text-bone-400 focus:outline-none focus:border-ember-500"
          />
          {send.isError && <p className="font-ui text-sm text-danger">{r.failed}</p>}
          <button
            type="button"
            disabled={!body.trim() || send.isPending}
            onClick={() =>
              send.mutate({ issueId: report.id, body: body.trim() }, { onSuccess: () => setBody('') })
            }
            className="min-h-[44px] px-4 rounded-md bg-ember-500 text-on-accent font-ui text-sm font-semibold disabled:opacity-50"
          >
            {send.isPending ? r.sending : r.send}
          </button>
        </>
      ) : (
        <p className="text-bone-400 text-sm">{r.anonymous}</p>
      )}
    </div>
  );
}

/** Max length of the public summary; one sentence for a Discord embed. */
const SUMMARY_MAX = 200;

/**
 * Migration 0073 — the one public line about a fix. A trigger posts it to
 * Discord #fixed-issues once the report is closed with it set, exactly once.
 * Controlled by the row so "Mark closed" can save an unsaved draft in the same
 * write as the status.
 */
function PublicSummarySection({
  report,
  draft,
  onDraft,
  onSave,
  saving,
  failed,
}: {
  report: IssueReport;
  draft: string;
  onDraft: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  failed: boolean;
}) {
  const dirty = draft.trim() !== report.publicSummary;
  const hint = report.fixedPostedAt
    ? `Posted to Discord ${new Date(report.fixedPostedAt).toLocaleString()}. Edits are not re-posted.`
    : report.status === 'closed'
      ? report.publicSummary
        ? 'Queued for Discord.'
        : 'Closed without a public summary, so not posted. Saving one now posts it.'
      : 'Posted to Discord when the report is closed.';

  return (
    <div className="space-y-2">
      <label
        htmlFor={`summary-${report.id}`}
        className="block font-ui text-xs font-semibold uppercase tracking-wide text-bone-400"
      >
        Public summary · #fixed-issues
      </label>
      <textarea
        id={`summary-${report.id}`}
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        rows={2}
        maxLength={SUMMARY_MAX}
        placeholder="Hired swords now keep their XP after a battle."
        className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-base text-bone-100 placeholder:text-bone-400 focus:outline-none focus:border-ember-500"
      />
      <p className={`font-ui text-xs ${report.fixedPostedAt ? 'text-verdigris' : 'text-bone-400'}`}>
        {hint} <span className="text-bone-400">({draft.length}/{SUMMARY_MAX})</span>
      </p>
      {failed && <p className="font-ui text-sm text-danger">Saving the summary failed. Try again.</p>}
      <button
        type="button"
        disabled={!dirty || saving}
        onClick={onSave}
        className="min-h-[44px] px-4 rounded-md bg-ember-500 text-on-accent font-ui text-sm font-semibold disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save summary'}
      </button>
    </div>
  );
}

const FILTERS:{ id: IssueStatus | 'all'; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'triaged', label: 'Triaged' },
  { id: 'closed', label: 'Closed' },
  { id: 'all', label: 'All' },
];

function ReportRow({
  report,
  replies,
  onUpdate,
  saving,
  failed,
}: {
  report: IssueReport;
  replies: IssueReply[];
  onUpdate: (patch: IssuePatch, onSuccess?: () => void) => void;
  saving: boolean;
  failed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState(report.publicSummary);
  const summaryDirty = draft.trim() !== report.publicSummary;

  function changeStatus(status: IssueStatus) {
    // Closing with an unsaved summary saves both in one write, so the Discord
    // trigger sees the closed row and its summary together.
    onUpdate(status === 'closed' && summaryDirty ? { status, publicSummary: draft } : { status });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(reportAsText(report));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied; the report is on screen to copy by hand.
    }
  }

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
        <span className="shrink-0 flex flex-col items-end gap-1">
          <span className="rounded border border-ink-700 px-1.5 py-0.5 font-ui text-xs uppercase tracking-wide text-bone-400">
            {report.status}
          </span>
          {/* Answered at a glance, without expanding the row. */}
          {replies.length > 0 && (
            <span className="font-ui text-xs text-verdigris">↩ {replies.length}</span>
          )}
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
              <dd className="inline">
                {report.reporterId ? (
                  <Link
                    to={`/admin/players/${report.reporterId}`}
                    className="text-ember-400 underline-offset-2 hover:underline"
                  >
                    {report.reporterName || 'Unnamed player'}
                  </Link>
                ) : (
                  'anonymous'
                )}
              </dd>
            </div>
            <div>
              <dt className="inline font-semibold">Agent: </dt>
              <dd className="inline break-all">{report.userAgent || '—'}</dd>
            </div>
          </dl>

          {/* §4.9.4.3 — a report filed from a roster screen carries its id. */}
          {warbandIdFrom(report.context) && (
            <Link
              to={`/admin/warbands/${warbandIdFrom(report.context)}`}
              className="inline-flex items-center min-h-[40px] text-ember-400 text-sm font-semibold"
            >
              Open roster →
            </Link>
          )}

          {Object.keys(report.context).length > 0 && (
            <pre className="overflow-x-auto rounded-md border border-ink-800 bg-ink-950 p-2 font-ui text-xs text-bone-100">
              {JSON.stringify(report.context, null, 2)}
            </pre>
          )}

          <PublicSummarySection
            report={report}
            draft={draft}
            onDraft={setDraft}
            onSave={() => onUpdate({ publicSummary: draft }, () => setDraft(draft.trim()))}
            saving={saving}
            failed={failed}
          />

          <ReplySection report={report} replies={replies} />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copy}
              className="min-h-[44px] px-3 rounded-md border border-ink-700 font-ui text-sm font-semibold text-bone-100"
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
            {(['open', 'triaged', 'closed'] as IssueStatus[])
              .filter((s) => s !== report.status)
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => changeStatus(s)}
                  className="min-h-[44px] px-3 rounded-md border border-ink-700 font-ui text-sm font-semibold text-bone-100"
                >
                  Mark {s}
                  {s === 'closed' && summaryDirty ? ' + save summary' : ''}
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
  const update = useUpdateIssueMutation();
  const { data: replies } = useIssueRepliesQuery(reports?.map((r) => r.id) ?? []);

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
            <ReportRow
              key={report.id}
              report={report}
              replies={(replies ?? []).filter((rp) => rp.issueId === report.id)}
              onUpdate={(patch, onSuccess) => update.mutate({ id: report.id, patch }, { onSuccess })}
              saving={update.isPending && update.variables?.id === report.id}
              failed={update.isError && update.variables?.id === report.id}
            />
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

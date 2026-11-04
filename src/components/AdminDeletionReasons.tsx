import { useAdminDeletionFeedbackQuery } from '../hooks/useIssues';
import { strings } from '../strings';

/**
 * §42 — on Admin › Deleted warbands: why players delete, from the optional
 * answer on the delete step (migration 0069).
 *
 * The answers are anonymous, so this shows counts, the typical age and edit
 * count of the warbands behind each reason, and the latest notes as plain text
 * with their reason: no player, warband or date. The labels are the player's
 * own wording on the delete step, so the admin reads exactly what was asked.
 */

const LABEL = strings.roster.deleteReason.options as Record<string, string>;

/** Hours as the coarsest readable unit. */
function age(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return 'under an hour';
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

export default function AdminDeletionReasons() {
  const { data, isError } = useAdminDeletionFeedbackQuery(90);

  if (isError) {
    return (
      <p className="font-ui text-xs text-bone-400">
        Deletion reasons unavailable: migration 0069 (<code>admin_deletion_feedback</code>) may not be applied yet.
      </p>
    );
  }
  if (!data) return null;

  const peak = Math.max(1, ...data.reasons.map((r) => r.n));
  const rate = data.deleted > 0 ? Math.round((data.answered / data.deleted) * 100) : 0;

  return (
    <section className="space-y-3 rounded-lg border border-ink-800 bg-ink-900 p-3">
      <div>
        <h2 className="text-bone-100 font-semibold">Why players delete</h2>
        <p className="font-ui text-xs text-bone-400">
          Last {data.days} days · {data.answered} answered of {data.deleted} deleted
          {data.deleted > 0 ? ` (${rate}%)` : ''}. Answers are optional and anonymous.
        </p>
      </div>

      {data.reasons.length === 0 ? (
        <p className="text-bone-400 text-sm">No answers yet.</p>
      ) : (
        <ul className="space-y-2">
          {data.reasons.map((r) => (
            <li key={r.reason} className="space-y-0.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 text-bone-100">{LABEL[r.reason] ?? r.reason}</span>
                <span className="w-8 text-right font-ui tabular-nums lining-nums text-bone-100">{r.n}</span>
              </div>
              <div className="h-2 rounded-sm bg-ink-800 overflow-hidden">
                <div className="h-full rounded-sm bg-ember-500/80" style={{ width: `${(r.n / peak) * 100}%` }} />
              </div>
              <p className="font-ui text-xs text-bone-400">
                Typically {age(r.median_age_hours)} old, {Math.round(r.median_edits ?? 0)} {Math.round(r.median_edits ?? 0) === 1 ? 'edit' : 'edits'}
                {r.in_campaign > 0 ? ` · ${r.in_campaign} in a campaign` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}

      {data.notes.length > 0 && (
        <div className="space-y-1">
          <p className="font-ui text-xs uppercase tracking-wide text-bone-400">In their words (latest {data.notes.length})</p>
          <ul className="space-y-1.5">
            {data.notes.map((n, i) => (
              <li key={i} className="text-sm text-bone-200">
                “{n.note}”
                <span className="block font-ui text-xs text-bone-400">{LABEL[n.reason] ?? n.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

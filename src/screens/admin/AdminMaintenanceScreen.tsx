import { useState } from 'react';
import ConfirmByTyping from '../../components/ConfirmByTyping';
import { usePurgeMutation, useStoragePurgeQueueQuery } from '../../hooks/usePhotos';
import { runAuditLogPurge } from '../../api/adminMaintenance';

/**
 * §10.4 — the audit-log retention job's manual trigger (migration 0043). The
 * nightly pg_cron run already does this; the button is for running it now (or
 * confirming it works) without the SQL editor. Only rows older than three years
 * go, so today it's expected to report zero — the number is the point.
 */
function AuditLogCleanup() {
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function purge() {
    setRunning(true);
    try {
      const r = await runAuditLogPurge();
      setResult(
        r.editsPurged === 0 && r.ratingPointsPurged === 0
          ? 'Nothing older than three years — no rows removed.'
          : `Removed ${r.editsPurged} edit-log row${r.editsPurged === 1 ? '' : 's'} and ${r.ratingPointsPurged} rating-history point${r.ratingPointsPurged === 1 ? '' : 's'}.`,
      );
    } catch (e) {
      setResult(`Failed: ${(e as Error).message}${/admin_purge_old_audit_logs/.test((e as Error).message) ? ' — migration 0043 not applied?' : ''}`);
    } finally {
      setRunning(false);
      setConfirming(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-bone-100 font-semibold">Audit-log cleanup</h2>
      <div className="space-y-3 rounded-lg border border-ink-800 bg-ink-900 p-3">
        <p className="text-bone-100 text-sm">
          Deletes roster edit-log rows and rating-history points older than three years. Runs nightly at 03:29; this
          runs it now.
        </p>
        <p className="font-ui text-xs text-bone-400">
          Three years outlasts any campaign, so no visible rating chart loses history. The Players screen's edit counts
          are unaffected until rows actually reach that age.
        </p>

        {!confirming ? (
          <button
            type="button"
            disabled={running}
            onClick={() => setConfirming(true)}
            className="min-h-[44px] px-4 rounded-md border border-blood-600 text-blood-500 font-ui text-sm font-semibold hover:bg-blood-600 hover:text-bone-100 transition-colors disabled:opacity-40"
          >
            Run log cleanup now
          </button>
        ) : (
          <div className="space-y-2">
            <ConfirmByTyping
              phrase="CLEANUP"
              label="Type CLEANUP to delete audit-log rows older than three years"
              action={running ? 'Running…' : 'Clean up now'}
              onConfirm={purge}
              impact={<p>Rows removed this way are gone for good. Only data older than three years is affected.</p>}
            />
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="w-full min-h-[44px] rounded-md text-bone-300 text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {result && <p className="font-ui text-xs text-bone-400">{result}</p>}
      </div>
    </section>
  );
}

/**
 * §4.9.6 — operator chores with no per-resource home: draining the storage
 * purge-queue the nightly job leaves behind (it can queue paths but not delete
 * the objects — that needs a session). Destructive, so it follows §10.1's
 * type-to-confirm rather than a bare button; "purge now" is irreversible.
 */
export default function AdminMaintenanceScreen() {
  const { data: queue, isError, error } = useStoragePurgeQueueQuery(true);
  const { run, running } = usePurgeMutation();
  const [result, setResult] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (isError) {
    return (
      <>
        <section className="space-y-1">
          <h2 className="text-bone-100 font-semibold">Storage cleanup</h2>
          <p className="text-blood-500 text-sm">Could not read the cleanup queue.</p>
          <p className="font-ui text-xs text-bone-400">
            {(error as Error).message} — if this mentions <code>storage_purge_queue</code>, migration 0014 has
            not been applied yet.
          </p>
        </section>
        <AuditLogCleanup />
      </>
    );
  }

  const pending = queue?.length ?? 0;

  async function purge() {
    const outcome = await run();
    setResult(
      typeof outcome === 'string'
        ? outcome
        : `Purged ${outcome.purged} warband${outcome.purged === 1 ? '' : 's'} and deleted ${outcome.cleared} file${outcome.cleared === 1 ? '' : 's'}.`,
    );
    setConfirming(false);
  }

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-bone-100 font-semibold">Storage cleanup</h2>

        <div className="space-y-3 rounded-lg border border-ink-800 bg-ink-900 p-3">
          <p className="text-bone-100 text-sm">
            {pending === 0
              ? 'No files waiting. The job runs nightly at 03:17.'
              : `${pending} file${pending === 1 ? '' : 's'} left behind by purged warbands, oldest queued ${new Date(queue![0].queuedAt).toLocaleDateString()}.`}
          </p>

          {!confirming ? (
            <button
              type="button"
              disabled={running}
              onClick={() => setConfirming(true)}
              className="min-h-[44px] px-4 rounded-md border border-blood-600 text-blood-500 font-ui text-sm font-semibold hover:bg-blood-600 hover:text-bone-100 transition-colors disabled:opacity-40"
            >
              Run purge now
            </button>
          ) : (
            <div className="space-y-2">
              <ConfirmByTyping
                phrase="PURGE"
                label="Type PURGE to hard-delete queued warbands and their files"
                action={running ? 'Running…' : 'Purge now'}
                onConfirm={purge}
                impact={<p>This permanently deletes the queued warbands and their storage objects. It cannot be undone.</p>}
              />
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="w-full min-h-[44px] rounded-md text-bone-300 text-sm"
              >
                Cancel
              </button>
            </div>
          )}

          {result && <p className="font-ui text-xs text-bone-400">{result}</p>}

          {pending > 0 && (
            <ul className="font-ui text-xs text-bone-400 space-y-0.5 pt-1">
              {queue!.slice(0, 5).map((q) => (
                <li key={q.path} className="break-all">
                  {q.path}
                </li>
              ))}
              {pending > 5 && <li>…and {pending - 5} more</li>}
            </ul>
          )}
        </div>
      </section>

      <AuditLogCleanup />
    </>
  );
}

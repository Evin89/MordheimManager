import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import DisclosureChevron from './DisclosureChevron';
import { useAuth } from '../auth/AuthProvider';
import { insertIssueReport } from '../api/issues';
import { strings } from '../strings';

/**
 * "Report an issue on this page", on every screen.
 *
 * Sits at the foot of the content rather than floating over it or taking a nav
 * cell: floating controls cover the thing being reported, and the tab bar has
 * seven tabs on a 375px phone already.
 *
 * The textbox is the small part. What makes a report worth having is the
 * context attached to it — the route, the build, the viewport — because the
 * expensive half of the last play-test was working out which screen and which
 * warband each of fifty remarks referred to.
 *
 * Works signed out: the rules pages are public, and a rules error is exactly
 * the kind of thing a signed-out reader is placed to notice.
 */
export default function ReportIssueButton() {
  const location = useLocation();
  const params = useParams();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  async function submit() {
    const trimmed = message.trim();
    if (!trimmed) return;
    setState('sending');
    try {
      await insertIssueReport({
        reporterId: user?.id ?? null,
        path: location.pathname,
        message: trimmed,
        // Whatever the route knows about what's on screen. Kept as free-form
        // json because what's worth capturing differs per screen and will keep
        // changing; the fields that are always present are real columns.
        context: {
          params,
          search: location.search,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          theme: document.documentElement.getAttribute('data-theme') ?? '',
          signedIn: !!user,
        },
        appVersion: __APP_VERSION__,
        userAgent: navigator.userAgent,
      });
      setState('sent');
      setMessage('');
    } catch {
      // Never a silent failure: there's no retry queue, so a report that didn't
      // send has to say so or the reporter assumes it landed.
      setState('failed');
    }
  }

  return (
    <section className="print:hidden mx-auto w-full max-w-4xl px-4 pb-6 pt-2">
      <div className="border-t border-ink/15 pt-3">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            if (state === 'sent' || state === 'failed') setState('idle');
          }}
          aria-expanded={open}
          className="min-h-[44px] flex items-center gap-2 font-ui text-sm text-ink-faded hover:text-ink transition-colors"
        >
          <DisclosureChevron open={open} />
          {strings.report.trigger}
        </button>

        {open && (
          <div className="mt-2 space-y-3 rounded-lg border-2 border-ink bg-parchment-raised p-4">
            <p className="text-sm text-ink">{strings.report.hint}</p>

            <textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (state !== 'idle') setState('idle');
              }}
              rows={4}
              placeholder={strings.report.placeholder}
              className="w-full rounded-md border border-ink/40 bg-parchment px-3 py-2 text-base text-ink placeholder:text-ink-faded focus:outline-none focus:border-ink"
            />

            <p className="font-ui text-xs text-ink-faded">
              {strings.report.attachedTo(location.pathname)} · {__APP_VERSION__}
            </p>

            {state === 'sent' && (
              <p className="font-ui text-sm text-verdigris">{strings.report.thanks}</p>
            )}
            {state === 'failed' && (
              <p className="font-ui text-sm text-blood">{strings.report.failed}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={!message.trim() || state === 'sending'}
                className="flex-1 min-h-[48px] rounded-md bg-blood text-on-accent font-ui text-sm font-semibold disabled:opacity-50"
              >
                {state === 'sending' ? strings.report.sending : strings.report.send}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setState('idle');
                }}
                className="min-h-[48px] px-4 rounded-md border border-ink/40 font-ui text-sm font-semibold text-ink"
              >
                {strings.report.cancel}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

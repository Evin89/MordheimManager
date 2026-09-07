import { useEffect, useState } from 'react';
import { consentDecisionNeeded, setAnalyticsConsent, subscribeConsent } from '../lib/analyticsConsent';
import { strings } from '../strings';
import { Button } from './ui';

/**
 * The first-run analytics consent prompt (§23.7 / Privacy Policy §10).
 *
 * Analytics is non-essential, so under the EU ePrivacy rules it stays off until
 * the visitor actively agrees. This banner is the ask: Accept and Decline carry
 * equal weight (a dark-pattern "Accept" next to a buried "Decline" is exactly
 * what the rule forbids), and until one is tapped PostHog never loads.
 *
 * It renders nothing whenever a decision isn't pending — already chosen, demo
 * mode, Do-Not-Track, or no PostHog project configured — so the common case is
 * an early return. The choice lives in one shared key (see analyticsConsent.ts),
 * so accepting here also settles it for the static landing page, and vice-versa.
 *
 * The Privacy Policy is a static page outside the router, so it's a plain <a>,
 * not a <Link>.
 */
export default function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(consentDecisionNeeded());
    return subscribeConsent(() => setShow(consentDecisionNeeded()));
  }, []);

  if (!show) return null;

  const s = strings.consent;

  return (
    <div
      role="dialog"
      aria-label={s.ariaLabel}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-700 bg-ink-900/95 backdrop-blur px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto max-w-2xl space-y-3">
        <p className="text-bone-200 text-sm">
          {s.message}{' '}
          <a href="/privacy.html" className="text-ember-400 underline underline-offset-2">
            {s.learnMore}
          </a>
          . <span className="text-bone-400">{s.changeHint}</span>
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setAnalyticsConsent(false)}>
            {s.decline}
          </Button>
          <Button onClick={() => setAnalyticsConsent(true)}>{s.accept}</Button>
        </div>
      </div>
    </div>
  );
}

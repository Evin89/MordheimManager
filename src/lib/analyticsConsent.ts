/**
 * Analytics consent (§23.7 and the Privacy Policy's cookies section).
 *
 * PostHog is non-essential, so under the EU ePrivacy rules it may only load once
 * the visitor has actively agreed. This module owns that one decision — stored
 * under a single localStorage key that the React app AND the static landing page
 * both read, so a choice made on either surface is honoured everywhere.
 *
 *   unset   → undecided: no analytics runs, and the banner is shown
 *   granted → analytics may load
 *   denied  → analytics stays off
 *
 * Do-Not-Track and demo mode both force "no analytics, no banner": there is
 * nothing to consent to when the browser has already said no, and demo traffic
 * must never reach real analytics (§13.1).
 *
 * posthog.ts depends on this module (it gates `initAnalytics` on `analyticsAllowed`
 * and reacts to `subscribeConsent`); this module never imports posthog.ts back,
 * so the dependency stays one-way.
 */
import { isDemoMode } from '../dev/demoMode';

// Shared with the static landing page's inline script — keep the two in step.
export const CONSENT_STORAGE_KEY = 'mordheim.analyticsConsent';

export type ConsentChoice = 'granted' | 'denied' | 'unset';

// The same keys the client build reads for PostHog. Read here directly (rather
// than imported from posthog.ts) so this module has no dependency back on it.
const isConfigured = Boolean(
  import.meta.env.VITE_POSTHOG_KEY && import.meta.env.VITE_POSTHOG_HOST,
);

/** Do-Not-Track, read defensively across the vendor spellings. Stronger than
 * PostHog's own `respect_dnt`: we never even load the SDK when it's on. */
export function doNotTrackEnabled(): boolean {
  if (typeof navigator === 'undefined') return false;
  const dnt =
    navigator.doNotTrack ||
    (window as { doNotTrack?: string }).doNotTrack ||
    (navigator as { msDoNotTrack?: string }).msDoNotTrack;
  return dnt === '1' || dnt === 'yes';
}

function read(): 'granted' | 'denied' | null {
  try {
    const v = localStorage.getItem(CONSENT_STORAGE_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

/** The visitor's recorded choice, or 'unset' if they haven't decided yet. */
export function consentChoice(): ConsentChoice {
  return read() ?? 'unset';
}

/** True only when analytics is allowed to run right now: configured, not demo,
 * Do-Not-Track off, and explicitly granted. This is the single gate that
 * posthog.ts checks before it will initialise or send anything. */
export function analyticsAllowed(): boolean {
  return isConfigured && !isDemoMode() && !doNotTrackEnabled() && read() === 'granted';
}

/** Whether the consent controls (the banner, the Account-screen toggle) make any
 * sense — hidden when analytics can't run regardless of the choice. */
export function analyticsConfigurable(): boolean {
  return isConfigured && !isDemoMode() && !doNotTrackEnabled();
}

/** Show the first-run banner only while a decision is genuinely pending. */
export function consentDecisionNeeded(): boolean {
  return analyticsConfigurable() && read() === null;
}

type Listener = (choice: ConsentChoice) => void;
const listeners = new Set<Listener>();

/** Subscribe to consent changes — the banner hides, posthog starts or stops.
 * Returns an unsubscribe. Also fires when another tab (or the landing page)
 * writes the key. */
export function subscribeConsent(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify(): void {
  const choice = consentChoice();
  for (const cb of listeners) cb(choice);
}

/** Record the choice and notify subscribers. */
export function setAnalyticsConsent(granted: boolean): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, granted ? 'granted' : 'denied');
  } catch {
    // A private-mode browser that refuses storage still gets the in-memory
    // notification below, so the banner closes for this session at least.
  }
  notify();
}

// A choice made in another tab — or on the static landing page in this same tab
// before the SPA booted — should propagate here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === CONSENT_STORAGE_KEY) notify();
  });
}

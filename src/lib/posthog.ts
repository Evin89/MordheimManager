import type { CaptureResult } from 'posthog-js';
import { isDemoMode } from '../dev/demoMode';

/**
 * Behavioural analytics (spec §23.7) — the deliberately narrow client.
 *
 * The spec's rule is "anonymous IDs and event names only": no autocapture, no
 * session replay, no PII, no warband names or GW-sourced content. This module is
 * the whole surface through which telemetry can leave the app, so it enforces
 * that shape rather than trusting each call site to — events are a closed union,
 * and identify carries an opaque user id with *no* properties (never the email
 * or display name PostHog's own wizard would attach).
 *
 * - Loaded lazily via dynamic import so `posthog-js` stays off the first-paint
 *   bundle (§16 is already over Vite's size warning; §23.7 requires it off the
 *   critical path). The import is a separate chunk; init is triggered from a
 *   post-paint effect (the first pageview), never during render.
 * - A no-op when the keys are unset (a dev or self-host without a PostHog
 *   project just runs), when Do-Not-Track is on, or when the demo viewer is
 *   active — so demo interactions never pollute real analytics.
 */

// The default export of posthog-js is the singleton instance; borrow its type
// from the module rather than guessing a named export.
type PostHogClient = typeof import('posthog-js')['default'];

const projectToken = import.meta.env.VITE_POSTHOG_KEY;
const host = import.meta.env.VITE_POSTHOG_HOST;

export const isAnalyticsConfigured = Boolean(projectToken && host);

/**
 * The only events we send — the behavioural counterpart to the §23 DB funnel,
 * not a firehose. A closed union so a typo or a casually-added event is a
 * compile error, not silent drift. Properties (below) are scrubbed by contract:
 * enums, counts and booleans, never a name, note, or anything a player typed.
 */
export type AnalyticsEvent =
  | 'warband_created'
  | 'battle_committed'
  | 'campaign_created'
  | 'campaign_joined'
  | 'campaign_selected'
  | 'campaign_invite_shared'
  | 'warband_campaign_assignment_changed'
  | 'warband_visibility_changed'
  | 'issue_report_submitted';

type EventProps = Record<string, string | number | boolean>;

let client: PostHogClient | null = null;
let initPromise: Promise<PostHogClient | null> | null = null;

/** Honour Do-Not-Track before we even fetch the SDK — stronger than PostHog's
 * own `respect_dnt`, which loads first and suppresses after. */
function doNotTrackEnabled(): boolean {
  if (typeof navigator === 'undefined') return false;
  const dnt =
    navigator.doNotTrack ||
    (window as { doNotTrack?: string }).doNotTrack ||
    (navigator as { msDoNotTrack?: string }).msDoNotTrack;
  return dnt === '1' || dnt === 'yes';
}

// URL-bearing properties PostHog attaches to *every* event automatically. The
// query string is stripped from each so a `?join=…` can never ride along.
const URL_PROPS = ['$current_url', '$referrer', '$pathname'];

/**
 * Runs on every outgoing event (§23.7 belt-and-braces), no matter how it was
 * captured. Two jobs: strip query strings from the URL autoprops PostHog adds to
 * every event, and redact exception message text — the error *type* and stack
 * are code and stay, but the free-text message could carry a warband name or
 * something a player typed, so it's dropped. Returning the event sends it;
 * returning null would drop it.
 */
function scrubEvent(event: CaptureResult | null): CaptureResult | null {
  const props = event?.properties;
  if (!props) return event;

  for (const key of URL_PROPS) {
    const value = props[key];
    if (typeof value === 'string' && value.includes('?')) {
      props[key] = value.slice(0, value.indexOf('?'));
    }
  }

  const exceptions = props['$exception_list'];
  if (Array.isArray(exceptions)) {
    for (const ex of exceptions) {
      if (ex && typeof ex === 'object' && 'value' in ex) {
        (ex as { value: unknown }).value = '[redacted]';
      }
    }
  }

  return event;
}

/**
 * Load and initialise PostHog once. Safe to call repeatedly; the in-flight
 * promise is shared. A no-op in every build when there's nothing to send to
 * (keys unset) or when we mustn't (Do-Not-Track, demo mode) — never a throw, so
 * the one environment where the keys are legitimately absent still runs.
 */
export async function initAnalytics(): Promise<PostHogClient | null> {
  if (!isAnalyticsConfigured || doNotTrackEnabled() || isDemoMode()) return null;
  if (initPromise) return initPromise;

  initPromise = import('posthog-js').then(({ default: posthog }) => {
    posthog.init(projectToken!, {
      api_host: host,
      // Anonymous, event-names-only telemetry (§23.7). Everything that could
      // carry DOM text, a warband name, or GW content is turned off:
      autocapture: false,
      capture_pageview: false, // captured manually per SPA route (capturePageview)
      capture_pageleave: false,
      disable_session_recording: true,
      // No person profiles for anonymous traffic — one is created only when we
      // identify a signed-in user, by opaque id and with no properties.
      person_profiles: 'identified_only',
      // First-party storage, no tracking cookie.
      persistence: 'localStorage',
      // Belt-and-braces: suppress capture if DNT flips on mid-session too.
      respect_dnt: true,
      // Capture unhandled browser errors and rejected promises globally for
      // Error Tracking; leave console errors out of the monitoring scope.
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: false,
      },
      // Last line before anything leaves: strip query strings and redact
      // exception messages, so even error tracking stays anonymous (§23.7).
      before_send: scrubEvent,
    });
    client = posthog;
    return posthog;
  });

  return initPromise;
}

/**
 * Send one curated event. No-ops silently when analytics is off. Awaits the
 * in-flight init so an event fired early (e.g. right after sign-up) isn't lost.
 */
export async function capture(event: AnalyticsEvent, properties?: EventProps): Promise<void> {
  const ph = client ?? (await initAnalytics());
  ph?.capture(event, properties);
}

/**
 * A single SPA pageview. The path only — the query string is stripped, since a
 * `?join=…` or similar could carry data we've promised never to send. `pathname`
 * is the in-app path with the router's `/app` basename already removed; we
 * prefix it back on so PostHog paths line up with the real URL bar.
 */
export async function capturePageview(pathname: string): Promise<void> {
  const ph = client ?? (await initAnalytics());
  if (!ph) return;
  // Override $current_url so PostHog can't refill it from window.location and
  // smuggle the query string back in.
  ph.capture('$pageview', { $current_url: `${window.location.origin}/app${pathname}` });
}

/**
 * Tie subsequent events to a signed-in user by their opaque Supabase id — the
 * same key the §23 DB analytics uses. No properties: never the email or display
 * name (§4.9 / §23.7). Stitches the prior anonymous session onto the user.
 */
export async function identifyUser(userId: string): Promise<void> {
  const ph = client ?? (await initAnalytics());
  ph?.identify(userId);
}

/** Drop the current identity and rotate the anonymous id — on sign-out and on a
 * direct account switch, so a shared device never blends two people's sessions.
 * No-ops if analytics never loaded (nothing to reset). */
export function resetAnalytics(): void {
  client?.reset();
}

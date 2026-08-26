import { isDemoMode } from '../dev/demoMode';

/**
 * Behavioural analytics (spec §23.7) — the deliberately narrow client.
 *
 * The spec's rule is "anonymous IDs and event names only": no autocapture, no
 * session replay, no PII, no warband names or GW-sourced content. This module is
 * the whole surface through which telemetry can leave the app, so it enforces
 * that shape rather than trusting each call site to.
 *
 * - Loaded lazily via dynamic import so `posthog-js` stays off the first-paint
 *   bundle (§16 is already over Vite's size warning; §23.7 requires it off the
 *   critical path).
 * - A no-op when the keys are unset (a dev or self-host without a PostHog
 *   project just runs) or when Do-Not-Track is on or the demo viewer is active.
 * - Only the curated `AnalyticsEvent` names can be sent, with scrubbed
 *   properties — enums, counts and booleans, never names or free text.
 */

// The default export of posthog-js is the singleton instance; borrow its type
// from the module rather than guessing a named export.
type PostHogClient = typeof import('posthog-js')['default'];

const projectToken = import.meta.env.VITE_POSTHOG_KEY;
const host = import.meta.env.VITE_POSTHOG_HOST;

export const isAnalyticsConfigured = Boolean(projectToken && host);

/**
 * The only events we send. Keep this list short and meaningful — it is the
 * behavioural counterpart to the §23 DB funnel, not a firehose. Properties are
 * scrubbed by contract at the call site: pass enums/counts/booleans, never a
 * name, note, or anything a player typed.
 */
export type AnalyticsEvent = 'warband_created' | 'campaign_created';

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

/**
 * Load and initialise PostHog, once. Returns the client, or null when analytics
 * is switched off (unconfigured, Do-Not-Track, or demo mode) — callers don't
 * branch on that, they just get a no-op. Safe to call repeatedly; the in-flight
 * promise is shared.
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
      capture_pageview: false, // captured manually per SPA route (usePageviews)
      capture_pageleave: false,
      disable_session_recording: true,
      // No person profiles for anonymous traffic — we never call identify, so
      // this keeps events anonymous rather than minting a profile per visitor.
      person_profiles: 'identified_only',
      // First-party storage, no tracking cookie.
      persistence: 'localStorage',
      // Belt-and-braces: suppress capture if DNT flips on mid-session too.
      respect_dnt: true,
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

/** The initialised client, or null when analytics is off. For the pageview hook
 * and anything that needs the raw instance; prefer `capture` for events. */
export function analytics(): PostHogClient | null {
  return client;
}

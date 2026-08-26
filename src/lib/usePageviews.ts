import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { analytics } from './posthog';

/**
 * Manual SPA pageview capture (autocapture is off, §23.7). Fires `$pageview` on
 * every route change with the path only — the query string is stripped, since a
 * `?join=…` or similar could carry data we've promised never to send.
 *
 * `location.pathname` here is the in-app path with the router's `/app` basename
 * already removed; we prefix it back on so PostHog paths line up with the real
 * URL bar. No-ops until analytics has initialised.
 */
export function usePageviews(): void {
  const location = useLocation();

  useEffect(() => {
    const ph = analytics();
    if (!ph) return;
    // Override $current_url so PostHog can't fill it from window.location and
    // smuggle the query string back in.
    const url = `${window.location.origin}/app${location.pathname}`;
    ph.capture('$pageview', { $current_url: url });
  }, [location.pathname]);
}

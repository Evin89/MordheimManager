import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { capturePageview } from './posthog';

/**
 * Manual SPA pageview capture (autocapture is off, §23.7). Fires a `$pageview`
 * on every route change. The effect runs after paint, so the first one is also
 * what lazy-loads the analytics chunk — keeping `posthog-js` off the first-paint
 * bundle without losing the initial view.
 */
export function usePageviews(): void {
  const location = useLocation();

  useEffect(() => {
    void capturePageview(location.pathname);
  }, [location.pathname]);
}

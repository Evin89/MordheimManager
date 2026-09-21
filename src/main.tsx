import React from 'react';
import ReactDOM from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthProvider';
import { useConnectionStatus } from './store/useConnectionStatus';
import { initAnalytics } from './lib/posthog';
import { missingConfig } from './lib/supabaseClient';
import { describeError } from './lib/errorMessage';
import StartupError from './StartupError';
import App from './App';
import './index.css';

function reportConnectionError(error: unknown) {
  // Store the classified message, so the banner distinguishes a permission
  // refusal or a stale-version conflict from an actual dropped connection.
  useConnectionStatus.getState().reportError(describeError(error));
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Coming back to the tab should show current data — someone else may have
      // reported a battle while you were away from the table.
      refetchOnWindowFocus: true,
      // Without a staleTime every screen change refetched: opening a hero,
      // going back, opening the next one re-ran the warband query each time,
      // which on a phone at the game store is a visible stall per tap. Half a
      // minute is short enough that a campaign-mate's change still lands
      // quickly (focus and mutations both invalidate on top of this), and long
      // enough that moving around your own roster hits the cache.
      staleTime: 30_000,
      // Keep data around long enough that stepping into the post-battle wizard
      // and back doesn't start from an empty screen.
      gcTime: 5 * 60_000,
    },
  },
  queryCache: new QueryCache({ onError: reportConnectionError }),
  // A mutation can opt out of the global banner with `meta.suppressGlobalError`
  // when the screen that fired it shows the error inline itself (e.g. the roster
  // delete), so the failure isn't reported twice in two different voices.
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.meta?.suppressGlobalError) return;
      reportConnectionError(error);
    },
  }),
});

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

if (missingConfig.length > 0) {
  // Checked before the providers mount, not inside them: AuthProvider talks to
  // Supabase on its first render, so anything downstream of it would fail on the
  // way to reporting that it cannot work. Also logged, since a screenshot of the
  // page is not always what gets sent.
  console.error(`Missing required configuration: ${missingConfig.join(', ')}`);
  root.render(<StartupError missing={missingConfig} />);
} else {
  void initAnalytics();
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

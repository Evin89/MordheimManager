import React from 'react';
import ReactDOM from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthProvider';
import { useConnectionStatus } from './store/useConnectionStatus';
import { clearLegacyServiceWorker } from './lib/clearLegacyServiceWorker';
import App from './App';
import './index.css';

// Fire and forget — nothing in the app waits on it.
void clearLegacyServiceWorker();

function reportConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  useConnectionStatus.getState().reportError(message);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
  queryCache: new QueryCache({ onError: reportConnectionError }),
  mutationCache: new MutationCache({ onError: reportConnectionError }),
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

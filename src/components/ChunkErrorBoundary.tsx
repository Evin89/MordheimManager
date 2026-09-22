import { Component, ReactNode } from 'react';
import { strings } from '../strings';

const RELOAD_FLAG = 'mm:chunk-reload';

/**
 * Matches the handful of ways browsers phrase a failed dynamic `import()` —
 * Chrome, Firefox and Safari each word it differently, and none of them throw
 * a typed error class for it.
 */
function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|importing a module script failed|loading chunk/i.test(message);
}

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Every route screen is lazy-loaded (see App.tsx), so a click on an in-app
 * link some time after a new deploy tries to fetch a chunk file whose hash no
 * longer exists on the server — the old one was replaced. With no boundary
 * above `<Suspense>`, that rejected import unmounts the whole tree and the
 * app goes blank; a reload works only because it fetches the current index.html
 * and asset manifest fresh.
 *
 * This reloads once, automatically, so that failure is invisible instead of a
 * black screen. If the reload *also* throws a chunk error — a genuinely broken
 * deploy, not just a stale local one — the flag stops it from looping and a
 * fallback with a manual retry is shown instead.
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (!isChunkLoadError(error)) return;

    if (sessionStorage.getItem(RELOAD_FLAG) === '1') {
      sessionStorage.removeItem(RELOAD_FLAG);
      return;
    }
    sessionStorage.setItem(RELOAD_FLAG, '1');
    window.location.reload();
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="min-h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-bone-300">{strings.common.updateAvailableError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border border-ink-600 px-4 py-2 text-sm text-bone-100 hover:bg-ink-800"
          >
            {strings.common.reload}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

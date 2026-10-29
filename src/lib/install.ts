import { capture } from './posthog';

/**
 * §36 — offering the PWA install from inside the app.
 *
 * The app has always been installable through the browser's own menu; this
 * module is what lets it *offer* that. It is imported for its side effect at
 * the top of main.tsx because Chromium can fire `beforeinstallprompt` before
 * React mounts — a listener registered in a component would miss it.
 *
 * Exposes a tiny external store (`getInstallState` + `subscribeInstall`) that
 * `useInstall` reads through `useSyncExternalStore`, the same no-dependency
 * pattern as analyticsConsent.ts.
 */

/** Chromium's install-prompt event; not in the DOM lib typings. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type InstallState =
  | 'installed'
  | 'just-installed'
  | 'promptable'
  | 'ios'
  | 'android-manual'
  | 'unsupported';

let deferred: BeforeInstallPromptEvent | null = null;
let installedThisSession = false;

const listeners = new Set<() => void>();

function notify(): void {
  for (const cb of listeners) cb();
}

/** Running as the installed app, not in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

// iPadOS reports a Mac user agent; touch points are what give it away — the
// same trap as the §19.4 push detection.
function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPod|iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

/** Which install path this device has right now (§36.3). */
export function getInstallState(): InstallState {
  if (typeof window === 'undefined') return 'unsupported';
  if (isStandalone()) return 'installed';
  if (installedThisSession) return 'just-installed';
  if (deferred) return 'promptable';
  if (isIos()) return 'ios';
  if (isAndroid()) return 'android-manual';
  return 'unsupported';
}

export function subscribeInstall(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Show the native install sheet. A prompt event is single-use, so it is dropped
 * whatever the answer; if Chrome later re-fires `beforeinstallprompt`, the
 * listener below picks the new one up.
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (!event) return 'unavailable';
  deferred = null;
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    void capture('install_prompt_result', { outcome });
    return outcome;
  } catch {
    return 'unavailable';
  } finally {
    notify();
  }
}

if (typeof window !== 'undefined') {
  // No preventDefault (§36.2): Chrome's own install icon stays as a second
  // route, and the stashed event's prompt() works without it.
  window.addEventListener('beforeinstallprompt', (e) => {
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedThisSession = true;
    void capture('app_installed');
    notify();
  });
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', notify);
}

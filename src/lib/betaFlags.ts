const STORAGE_KEY = 'mordheim.beta.stunnedTracking';

export function isStunnedBetaOn(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setStunnedBeta(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, '1');
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The in-memory setting still applies if storage is unavailable.
  }
}

import { useSyncExternalStore } from 'react';
import { getInstallState, subscribeInstall, type InstallState } from '../lib/install';

/** §28 — the device's current install path, re-rendering when it changes. */
export function useInstall(): InstallState {
  return useSyncExternalStore(subscribeInstall, getInstallState, () => 'unsupported');
}

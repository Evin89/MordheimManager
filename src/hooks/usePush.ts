import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  disablePush,
  enablePush,
  isPushConfigured,
  isPushSupported,
  isSubscribed,
  pushPermission,
} from '../lib/push';

type EnableResult = 'subscribed' | 'denied' | 'unsupported';

/**
 * Drives the Settings notification toggle: whether push can work here, whether
 * this device is subscribed, and the enable/disable actions. `permission` is
 * surfaced so the toggle can say "you've blocked notifications" rather than
 * silently failing when the browser refuses the prompt.
 */
export function usePush() {
  const { user } = useAuth();
  const [supported] = useState(() => isPushSupported() && isPushConfigured);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(() => pushPermission());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    let active = true;
    isSubscribed().then((v) => {
      if (active) setSubscribed(v);
    });
    return () => {
      active = false;
    };
  }, [supported]);

  async function enable(): Promise<EnableResult | undefined> {
    if (!user || busy) return;
    setBusy(true);
    try {
      const result = await enablePush(user.id);
      setPermission(pushPermission());
      if (result === 'subscribed') setSubscribed(true);
      return result;
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy) return;
    setBusy(true);
    try {
      await disablePush();
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }

  return { supported, subscribed, permission, busy, enable, disable };
}

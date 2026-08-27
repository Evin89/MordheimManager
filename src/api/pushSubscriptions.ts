import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';

/**
 * §19.4 — a browser's Web Push subscription, stored so the reminder job can send
 * to it. The shape mirrors the `PushSubscription` the browser hands us: an
 * endpoint plus the two keys needed to encrypt a payload for it.
 */
export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** Upsert this device's subscription onto its endpoint (re-subscribing the same
 * browser replaces the old row rather than piling up duplicates). `user_id` is
 * filled by the RLS default of auth.uid() via the insert policy. No-op in demo. */
export async function savePushSubscription(
  userId: string,
  sub: StoredPushSubscription,
): Promise<void> {
  if (isDemoMode()) return;
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    },
    { onConflict: 'endpoint' },
  );
  if (error) throw error;
}

/** Forget this device's subscription (the toggle turned off, or the browser
 * revoked it). Keyed by endpoint, which is unique. No-op in demo. */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  if (isDemoMode()) return;
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) throw error;
}

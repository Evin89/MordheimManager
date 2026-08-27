import { deletePushSubscription, savePushSubscription } from '../api/pushSubscriptions';

/**
 * §19.4 — the browser side of Web Push. Turns the Notification/Push/SW APIs into
 * a small enable/disable surface the Settings toggle drives, and stores the
 * resulting subscription so the reminder job can reach this device.
 *
 * The VAPID public key is a build-time env value; without it push is simply
 * unavailable (the toggle hides), the same graceful-off posture as analytics.
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const isPushConfigured = Boolean(VAPID_PUBLIC_KEY);

/**
 * Web Push needs a service worker, the Push API and the Notification API. On
 * iOS/iPadOS these exist only for a PWA added to the Home Screen (16.4+), so
 * this is false in plain mobile Safari — the caller shows an install hint rather
 * than a toggle that can't work.
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function pushPermission(): NotificationPermission {
  return typeof Notification !== 'undefined' ? Notification.permission : 'denied';
}

// VAPID keys and the subscription's own keys travel as base64url; the
// PushManager wants a Uint8Array for the application server key.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalised);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

// The reverse, for the p256dh/auth keys the browser hands back as ArrayBuffers.
function keyToBase64Url(key: ArrayBuffer | null): string {
  if (!key) return '';
  const bytes = new Uint8Array(key);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.ready;
}

/** Whether this device currently holds a live push subscription. */
export async function isSubscribed(): Promise<boolean> {
  const reg = await readyRegistration();
  if (!reg) return false;
  return Boolean(await reg.pushManager.getSubscription());
}

/**
 * Ask permission (must run from a user gesture), subscribe, and store it.
 * Returns the outcome so the toggle can explain a block; only an unexpected
 * failure throws. A declined prompt resolves to 'denied', not an error.
 */
export async function enablePush(userId: string): Promise<'subscribed' | 'denied' | 'unsupported'> {
  if (!isPushSupported() || !isPushConfigured) return 'unsupported';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const reg = await readyRegistration();
  if (!reg) return 'unsupported';

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      // Required by browsers: every push must result in a visible notification.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
    }));

  await savePushSubscription(userId, {
    endpoint: sub.endpoint,
    p256dh: keyToBase64Url(sub.getKey('p256dh')),
    auth: keyToBase64Url(sub.getKey('auth')),
  });
  return 'subscribed';
}

/** Unsubscribe this device and forget it server-side. */
export async function disablePush(): Promise<void> {
  const reg = await readyRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  await deletePushSubscription(sub.endpoint);
  await sub.unsubscribe();
}

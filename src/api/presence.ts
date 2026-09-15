import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';

/**
 * Marks the signed-in user as seen now, so the admin dashboard can count who has
 * been online today (migration 0037). The database throttles the write to once
 * per five minutes; the client throttles the call on top of that.
 *
 * Best-effort by design: presence is a nicety, so a failure (offline, RLS,
 * un-migrated backend) is swallowed rather than surfaced or retried.
 */
export async function touchLastSeen(): Promise<void> {
  if (isDemoMode()) return;
  try {
    await supabase.rpc('touch_last_seen');
  } catch {
    /* presence is best-effort — never surface */
  }
}

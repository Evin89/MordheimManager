import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import { browserTimeZone } from '../lib/calendar';

/**
 * Marks the signed-in user as seen now, so the admin dashboard can count who has
 * been online today (migration 0037), and logs today as a visit day for the
 * activity calendar (migration 0052, §4.9.4.1). The browser's time zone decides
 * which day "today" is, so a late-evening visit isn't filed under tomorrow. The
 * database throttles the last-seen write to once per five minutes and keeps one
 * visit row per day; the client throttles the call on top of that.
 *
 * Best-effort by design: presence is a nicety, so a failure (offline, RLS,
 * un-migrated backend) is swallowed rather than surfaced or retried.
 */
export async function touchLastSeen(): Promise<void> {
  if (isDemoMode()) return;
  try {
    await supabase.rpc('touch_last_seen', { p_tz: browserTimeZone() });
  } catch {
    /* presence is best-effort — never surface */
  }
}

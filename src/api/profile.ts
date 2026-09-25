import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';

/**
 * §26.7.1 — a Google signup can't carry acquisition through signup metadata
 * (the provider flow skips the register form), so it records it once, just
 * after the account is created. The function is write-once, own-row-only and
 * refuses any profile older than 30 minutes (migration 0048). Best-effort.
 */
export async function recordSignupAcquisition(acq: {
  channel: string;
  ref: string | null;
  host: string | null;
}): Promise<void> {
  if (isDemoMode()) return;
  try {
    await supabase.rpc('record_signup_acquisition', {
      p_channel: acq.channel,
      p_ref: acq.ref,
      p_host: acq.host,
    });
  } catch {
    /* acquisition is best-effort — never surface */
  }
}

export type Profile = {
  id: string;
  displayName: string;
};

/** Longest name the standings table and gallery rows can show without
 * truncating. Enforced here rather than only in the input, since this is the
 * value other people see. */
export const MAX_DISPLAY_NAME = 40;

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  if (isDemoMode()) return demo.fetchMyProfile(userId);
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, displayName: data.display_name } : null;
}

/**
 * Renames the signed-in player.
 *
 * Writes only `display_name`: the row is the user's own, but an update that
 * carried `id` would let a typo point the row at someone else's uuid. The
 * `profiles_update_own` policy would reject it — Postgres reuses a policy's
 * USING expression as its WITH CHECK when none is given — but not sending the
 * column at all is the clearer guarantee.
 */
export async function updateDisplayName(userId: string, displayName: string): Promise<Profile> {
  const trimmed = displayName.trim();
  if (!trimmed) throw new Error('Your display name cannot be empty.');
  if (trimmed.length > MAX_DISPLAY_NAME) {
    throw new Error(`Your display name cannot be longer than ${MAX_DISPLAY_NAME} characters.`);
  }

  if (isDemoMode()) return demo.updateDisplayName(userId, trimmed);

  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', userId)
    .select('id, display_name')
    .single();
  if (error) throw error;
  return { id: data.id, displayName: data.display_name };
}

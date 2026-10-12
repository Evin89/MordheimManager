import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';

/**
 * Soft-deleted warbands (migration 0009), read through the admin-only RPC in
 * migration 0054. Metadata only — the roster itself stays unreadable (§4.9.7).
 * `purge_at` is when the nightly 0014 job hard-deletes the row.
 */
export type AdminDeletedWarband = {
  id: string;
  name: string;
  warband_type: string;
  owner_id: string;
  owner_name: string | null;
  campaign_name: string | null;
  created_at: string;
  deleted_at: string;
  purge_at: string;
};

export async function fetchAdminDeletedWarbands(): Promise<AdminDeletedWarband[]> {
  if (isDemoMode()) return demo.fetchAdminDeletedWarbands();
  const { data, error } = await supabase.rpc('admin_deleted_warbands');
  if (error) throw error;
  return (data ?? []) as AdminDeletedWarband[];
}

/**
 * §35.4 — put a soft-deleted warband back (migration 0056). Admin-only on the
 * server; fails if the nightly purge already removed the row.
 */
export async function restoreDeletedWarband(id: string): Promise<void> {
  if (isDemoMode()) return demo.restoreDeletedWarband(id);
  const { error } = await supabase.rpc('admin_restore_warband', { p_warband_id: id });
  if (error) throw error;
}

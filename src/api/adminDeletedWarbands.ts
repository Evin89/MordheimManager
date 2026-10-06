import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';

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
  if (isDemoMode()) return [];
  const { data, error } = await supabase.rpc('admin_deleted_warbands');
  if (error) throw error;
  return (data ?? []) as AdminDeletedWarband[];
}

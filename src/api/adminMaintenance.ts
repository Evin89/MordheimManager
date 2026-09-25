import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';

/**
 * §10.4 — the operator's entry point to the audit-log retention job (migration
 * 0043). Deletes `warband_edits` and `warband_rating_history` rows older than
 * three years; the same function pg_cron runs nightly at 03:29. Admin-gated in
 * the database.
 */
export type AuditLogPurgeResult = { editsPurged: number; ratingPointsPurged: number };

export async function runAuditLogPurge(): Promise<AuditLogPurgeResult> {
  if (isDemoMode()) return { editsPurged: 0, ratingPointsPurged: 0 };
  const { data, error } = await supabase.rpc('admin_purge_old_audit_logs');
  if (error) throw error;
  // A set-returning function: one row.
  const row = (Array.isArray(data) ? data[0] : data) as
    | { edits_purged: number; rating_points_purged: number }
    | undefined;
  return {
    editsPurged: Number(row?.edits_purged ?? 0),
    ratingPointsPurged: Number(row?.rating_points_purged ?? 0),
  };
}

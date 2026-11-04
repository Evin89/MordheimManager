import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';
import type { Warband } from '../types';

/**
 * §4.9.4.2 — one player's warbands, soft-deleted included (migration 0056).
 * Metadata only: never the roster jsonb.
 */
export type AdminUserWarband = {
  id: string;
  name: string;
  warband_type: string;
  visibility: 'public' | 'private';
  rating: number;
  campaign_id: string | null;
  campaign_name: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  edits_total: number;
  edits_30d: number;
};

export async function fetchAdminUserWarbands(userId: string): Promise<AdminUserWarband[]> {
  if (isDemoMode()) return demo.fetchAdminUserWarbands(userId);
  const { data, error } = await supabase.rpc('admin_user_warbands', { p_user_id: userId });
  if (error) throw error;
  return (data ?? []) as AdminUserWarband[];
}

/**
 * §4.9.4.3 — any warband's roster, read-only (migration 0056). The only admin
 * read that returns roster content; the function logs every call to
 * `admin_roster_views`. BTB objectives are never part of it.
 */
export type AdminWarbandRoster = {
  id: string;
  name: string;
  warband_type: string;
  owner_id: string;
  owner_name: string | null;
  visibility: 'public' | 'private';
  campaign_name: string | null;
  updated_at: string;
  deleted_at: string | null;
  data: Warband;
};

export async function fetchAdminWarbandRoster(warbandId: string): Promise<AdminWarbandRoster> {
  if (isDemoMode()) return demo.fetchAdminWarbandRoster(warbandId);
  const { data, error } = await supabase.rpc('admin_warband_roster', { p_warband_id: warbandId });
  if (error) throw error;
  return data as AdminWarbandRoster;
}

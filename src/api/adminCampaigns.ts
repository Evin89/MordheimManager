import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';

/**
 * §4.9.5 admin campaign view — metadata and counts only (§4.9.7), through the
 * SECURITY DEFINER RPCs in migration 0026 that bypass RLS so an admin can see a
 * private campaign they aren't a member of, without exposing its content.
 */

export type AdminCampaignRow = {
  id: string;
  name: string;
  visibility: string;
  creator_id: string;
  creator_name: string | null;
  created_at: string;
  member_count: number;
  leader_count: number;
  battle_count: number;
  event_count: number;
  warband_count: number;
  last_activity: string | null;
};

export type AdminCampaignMember = {
  user_id: string;
  display_name: string | null;
  role: string;
  warband_name: string | null;
  warband_type: string | null;
};

export type AdminCampaignDetail = {
  campaign: AdminCampaignRow;
  members: AdminCampaignMember[];
};

/** A campaign is "stranded" (§10.3.1) with ≤1 leader and no activity in 30 days. */
export function isStranded(row: {
  leader_count: number;
  last_activity: string | null;
}): boolean {
  const stale =
    !row.last_activity || Date.now() - new Date(row.last_activity).getTime() > 30 * 86_400_000;
  return row.leader_count <= 1 && stale;
}

export async function fetchAdminCampaigns(
  search?: string,
  before?: string,
  lim = 25,
): Promise<AdminCampaignRow[]> {
  if (isDemoMode()) return demo.fetchAdminCampaigns(search);
  const { data, error } = await supabase.rpc('admin_campaign_overview', {
    p_search: search || null,
    p_before: before || null,
    p_lim: lim,
  });
  if (error) throw error;
  return (data ?? []) as AdminCampaignRow[];
}

export async function fetchAdminCampaignDetail(id: string): Promise<AdminCampaignDetail> {
  if (isDemoMode()) return demo.fetchAdminCampaignDetail(id);
  const { data, error } = await supabase.rpc('admin_campaign_detail', { p_campaign_id: id });
  if (error) throw error;
  return data as AdminCampaignDetail;
}

export async function fetchStrandedCampaignCount(): Promise<number> {
  if (isDemoMode()) return demo.fetchStrandedCampaignCount();
  const { data, error } = await supabase.rpc('admin_stranded_campaign_count');
  if (error) throw error;
  return (data as number) ?? 0;
}

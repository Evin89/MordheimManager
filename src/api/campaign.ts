import { supabase } from '../lib/supabaseClient';
import { Campaign } from '../types';

type CampaignRow = {
  id: string;
  name: string;
  uses_btb: boolean;
  visibility: 'public' | 'private';
  join_code: string | null;
  created_by: string;
  notes: string;
  created_at: string;
};

function toCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    usesBTB: row.uses_btb,
    visibility: row.visibility,
    joinCode: row.join_code,
    createdBy: row.created_by,
    notes: row.notes,
  };
}

/** Every player currently owns/leads at most one campaign in this pass (no join-code UI yet). */
export async function fetchMyCampaign(userId: string): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toCampaign(data as CampaignRow) : null;
}

/** Atomic via RPC: also adds the creator as campaign_leader (see 0001_init.sql). */
export async function createCampaign(name: string, usesBtb: boolean): Promise<Campaign> {
  const { data, error } = await supabase.rpc('create_campaign', { p_name: name, p_uses_btb: usesBtb });
  if (error) throw error;
  return toCampaign(data as CampaignRow);
}

export async function updateCampaign(campaign: Campaign): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .update({ name: campaign.name, uses_btb: campaign.usesBTB, notes: campaign.notes })
    .eq('id', campaign.id)
    .select()
    .single();
  if (error) throw error;
  return toCampaign(data as CampaignRow);
}

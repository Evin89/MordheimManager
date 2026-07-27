import { supabase } from '../lib/supabaseClient';
import { BattleRecord } from '../types';

type BattleRow = {
  id: string;
  campaign_id: string;
  reported_by: string;
  data: BattleRecord;
  created_at: string;
};

export async function fetchBattles(campaignId: string): Promise<BattleRecord[]> {
  const { data, error } = await supabase
    .from('battles')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as BattleRow[]).map((row) => row.data);
}

export async function insertBattle(campaignId: string, reportedBy: string, battle: BattleRecord): Promise<BattleRecord> {
  const { data, error } = await supabase
    .from('battles')
    .insert({ id: battle.id, campaign_id: campaignId, reported_by: reportedBy, data: battle })
    .select()
    .single();
  if (error) throw error;
  return (data as BattleRow).data;
}

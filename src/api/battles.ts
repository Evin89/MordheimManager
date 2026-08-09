import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';
import { BattleRecord } from '../types';

type BattleRow = {
  id: string;
  campaign_id: string;
  reported_by: string;
  data: BattleRecord;
  created_at: string;
};

export async function fetchBattles(campaignId: string): Promise<BattleRecord[]> {
  if (isDemoMode()) return demo.fetchBattles(campaignId);
  const { data, error } = await supabase
    .from('battles')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as BattleRow[]).map((row) => row.data);
}

/** Battles the user fought outside any campaign. Personal by definition — RLS
 * only returns campaign-less rows to whoever reported them. */
export async function fetchPersonalBattles(userId: string): Promise<BattleRecord[]> {
  if (isDemoMode()) return demo.fetchPersonalBattles(userId);
  const { data, error } = await supabase
    .from('battles')
    .select('*')
    .is('campaign_id', null)
    .eq('reported_by', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as BattleRow[]).map((row) => row.data);
}

/** `campaignId` is null for a one-off battle outside a campaign — the app no
 * longer invents a campaign just to have somewhere to file the record. */
export async function insertBattle(
  campaignId: string | null,
  reportedBy: string,
  battle: BattleRecord,
): Promise<BattleRecord> {
  if (isDemoMode()) return demo.insertBattle(campaignId, reportedBy, battle);
  const { data, error } = await supabase
    .from('battles')
    .insert({ id: battle.id, campaign_id: campaignId, reported_by: reportedBy, data: battle })
    .select()
    .single();
  if (error) throw error;
  return (data as BattleRow).data;
}

/**
 * Removes one entry from the battle log.
 *
 * Whoever reported it, or the campaign leader — the `battles_delete` policy
 * decides, and it has allowed this since 0005 with nothing calling it. A
 * mistyped result was previously permanent.
 *
 * Deleting the record does not touch the warbands: Experience and injuries were
 * applied at commit time and are part of the roster now. Use the post-battle
 * undo for that, which is a separate, single-level thing.
 */
export async function deleteBattle(id: string): Promise<void> {
  if (isDemoMode()) return demo.deleteBattle(id);
  const { error } = await supabase.from('battles').delete().eq('id', id);
  if (error) throw error;
}

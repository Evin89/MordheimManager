import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';

/**
 * A narrative log entry — a story between games (spec §17.3), distinct from a
 * BattleRecord's tally. `authorDisplayName` is denormalised onto the row the
 * same way StandingsRow denormalises player names: a log list would otherwise
 * join profiles per entry.
 */
export type CampaignLogEntry = {
  id: string;
  campaignId: string;
  authorId: string;
  authorDisplayName: string;
  title: string;
  body: string;
  battleId: string | null;
  createdAt: string;
};

type LogRow = {
  id: string;
  campaign_id: string;
  author_id: string;
  title: string;
  body: string | null;
  battle_id: string | null;
  created_at: string;
  profiles: { display_name: string } | null;
};

function toEntry(row: LogRow): CampaignLogEntry {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    authorId: row.author_id,
    authorDisplayName: row.profiles?.display_name || '',
    title: row.title,
    body: row.body ?? '',
    battleId: row.battle_id,
    createdAt: row.created_at,
  };
}

export async function fetchCampaignLog(campaignId: string): Promise<CampaignLogEntry[]> {
  if (isDemoMode()) return demo.fetchCampaignLog(campaignId);
  const { data, error } = await supabase
    .from('campaign_log_entries')
    .select('id, campaign_id, author_id, title, body, battle_id, created_at, profiles (display_name)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as LogRow[]).map(toEntry);
}

export async function createCampaignLogEntry(
  campaignId: string,
  authorId: string,
  fields: { title: string; body: string; battleId: string | null },
): Promise<CampaignLogEntry> {
  if (isDemoMode()) return demo.createCampaignLogEntry(campaignId, authorId, fields);
  const { data, error } = await supabase
    .from('campaign_log_entries')
    .insert({
      campaign_id: campaignId,
      author_id: authorId,
      title: fields.title.trim(),
      body: fields.body.trim(),
      battle_id: fields.battleId,
    })
    .select('id, campaign_id, author_id, title, body, battle_id, created_at, profiles (display_name)')
    .single();
  if (error) throw error;
  return toEntry(data as unknown as LogRow);
}

/** Author or campaign leader — the 0017 policy decides, not a client check. */
export async function deleteCampaignLogEntry(id: string): Promise<void> {
  if (isDemoMode()) return demo.deleteCampaignLogEntry(id);
  const { error } = await supabase.from('campaign_log_entries').delete().eq('id', id);
  if (error) throw error;
}

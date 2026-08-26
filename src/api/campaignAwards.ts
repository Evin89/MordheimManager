import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';

/**
 * §17.4 (manual) — an honour a campaign leader has granted to a warband. The
 * recipient's name is resolved on the screen from the campaign warband list (as
 * territories do), so this stays a thin row.
 */
export type CampaignAwardRecord = {
  id: string;
  campaignId: string;
  warbandId: string;
  title: string;
  note: string;
  /** When it was granted — newest first in the list, and the activity feed's timestamp. */
  createdAt: string;
};

type CampaignAwardRow = {
  id: string;
  campaign_id: string;
  warband_id: string;
  title: string;
  note: string | null;
  created_at?: string;
};

const COLUMNS = 'id, campaign_id, warband_id, title, note, created_at';

function toAward(row: CampaignAwardRow): CampaignAwardRecord {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    warbandId: row.warband_id,
    title: row.title,
    note: row.note ?? '',
    createdAt: row.created_at ?? '',
  };
}

export async function fetchCampaignAwards(campaignId: string): Promise<CampaignAwardRecord[]> {
  if (isDemoMode()) return demo.fetchCampaignAwards(campaignId);
  const { data, error } = await supabase
    .from('campaign_awards')
    .select(COLUMNS)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as CampaignAwardRow[]).map(toAward);
}

export async function createCampaignAward(
  campaignId: string,
  createdBy: string,
  fields: { warbandId: string; title: string; note: string },
): Promise<CampaignAwardRecord> {
  if (isDemoMode()) return demo.createCampaignAward(campaignId, fields);
  const { data, error } = await supabase
    .from('campaign_awards')
    .insert({
      campaign_id: campaignId,
      warband_id: fields.warbandId,
      title: fields.title.trim(),
      note: fields.note.trim() || null,
      created_by: createdBy,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toAward(data as CampaignAwardRow);
}

export async function deleteCampaignAward(id: string): Promise<void> {
  if (isDemoMode()) return demo.deleteCampaignAward(id);
  const { error } = await supabase.from('campaign_awards').delete().eq('id', id);
  if (error) throw error;
}

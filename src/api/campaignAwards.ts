import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';

/**
 * §17.4 (manual) — an honour a campaign leader has granted to a warband. The
 * recipient's name is resolved on the screen from the campaign warband list (as
 * territories do), so this stays a thin row.
 */
/** 'honour' — a leader granted it by hand; 'computed' — a §17.4 award frozen
 * onto its warband when the campaign concluded. */
export type AwardKind = 'honour' | 'computed';

export type CampaignAwardRecord = {
  id: string;
  campaignId: string;
  warbandId: string;
  title: string;
  note: string;
  kind: AwardKind;
  /** The computed award's id (e.g. 'most-battles') for badge art; null for an honour. */
  awardKey: string | null;
  /** When it was granted — newest first in the list, and the activity feed's timestamp. */
  createdAt: string;
};

type CampaignAwardRow = {
  id: string;
  campaign_id: string;
  warband_id: string;
  title: string;
  note: string | null;
  kind?: AwardKind;
  award_key?: string | null;
  created_at?: string;
};

const COLUMNS = 'id, campaign_id, warband_id, title, note, kind, award_key, created_at';

function toAward(row: CampaignAwardRow): CampaignAwardRecord {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    warbandId: row.warband_id,
    title: row.title,
    note: row.note ?? '',
    kind: row.kind ?? 'honour',
    awardKey: row.award_key ?? null,
    createdAt: row.created_at ?? '',
  };
}

/** An award as shown on a warband's own roster — carries the campaign it was won
 * in, since the roster spans every campaign the warband has fought. */
export type WarbandAwardRecord = CampaignAwardRecord & { campaignName: string };

type WarbandAwardRow = CampaignAwardRow & { campaigns: { name: string } | null };

/** Every award a warband holds, newest first — honours from live campaigns and
 * the computed awards frozen in when a campaign concluded. Readable wherever the
 * warband's campaign is (owner, member, or a public campaign — the 0027 select
 * policy). */
export async function fetchWarbandAwards(warbandId: string): Promise<WarbandAwardRecord[]> {
  if (isDemoMode()) return demo.fetchWarbandAwards(warbandId);
  const { data, error } = await supabase
    .from('campaign_awards')
    .select(`${COLUMNS}, campaigns (name)`)
    .eq('warband_id', warbandId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as WarbandAwardRow[]).map((row) => ({
    ...toAward(row),
    campaignName: row.campaigns?.name ?? '',
  }));
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

/** Freeze the §17.4 computed winners onto their warbands as a campaign concludes.
 * Replaces any prior computed rows for the campaign first, so a reopen-then-
 * reconclude never duplicates. Leader-only, via the 0027 insert/delete policies. */
export async function saveComputedCampaignAwards(
  campaignId: string,
  createdBy: string,
  awards: { warbandId: string; title: string; awardKey: string }[],
): Promise<void> {
  if (isDemoMode()) return;
  await deleteComputedCampaignAwards(campaignId);
  if (awards.length === 0) return;
  const { error } = await supabase.from('campaign_awards').insert(
    awards.map((a) => ({
      campaign_id: campaignId,
      warband_id: a.warbandId,
      title: a.title,
      kind: 'computed',
      award_key: a.awardKey,
      created_by: createdBy,
    })),
  );
  if (error) throw error;
}

/** Remove a campaign's frozen computed awards — on reopen, or before a
 * re-conclude refreshes them. Leaves leader-granted honours untouched. */
export async function deleteComputedCampaignAwards(campaignId: string): Promise<void> {
  if (isDemoMode()) return;
  const { error } = await supabase
    .from('campaign_awards')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('kind', 'computed');
  if (error) throw error;
}

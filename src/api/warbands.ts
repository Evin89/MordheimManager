import { supabase } from '../lib/supabaseClient';
import { computeWarbandRating } from '../lib/rating';
import { Warband, WarbandVisibility } from '../types';
import { ConcurrencyError, PGRST_NO_ROWS } from './errors';

type WarbandRow = {
  id: string;
  owner_id: string;
  campaign_id: string | null;
  name: string;
  warband_type: string;
  visibility: WarbandVisibility;
  data: Warband;
  rating: number;
  previous_data: Warband | null;
  previous_data_at: string | null;
  updated_at: string;
  created_at: string;
};

export type WarbandRecord = {
  warband: Warband;
  updatedAt: string;
  hasSnapshot: boolean;
  /** Campaign this warband is entered in, or null when it's a standalone warband. */
  campaignId: string | null;
  /** Governs reads from *outside* the campaign only — campaign-mates always see it. */
  visibility: WarbandVisibility;
};

function toRecord(row: WarbandRow): WarbandRecord {
  return {
    warband: row.data,
    updatedAt: row.updated_at,
    hasSnapshot: row.previous_data !== null,
    campaignId: row.campaign_id,
    visibility: row.visibility,
  };
}

export async function fetchWarbands(ownerId: string): Promise<WarbandRecord[]> {
  const { data, error } = await supabase
    .from('warbands')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as WarbandRow[]).map(toRecord);
}

export async function insertWarband(ownerId: string, warband: Warband): Promise<WarbandRecord> {
  const { data, error } = await supabase
    .from('warbands')
    .insert({
      id: warband.id,
      owner_id: ownerId,
      name: warband.name,
      warband_type: warband.warbandType,
      data: warband,
      rating: computeWarbandRating(warband),
    })
    .select()
    .single();
  if (error) throw error;
  return toRecord(data as WarbandRow);
}

/** Plain field save (name/gold/roster edits) — not a battle commit, so no snapshot is taken. */
export async function updateWarband(
  id: string,
  ownerId: string,
  warband: Warband,
  expectedUpdatedAt: string,
): Promise<WarbandRecord> {
  const { data, error } = await supabase
    .from('warbands')
    .update({
      name: warband.name,
      warband_type: warband.warbandType,
      data: warband,
      rating: computeWarbandRating(warband),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('owner_id', ownerId)
    .eq('updated_at', expectedUpdatedAt)
    .select()
    .single();
  if (error) {
    if (error.code === PGRST_NO_ROWS) throw new ConcurrencyError();
    throw error;
  }
  return toRecord(data as WarbandRow);
}

/** Post-battle wizard commit: stages the pre-battle warband as the single-level undo snapshot. */
export async function commitBattleUpdate(
  id: string,
  ownerId: string,
  previousWarband: Warband,
  newWarband: Warband,
  expectedUpdatedAt: string,
): Promise<WarbandRecord> {
  const { data, error } = await supabase
    .from('warbands')
    .update({
      name: newWarband.name,
      warband_type: newWarband.warbandType,
      data: newWarband,
      rating: computeWarbandRating(newWarband),
      previous_data: previousWarband,
      previous_data_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('owner_id', ownerId)
    .eq('updated_at', expectedUpdatedAt)
    .select()
    .single();
  if (error) {
    if (error.code === PGRST_NO_ROWS) throw new ConcurrencyError();
    throw error;
  }
  return toRecord(data as WarbandRow);
}

/** Rolls back to the single-level undo snapshot, if one exists. Returns null if there was none. */
export async function undoLastBattle(id: string, ownerId: string): Promise<WarbandRecord | null> {
  const { data: current, error: fetchError } = await supabase
    .from('warbands')
    .select('previous_data')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .single();
  if (fetchError) throw fetchError;
  const previous = (current as { previous_data: Warband | null }).previous_data;
  if (!previous) return null;

  const { data, error } = await supabase
    .from('warbands')
    .update({
      name: previous.name,
      warband_type: previous.warbandType,
      data: previous,
      rating: computeWarbandRating(previous),
      previous_data: null,
      previous_data_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('owner_id', ownerId)
    .select()
    .single();
  if (error) throw error;
  return toRecord(data as WarbandRow);
}

export async function deleteWarband(id: string, ownerId: string): Promise<void> {
  const { error } = await supabase.from('warbands').delete().eq('id', id).eq('owner_id', ownerId);
  if (error) throw error;
}

/**
 * Enters a warband into a campaign, or withdraws it with `null`.
 *
 * Doesn't touch `updated_at`, so this deliberately sits outside the optimistic
 * concurrency check that guards roster edits — entering a campaign isn't a
 * change to the warband's game state and shouldn't collide with one.
 *
 * The database rejects a campaign the owner isn't a member of (see the
 * `warbands_update_own` WITH CHECK in 0002), so this can't be used to push a
 * warband into someone else's standings.
 */
export async function setWarbandCampaign(
  id: string,
  ownerId: string,
  campaignId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('warbands')
    .update({ campaign_id: campaignId })
    .eq('id', id)
    .eq('owner_id', ownerId);
  if (error) throw error;
}

export async function setWarbandVisibility(
  id: string,
  ownerId: string,
  visibility: WarbandVisibility,
): Promise<void> {
  const { error } = await supabase
    .from('warbands')
    .update({ visibility })
    .eq('id', id)
    .eq('owner_id', ownerId);
  if (error) throw error;
}

export type CampaignWarbandRow = {
  id: string;
  ownerId: string;
  name: string;
  warbandType: string;
  rating: number;
};

/**
 * Every warband entered in a campaign, whatever its own visibility — per spec
 * 8.3, visibility never hides a warband from its own campaign.
 */
export async function fetchCampaignWarbands(campaignId: string): Promise<CampaignWarbandRow[]> {
  const { data, error } = await supabase
    .from('warbands')
    .select('id, owner_id, name, warband_type, rating')
    .eq('campaign_id', campaignId)
    .order('rating', { ascending: false });
  if (error) throw error;

  return (data as { id: string; owner_id: string; name: string; warband_type: string; rating: number }[]).map(
    (row) => ({
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      warbandType: row.warband_type,
      rating: row.rating,
    }),
  );
}

/**
 * One campaign-mate's roster, read-only. Relies entirely on the `warbands_select`
 * policy to decide whether this is allowed — there is no client-side check here,
 * because a client-side check wouldn't be a security boundary. Returns null when
 * RLS filters the row out.
 */
export async function fetchSharedWarband(id: string): Promise<Warband | null> {
  const { data, error } = await supabase.from('warbands').select('data').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? (data as { data: Warband }).data : null;
}

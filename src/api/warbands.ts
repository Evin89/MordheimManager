import { supabase } from '../lib/supabaseClient';
import { computeWarbandRating } from '../lib/rating';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';
import { PublicWarbandRow, Warband, WarbandVisibility } from '../types';
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
  if (isDemoMode()) return demo.fetchWarbands(ownerId);
  const { data, error } = await supabase
    .from('warbands')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as WarbandRow[]).map(toRecord);
}

export async function insertWarband(ownerId: string, warband: Warband): Promise<WarbandRecord> {
  if (isDemoMode()) return demo.insertWarband(ownerId, warband);
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
  if (isDemoMode()) return demo.updateWarband(id, ownerId, warband, expectedUpdatedAt);
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
  if (isDemoMode()) {
    return demo.commitBattleUpdate(id, ownerId, previousWarband, newWarband, expectedUpdatedAt);
  }
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
  if (isDemoMode()) return demo.undoLastBattle(id, ownerId);
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

/**
 * Soft-deletes a warband.
 *
 * An UPDATE, not a DELETE: this is the one action in the app that destroys work
 * nobody can reconstruct — a season of Experience, advances and injuries — so
 * the row stays and every read path filters it out through RLS (migration
 * 0009). Recovering one is `update warbands set deleted_at = null` in the
 * dashboard, rather than an apology.
 *
 * Battles are left alone deliberately: they are the campaign's history, and a
 * deleted warband's games still happened.
 */
export async function deleteWarband(id: string, ownerId: string): Promise<void> {
  if (isDemoMode()) return demo.deleteWarband(id, ownerId);
  const { error } = await supabase
    .from('warbands')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', ownerId);
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
  if (isDemoMode()) return demo.setWarbandCampaign(id, ownerId, campaignId);
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
  if (isDemoMode()) return demo.setWarbandVisibility(id, ownerId, visibility);
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
  /** Owner's display name — the pre-battle opponent picker needs to say whose
   * warband it is, since two players can field the same warband type. */
  playerName: string;
};

type CampaignWarbandQueryRow = {
  id: string;
  owner_id: string;
  name: string;
  warband_type: string;
  rating: number;
  profiles: { display_name: string } | null;
};

/**
 * Every warband entered in a campaign, whatever its own visibility — per spec
 * 8.3, visibility never hides a warband from its own campaign.
 */
export async function fetchCampaignWarbands(campaignId: string): Promise<CampaignWarbandRow[]> {
  if (isDemoMode()) return demo.fetchCampaignWarbands(campaignId);
  const { data, error } = await supabase
    .from('warbands')
    .select('id, owner_id, name, warband_type, rating, profiles (display_name)')
    .eq('campaign_id', campaignId)
    .order('rating', { ascending: false });
  if (error) throw error;

  return (data as unknown as CampaignWarbandQueryRow[]).map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    warbandType: row.warband_type,
    rating: row.rating,
    playerName: row.profiles?.display_name || '',
  }));
}

/** Rows per page in the gallery.
 *
 * Was a single hard `.limit(200)`, which is both too much to send someone who
 * looks at the first screenful and a silent ceiling once the gallery passes it.
 *
 * Paged with `.range()` rather than a keyset cursor, deliberately: the sort key
 * is `rating`, which changes every time a warband gains Experience, so a cursor
 * over it is no more stable than an offset — a row can move across the boundary
 * either way. Neither is exact under concurrent edits, and the offset version is
 * far harder to get wrong. Revisit if the gallery reaches thousands of rows,
 * where OFFSET's cost actually bites.
 */
export const PUBLIC_WARBAND_PAGE_SIZE = 24;

export type PublicWarbandPage = {
  rows: PublicWarbandRow[];
  /** Offset to pass as the next page's cursor, or null at the end. */
  nextCursor: number | null;
};

/**
 * Every warband its owner has marked public.
 *
 * The `visibility = 'public'` filter is a *narrowing*, not the access control —
 * RLS would also return your own private warbands and your campaign-mates'
 * rosters on this table, and this screen is specifically the public gallery, so
 * it asks for exactly that. Reading still requires a session; there is no
 * signed-out browsing of other people's warbands.
 */
export async function fetchPublicWarbands(cursor = 0): Promise<PublicWarbandPage> {
  if (isDemoMode()) return demo.fetchPublicWarbands(cursor);
  const { data, error } = await supabase
    .from('warbands')
    .select('id, owner_id, name, warband_type, rating, profiles (display_name)')
    .eq('visibility', 'public')
    // `id` breaks ties: ordering by rating alone leaves rows with equal ratings
    // in an arbitrary order per request, which pages can duplicate or skip.
    .order('rating', { ascending: false })
    .order('id', { ascending: true })
    .range(cursor, cursor + PUBLIC_WARBAND_PAGE_SIZE - 1);
  if (error) throw error;

  const rows = (
    data as unknown as {
      id: string;
      owner_id: string;
      name: string;
      warband_type: string;
      rating: number;
      profiles: { display_name: string } | null;
    }[]
  ).map((row) => ({
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    warbandType: row.warband_type,
    playerName: row.profiles?.display_name || '',
    rating: row.rating,
  }));

  return {
    rows,
    // A short page means the end. Costs nothing, where asking for an exact
    // count would be a second query on every page.
    nextCursor: rows.length < PUBLIC_WARBAND_PAGE_SIZE ? null : cursor + rows.length,
  };
}

/**
 * One campaign-mate's roster, read-only. Relies entirely on the `warbands_select`
 * policy to decide whether this is allowed — there is no client-side check here,
 * because a client-side check wouldn't be a security boundary. Returns null when
 * RLS filters the row out.
 */
export async function fetchSharedWarband(id: string): Promise<Warband | null> {
  if (isDemoMode()) return demo.fetchSharedWarband(id);
  const { data, error } = await supabase.from('warbands').select('data').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? (data as { data: Warband }).data : null;
}

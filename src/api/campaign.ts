import { supabase } from '../lib/supabaseClient';
import { CampaignWarbandRow, fetchCampaignWarbands } from './warbands';
import { Campaign, CampaignMember, CampaignRole, CampaignVisibility, StandingsRow } from '../types';

type CampaignRow = {
  id: string;
  name: string;
  uses_btb: boolean;
  visibility: CampaignVisibility;
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

/**
 * Every campaign the user belongs to, leading or joined.
 *
 * Membership is the source of truth, not `created_by` — a player who joined
 * someone else's campaign never created a row in `campaigns`. The nested select
 * goes through `campaign_members` so RLS resolves it in one round trip.
 */
export async function fetchMyCampaigns(userId: string): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaign_members')
    .select('role, campaigns (*)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });
  if (error) throw error;

  return (data as unknown as { campaigns: CampaignRow | null }[])
    .map((row) => row.campaigns)
    .filter((row): row is CampaignRow => row !== null)
    .map(toCampaign);
}

/** Atomic via RPC: also adds the creator as campaign_leader and issues a join code. */
export async function createCampaign(name: string, usesBtb: boolean): Promise<Campaign> {
  const { data, error } = await supabase.rpc('create_campaign', { p_name: name, p_uses_btb: usesBtb });
  if (error) throw error;
  return toCampaign(data as CampaignRow);
}

export async function updateCampaign(campaign: Campaign): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .update({
      name: campaign.name,
      uses_btb: campaign.usesBTB,
      notes: campaign.notes,
      visibility: campaign.visibility,
    })
    .eq('id', campaign.id)
    .select()
    .single();
  if (error) throw error;
  return toCampaign(data as CampaignRow);
}

/**
 * Joins via the SECURITY DEFINER RPC — `campaign_members` is never directly
 * client-writable, and the RPC is also what lets a code find a *private*
 * campaign the caller can't yet SELECT.
 */
export async function joinCampaignByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_campaign_by_code', { p_code: code });
  if (error) throw error;
  // The RPC returns the campaign_members row; its campaign_id is what the
  // caller needs to switch the user into the campaign they just joined.
  return (data as { campaign_id: string }).campaign_id;
}

/** Leader-only; invalidates the previous code. */
export async function regenerateJoinCode(campaignId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_join_code', { p_campaign_id: campaignId });
  if (error) throw error;
  return data as string;
}

type MemberRow = {
  user_id: string;
  role: CampaignRole;
  joined_at: string;
  profiles: { display_name: string } | null;
};

export async function fetchCampaignMembers(campaignId: string): Promise<CampaignMember[]> {
  const { data, error } = await supabase
    .from('campaign_members')
    .select('user_id, role, joined_at, profiles (display_name)')
    .eq('campaign_id', campaignId)
    .order('joined_at', { ascending: true });
  if (error) throw error;

  return (data as unknown as MemberRow[]).map((row) => ({
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
    displayName: row.profiles?.display_name || '',
  }));
}

/**
 * Standings, built from the member list outwards.
 *
 * Listing warbands and reading the player off each one seems natural but drops
 * anyone who hasn't entered a warband — most often the leader, who tends to set
 * the campaign up before building a roster, and so appeared nowhere in their own
 * campaign. Starting from membership means every player is present, with their
 * warband attached when they have one.
 *
 * Win/loss/draw counts come from the caller's battle records rather than a
 * second query — the campaign's battle log is already loaded on this screen,
 * and every battle carries the `warbandId` it belongs to.
 */
export async function fetchCampaignStandings(
  campaignId: string,
  results: { warbandId: string; result: 'win' | 'loss' | 'draw' }[],
): Promise<StandingsRow[]> {
  const [members, warbands] = await Promise.all([
    fetchCampaignMembers(campaignId),
    fetchCampaignWarbands(campaignId),
  ]);
  return buildStandingsRows(members, warbands, results);
}

/** The assembly and ordering rules, separated from the fetching so they can be
 * exercised directly. See {@link fetchCampaignStandings} for the why. */
export function buildStandingsRows(
  members: CampaignMember[],
  warbands: CampaignWarbandRow[],
  results: { warbandId: string; result: 'win' | 'loss' | 'draw' }[],
): StandingsRow[] {
  const record = (warbandId: string) => {
    const mine = results.filter((r) => r.warbandId === warbandId);
    return {
      wins: mine.filter((r) => r.result === 'win').length,
      losses: mine.filter((r) => r.result === 'loss').length,
      draws: mine.filter((r) => r.result === 'draw').length,
    };
  };

  const rows: StandingsRow[] = [];
  for (const member of members) {
    const theirs = warbands.filter((w) => w.ownerId === member.userId);
    if (theirs.length === 0) {
      rows.push({
        ownerId: member.userId,
        playerName: member.displayName,
        role: member.role,
        warbandId: null,
        warbandName: null,
        warbandType: null,
        rating: null,
        wins: 0,
        losses: 0,
        draws: 0,
      });
      continue;
    }
    // Nothing stops a player entering two warbands, so give each its own row
    // rather than silently showing only the first.
    for (const warband of theirs) {
      rows.push({
        ownerId: member.userId,
        playerName: member.displayName,
        role: member.role,
        warbandId: warband.id,
        warbandName: warband.name,
        warbandType: warband.warbandType,
        rating: warband.rating,
        ...record(warband.id),
      });
    }
  }

  // Highest rating first; players yet to enter a warband sit at the bottom.
  return rows.sort((a, b) => {
    if (a.rating === null && b.rating === null) return a.playerName.localeCompare(b.playerName);
    if (a.rating === null) return 1;
    if (b.rating === null) return -1;
    return b.rating - a.rating;
  });
}

/**
 * Doubles as "leave" and "remove a player": RLS allows the delete when the row
 * is your own or you lead the campaign, so one call covers both cases.
 */
export async function removeCampaignMember(campaignId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('campaign_members')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('user_id', userId);
  if (error) throw error;
}

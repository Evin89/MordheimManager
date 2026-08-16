import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';
import { CampaignWarbandRow, fetchCampaignWarbands } from './warbands';
import {
  Campaign,
  CampaignMember,
  CampaignRole,
  CampaignSummary,
  CampaignVisibility,
  StandingsRow,
} from '../types';

type CampaignRow = {
  id: string;
  name: string;
  uses_btb: boolean;
  visibility: CampaignVisibility;
  join_code: string | null;
  created_by: string;
  notes: string;
  created_at: string;
  pinned_announcement?: string | null;
  pinned_announcement_at?: string | null;
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
    pinnedAnnouncement: row.pinned_announcement ?? null,
    pinnedAnnouncementAt: row.pinned_announcement_at ?? null,
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
  if (isDemoMode()) return demo.fetchMyCampaigns(userId);
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

/**
 * Every campaign you're in, with your role and enough activity to judge it.
 *
 * Counts are gathered in two queries over all your campaigns at once rather
 * than per campaign — the obvious loop would be one round trip each, which on
 * a phone at a game table is exactly where it hurts. RLS already scopes both
 * tables to campaigns you belong to, so no extra filtering is needed beyond
 * the id list.
 */
export async function fetchCampaignSummaries(userId: string): Promise<CampaignSummary[]> {
  if (isDemoMode()) return demo.fetchCampaignSummaries(userId);
  const { data: memberRows, error } = await supabase
    .from('campaign_members')
    .select('campaign_id, role, campaigns (*)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });
  if (error) throw error;

  const rows = (memberRows ?? []) as unknown as {
    campaign_id: string;
    role: CampaignRole;
    campaigns: CampaignRow | null;
  }[];
  const mine = rows.filter((r) => r.campaigns !== null);
  const ids = mine.map((r) => r.campaign_id);
  if (ids.length === 0) return [];

  const [members, battles, warbands] = await Promise.all([
    supabase.from('campaign_members').select('campaign_id').in('campaign_id', ids),
    supabase.from('battles').select('campaign_id').in('campaign_id', ids),
    supabase.from('warbands').select('campaign_id').eq('owner_id', userId).in('campaign_id', ids),
  ]);

  const tally = (data: { campaign_id: string | null }[] | null) => {
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      if (!row.campaign_id) continue;
      counts.set(row.campaign_id, (counts.get(row.campaign_id) ?? 0) + 1);
    }
    return counts;
  };

  const memberCounts = tally(members.data);
  const battleCounts = tally(battles.data);
  const warbandCounts = tally(warbands.data);

  return mine.map((r) => ({
    campaign: toCampaign(r.campaigns!),
    role: r.role,
    memberCount: memberCounts.get(r.campaign_id) ?? 0,
    battleCount: battleCounts.get(r.campaign_id) ?? 0,
    myWarbandCount: warbandCounts.get(r.campaign_id) ?? 0,
  }));
}

/** Atomic via RPC: also adds the creator as campaign_leader and issues a join code. */
export async function createCampaign(name: string, usesBtb: boolean): Promise<Campaign> {
  if (isDemoMode()) return demo.createCampaign(name, usesBtb);
  const { data, error } = await supabase.rpc('create_campaign', { p_name: name, p_uses_btb: usesBtb });
  if (error) throw error;
  return toCampaign(data as CampaignRow);
}

export async function updateCampaign(campaign: Campaign): Promise<Campaign> {
  if (isDemoMode()) return demo.updateCampaign(campaign);
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
 * §19.3 — pin or clear the campaign's single announcement. Passing null (or an
 * empty string) clears it. Only a leader gets past `campaigns_update_leader`;
 * the client never has to check the role itself. The timestamp is stamped here
 * so the banner can show how fresh the notice is.
 */
export async function setCampaignAnnouncement(
  campaignId: string,
  text: string | null,
): Promise<Campaign> {
  const trimmed = text?.trim() || null;
  if (isDemoMode()) return demo.setCampaignAnnouncement(campaignId, trimmed);
  const { data, error } = await supabase
    .from('campaigns')
    .update({
      pinned_announcement: trimmed,
      pinned_announcement_at: trimmed ? new Date().toISOString() : null,
    })
    .eq('id', campaignId)
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
  if (isDemoMode()) return demo.joinCampaignByCode(code);
  const { data, error } = await supabase.rpc('join_campaign_by_code', { p_code: code });
  if (error) throw error;
  // The RPC returns the campaign_members row; its campaign_id is what the
  // caller needs to switch the user into the campaign they just joined.
  return (data as { campaign_id: string }).campaign_id;
}

/** Leader-only; invalidates the previous code. */
export async function regenerateJoinCode(campaignId: string): Promise<string> {
  if (isDemoMode()) return demo.regenerateJoinCode(campaignId);
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
  if (isDemoMode()) return demo.fetchCampaignMembers(campaignId);
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
/**
 * Hands leadership to another member.
 *
 * An RPC because it necessarily writes two rows the caller cannot both write
 * under RLS: the point is that the caller ends up without the rights they
 * started with, so doing it as two client updates would either lose the
 * permission needed for the second, or leave two leaders if it failed.
 */
export async function transferCampaignLeadership(
  campaignId: string,
  toUserId: string,
): Promise<void> {
  if (isDemoMode()) return demo.transferCampaignLeadership(campaignId, toUserId);
  const { error } = await supabase.rpc('transfer_campaign_leadership', {
    p_campaign_id: campaignId,
    p_to_user_id: toUserId,
  });
  if (error) throw error;
}

/**
 * Promotes a member to co-leader, the caller keeping their own role.
 *
 * The difference from transfer, and the point of it: one leader who stops
 * turning up is otherwise a dead end, since nobody else can rename the
 * campaign, regenerate the code, remove a member or delete it (migration 0012).
 */
export async function grantCampaignLeadership(
  campaignId: string,
  toUserId: string,
): Promise<void> {
  if (isDemoMode()) return demo.grantCampaignLeadership(campaignId, toUserId);
  const { error } = await supabase.rpc('grant_campaign_leadership', {
    p_campaign_id: campaignId,
    p_to_user_id: toUserId,
  });
  if (error) throw error;
}

/**
 * Demotes a leader back to player — any leader may demote any leader, including
 * themselves. Refused by the 0012 trigger if it would leave a campaign that
 * still has members with no leader at all.
 */
export async function revokeCampaignLeadership(
  campaignId: string,
  userId: string,
): Promise<void> {
  if (isDemoMode()) return demo.revokeCampaignLeadership(campaignId, userId);
  const { error } = await supabase.rpc('revoke_campaign_leadership', {
    p_campaign_id: campaignId,
    p_user_id: userId,
  });
  if (error) throw error;
}

/**
 * Deletes a campaign.
 *
 * Only its leader, and only once every other player has gone — enforced by the
 * `campaigns_delete_leader` policy as narrowed in 0011, not here. The client
 * check exists to explain the rule before you try, not to be the rule.
 *
 * Battles, memberships and scheduled events cascade with the row. Warbands do
 * not: the 0003 trigger unlinks them, so they return to being standalone
 * warbands owned by their players.
 */
export async function deleteCampaign(campaignId: string): Promise<void> {
  if (isDemoMode()) return demo.deleteCampaign(campaignId);
  const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
  if (error) throw error;
}

export async function removeCampaignMember(campaignId: string, userId: string): Promise<void> {
  if (isDemoMode()) return demo.removeCampaignMember(campaignId, userId);
  const { error } = await supabase
    .from('campaign_members')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('user_id', userId);
  if (error) throw error;
}

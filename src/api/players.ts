import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';
import { signPhotoUrls } from './photos';
import { insertIssueReport } from './issues';
import type { CampaignRole } from '../types';

/**
 * §38 player profiles.
 *
 * Every profile field beyond the name comes through a SECURITY DEFINER RPC
 * (migration 0058): the new columns aren't client-selectable, so the RPC's
 * return list is the whole of what a profile can expose. Warbands, shared
 * campaigns and honours are plain queries under the existing RLS, so a profile
 * shows exactly what the viewer could already read and nothing more.
 */

const BUCKET = 'images';
export const MAX_BIO = 280;

export type PlayerProfile = {
  id: string;
  displayName: string;
  avatarSeed: string;
  avatarPath: string | null;
  country: string | null;
  bio: string | null;
  favouriteWarbandType: string | null;
  joinedAt: string;
  /** In the directory, and so able to receive direct invites (§38.4). */
  discoverable: boolean;
  lookingForCampaign: boolean;
  stats: {
    battles: number;
    wins: number;
    losses: number;
    draws: number;
    warbands: number;
    campaigns: number;
  };
};

export type ProfileWarbandRow = {
  id: string;
  name: string;
  warbandType: string;
  rating: number;
  visibility: 'public' | 'private';
  campaignId: string | null;
  /** Set when the warband sits in a campaign the viewer can see. */
  campaignName: string | null;
};

export type SharedCampaignRow = { id: string; name: string; role: CampaignRole };

export type PlayerHonour = { id: string; title: string; note: string | null; warbandName: string };

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_seed: string;
  avatar_path: string | null;
  country: string | null;
  bio: string | null;
  favourite_warband_type: string | null;
  joined_at: string;
  battles: number;
  wins: number;
  losses: number;
  draws: number;
  warbands: number;
  campaigns: number;
  discoverable?: boolean;
  looking_for_campaign?: boolean;
};

export async function fetchPlayerProfile(userId: string): Promise<PlayerProfile | null> {
  if (isDemoMode()) return demo.fetchPlayerProfile(userId);
  const { data, error } = await supabase.rpc('get_player_profile', { p_uid: userId });
  if (error) throw error;
  const row = (data as ProfileRow[] | null)?.[0];
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.display_name,
    avatarSeed: row.avatar_seed,
    avatarPath: row.avatar_path,
    country: row.country,
    bio: row.bio,
    favouriteWarbandType: row.favourite_warband_type,
    joinedAt: row.joined_at,
    discoverable: !!row.discoverable,
    lookingForCampaign: !!row.looking_for_campaign,
    stats: {
      battles: row.battles,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      warbands: row.warbands,
      campaigns: row.campaigns,
    },
  };
}

/** Photo paths for a list of players, in one call. Players without a photo are
 * simply absent from the result. */
export async function fetchAvatarPaths(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0 || isDemoMode()) return {};
  const { data, error } = await supabase.rpc('get_avatar_paths', { p_ids: userIds });
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of (data as { id: string; avatar_path: string }[] | null) ?? []) {
    map[row.id] = row.avatar_path;
  }
  return map;
}

export { signPhotoUrls as signAvatarUrls };

export type ProfileInput = {
  displayName: string;
  bio: string;
  favouriteWarbandType: string;
  country: string;
};

export async function updateMyProfile(userId: string, input: ProfileInput): Promise<void> {
  if (isDemoMode()) return demo.updateMyProfile(userId, input);
  const { error } = await supabase.rpc('update_my_profile', {
    p_display_name: input.displayName,
    p_bio: input.bio,
    p_favourite_warband_type: input.favouriteWarbandType,
    p_country: input.country,
  });
  if (error) throw error;
}

/**
 * Uploads a processed photo and records it, replacing any existing one.
 *
 * The same order as warband photos (api/photos.ts): bytes to a fresh path
 * first, then the row, then delete what the row used to point at. A failed
 * record leaves the old photo intact and the new object orphaned, which is
 * the failure the user can't see.
 */
export async function uploadMyAvatar(userId: string, image: Blob): Promise<string> {
  if (isDemoMode()) throw new Error('Photos are not available in demo mode.');
  const path = `avatars/${userId}/${Date.now()}.webp`;
  const up = await supabase.storage.from(BUCKET).upload(path, image, {
    contentType: 'image/webp',
    upsert: false,
  });
  if (up.error) throw up.error;

  const { data: previous, error } = await supabase.rpc('set_my_avatar', { p_path: path });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
  if (previous) await supabase.storage.from(BUCKET).remove([previous as string]);
  return path;
}

export async function clearMyAvatar(): Promise<void> {
  if (isDemoMode()) return;
  const { data: previous, error } = await supabase.rpc('clear_my_avatar');
  if (error) throw error;
  if (previous) await supabase.storage.from(BUCKET).remove([previous as string]);
}

export async function rerollMyAvatar(): Promise<void> {
  if (isDemoMode()) return;
  const { error } = await supabase.rpc('reroll_my_avatar');
  if (error) throw error;
}

/**
 * The player's warbands that the viewer may read. RLS decides: public ones,
 * plus private ones in a campaign the viewer belongs to (§8.3). The campaign
 * names come from a second query that RLS narrows the same way, so a campaign
 * the viewer isn't in never gets named.
 */
export async function fetchProfileWarbands(userId: string): Promise<ProfileWarbandRow[]> {
  if (isDemoMode()) return demo.fetchProfileWarbands(userId);
  const { data, error } = await supabase
    .from('warbands')
    .select('id, name, warband_type, rating, visibility, campaign_id')
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .order('rating', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as {
    id: string;
    name: string;
    warband_type: string;
    rating: number | null;
    visibility: 'public' | 'private';
    campaign_id: string | null;
  }[];
  const campaignIds = [...new Set(rows.map((r) => r.campaign_id).filter((id): id is string => !!id))];
  const names = new Map<string, string>();
  if (campaignIds.length) {
    const { data: campaigns, error: cErr } = await supabase
      .from('campaigns')
      .select('id, name')
      .in('id', campaignIds);
    if (cErr) throw cErr;
    for (const c of campaigns ?? []) names.set(c.id as string, c.name as string);
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    warbandType: r.warband_type,
    rating: r.rating ?? 0,
    visibility: r.visibility,
    campaignId: r.campaign_id,
    campaignName: r.campaign_id ? names.get(r.campaign_id) ?? null : null,
  }));
}

/** Campaigns the viewer and this player are both in. `campaign_members` is
 * only readable for your own campaigns, so RLS does the intersecting. */
export async function fetchSharedCampaigns(userId: string): Promise<SharedCampaignRow[]> {
  if (isDemoMode()) return demo.fetchSharedCampaigns(userId);
  const { data, error } = await supabase
    .from('campaign_members')
    .select('campaign_id, role, campaigns(name)')
    .eq('user_id', userId);
  if (error) throw error;
  return ((data ?? []) as unknown as {
    campaign_id: string;
    role: CampaignRole;
    campaigns: { name: string } | null;
  }[]).map((r) => ({ id: r.campaign_id, name: r.campaigns?.name ?? '', role: r.role }));
}

/** Leader-granted honours (§17.4) on the warbands the viewer can see. */
export async function fetchPlayerHonours(warbands: ProfileWarbandRow[]): Promise<PlayerHonour[]> {
  if (warbands.length === 0 || isDemoMode()) return [];
  const byId = new Map(warbands.map((w) => [w.id, w.name]));
  const { data, error } = await supabase
    .from('campaign_awards')
    .select('id, title, note, warband_id')
    .in('warband_id', [...byId.keys()])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    note: (r.note as string | null) ?? null,
    warbandName: byId.get(r.warband_id as string) ?? '',
  }));
}

/** Files into the shared issue inbox (§4.9) with the profile as context, so an
 * admin sees whose photo or bio was reported. Never attributed: reporting a
 * person is not something to sign. */
export async function reportProfile(userId: string, message: string, profile: PlayerProfile): Promise<void> {
  await insertIssueReport({
    reporterId: null,
    path: `/players/${userId}`,
    message,
    context: {
      kind: 'profile',
      userId,
      hasPhoto: !!profile.avatarPath,
      hasBio: !!profile.bio,
    },
    appVersion: __APP_VERSION__,
    userAgent: navigator.userAgent,
  });
}

// ── Admin moderation ─────────────────────────────────────────────────────────

export async function adminClearAvatar(userId: string): Promise<void> {
  const { data: previous, error } = await supabase.rpc('admin_clear_avatar', { p_uid: userId });
  if (error) throw error;
  if (previous) await supabase.storage.from(BUCKET).remove([previous as string]);
}

export async function adminClearBio(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_clear_bio', { p_uid: userId });
  if (error) throw error;
}

// ── Directory & invites (§38.4, §38.5) ──────────────────────────────────────

export async function setMyDirectory(discoverable: boolean, looking: boolean): Promise<void> {
  if (isDemoMode()) return demo.setMyDirectory(discoverable, looking);
  const { error } = await supabase.rpc('set_my_directory', {
    p_discoverable: discoverable,
    p_looking: looking,
  });
  if (error) throw error;
}

export type DirectoryRow = {
  id: string;
  displayName: string;
  avatarSeed: string;
  avatarPath: string | null;
  country: string | null;
  favouriteWarbandType: string | null;
  lookingForCampaign: boolean;
  joinedAt: string;
  publicWarbandCount: number;
};

export type DirectoryFilters = {
  country: string;
  warbandType: string;
  lookingOnly: boolean;
  query: string;
};

export const DIRECTORY_PAGE = 25;

export async function searchPlayers(filters: DirectoryFilters, before: string | null): Promise<DirectoryRow[]> {
  if (isDemoMode()) return demo.searchPlayers(filters, before);
  const { data, error } = await supabase.rpc('search_players', {
    p_country: filters.country || null,
    p_warband_type: filters.warbandType || null,
    p_looking_only: filters.lookingOnly,
    p_query: filters.query.trim() || null,
    p_before: before,
    p_limit: DIRECTORY_PAGE,
  });
  if (error) throw error;
  return ((data ?? []) as {
    id: string;
    display_name: string;
    avatar_seed: string;
    avatar_path: string | null;
    country: string | null;
    favourite_warband_type: string | null;
    looking_for_campaign: boolean;
    joined_at: string;
    public_warband_count: number;
  }[]).map((r) => ({
    id: r.id,
    displayName: r.display_name,
    avatarSeed: r.avatar_seed,
    avatarPath: r.avatar_path,
    country: r.country,
    favouriteWarbandType: r.favourite_warband_type,
    lookingForCampaign: r.looking_for_campaign,
    joinedAt: r.joined_at,
    publicWarbandCount: r.public_warband_count,
  }));
}

export type InviteOption = { campaignId: string; campaignName: string; isMember: boolean; hasPending: boolean };

export async function fetchInviteOptions(userId: string): Promise<InviteOption[]> {
  if (isDemoMode()) return [];
  const { data, error } = await supabase.rpc('invite_options', { p_user: userId });
  if (error) throw error;
  return ((data ?? []) as { campaign_id: string; campaign_name: string; is_member: boolean; has_pending: boolean }[]).map(
    (r) => ({ campaignId: r.campaign_id, campaignName: r.campaign_name, isMember: r.is_member, hasPending: r.has_pending }),
  );
}

export const MAX_INVITE_MESSAGE = 200;

export async function inviteToCampaign(campaignId: string, userId: string, message: string): Promise<void> {
  if (isDemoMode()) throw new Error('Invites are not available in demo mode.');
  const { error } = await supabase.rpc('invite_to_campaign', {
    p_campaign: campaignId,
    p_user: userId,
    p_message: message,
  });
  if (error) throw error;
}

export type MyInvite = {
  id: string;
  campaignId: string;
  campaignName: string;
  campaignVisibility: 'public' | 'private';
  memberCount: number;
  invitedByName: string;
  message: string | null;
  createdAt: string;
};

export async function fetchMyInvites(): Promise<MyInvite[]> {
  if (isDemoMode()) return [];
  const { data, error } = await supabase.rpc('my_campaign_invites');
  if (error) throw error;
  return ((data ?? []) as {
    id: string;
    campaign_id: string;
    campaign_name: string;
    campaign_visibility: 'public' | 'private';
    member_count: number;
    invited_by_name: string;
    message: string | null;
    created_at: string;
  }[]).map((r) => ({
    id: r.id,
    campaignId: r.campaign_id,
    campaignName: r.campaign_name,
    campaignVisibility: r.campaign_visibility,
    memberCount: r.member_count,
    invitedByName: r.invited_by_name,
    message: r.message,
    createdAt: r.created_at,
  }));
}

/** Returns the campaign id, so an accept can open the campaign straight away. */
export async function respondToInvite(inviteId: string, accept: boolean): Promise<string> {
  const { data, error } = await supabase.rpc('respond_to_campaign_invite', {
    p_invite: inviteId,
    p_accept: accept,
  });
  if (error) throw error;
  return data as string;
}

export type PendingInvite = { id: string; userId: string; displayName: string; createdAt: string };

/** A leader's view of a campaign's open invites. RLS: leaders of that campaign. */
export async function fetchPendingInvites(campaignId: string): Promise<PendingInvite[]> {
  if (isDemoMode()) return [];
  const { data, error } = await supabase
    .from('campaign_invites')
    .select('id, invited_user_id, created_at')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as { id: string; invited_user_id: string; created_at: string }[];
  if (rows.length === 0) return [];
  const { data: names, error: nErr } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', rows.map((r) => r.invited_user_id));
  if (nErr) throw nErr;
  const byId = new Map((names ?? []).map((n) => [n.id as string, n.display_name as string]));
  return rows.map((r) => ({
    id: r.id,
    userId: r.invited_user_id,
    displayName: byId.get(r.invited_user_id) ?? '',
    createdAt: r.created_at,
  }));
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_campaign_invite', { p_invite: inviteId });
  if (error) throw error;
}

export async function adminRemoveFromDirectory(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_remove_from_directory', { p_uid: userId });
  if (error) throw error;
}

export type AdminDirectoryStats = {
  discoverable: number;
  looking: number;
  invites_sent_30d: number;
  invites_accepted_30d: number;
  invites_pending: number;
};

export async function fetchAdminDirectoryStats(): Promise<AdminDirectoryStats> {
  if (isDemoMode()) {
    return { discoverable: 17, looking: 6, invites_sent_30d: 9, invites_accepted_30d: 4, invites_pending: 3 };
  }
  const { data, error } = await supabase.rpc('admin_directory_stats');
  if (error) throw error;
  return data as AdminDirectoryStats;
}

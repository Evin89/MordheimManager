import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';
import type { BattleRecord, Campaign, CampaignMember } from '../types';
import { toCampaign, toMember, type CampaignRow, type MemberRow } from './campaign';
import {
  toCampaignWarband,
  type CampaignWarbandQueryRow,
  type CampaignWarbandRow,
} from './warbands';
import { toEvent, type CampaignEvent, type EventRow } from './events';
import { toRsvp, type EventRsvp, type RsvpRow } from './rsvps';
import { toEntry, type CampaignLogEntry, type LogRow } from './campaignLog';
import { toTerritory, type Territory, type TerritoryRow } from './territories';
import { toAward, type CampaignAwardRecord, type CampaignAwardRow } from './campaignAwards';

/**
 * §4.9.5 admin campaign view — the list and header are metadata and counts
 * (migration 0026); the full read-only content (§4.9.8) comes through
 * `fetchAdminCampaignContent` below. All SECURITY DEFINER RPCs that bypass RLS
 * so an admin can see a private campaign they aren't a member of.
 */

export type AdminCampaignRow = {
  id: string;
  name: string;
  visibility: string;
  creator_id: string;
  creator_name: string | null;
  created_at: string;
  member_count: number;
  leader_count: number;
  battle_count: number;
  event_count: number;
  warband_count: number;
  last_activity: string | null;
};

export type AdminCampaignMember = {
  user_id: string;
  display_name: string | null;
  role: string;
  warband_name: string | null;
  warband_type: string | null;
};

export type AdminCampaignDetail = {
  campaign: AdminCampaignRow;
  members: AdminCampaignMember[];
};

/** A campaign is "stranded" (§10.3.1) with ≤1 leader and no activity in 30 days. */
export function isStranded(row: {
  leader_count: number;
  last_activity: string | null;
}): boolean {
  const stale =
    !row.last_activity || Date.now() - new Date(row.last_activity).getTime() > 30 * 86_400_000;
  return row.leader_count <= 1 && stale;
}

export async function fetchAdminCampaigns(
  search?: string,
  before?: string,
  lim = 25,
): Promise<AdminCampaignRow[]> {
  if (isDemoMode()) return demo.fetchAdminCampaigns(search);
  const { data, error } = await supabase.rpc('admin_campaign_overview', {
    p_search: search || null,
    p_before: before || null,
    p_lim: lim,
  });
  if (error) throw error;
  return (data ?? []) as AdminCampaignRow[];
}

export async function fetchAdminCampaignDetail(id: string): Promise<AdminCampaignDetail> {
  if (isDemoMode()) return demo.fetchAdminCampaignDetail(id);
  const { data, error } = await supabase.rpc('admin_campaign_detail', { p_campaign_id: id });
  if (error) throw error;
  return data as AdminCampaignDetail;
}

export async function fetchStrandedCampaignCount(): Promise<number> {
  if (isDemoMode()) return demo.fetchStrandedCampaignCount();
  const { data, error } = await supabase.rpc('admin_stranded_campaign_count');
  if (error) throw error;
  return (data as number) ?? 0;
}

/**
 * §4.9.8 — one campaign's full content, read-only, for the admin.
 *
 * Reads through `admin_campaign_content` (migration 0057), the one admin
 * function that returns campaign content; it writes an `admin_campaign_views`
 * row on every call. The RPC returns rows in the same snake_case shape the
 * member-side selects read, so they go through the very same mappers — the
 * admin view shows exactly what a member sees, never more. BTB objectives and
 * the join code are never part of it.
 */
export type AdminCampaignContent = {
  campaign: Campaign;
  hasJoinCode: boolean;
  members: CampaignMember[];
  warbands: CampaignWarbandRow[];
  battles: BattleRecord[];
  /** Battle id → who reported it, for the log. */
  reporters: Record<string, string>;
  events: CampaignEvent[];
  rsvps: EventRsvp[];
  log: CampaignLogEntry[];
  territories: Territory[];
  awards: CampaignAwardRecord[];
};

type AdminCampaignContentRow = {
  campaign: CampaignRow & { has_join_code: boolean };
  members: MemberRow[];
  warbands: CampaignWarbandQueryRow[];
  battles: { id: string; reported_by: string; created_at: string; data: BattleRecord }[];
  events: EventRow[];
  rsvps: RsvpRow[];
  log: LogRow[];
  territories: TerritoryRow[];
  awards: CampaignAwardRow[];
};

export async function fetchAdminCampaignContent(id: string): Promise<AdminCampaignContent> {
  if (isDemoMode()) return demo.fetchAdminCampaignContent(id);
  const { data, error } = await supabase.rpc('admin_campaign_content', { p_campaign_id: id });
  if (error) throw error;
  const d = data as AdminCampaignContentRow;
  return {
    campaign: toCampaign(d.campaign),
    hasJoinCode: d.campaign.has_join_code,
    members: d.members.map(toMember),
    warbands: d.warbands.map(toCampaignWarband),
    battles: d.battles.map((b) => b.data),
    reporters: Object.fromEntries(d.battles.map((b) => [b.data.id, b.reported_by])),
    events: d.events.map(toEvent),
    rsvps: d.rsvps.map(toRsvp),
    log: d.log.map(toEntry),
    territories: d.territories.map(toTerritory),
    awards: d.awards.map(toAward),
  };
}

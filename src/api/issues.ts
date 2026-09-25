import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';
import type { BattleRecord } from '../types';

export type IssueStatus = 'open' | 'triaged' | 'closed';

export type IssueReport = {
  id: string;
  reporterId: string | null;
  /** The reporter's display name, resolved from `reporter_id` for the inbox.
   * Null when the report was filed anonymously (or the account is gone). */
  reporterName: string | null;
  path: string;
  message: string;
  context: Record<string, unknown>;
  appVersion: string;
  userAgent: string;
  status: IssueStatus;
  adminNotes: string;
  createdAt: string;
};

type IssueRow = {
  id: string;
  reporter_id: string | null;
  path: string;
  message: string;
  context: Record<string, unknown>;
  app_version: string;
  user_agent: string;
  status: IssueStatus;
  admin_notes: string;
  created_at: string;
};

function toReport(row: IssueRow): IssueReport {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    reporterName: null, // filled in by fetchIssueReports for attributed reports
    path: row.path,
    message: row.message,
    context: row.context ?? {},
    appVersion: row.app_version,
    userAgent: row.user_agent,
    status: row.status,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
  };
}

export type NewIssueReport = {
  reporterId: string | null;
  path: string;
  message: string;
  context: Record<string, unknown>;
  appVersion: string;
  userAgent: string;
};

/**
 * Files a report.
 *
 * Deliberately returns nothing to read back: the insert policy allows anyone to
 * write, but only an admin may select, so asking for the row back would fail
 * for the very people filing most reports.
 */
export async function insertIssueReport(report: NewIssueReport): Promise<void> {
  if (isDemoMode()) return demo.insertIssueReport(report);
  const { error } = await supabase.from('issue_reports').insert({
    reporter_id: report.reporterId,
    path: report.path,
    message: report.message,
    context: report.context,
    app_version: report.appVersion,
    user_agent: report.userAgent,
  });
  if (error) throw error;
}

/** True when the signed-in user is an admin. Reads the `admins` table, whose
 * select policy is scoped to your own row — a non-admin simply gets nothing. */
export async function fetchIsAdmin(userId: string): Promise<boolean> {
  if (isDemoMode()) return demo.fetchIsAdmin(userId);
  const { data, error } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

/** Reports per page in the inbox. Unlike the gallery this is ordered by
 * `created_at`, which never changes once written, so paging is exact. */
export const ISSUE_PAGE_SIZE = 25;

export type IssueReportPage = {
  rows: IssueReport[];
  nextCursor: number | null;
};

/**
 * A page of reports, newest first.
 *
 * Paged because this list is the one thing in the app that grows without any
 * natural ceiling: every player, signed in or not, can add to it forever, and
 * closing a report doesn't remove the row.
 */
export async function fetchIssueReports(
  status: IssueStatus | 'all',
  cursor = 0,
): Promise<IssueReportPage> {
  if (isDemoMode()) return demo.fetchIssueReports(status, cursor);
  let query = supabase
    .from('issue_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .range(cursor, cursor + ISSUE_PAGE_SIZE - 1);
  if (status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data as IssueRow[]).map(toReport);

  // Resolve the display names of reporters who chose to be identified. A second
  // query rather than an embed: `reporter_id` points at auth.users, not the
  // profiles table, so PostgREST has no relationship to auto-join. Names are a
  // nicety — a failure here leaves them null rather than sinking the whole page.
  const ids = [...new Set(rows.map((r) => r.reporterId).filter((id): id is string => !!id))];
  if (ids.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', ids);
    const nameById = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string]));
    for (const row of rows) if (row.reporterId) row.reporterName = nameById.get(row.reporterId) ?? null;
  }

  return {
    rows,
    nextCursor: rows.length < ISSUE_PAGE_SIZE ? null : cursor + rows.length,
  };
}

export async function updateIssueStatus(id: string, status: IssueStatus): Promise<void> {
  if (isDemoMode()) return demo.updateIssueStatus(id, status);
  const { error } = await supabase.from('issue_reports').update({ status }).eq('id', id);
  if (error) throw error;
}

/** Players per page in the admin user overview. */
export const ADMIN_USER_PAGE_SIZE = 25;

export type AdminUserRow = {
  userId: string;
  displayName: string;
  createdAt: string;
  isAdmin: boolean;
  warbands: number;
  publicWarbands: number;
  campaigns: number;
  battles: number;
  /** Warbands created in the last 30 days — how often they start a new one. */
  newWarbands30d: number;
  /** Roster edits logged in the last 30 days (since edit tracking began). */
  edits30d: number;
  /** Most recent warband edit (max updated_at), or null — NOT presence. */
  lastActive: string | null;
  /** Derived last seen (§26.1, `user_last_seen()`): the latest of a tracked app
   * open, a warband edit, a battle report and signup — so never null. */
  lastSeen: string;
  /** §26.3.1 — auth metadata, never the address: an unconfirmed account can't
   * sign in, which separates "blocked" from "left". */
  emailConfirmed: boolean;
  /** Last successful sign-in, or null if they never got in. */
  lastSignInAt: string | null;
};

export type AdminUserPage = {
  rows: AdminUserRow[];
  nextCursor: number | null;
};

/**
 * Per-player activity for the admin overview.
 *
 * Counts only, and no email — see the comment block on migration 0007 for what
 * is deliberately left out and why.
 */
export async function fetchAdminUsers(cursor = 0): Promise<AdminUserPage> {
  if (isDemoMode()) return demo.fetchAdminUsers(cursor);
  const { data, error } = await supabase.rpc('admin_user_overview', {
    p_limit: ADMIN_USER_PAGE_SIZE,
    p_offset: cursor,
  });
  if (error) throw error;

  const rows: AdminUserRow[] = (
    data as {
      user_id: string;
      display_name: string;
      created_at: string;
      is_admin: boolean;
      warbands: number;
      public_warbands: number;
      campaigns: number;
      battles: number;
      last_active: string | null;
      new_warbands_30d: number;
      edits_30d: number;
      last_seen: string | null;
      email_confirmed?: boolean | null;
      last_sign_in_at?: string | null;
    }[]
  ).map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    createdAt: r.created_at,
    isAdmin: r.is_admin,
    // Postgres bigint arrives as a string over PostgREST when it exceeds the
    // safe integer range; Number() is correct either way and these never will.
    warbands: Number(r.warbands),
    publicWarbands: Number(r.public_warbands),
    campaigns: Number(r.campaigns),
    battles: Number(r.battles),
    newWarbands30d: Number(r.new_warbands_30d ?? 0),
    edits30d: Number(r.edits_30d ?? 0),
    lastActive: r.last_active,
    // Signup is the SQL function's floor; mirror it for a pre-0045 backend.
    lastSeen: r.last_seen ?? r.created_at,
    // Pre-0046 backends omit these; read "unknown" as confirmed so nobody is
    // flagged on missing data.
    emailConfirmed: r.email_confirmed ?? true,
    lastSignInAt: r.last_sign_in_at ?? null,
  }));

  return {
    rows,
    nextCursor: rows.length < ADMIN_USER_PAGE_SIZE ? null : cursor + rows.length,
  };
}

export type AdminUserWarband = {
  id: string;
  name: string;
  warbandType: string;
  rating: number;
  visibility: 'public' | 'private';
  campaignName: string | null;
  updatedAt: string;
  createdAt: string;
  /** Roster edits logged for this warband (since edit tracking began). */
  edits: number;
};

export type AdminUserCampaign = {
  id: string;
  name: string;
  usesBtb: boolean;
  role: 'campaign_leader' | 'player';
  joinedAt: string;
  members: number;
};

export type AdminUserDetail = {
  userId: string;
  displayName: string;
  createdAt: string;
  isAdmin: boolean;
  /** Derived last seen (§26.1); signup is its floor. */
  lastSeen: string;
  /** §26.3.1 auth health — see AdminUserRow. */
  emailConfirmed: boolean;
  lastSignInAt: string | null;
  /** Battles this player has reported. */
  battles: number;
  /** Roster edits logged, all-time and in the last 30 days (since tracking began). */
  editsAll: number;
  edits30d: number;
  /** Warbands created in the last 30 / 90 days — how often they start a new one. */
  newWarbands30d: number;
  newWarbands90d: number;
  warbands: AdminUserWarband[];
  campaigns: AdminUserCampaign[];
};

/** One player's warbands and campaigns — summary rows only. See migration 0008
 * for what is deliberately excluded. */
export async function fetchAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  if (isDemoMode()) return demo.fetchAdminUserDetail(userId);
  const { data, error } = await supabase.rpc('admin_user_detail', { p_user_id: userId });
  if (error) throw error;

  const d = data as {
    user_id: string;
    display_name: string;
    created_at: string;
    is_admin: boolean;
    last_seen?: string | null;
    email_confirmed?: boolean | null;
    last_sign_in_at?: string | null;
    battles?: number;
    edits_all?: number;
    edits_30d?: number;
    new_warbands_30d?: number;
    new_warbands_90d?: number;
    warbands: Record<string, unknown>[];
    campaigns: Record<string, unknown>[];
  };

  return {
    userId: d.user_id,
    displayName: d.display_name,
    createdAt: d.created_at,
    isAdmin: d.is_admin,
    lastSeen: d.last_seen ?? d.created_at,
    emailConfirmed: d.email_confirmed ?? true,
    lastSignInAt: d.last_sign_in_at ?? null,
    battles: Number(d.battles ?? 0),
    editsAll: Number(d.edits_all ?? 0),
    edits30d: Number(d.edits_30d ?? 0),
    newWarbands30d: Number(d.new_warbands_30d ?? 0),
    newWarbands90d: Number(d.new_warbands_90d ?? 0),
    warbands: d.warbands.map((w) => ({
      id: w.id as string,
      name: w.name as string,
      warbandType: w.warband_type as string,
      rating: Number(w.rating ?? 0),
      visibility: w.visibility as 'public' | 'private',
      campaignName: (w.campaign_name as string | null) ?? null,
      updatedAt: w.updated_at as string,
      createdAt: w.created_at as string,
      edits: Number(w.edits ?? 0),
    })),
    campaigns: d.campaigns.map((c) => ({
      id: c.id as string,
      name: c.name as string,
      usesBtb: Boolean(c.uses_btb),
      role: c.role as 'campaign_leader' | 'player',
      joinedAt: c.joined_at as string,
      members: Number(c.members ?? 0),
    })),
  };
}

export type AdminUserBattle = {
  battleId: string;
  createdAt: string;
  /** The campaign it was fought in, or null for a one-off battle. */
  campaignName: string | null;
  battle: BattleRecord;
};

/** One player's reported battles, newest first — the drill-in behind the battle
 * count on the admin player screen. Admin-gated in the database. */
export async function fetchAdminUserBattles(userId: string): Promise<AdminUserBattle[]> {
  if (isDemoMode()) return demo.fetchAdminUserBattles(userId);
  const { data, error } = await supabase.rpc('admin_user_battles', { p_user_id: userId });
  if (error) throw error;
  return (
    data as {
      battle_id: string;
      created_at: string;
      campaign_name: string | null;
      data: BattleRecord;
    }[]
  ).map((r) => ({
    battleId: r.battle_id,
    createdAt: r.created_at,
    campaignName: r.campaign_name,
    battle: r.data,
  }));
}

export type AdminStats = {
  users: number;
  warbands: number;
  public_warbands: number;
  campaigns: number;
  battles: number;
  open_issues: number;
  // §26.3.1: accounts that never confirmed their email (migration 0046).
  unconfirmed_users?: number;
  // Presence (migration 0037): distinct users seen today / in the last 7 days.
  // Optional so an un-migrated backend that omits them still parses.
  active_today?: number;
  active_7d?: number;
  // §23.3 rolling growth (extended admin_stats); optional so an un-migrated
  // backend that returns the old shape still parses.
  new_users_7d?: number;
  new_users_30d?: number;
  new_users_prev_7d?: number;
  warband_types: { type: string; count: number }[];
  signups: { day: string; count: number }[];
};

/** Aggregates only — the function counts rows the caller has no row access to,
 * which is why the admin check lives inside it rather than in a policy. */
export async function fetchAdminStats(): Promise<AdminStats> {
  if (isDemoMode()) return demo.fetchAdminStats();
  const { data, error } = await supabase.rpc('admin_stats');
  if (error) throw error;
  return data as AdminStats;
}

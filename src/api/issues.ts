import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';

export type IssueStatus = 'open' | 'triaged' | 'closed';

export type IssueReport = {
  id: string;
  reporterId: string | null;
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

export type AdminStats = {
  users: number;
  warbands: number;
  public_warbands: number;
  campaigns: number;
  battles: number;
  open_issues: number;
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

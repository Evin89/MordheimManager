import { supabase } from '../lib/supabaseClient';
import { isDemoMode } from '../dev/demoMode';
import * as demo from '../dev/demoApi';

/**
 * §23 growth-insight RPCs — aggregates only, admin-gated inside each function
 * (see migration 0025). Each returns a jsonb array, the same shape as
 * `admin_stats`'s `signups`/`warband_types`, so the client just casts.
 */

export type FunnelStage = { stage: string; ordinal: number; n: number };
export type CohortCell = {
  cohort_week: string;
  weeks_since: number;
  cohort_size: number;
  active: number;
};
/** §23.2 time-to-activation for recent signups (migration 0050). A null median
 * means nobody in the window has reached that stage yet. */
export type TimeToActivation = {
  days: number;
  cohort: number;
  warband: { reached: number; median_hours: number | null };
  battle: { reached: number; median_hours: number | null };
};
export type ActivityDay = { day: string; signups: number; warbands: number; battles: number };
export type AcquisitionRow = { channel: string; n: number };
/** §26.7.2 — self-reported source counts (incl. `not_answered`) and the last 20
 * "Other" notes, text only: no user id, name or date. */
export type SelfReportBreakdown = {
  answers: { answer: string; n: number }[];
  notes: string[];
};

async function callJson<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return (data ?? []) as T;
}

export async function fetchActivationFunnel(): Promise<FunnelStage[]> {
  if (isDemoMode()) return demo.fetchActivationFunnel();
  return callJson<FunnelStage[]>('admin_activation_funnel');
}

export async function fetchTimeToActivation(days = 90): Promise<TimeToActivation | null> {
  if (isDemoMode()) return demo.fetchTimeToActivation(days);
  const { data, error } = await supabase.rpc('admin_time_to_activation', { p_days: days });
  if (error) throw error;
  return (data ?? null) as TimeToActivation | null;
}

export async function fetchRetentionCohorts(weeks = 8): Promise<CohortCell[]> {
  if (isDemoMode()) return demo.fetchRetentionCohorts(weeks);
  return callJson<CohortCell[]>('admin_retention_cohorts', { p_weeks: weeks });
}

export async function fetchActivitySeries(days = 30): Promise<ActivityDay[]> {
  if (isDemoMode()) return demo.fetchActivitySeries(days);
  return callJson<ActivityDay[]>('admin_activity_series', { p_days: days });
}

export async function fetchAcquisitionBreakdown(days = 30): Promise<AcquisitionRow[]> {
  if (isDemoMode()) return demo.fetchAcquisitionBreakdown(days);
  return callJson<AcquisitionRow[]>('admin_acquisition_breakdown', { p_days: days });
}

export async function fetchSelfReportBreakdown(days = 30): Promise<SelfReportBreakdown> {
  if (isDemoMode()) return demo.fetchSelfReportBreakdown(days);
  const data = await callJson<Partial<SelfReportBreakdown>>('admin_acquisition_self_report', { p_days: days });
  return { answers: data.answers ?? [], notes: data.notes ?? [] };
}

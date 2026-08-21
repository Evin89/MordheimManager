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
export type ActivityDay = { day: string; signups: number; warbands: number; battles: number };
export type AcquisitionRow = { channel: string; n: number };

async function callJson<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return (data ?? []) as T;
}

export async function fetchActivationFunnel(): Promise<FunnelStage[]> {
  if (isDemoMode()) return demo.fetchActivationFunnel();
  return callJson<FunnelStage[]>('admin_activation_funnel');
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

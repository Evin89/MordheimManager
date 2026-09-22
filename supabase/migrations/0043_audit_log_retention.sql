-- ----------------------------------------------------------------------------
-- Retention for the two warband audit-log tables (§10.4's deferred item).
--
-- `warband_edits` and `warband_rating_history` are append-only: every genuine
-- roster edit and every rating change writes a row, forever, with no ceiling.
-- They are *not* actually unbounded by warband deletion — both cascade away
-- when their parent warband is hard-purged (migration 0014) — so the real risk
-- is a single warband that stays alive and gets edited for years, accumulating
-- rows with no cap at all.
--
-- The retention window here is deliberately generous (3 years) rather than
-- aggressive. `warband_rating_history` backs a real, visible feature — the
-- §18.3 rating-over-time chart — and a short window would quietly truncate
-- that chart for any campaign that outlives it. Three years is longer than any
-- Mordheim campaign this app has seen or is likely to: this exists to put a
-- ceiling on literally-infinite growth, not to actively prune history anyone
-- is still looking at. `warband_edits` has no chart depending on it (it feeds
-- only the admin "edits" counts, §4.9.4, already framed as "since tracking
-- began" rather than a true lifetime total) and could safely use a shorter
-- window, but sharing one job and one interval keeps this simple to reason
-- about, and the admin counts stay correct for exactly as long as the window.
-- ----------------------------------------------------------------------------

create or replace function public.purge_old_audit_logs(
  p_retention interval default interval '3 years'
)
returns table (edits_purged integer, rating_points_purged integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edits integer;
  v_rating integer;
begin
  delete from public.warband_edits
  where edited_at < now() - p_retention;
  get diagnostics v_edits = row_count;

  delete from public.warband_rating_history
  where recorded_at < now() - p_retention;
  get diagnostics v_rating = row_count;

  return query select v_edits, v_rating;
end;
$$;

comment on function public.purge_old_audit_logs(interval) is
  'Deletes warband_edits/warband_rating_history rows older than the retention window (default 3 years). Called by pg_cron; see admin_purge_old_audit_logs for the operator entry point.';

-- Not reachable from the client directly, same posture as purge_deleted_warbands.
revoke all on function public.purge_old_audit_logs(interval) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- The operator's entry point (mirrors admin_purge_deleted_warbands, 0014).
-- Not yet wired to a Maintenance-screen button — the function exists so one
-- can be added later without another migration.
-- ----------------------------------------------------------------------------
create or replace function public.admin_purge_old_audit_logs()
returns table (edits_purged integer, rating_points_purged integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;
  return query select * from public.purge_old_audit_logs();
end;
$$;

revoke all on function public.admin_purge_old_audit_logs() from public, anon;
grant execute on function public.admin_purge_old_audit_logs() to authenticated;

-- ----------------------------------------------------------------------------
-- The schedule. Same defensive pg_cron guard as 0014, so a project without the
-- extension still gets the functions — usable by hand from the SQL editor or a
-- future admin button — just not the automatic nightly run.
-- 03:29 rather than 03:17 (the warband purge, 0014): two jobs deleting things
-- should not race for the same minute.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-old-audit-logs') then
      perform cron.unschedule('purge-old-audit-logs');
    end if;
    perform cron.schedule(
      'purge-old-audit-logs',
      '29 3 * * *',
      'select public.purge_old_audit_logs()'
    );
  end if;
end;
$$;

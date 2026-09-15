-- ----------------------------------------------------------------------------
-- Presence: how many users have been online today (§4.9.2 / §23.2).
--
-- The admin dashboard could show who has *acted* (a warband edited, a battle
-- reported) but not who simply opened the app that day. This adds a last-seen
-- timestamp the signed-in client touches on load (throttled), and surfaces the
-- daily / 7-day active counts through admin_stats.
--
-- last_seen is a single self-owned timestamp, no history and no third party:
-- the same DB-derived, privacy-minimal posture as the rest of the admin metrics
-- (§23.7). PostHog already has anonymous DAU; this keeps the operator's own
-- dashboard answering the question without leaving the database.
-- ----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- Every online-count reads this column over a recent window, so index it.
create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at);

-- ── The heartbeat ───────────────────────────────────────────────────────────
-- Marks the caller's own profile seen now. SECURITY DEFINER so it needs no
-- broad profile-update grant, scoped to auth.uid(); the 5-minute guard makes a
-- ping on every app load cheap — most calls touch no row. Anonymous callers
-- (auth.uid() is null) match nothing, so it is a safe no-op signed out.
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '5 minutes');
$$;

-- ── admin_stats + active_today / active_7d ──────────────────────────────────
-- Rebuilt from the live definition (jsonb return, so create-or-replace is fine)
-- with two new keys; everything else is unchanged.
create or replace function public.admin_stats()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;

  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'warbands', (select count(*) from public.warbands where deleted_at is null),
    'public_warbands', (select count(*) from public.warbands
                         where deleted_at is null and visibility = 'public'),
    'campaigns', (select count(*) from public.campaigns),
    'battles', (select count(*) from public.battles),
    'open_issues', (select count(*) from public.issue_reports where status = 'open'),
    -- Presence: distinct accounts seen today (server date) and in the last 7
    -- days. One row per user, so a plain count is the distinct count.
    'active_today', (select count(*) from public.profiles
                       where last_seen_at >= date_trunc('day', now())),
    'active_7d', (select count(*) from public.profiles
                    where last_seen_at >= now() - interval '7 days'),
    -- §23.2 rolling growth: the 7/30-day numbers that were counted by hand, plus
    -- the previous 7-day window so the screen can draw a delta arrow.
    'new_users_7d', (select count(*) from public.profiles
                       where created_at >= now() - interval '7 days'),
    'new_users_30d', (select count(*) from public.profiles
                        where created_at >= now() - interval '30 days'),
    'new_users_prev_7d', (select count(*) from public.profiles
                            where created_at >= now() - interval '14 days'
                              and created_at <  now() - interval '7 days'),
    'warband_types', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select warband_type as type, count(*) as count
        from public.warbands
        where deleted_at is null
        group by warband_type
        order by count(*) desc, warband_type
      ) t
    ),
    'signups', (
      select coalesce(jsonb_agg(s order by s.day), '[]'::jsonb) from (
        select d::date as day,
               (select count(*) from public.profiles p
                 where p.created_at >= d and p.created_at < d + interval '1 day') as count
        from generate_series(current_date - interval '29 days', current_date, interval '1 day') d
      ) s
    )
  ) into v_result;

  return v_result;
end;
$$;

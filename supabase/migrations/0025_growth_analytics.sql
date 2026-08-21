-- §23 Admin analytics & growth insight (DB-derived layer, §23.1–§23.6).
--
-- All aggregate SQL over tables the app already owns, in the same admin-gated,
-- SECURITY DEFINER family as admin_stats(): counts only, never row data, email,
-- roster jsonb or objectives (§23.6). Plus one new write path — acquisition
-- capture at signup (§23.4) — written once via the profile-creation trigger, so
-- no client UPDATE path is opened and the columns are never client-readable.

-- ── §23.4 Acquisition columns (written once, never updated) ─────────────────
alter table public.profiles
  add column if not exists acquisition_channel     text,        -- classified, closed set
  add column if not exists acquisition_ref         text,        -- raw ?ref / utm_source
  add column if not exists acquisition_host        text,        -- document.referrer host only
  add column if not exists acquisition_captured_at timestamptz;

-- Capture flows through the same trigger that creates the profile from the
-- auth metadata, so the values land atomically with the row and there is no
-- client-writable path to them afterwards. Existing users stay null ('unknown').
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (
    id, display_name,
    acquisition_channel, acquisition_ref, acquisition_host, acquisition_captured_at
  )
  values (
    new.id,
    coalesce(m ->> 'display_name', ''),
    nullif(m ->> 'acquisition_channel', ''),
    nullif(m ->> 'acquisition_ref', ''),
    nullif(m ->> 'acquisition_host', ''),
    case when m ? 'acquisition_channel' then now() else null end
  );
  return new;
end;
$$;

-- ── §23.3 Indexes (fold into the §8.2 pre-scale set) ────────────────────────
create index if not exists profiles_created_at_idx on public.profiles (created_at);
create index if not exists warbands_owner_created_idx on public.warbands (owner_id, created_at);
create index if not exists battles_reporter_created_idx on public.battles (reported_by, created_at);

-- ── §23.3 Extend admin_stats() with rolling new-user counts ─────────────────
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

-- ── §23.2 Activation funnel — one row per stage, each strictly narrowing ─────
create or replace function public.admin_activation_funnel()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;

  return (
    select coalesce(jsonb_agg(f order by f.ordinal), '[]'::jsonb) from (
      select 'registered'::text as stage, 1 as ordinal, count(*)::bigint as n
        from public.profiles
      union all
      select 'created_warband', 2, count(distinct owner_id)
        from public.warbands where deleted_at is null
      union all
      select 'entered_campaign', 3, count(distinct owner_id)
        from public.warbands where deleted_at is null and campaign_id is not null
      union all
      select 'ran_battle', 4, count(distinct reported_by)
        from public.battles
    ) f
  );
end;
$$;

-- ── §23.2 Retention cohorts — signup week × weeks-since, % still active ──────
-- "Active" = a battle reported OR a warband updated, in the window (union'd so a
-- roster-only session still counts). cohort_size is computed once per week and
-- joined, not as a window over the grouped rows (the drafted SQL's trap).
create or replace function public.admin_retention_cohorts(p_weeks int default 8)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;

  return (
    with signup as (
      select id as user_id, date_trunc('week', created_at)::date as cohort_week
      from public.profiles
      where created_at >= now() - make_interval(weeks => p_weeks)
    ),
    sizes as (
      select cohort_week, count(*)::bigint as cohort_size from signup group by cohort_week
    ),
    activity as (
      select reported_by as user_id, date_trunc('week', created_at)::date as wk
        from public.battles
      union
      select owner_id, date_trunc('week', updated_at)::date
        from public.warbands where deleted_at is null
    ),
    cohort_activity as (
      select s.cohort_week,
             ((a.wk - s.cohort_week) / 7)::int as weeks_since,
             count(distinct s.user_id)::bigint as active
      from signup s
      join activity a on a.user_id = s.user_id and a.wk >= s.cohort_week
      group by s.cohort_week, ((a.wk - s.cohort_week) / 7)
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'cohort_week', ca.cohort_week,
             'weeks_since', ca.weeks_since,
             'cohort_size', sz.cohort_size,
             'active', ca.active
           ) order by ca.cohort_week, ca.weeks_since), '[]'::jsonb)
    from cohort_activity ca
    join sizes sz on sz.cohort_week = ca.cohort_week
  );
end;
$$;

-- ── §23.2 Activity series — signups / warbands / battles per day ────────────
create or replace function public.admin_activity_series(p_days int default 30)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;

  return (
    select coalesce(jsonb_agg(r order by r.day), '[]'::jsonb) from (
      select d.day,
        (select count(*) from public.profiles p where p.created_at::date = d.day) as signups,
        (select count(*) from public.warbands w
           where w.created_at::date = d.day and w.deleted_at is null) as warbands,
        (select count(*) from public.battles b where b.created_at::date = d.day) as battles
      from (
        select generate_series(current_date - (p_days - 1), current_date, '1 day')::date as day
      ) d
    ) r
  );
end;
$$;

-- ── §23.4 Acquisition breakdown — counts per channel, last N days ───────────
create or replace function public.admin_acquisition_breakdown(p_days int default 30)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;

  return (
    select coalesce(jsonb_agg(a order by a.n desc, a.channel), '[]'::jsonb) from (
      select coalesce(acquisition_channel, 'unknown') as channel, count(*)::bigint as n
      from public.profiles
      where created_at >= now() - make_interval(days => p_days)
      group by coalesce(acquisition_channel, 'unknown')
    ) a
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- One definition of "last seen" (§26.1).
--
-- `profiles.last_seen_at` (0037) is written going forward only — by the
-- throttled heartbeat on app load — so every account that hasn't opened the app
-- since 0037 shipped (2026-09-15) reads null, and the Players screen called
-- them "never" seen even with a roster edit last week. A user who edited a
-- warband nine days ago was plainly seen nine days ago.
--
-- The fix derives last seen at read time from every signal the database owns,
-- rather than backfilling: `last_seen_at` keeps meaning exactly "tracked visit",
-- and the derived value is the latest of that, a warband edit, a battle report
-- and the signup itself. Because signup is a floor, the value is never null.
--
-- The Players list, the Overview's "Online today" / "Active · 7d" tiles and the
-- §23.2 retention grid all call the same function, so they can't disagree.
-- ----------------------------------------------------------------------------

-- ── The shared definition ───────────────────────────────────────────────────
-- greatest() ignores nulls. Soft-deleted warbands count on purpose: an edit to a
-- warband later deleted was still a visit. SECURITY DEFINER so it reads
-- last_seen_at (column-hidden from clients since 0038) — which is exactly why it
-- must not be callable by clients: it would leak presence for any uuid.
create or replace function public.user_last_seen(uid uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    p.last_seen_at,
    (select max(w.updated_at) from public.warbands w where w.owner_id = p.id),
    (select max(b.created_at) from public.battles b where b.reported_by = p.id),
    p.created_at
  )
  from public.profiles p
  where p.id = uid;
$$;

revoke all on function public.user_last_seen(uuid) from public, anon, authenticated;

-- ── admin_stats: presence counts read the shared definition ─────────────────
-- The live definition (0037) with active_today / active_7d switched from the
-- raw column to user_last_seen(); every other key is unchanged.
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
    -- Presence (§26.1): the same derived last-seen the Players list shows.
    'active_today', (select count(*) from public.profiles p
                       where public.user_last_seen(p.id) >= date_trunc('day', now())),
    'active_7d', (select count(*) from public.profiles p
                    where public.user_last_seen(p.id) >= now() - interval '7 days'),
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

-- ── admin_user_overview: last_seen is the derived value ─────────────────────
-- Same row type as 0038, so create-or-replace suffices; only the last column's
-- expression changes.
create or replace function public.admin_user_overview(
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  display_name text,
  created_at timestamptz,
  is_admin boolean,
  warbands bigint,
  public_warbands bigint,
  campaigns bigint,
  battles bigint,
  last_active timestamptz,
  new_warbands_30d bigint,
  edits_30d bigint,
  last_seen timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;

  return query
    select
      p.id,
      p.display_name,
      p.created_at,
      exists (select 1 from public.admins a where a.user_id = p.id),
      (select count(*) from public.warbands w
        where w.owner_id = p.id and w.deleted_at is null),
      (select count(*) from public.warbands w
        where w.owner_id = p.id and w.deleted_at is null and w.visibility = 'public'),
      (select count(*) from public.campaign_members cm where cm.user_id = p.id),
      (select count(*) from public.battles b where b.reported_by = p.id),
      (select max(w.updated_at) from public.warbands w
        where w.owner_id = p.id and w.deleted_at is null),
      (select count(*) from public.warbands w
        where w.owner_id = p.id and w.deleted_at is null
          and w.created_at >= now() - interval '30 days'),
      (select count(*) from public.warband_edits e
        where e.owner_id = p.id and e.edited_at >= now() - interval '30 days'),
      public.user_last_seen(p.id)
    from public.profiles p
    order by p.created_at desc, p.id
    limit greatest(1, least(p_limit, 100))
    offset greatest(0, p_offset);
end;
$$;

-- ── Retention cohorts: the derived last-seen is one more activity signal ────
-- The live definition (0025) with user_last_seen() added to the activity union,
-- so a week in which someone only opened the app (no edit, no battle) now counts
-- as active. Side effect, and a correct one: signup is a floor of last-seen, so
-- week 0 now reads 100% — every account was seen the week it registered.
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
      union
      select s.user_id, date_trunc('week', public.user_last_seen(s.user_id))::date
        from signup s
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

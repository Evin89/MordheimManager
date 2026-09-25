-- ----------------------------------------------------------------------------
-- Auth health on the admin screens (§26.3.1).
--
-- An account that signs up but never confirms its email can't sign in, and from
-- the Players list it looks exactly like someone who lost interest: joined, zero
-- warbands. Two pieces of auth metadata separate "blocked" from "left":
--
--   email_confirmed  — auth.users.email_confirmed_at is not null (boolean only)
--   last_sign_in_at  — "signed in and did nothing" vs "never got in"
--
-- Both are metadata, not the address: the email column itself is never selected,
-- so §4.9.7 holds. Surfaced on the Players list and detail, and as an Overview
-- attention count (`unconfirmed_users` on admin_stats).
-- ----------------------------------------------------------------------------

-- ── admin_user_overview + two auth columns ──────────────────────────────────
-- A new return column changes the row type, so drop then recreate. Body is 0045
-- with the two columns appended.
drop function if exists public.admin_user_overview(integer, integer);

create function public.admin_user_overview(
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
  last_seen timestamptz,
  email_confirmed boolean,
  last_sign_in_at timestamptz
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
      public.user_last_seen(p.id),
      -- A profile with no auth row can't exist (the trigger creates one from the
      -- other), but coalesce rather than let a null read as "confirmed".
      coalesce(u.email_confirmed_at is not null, false),
      u.last_sign_in_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by p.created_at desc, p.id
    limit greatest(1, least(p_limit, 100))
    offset greatest(0, p_offset);
end;
$$;

-- ── admin_user_detail + the same two fields ─────────────────────────────────
-- jsonb return, so create-or-replace. The live definition (0035) with
-- `last_seen`, `email_confirmed` and `last_sign_in_at` added.
create or replace function public.admin_user_detail(p_user_id uuid)
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
    'user_id', p.id,
    'display_name', p.display_name,
    'created_at', p.created_at,
    'is_admin', exists (select 1 from public.admins a where a.user_id = p.id),
    'last_seen', public.user_last_seen(p.id),
    'email_confirmed', coalesce(u.email_confirmed_at is not null, false),
    'last_sign_in_at', u.last_sign_in_at,
    'battles', (select count(*) from public.battles b where b.reported_by = p.id),
    'edits_all', (select count(*) from public.warband_edits e where e.owner_id = p.id),
    'edits_30d', (select count(*) from public.warband_edits e
                   where e.owner_id = p.id and e.edited_at >= now() - interval '30 days'),
    'new_warbands_30d', (select count(*) from public.warbands w
                          where w.owner_id = p.id and w.deleted_at is null
                            and w.created_at >= now() - interval '30 days'),
    'new_warbands_90d', (select count(*) from public.warbands w
                          where w.owner_id = p.id and w.deleted_at is null
                            and w.created_at >= now() - interval '90 days'),
    'warbands', (
      select coalesce(jsonb_agg(to_jsonb(w) order by w.rating desc nulls last), '[]'::jsonb)
      from (
        select wb.id, wb.name, wb.warband_type, wb.rating, wb.visibility,
               wb.updated_at, wb.created_at, c.name as campaign_name,
               (select count(*) from public.warband_edits e where e.warband_id = wb.id) as edits
        from public.warbands wb
        left join public.campaigns c on c.id = wb.campaign_id
        where wb.owner_id = p.id and wb.deleted_at is null
      ) w
    ),
    'campaigns', (
      select coalesce(jsonb_agg(to_jsonb(cm) order by cm.joined_at), '[]'::jsonb)
      from (
        select c.id, c.name, c.uses_btb, m.role, m.joined_at,
               (select count(*) from public.campaign_members x where x.campaign_id = c.id) as members
        from public.campaign_members m
        join public.campaigns c on c.id = m.campaign_id
        where m.user_id = p.id
      ) cm
    )
  )
  into v_result
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id = p_user_id;

  if v_result is null then
    raise exception 'No such player';
  end if;

  return v_result;
end;
$$;

-- ── admin_stats + unconfirmed_users ─────────────────────────────────────────
-- 0045's definition with one key added: accounts whose email was never
-- confirmed, for the Overview attention badge.
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
    'unconfirmed_users', (select count(*) from public.profiles p
                            join auth.users u on u.id = p.id
                           where u.email_confirmed_at is null),
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

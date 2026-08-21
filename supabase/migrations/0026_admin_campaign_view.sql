-- §4.9.5 — the per-campaign admin view, the symmetric mirror of the player one.
--
-- An admin is deliberately not a member of every campaign and, by §8.3, can't
-- SELECT a private one through the normal client path (visibility='public' OR
-- member) — nor should they, since membership would also expose the battle log
-- and objectives. These SECURITY DEFINER functions bypass RLS to return
-- METADATA AND COUNTS ONLY (§4.9.7): never battle jsonb, event bodies, objectives,
-- warband roster data, or email. Warband rating is derived from roster jsonb, so
-- it is deliberately not returned — name and type are columns, rating is content.

-- List: searchable, keyset-paged on created_at desc (last_activity is unstable
-- as a cursor since battles keep moving it — same reasoning as the gallery).
create or replace function public.admin_campaign_overview(
  p_search text default null,
  p_before timestamptz default null,
  p_lim int default 25
)
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
    select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc), '[]'::jsonb)
    from (
      select
        cm.id, cm.name, cm.visibility,
        cm.created_by as creator_id, cr.display_name as creator_name, cm.created_at,
        (select count(*) from public.campaign_members m where m.campaign_id = cm.id)::int as member_count,
        (select count(*) from public.campaign_members m
           where m.campaign_id = cm.id and m.role = 'campaign_leader')::int as leader_count,
        (select count(*) from public.battles b where b.campaign_id = cm.id)::int as battle_count,
        (select count(*) from public.campaign_events e where e.campaign_id = cm.id)::int as event_count,
        (select count(*) from public.warbands w
           where w.campaign_id = cm.id and w.deleted_at is null)::int as warband_count,
        -- Activity, not schedule: events are future-dated, so they must not feed
        -- this or every campaign with an upcoming game night reads as active.
        greatest(
          (select max(b.created_at) from public.battles b where b.campaign_id = cm.id),
          (select max(m.joined_at) from public.campaign_members m where m.campaign_id = cm.id)
        ) as last_activity
      from public.campaigns cm
      left join public.profiles cr on cr.id = cm.created_by
      where (p_search is null or cm.name ilike '%' || p_search || '%')
        and (p_before is null or cm.created_at < p_before)
      order by cm.created_at desc
      limit greatest(1, least(p_lim, 100))
    ) c
  );
end;
$$;

-- Detail: metadata + counts + the member list (roles, names, entered warband
-- name/type — never rating/roster content). Same content-blind boundary.
create or replace function public.admin_campaign_detail(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;

  select jsonb_build_object(
    'campaign', (
      select jsonb_build_object(
        'id', c.id, 'name', c.name, 'visibility', c.visibility,
        'creator_id', c.created_by, 'creator_name', cr.display_name,
        'created_at', c.created_at,
        'member_count', (select count(*) from public.campaign_members m where m.campaign_id = c.id)::int,
        'leader_count', (select count(*) from public.campaign_members m
                           where m.campaign_id = c.id and m.role = 'campaign_leader')::int,
        'battle_count', (select count(*) from public.battles b where b.campaign_id = c.id)::int,
        'event_count', (select count(*) from public.campaign_events e where e.campaign_id = c.id)::int,
        'warband_count', (select count(*) from public.warbands w
                            where w.campaign_id = c.id and w.deleted_at is null)::int,
        'last_activity', greatest(
          (select max(b.created_at) from public.battles b where b.campaign_id = c.id),
          (select max(m.joined_at) from public.campaign_members m where m.campaign_id = c.id))
      )
      from public.campaigns c
      left join public.profiles cr on cr.id = c.created_by
      where c.id = p_campaign_id
    ),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'display_name', p.display_name,
        'role', m.role,
        'warband_name', (
          select w.name from public.warbands w
          where w.owner_id = m.user_id and w.campaign_id = m.campaign_id and w.deleted_at is null
          order by w.created_at limit 1
        ),
        'warband_type', (
          select w.warband_type from public.warbands w
          where w.owner_id = m.user_id and w.campaign_id = m.campaign_id and w.deleted_at is null
          order by w.created_at limit 1
        )
      ) order by (m.role = 'campaign_leader') desc, p.display_name), '[]'::jsonb)
      from public.campaign_members m
      left join public.profiles p on p.id = m.user_id
      where m.campaign_id = p_campaign_id
    )
  ) into v;

  return v;
end;
$$;

-- §4.9.5 stranded-campaign count for the Overview badge: a single leader and no
-- activity in 30 days. Surfacing only — no lever to fix one (that's a separate
-- decision, §10.3.1).
create or replace function public.admin_stranded_campaign_count()
returns int
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int from (
    select cm.id,
      (select count(*) from public.campaign_members m
         where m.campaign_id = cm.id and m.role = 'campaign_leader') as leaders,
      greatest(
        (select max(b.created_at) from public.battles b where b.campaign_id = cm.id),
        (select max(m.joined_at) from public.campaign_members m where m.campaign_id = cm.id)
      ) as last_activity
    from public.campaigns cm
    where public.is_admin()
  ) s
  where s.leaders <= 1 and (s.last_activity is null or s.last_activity < now() - interval '30 days');
$$;

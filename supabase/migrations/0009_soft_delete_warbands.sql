-- ----------------------------------------------------------------------------
-- Soft-delete warbands.
--
-- Deleting a warband is the only action in the app that destroys work which
-- cannot be re-derived: a season of Experience, advances, injuries and bought
-- equipment, plus the objectives row that cascades with it. It sat behind a
-- single `window.confirm`.
--
-- `deleted_at` replaces the DELETE. Every read path filters it out through the
-- policies below rather than through a `.is('deleted_at', null)` bolted onto
-- each query — a filter someone forgets to add is exactly how a deleted warband
-- reappears in the standings, and RLS is the one place that cannot be
-- forgotten. Restoring is then an operator-level `update ... set deleted_at =
-- null`, which is the whole point.
--
-- Battles are deliberately untouched: they belong to the campaign's history,
-- not to the warband, and a deleted warband's games still happened.
-- ----------------------------------------------------------------------------

alter table public.warbands
  add column if not exists deleted_at timestamptz;

-- Partial index: every read filters on this, and nearly all rows are live, so
-- indexing only the live ones keeps it small.
create index if not exists warbands_live_idx
  on public.warbands (owner_id)
  where deleted_at is null;

-- ---- Reads: a soft-deleted warband is invisible to everyone ----------------
-- Recreated rather than added to, since a policy cannot be altered in place.
-- The `using` clauses are the originals from 0001/0004 with the filter added.

drop policy if exists "warbands_select" on public.warbands;
create policy "warbands_select" on public.warbands
  for select to authenticated
  using (
    deleted_at is null
    and (
      owner_id = auth.uid()
      or visibility = 'public'
      or (campaign_id is not null and public.is_campaign_member(campaign_id))
    )
  );

drop policy if exists "warbands_select_public_anon" on public.warbands;
create policy "warbands_select_public_anon" on public.warbands
  for select to anon
  using (deleted_at is null and visibility = 'public');

-- ---- The admin views must not resurrect them either ------------------------
-- These are SECURITY DEFINER and so bypass the policies above; without this
-- the counts and the per-player screens would keep listing deleted warbands.

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
  last_active timestamptz
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
        where w.owner_id = p.id and w.deleted_at is null)
    from public.profiles p
    order by p.created_at desc, p.id
    limit greatest(1, least(p_limit, 100))
    offset greatest(0, p_offset);
end;
$$;

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
    'warbands', (
      select coalesce(jsonb_agg(to_jsonb(w) order by w.rating desc nulls last), '[]'::jsonb)
      from (
        select wb.id, wb.name, wb.warband_type, wb.rating, wb.visibility,
               wb.updated_at, wb.created_at, c.name as campaign_name
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
  where p.id = p_user_id;

  if v_result is null then
    raise exception 'No such player';
  end if;

  return v_result;
end;
$$;

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

-- ----------------------------------------------------------------------------
-- Warband edit tracking + richer admin per-player metrics (§4.9.4).
--
-- The admin player views could show how many warbands and battles someone has,
-- but not how much they actually work on a warband — the schema keeps only a
-- single `updated_at` per warband, not a history of edits. This adds a compact
-- append-only log of roster edits (one row per genuine change to a warband's
-- data), written by a trigger, and threads new counts through the two admin
-- RPCs: roster-edit cadence, and how often someone starts a new warband.
--
-- Edit tracking is forward-looking: rows accrue from this migration on, so a
-- long-standing warband can show 0 edits until its owner next changes it. The
-- admin UI frames the edit numbers as "since tracking began" for that reason.
-- ----------------------------------------------------------------------------

-- ── The edit log ────────────────────────────────────────────────────────────
-- One row per genuine change to a warband's roster jsonb. Deliberately minimal:
-- who and when, not what — the admin panel counts edits, it never reads rosters
-- (§4.9.7). Cascades with the warband and the owner so it never outlives them.
create table public.warband_edits (
  id bigint generated always as identity primary key,
  warband_id uuid not null references public.warbands (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  edited_at timestamptz not null default now()
);

alter table public.warband_edits enable row level security;

-- Owners may read their own edit log; nobody may write it from the client — only
-- the SECURITY DEFINER trigger below inserts, and the admin RPCs (also definer)
-- read across everyone. No insert/update/delete policy is intentional.
create policy "warband_edits_select_own" on public.warband_edits
  for select to authenticated using (owner_id = auth.uid());

create index warband_edits_owner_idx on public.warband_edits (owner_id, edited_at desc);
create index warband_edits_warband_idx on public.warband_edits (warband_id);

-- ── The trigger ─────────────────────────────────────────────────────────────
-- Logs a row only when the roster `data` actually changes, so a rename, a
-- visibility toggle, a campaign move or a soft-delete doesn't count as "changing
-- the warband". SECURITY DEFINER so the insert bypasses the log's RLS regardless
-- of which owner fired the update.
create function public.log_warband_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.warband_edits (warband_id, owner_id)
  values (new.id, new.owner_id);
  return null;
end;
$$;

create trigger warbands_log_edit
  after update on public.warbands
  for each row
  when (old.data is distinct from new.data)
  execute function public.log_warband_edit();

-- ── Admin overview: + new-warband and edit cadence ──────────────────────────
-- Adding columns changes the function's return-table row type, which
-- `create or replace` cannot do — so drop first, then recreate. The rest of the
-- body is unchanged from 0009. (admin_user_detail below still returns jsonb, so
-- it needs no drop.)
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
  edits_30d bigint
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
        where e.owner_id = p.id and e.edited_at >= now() - interval '30 days')
    from public.profiles p
    order by p.created_at desc, p.id
    limit greatest(1, least(p_limit, 100))
    offset greatest(0, p_offset);
end;
$$;

-- ── Admin detail: + battles, edit totals, new-warband windows, per-warband edits ──
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
  where p.id = p_user_id;

  if v_result is null then
    raise exception 'No such player';
  end if;

  return v_result;
end;
$$;

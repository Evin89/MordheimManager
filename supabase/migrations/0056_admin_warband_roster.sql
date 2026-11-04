-- ----------------------------------------------------------------------------
-- Admin: a player's warbands, and a read-only view of any roster (§4.9.4.2,
-- §4.9.4.3, amended §4.9.7).
--
-- Decided 2026-10-15: the admin may read any warband's roster, private ones
-- included, to see how players actually use the warband features and whether
-- they work on real data. This deliberately relaxes §4.9.7's "no roster `data`
-- jsonb — ever" for exactly ONE function, `admin_warband_roster`, which writes
-- an audit row on every call. What does NOT change:
--   * BTB objectives stay out. Nothing here touches that table.
--   * No admin write path. Read-only, end to end.
--   * Every other admin function stays content-blind.
-- ----------------------------------------------------------------------------

-- ── Audit log: one row per admin roster read ────────────────────────────────
create table if not exists public.admin_roster_views (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id) on delete cascade,
  -- No FK to warbands: the log must outlive the 0014 hard purge of the row.
  warband_id uuid not null,
  owner_id uuid,
  viewed_at timestamptz not null default now()
);

-- Deny-all: RLS on, no policies. Only the SECURITY DEFINER function writes it,
-- and nothing in the client reads it.
alter table public.admin_roster_views enable row level security;

create index if not exists admin_roster_views_viewed_idx
  on public.admin_roster_views (viewed_at desc);

-- ── §4.9.4.2 — a player's warbands, metadata only ───────────────────────────
-- Includes soft-deleted rows ("my warband vanished" is a real support case).
-- Never selects warbands.data.
create or replace function public.admin_user_warbands(p_user_id uuid)
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
    select coalesce(
      jsonb_agg(to_jsonb(w) order by (w.deleted_at is not null), w.updated_at desc),
      '[]'::jsonb
    )
    from (
      select
        wb.id,
        wb.name,
        wb.warband_type,
        wb.visibility,
        wb.rating,
        wb.campaign_id,
        c.name as campaign_name,
        wb.created_at,
        wb.updated_at,
        wb.deleted_at,
        (select count(*) from public.warband_edits e where e.warband_id = wb.id) as edits_total,
        (select count(*) from public.warband_edits e
           where e.warband_id = wb.id and e.edited_at >= now() - interval '30 days') as edits_30d
      from public.warbands wb
      left join public.campaigns c on c.id = wb.campaign_id
      where wb.owner_id = p_user_id
    ) w
  );
end;
$$;

revoke all on function public.admin_user_warbands(uuid) from public, anon;
grant execute on function public.admin_user_warbands(uuid) to authenticated;

-- ── §4.9.4.3 — the one admin function that returns roster content ───────────
-- Volatile (it writes the audit row), so never `stable`.
create or replace function public.admin_warband_roster(p_warband_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_owner uuid;
begin
  if not public.is_admin() then
    raise exception 'Not authorised';
  end if;

  select
    wb.owner_id,
    jsonb_build_object(
      'id', wb.id,
      'name', wb.name,
      'warband_type', wb.warband_type,
      'owner_id', wb.owner_id,
      'owner_name', p.display_name,
      'visibility', wb.visibility,
      'campaign_name', c.name,
      'updated_at', wb.updated_at,
      'deleted_at', wb.deleted_at,
      'data', wb.data
    )
  into v_owner, v_result
  from public.warbands wb
  left join public.profiles p on p.id = wb.owner_id
  left join public.campaigns c on c.id = wb.campaign_id
  where wb.id = p_warband_id;

  if v_result is null then
    raise exception 'No such warband';
  end if;

  insert into public.admin_roster_views (admin_id, warband_id, owner_id)
  values (auth.uid(), p_warband_id, v_owner);

  return v_result;
end;
$$;

revoke all on function public.admin_warband_roster(uuid) from public, anon;
grant execute on function public.admin_warband_roster(uuid) to authenticated;

-- ── Retention: the view log joins the 3-year audit purge (0043, 0052) ───────
-- Return shape unchanged, so its callers are too.
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

  delete from public.user_visits
  where first_seen_at < now() - p_retention;

  delete from public.admin_roster_views
  where viewed_at < now() - p_retention;

  return query select v_edits, v_rating;
end;
$$;

revoke all on function public.purge_old_audit_logs(interval) from public, anon, authenticated;

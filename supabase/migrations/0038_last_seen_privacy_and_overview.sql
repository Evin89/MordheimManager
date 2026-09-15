-- ----------------------------------------------------------------------------
-- Presence, done safely (follows 0037).
--
-- 0037 put `last_seen_at` on `profiles`, but `profiles` is world-readable — its
-- SELECT policies are `using (true)` for both anon and authenticated, because
-- display names are public. That meant anyone, even signed out, could read every
-- user's last-seen alongside their name: a presence leak. Postgres RLS is
-- row-level and can't hide one column, so this switches `profiles` to
-- column-level SELECT grants: every existing column stays readable, `last_seen_at`
-- does not. Only the SECURITY DEFINER admin functions (which run as the owner and
-- bypass column grants) can read it.
--
-- Then it threads per-user last-seen through `admin_user_overview`, so the admin
-- players list can show true presence beside the edit-based "last active".
-- ----------------------------------------------------------------------------

-- ── Hide last_seen_at from the public profile read ──────────────────────────
-- Replace the blanket table SELECT with a grant on every column *except*
-- last_seen_at. The app only ever selects id / display_name (and never `*`), so
-- nothing client-side needs the presence column — the admin RPCs do, as owner.
revoke select on public.profiles from anon, authenticated;

grant select (
  id,
  display_name,
  created_at,
  avatar_seed,
  acquisition_channel,
  acquisition_ref,
  acquisition_host,
  acquisition_captured_at
) on public.profiles to anon, authenticated;

-- ── admin_user_overview + last_seen ─────────────────────────────────────────
-- Adding a return column changes the row type, so drop then recreate. Body is
-- the live definition with `last_seen` (profiles.last_seen_at) appended; every
-- other column is unchanged. `last_active` stays what it always was — the most
-- recent warband edit — now sitting beside real presence.
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
      p.last_seen_at
    from public.profiles p
    order by p.created_at desc, p.id
    limit greatest(1, least(p_limit, 100))
    offset greatest(0, p_offset);
end;
$$;

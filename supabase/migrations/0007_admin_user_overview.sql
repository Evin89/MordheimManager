-- ----------------------------------------------------------------------------
-- Admin: per-player overview.
--
-- The admin panel has been aggregates-only until now — counts, never rows. This
-- is the first thing in it that lists individual people, so what it exposes is
-- a deliberate choice rather than "everything available".
--
-- Shown: display name, when they joined, whether they are an admin, how many
-- warbands / campaigns / battles they have, and when they last touched a
-- warband. Display names are already readable by every authenticated user
-- (`profiles_select_all` in 0001), so this reveals no new identity — only
-- activity, in aggregate, per person.
--
-- Deliberately NOT shown:
--   * Email addresses. They live in `auth.users`, which the client has never
--     been able to read. Surfacing them here would mean reaching into the auth
--     schema from a definer function — a real widening of what a compromised
--     admin session is worth, for something the operator can already look up in
--     the Supabase dashboard when they genuinely need it.
--   * Warband contents. The app's promise is that a roster is yours and your
--     campaign-mates'; "and the operator" was never part of it.
--   * BTB objectives. Owner-only is the entire reason that table is separate.
--
-- SECURITY DEFINER, so it bypasses RLS by design — which is exactly why the
-- admin check is the first statement in the body and raises rather than
-- returning an empty set. A silent empty result is indistinguishable from
-- "there are no users", and would hide a broken grant.
-- ----------------------------------------------------------------------------

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
      (select count(*) from public.warbands w where w.owner_id = p.id),
      (select count(*) from public.warbands w
        where w.owner_id = p.id and w.visibility = 'public'),
      (select count(*) from public.campaign_members cm where cm.user_id = p.id),
      (select count(*) from public.battles b where b.reported_by = p.id),
      -- Last sign-in would be the better measure, but it lives in auth.users;
      -- the newest warband edit is the best proxy this schema can offer, and it
      -- is null for someone who signed up and never built anything — which is
      -- itself the useful signal.
      (select max(w.updated_at) from public.warbands w where w.owner_id = p.id)
    from public.profiles p
    -- Newest first: the people who just joined are the ones worth looking at.
    order by p.created_at desc, p.id
    limit greatest(1, least(p_limit, 100))
    offset greatest(0, p_offset);
end;
$$;

comment on function public.admin_user_overview(integer, integer) is
  'Per-player activity counts for the admin panel. Admin-only; no emails, no roster contents, no objectives.';

revoke all on function public.admin_user_overview(integer, integer) from public, anon;
grant execute on function public.admin_user_overview(integer, integer) to authenticated;

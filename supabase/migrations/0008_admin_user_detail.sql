-- ----------------------------------------------------------------------------
-- Admin: one player's warbands and campaigns.
--
-- The overview in 0007 gives counts; this is the drill-down behind a row.
--
-- Summary level only, matching what a campaign-mate already sees in standings,
-- plus the visibility flag and campaign link an admin needs to make sense of a
-- report: warband name, type, rating, public/private, which campaign, when it
-- was last touched. Campaigns come back with the player's role and join date.
--
-- Deliberately still NOT returned:
--   * The `data` jsonb — the actual roster. Heroes, equipment, gold, injuries.
--     "Your warband is yours and your campaign-mates'" is a promise the app
--     makes, and quietly adding "and whoever holds an admin row" would break it
--     for a convenience nobody has asked for. Ratings and names are enough to
--     act on a bug report; if a roster genuinely needs inspecting, that is a
--     deliberate look in the Supabase dashboard, not an ambient capability of
--     the admin UI.
--   * Objectives. Owner-only is why that table exists separately at all.
--   * Email. Same reasoning as 0007.
--
-- SECURITY DEFINER, so the admin check is the first statement and raises rather
-- than returning null — a null result would be indistinguishable from "no such
-- player" and would hide a broken grant.
-- ----------------------------------------------------------------------------

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
        select
          wb.id,
          wb.name,
          wb.warband_type,
          wb.rating,
          wb.visibility,
          wb.updated_at,
          wb.created_at,
          -- Named, not just id: an admin reading a bug report needs to know
          -- which campaign, and a uuid tells them nothing.
          c.name as campaign_name
        from public.warbands wb
        left join public.campaigns c on c.id = wb.campaign_id
        where wb.owner_id = p.id
      ) w
    ),

    'campaigns', (
      select coalesce(jsonb_agg(to_jsonb(cm) order by cm.joined_at), '[]'::jsonb)
      from (
        select
          c.id,
          c.name,
          c.uses_btb,
          m.role,
          m.joined_at,
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

comment on function public.admin_user_detail(uuid) is
  'One player''s warbands and campaigns for the admin panel. Admin-only; summary rows only — no roster jsonb, no objectives, no email.';

revoke all on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;

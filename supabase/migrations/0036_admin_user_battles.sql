-- ----------------------------------------------------------------------------
-- Admin: one player's battle log (§4.9.4).
--
-- The per-player admin screen shows a battle *count*; this backs a drill-in to
-- the battles themselves. A battle row is the reporter's own self-reported
-- result (scenario, result, gold/wyrdstone, casualties, notes) — no other
-- player's roster is in it — so an admin may read the log of battles a player
-- reported without crossing the roster-privacy line (§4.9.7).
--
-- SECURITY DEFINER + an explicit admin check, like the other admin_* functions:
-- it reads across battle rows the caller has no direct RLS access to.
-- ----------------------------------------------------------------------------

create or replace function public.admin_user_battles(p_user_id uuid)
returns table (
  battle_id uuid,
  created_at timestamptz,
  campaign_id uuid,
  campaign_name text,
  data jsonb
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
    select b.id, b.created_at, b.campaign_id, c.name, b.data
    from public.battles b
    left join public.campaigns c on c.id = b.campaign_id
    where b.reported_by = p_user_id
    order by b.created_at desc;
end;
$$;

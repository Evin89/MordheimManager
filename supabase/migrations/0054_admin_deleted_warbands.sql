-- Admin overview of soft-deleted warbands.
--
-- 0009 hides soft-deleted warbands from every client read path (RLS), admins
-- included, so there was nowhere to see what had been deleted, by whom, or how
-- long is left before the 0014 purge removes it for good. Like 0026, this is a
-- SECURITY DEFINER read that returns METADATA ONLY (§4.9.7): name, type, owner,
-- campaign and timestamps — never the roster jsonb.

create or replace function public.admin_deleted_warbands(
  p_retention interval default interval '30 days'
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
    select coalesce(jsonb_agg(to_jsonb(d) order by d.deleted_at desc), '[]'::jsonb)
    from (
      select
        w.id,
        w.name,
        w.warband_type,
        w.owner_id,
        p.display_name as owner_name,
        c.name as campaign_name,
        w.created_at,
        w.deleted_at,
        w.deleted_at + p_retention as purge_at
      from public.warbands w
      left join public.profiles p on p.id = w.owner_id
      left join public.campaigns c on c.id = w.campaign_id
      where w.deleted_at is not null
    ) d
  );
end;
$$;

revoke all on function public.admin_deleted_warbands(interval) from public, anon;
grant execute on function public.admin_deleted_warbands(interval) to authenticated;

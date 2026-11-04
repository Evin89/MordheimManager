-- Admin restore of a soft-deleted warband (spec §35.4).
--
-- The delete copy has always promised that a deleted warband "can be reversed
-- on request", and 0054 gave admins a list of what was deleted — but the only
-- way to actually reverse one was a hand-written `update warbands set
-- deleted_at = null` in the SQL editor. This is that update as an admin-only
-- SECURITY DEFINER function, so it can sit behind a button on
-- Admin › Deleted warbands.
--
-- Admin is asserted first, before anything is read. Only a row that is still
-- soft-deleted can be restored: once the nightly 0014 job has purged it there is
-- no row left, and the function says so rather than silently doing nothing.
-- The warband comes back exactly as it was deleted — same owner, same campaign,
-- same roster; nothing about it was changed by the delete except `deleted_at`.

create or replace function public.admin_restore_warband(p_warband_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  update public.warbands
  set deleted_at = null
  where id = p_warband_id
    and deleted_at is not null;

  if not found then
    raise exception 'warband not found or not deleted (it may already have been purged)'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_restore_warband(uuid) from public, anon;
grant execute on function public.admin_restore_warband(uuid) to authenticated;

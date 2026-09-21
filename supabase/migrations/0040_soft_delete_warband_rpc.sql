-- Delete a warband through a SECURITY DEFINER function, not a bare UPDATE.
--
-- The soft delete was an UPDATE that set `deleted_at`, governed by the
-- `warbands_update_own` WITH CHECK. Migration 0039 carved soft deletes out of
-- that check, and yet deletes kept failing with a row-level-security error
-- (Postgres 42501) — the UPDATE's new row was still being rejected. Rather than
-- keep chasing why an owner's own UPDATE trips its own policy, we take the write
-- out of RLS's hands entirely: deleting your own warband is an owner-only,
-- server-decided action, which is exactly what SECURITY DEFINER is for.
--
-- The function runs as its owner (bypassing RLS), takes only the warband id, and
-- itself checks that the caller owns the row — so it cannot be used to delete
-- someone else's warband, and it cannot be tripped by whatever the client sends
-- in a request body. It stays a soft delete (sets `deleted_at`), so the row and
-- its history are preserved exactly as before (see api/warbands.ts, migration
-- 0009). Callers that aren't the owner get a 42501, which the app surfaces as a
-- permission error.

create or replace function public.soft_delete_warband(warband_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.warbands
  set deleted_at = now()
  where id = warband_id
    and owner_id = auth.uid();

  if not found then
    -- No row owned by the caller — either it doesn't exist or isn't theirs.
    raise exception 'warband not found or not owned by caller'
      using errcode = '42501';
  end if;
end;
$$;

-- Only signed-in users may call it, and it decides ownership internally.
revoke all on function public.soft_delete_warband(uuid) from public, anon;
grant execute on function public.soft_delete_warband(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- The 30-day purge (spec §10.5).
--
-- 0009 made warband deletion a soft delete so a mistake is recoverable, and said
-- rows older than 30 days are removed by a scheduled job. There was no job, so
-- nothing has ever been purged: every warband anyone has "deleted" is still
-- there, and since 0013 so is its photo, costing Storage quota indefinitely.
--
-- The hard part is not deleting the rows. It is that **`warband_photos`
-- cascades away with the warband**, and the instant it does, the only record of
-- which files belonged to that warband is gone. The bytes remain in the bucket
-- as an orphan nobody can even name — unreferenced, unlistable against any row,
-- and indistinguishable from a file that is still in use.
--
-- So the paths are copied into a queue *before* the rows go, in the same
-- transaction. That is the same rule 0013's upload path follows, read backwards:
-- there, the row is written last so it never points at bytes that don't exist;
-- here, the row is deleted last so the bytes never outlive the last reference to
-- them.
--
-- Draining the queue is a second step, because SQL cannot delete a Storage
-- object — `storage.objects` is metadata, and removing a row there does not free
-- the underlying file. Only the Storage API does that, which means something
-- holding a session: the admin screen (§4.9). §11.5 warns that client-side
-- cleanup is unreliable, and it is right about cleanup that happens *at deletion
-- time*, where a closed tab loses the work. A durable queue is the answer to
-- exactly that: a failed drain changes nothing and is simply run again.
-- ----------------------------------------------------------------------------

create table if not exists public.storage_purge_queue (
  bucket text not null,
  path text not null,
  -- Kept for diagnostics, deliberately **not** a foreign key: the whole reason
  -- this row exists is that the warband it names is about to stop existing.
  warband_id uuid,
  queued_at timestamptz not null default now(),
  primary key (bucket, path)
);

alter table public.storage_purge_queue enable row level security;

-- Operators only. This is a list of file paths belonging to other people.
create policy "storage_purge_queue_select_admin" on public.storage_purge_queue
  for select to authenticated using (public.is_admin());
create policy "storage_purge_queue_delete_admin" on public.storage_purge_queue
  for delete to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- The job itself.
--
-- Retention is a parameter with the §10.5 default rather than a literal, so the
-- job can be exercised against a shorter window without editing and re-pushing
-- the function that deletes people's warbands.
-- ----------------------------------------------------------------------------
create or replace function public.purge_deleted_warbands(
  p_retention interval default interval '30 days'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purged integer;
begin
  -- Queue first. Both statements are one transaction, so there is no instant at
  -- which the warband is gone and its files are unnamed.
  insert into public.storage_purge_queue (bucket, path, warband_id)
  select 'images', paths.path, p.warband_id
  from public.warband_photos p
  join public.warbands w on w.id = p.warband_id
  cross join lateral (values (p.storage_path), (p.thumb_path)) as paths(path)
  where w.deleted_at is not null
    and w.deleted_at < now() - p_retention
  on conflict (bucket, path) do nothing;

  -- `objectives` and `warband_photos` cascade. `battles` deliberately do not
  -- reference warbands at all — the id sits inside their jsonb — so campaign
  -- history survives the warband, which is what §10.4 requires.
  delete from public.warbands
  where deleted_at is not null
    and deleted_at < now() - p_retention;
  get diagnostics v_purged = row_count;

  return v_purged;
end;
$$;

comment on function public.purge_deleted_warbands(interval) is
  'Hard-deletes warbands soft-deleted longer ago than the retention window, queueing their photo paths for Storage cleanup first. Called by pg_cron.';

-- Not reachable from the client. pg_cron runs it as the table owner; an operator
-- goes through the admin wrapper below, which checks who is asking.
revoke all on function public.purge_deleted_warbands(interval) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- The operator's entry point.
--
-- Separate from the function above because that one has no caller check at all —
-- correct for cron, which has no `auth.uid()` to check, and unacceptable for
-- anything reachable with an anon key.
-- ----------------------------------------------------------------------------
create or replace function public.admin_purge_deleted_warbands()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;
  return public.purge_deleted_warbands();
end;
$$;

revoke all on function public.admin_purge_deleted_warbands() from public, anon;
grant execute on function public.admin_purge_deleted_warbands() to authenticated;

-- ----------------------------------------------------------------------------
-- An operator must be able to delete the queued objects.
--
-- The 0013 policy allowed only the owner, which cannot drain a queue: the files
-- belong to whoever deleted the warband, and waiting for that person to sign in
-- and tidy up is not a plan. Admins gain the same delete right — and only the
-- delete right, still confined to the `warbands/` prefix of the bucket.
-- ----------------------------------------------------------------------------
drop policy if exists "warband_photos_object_delete" on storage.objects;
create policy "warband_photos_object_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'warbands'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_admin()
    )
  );

-- ----------------------------------------------------------------------------
-- The schedule.
--
-- Wrapped so that a project without pg_cron still applies the rest of this
-- migration — the function and the queue are useful on their own, and the admin
-- screen can run them by hand. A migration that refuses to apply because an
-- extension is unavailable would block every later migration too.
--
-- 03:17 rather than midnight: a job that deletes things should not run at the
-- same minute as every other cron job on the instance.
-- ----------------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice
    'pg_cron unavailable (%), so the purge is not scheduled. Enable it under Database → Extensions, or call admin_purge_deleted_warbands() from the admin screen.',
    sqlerrm;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'purge-deleted-warbands') then
      perform cron.unschedule('purge-deleted-warbands');
    end if;
    perform cron.schedule(
      'purge-deleted-warbands',
      '17 3 * * *',
      'select public.purge_deleted_warbands()'
    );
  end if;
end;
$$;

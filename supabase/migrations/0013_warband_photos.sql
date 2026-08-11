-- ----------------------------------------------------------------------------
-- Warband photos (spec §11, group shot only).
--
-- The §11.1 plan put the photo record inside the warband jsonb and added a
-- `photo_index` table purely so Storage RLS could resolve ownership, since a
-- storage policy cannot read into jsonb. §11.2 then called keeping that index in
-- step with the blob "the fragile part". It is — so this table *is* the record,
-- and there is only one copy to keep in step.
--
-- Two more reasons it does not belong in the blob, both specific to this app:
--
--   * `warbands` saves carry the `updated_at` they last read and are queued per
--     warband. A photo in the blob makes uploading a picture a roster *save*: it
--     collides with pending characteristic edits and is refused as "changed
--     elsewhere", and it drags the whole roster through the save path to change
--     an image.
--   * A real row gets a foreign key, so deletion and the 30-day purge can
--     cascade. jsonb cannot.
--
-- One photo per warband is the primary key, not an application check.
-- ----------------------------------------------------------------------------

create table if not exists public.warband_photos (
  warband_id uuid primary key references public.warbands(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  -- Both objects live in the bucket below. The thumbnail is a separate path
  -- rather than a derived one: §11.5 warns egress bites before storage, and a
  -- list that loads full images is how that happens.
  storage_path text not null,
  thumb_path text not null,
  width integer,
  height integer,
  updated_at timestamptz not null default now()
);

create index if not exists warband_photos_owner_idx on public.warband_photos (owner_id);

alter table public.warband_photos enable row level security;

-- ----------------------------------------------------------------------------
-- Who may read a warband, as a function.
--
-- The same three branches as `warbands_select` (as narrowed by 0009), needed
-- here because a storage policy cannot express them and because repeating them
-- inline in three places is how they drift apart. SECURITY DEFINER so it can see
-- the row it is judging.
-- ----------------------------------------------------------------------------
create or replace function public.can_read_warband(p_warband_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.warbands w
    where w.id = p_warband_id
      and w.deleted_at is null
      and (
        w.owner_id = auth.uid()
        or w.visibility = 'public'
        or (w.campaign_id is not null and public.is_campaign_member(w.campaign_id))
      )
  );
$$;

comment on function public.can_read_warband(uuid) is
  'Mirrors warbands_select. Used by warband_photos and by the storage policies, which cannot express it themselves.';

-- Reading a photo record follows reading the warband it belongs to. `to
-- authenticated` and no anon policy is the deliberate part: the gallery is
-- anon-readable (0004), but a photo on a public warband would then be open to
-- the internet and indexable, which raises the moderation bar a long way (§11.5,
-- conflict 11). Names, types and ratings stay public; pictures need an account.
create policy "warband_photos_select" on public.warband_photos
  for select to authenticated
  using (public.can_read_warband(warband_id));

-- Writing is the owner's alone. Campaign-mates can read your roster; they do not
-- get to change its picture.
create policy "warband_photos_insert_own" on public.warband_photos
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.warbands w
      where w.id = warband_id and w.owner_id = auth.uid()
    )
  );
create policy "warband_photos_update_own" on public.warband_photos
  for update to authenticated using (owner_id = auth.uid());
create policy "warband_photos_delete_own" on public.warband_photos
  for delete to authenticated using (owner_id = auth.uid());

-- ----------------------------------------------------------------------------
-- The bucket: `images`, shared with whatever else the project keeps there.
--
-- It **must be private**. A public Supabase bucket serves every object at a
-- predictable URL to anyone on the internet, with no policy consulted at all —
-- which would route straight around `warband_photos_object_select` below and
-- undo the signed-in-only decision in §11.5. A private warband whose group shot
-- is one guessed URL away is exactly what that policy exists to prevent.
--
-- So this refuses to proceed rather than quietly publishing photos. If it stops
-- your migration: either flip `images` to private in the dashboard (Storage →
-- images → Settings), or say so and the client can be switched to public URLs
-- with the consequences understood.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('images', 'images', false)
on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from storage.buckets where id = 'images' and public) then
    raise exception
      'The `images` bucket is public. Warband photos are meant to be readable only by signed-in players (spec 11.5), and a public bucket serves every object to anyone with the URL regardless of policy. Make it private, or change the decision deliberately.';
  end if;
end;
$$;

-- Path convention: warbands/{owner_id}/{warband_id}/{full|thumb}-{timestamp}.webp
--
-- Namespaced under `warbands/` because the bucket is shared — without it these
-- policies would claim every object whose first path segment happens to be a
-- uuid. The owner id being the *second* segment is what lets the write policies
-- be a string comparison rather than a lookup.
drop policy if exists "warband_photos_object_insert" on storage.objects;
create policy "warband_photos_object_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'warbands'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "warband_photos_object_delete" on storage.objects;
create policy "warband_photos_object_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'warbands'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Deliberately no UPDATE policy: replacing a photo writes a *new* path and
-- deletes the old object. Overwriting in place would leave every cached signed
-- URL and CDN copy serving the previous image, so a replace would look as though
-- it had silently failed.

-- Reading an object follows reading its record, which follows reading the
-- warband. Written against both paths because the thumbnail is a row of its own
-- in storage but not in `warband_photos`.
drop policy if exists "warband_photos_object_select" on storage.objects;
create policy "warband_photos_object_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'images'
    and exists (
      select 1 from public.warband_photos p
      where (p.storage_path = storage.objects.name or p.thumb_path = storage.objects.name)
        and public.can_read_warband(p.warband_id)
    )
  );

-- ----------------------------------------------------------------------------
-- Soft delete (§10.5).
--
-- Nothing here hard-deletes when a warband is soft-deleted: 0009 keeps a warband
-- restorable for 30 days, and a restored warband with its picture missing is a
-- worse outcome than 30 days of quota. The row is filtered through its parent by
-- `can_read_warband`'s `deleted_at is null`, exactly like battles. The objects
-- go on the purge that removes the warband for real, which is also where the
-- `on delete cascade` above finally fires.
-- ----------------------------------------------------------------------------

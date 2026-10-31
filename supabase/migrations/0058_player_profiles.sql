-- ----------------------------------------------------------------------------
-- §38 Player profiles — part A: the profile itself.
--
-- Adds the fields a profile page shows (country, bio, favourite warband, an
-- uploaded photo) and the RPCs that read and write them. The directory and
-- direct campaign invites are part B (0059).
--
-- Exposure is decided by the 0047 column grants, which stay as they are:
-- clients can SELECT only id, display_name, created_at, avatar_seed and UPDATE
-- only display_name. None of the new columns is granted. Every read goes
-- through a SECURITY DEFINER function with an explicit return list, and every
-- write through `update_my_profile` / the avatar functions — so the
-- acquisition and presence columns stay unreachable whatever happens here, and
-- anon (the gallery is signed-out readable, 0004) never sees any of it.
-- ----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists bio text,
  add column if not exists favourite_warband_type text,
  add column if not exists country text,
  add column if not exists avatar_path text;

alter table public.profiles
  drop constraint if exists profiles_bio_check,
  add constraint profiles_bio_check
    check (bio is null or char_length(bio) <= 280),
  drop constraint if exists profiles_favourite_warband_type_check,
  add constraint profiles_favourite_warband_type_check
    check (favourite_warband_type is null or char_length(favourite_warband_type) <= 64),
  -- ISO 3166-1 alpha-2, upper case. Country only, by decision: no region or city.
  drop constraint if exists profiles_country_check,
  add constraint profiles_country_check
    check (country is null or country ~ '^[A-Z]{2}$'),
  -- Always inside the owner's own avatars/ folder in the `images` bucket.
  drop constraint if exists profiles_avatar_path_check,
  add constraint profiles_avatar_path_check
    check (avatar_path is null or avatar_path like 'avatars/' || id::text || '/%');

-- ── Read: one player's profile ──────────────────────────────────────────────
-- Header fields plus counts. The counts include battles and warbands the
-- viewer cannot read (a stranger's standalone games, private warbands): that
-- is the point of a definer function here, and why it returns numbers only —
-- no opponents, scenarios, dates or campaign names (§4.9.7 content-blind).
--
-- The return list is the boundary. It never carries last_seen_at, an
-- acquisition column or an email; adding one is a privacy decision.
create or replace function public.get_player_profile(p_uid uuid)
returns table (
  id uuid,
  display_name text,
  avatar_seed text,
  avatar_path text,
  country text,
  bio text,
  favourite_warband_type text,
  joined_at timestamptz,
  battles int,
  wins int,
  losses int,
  draws int,
  warbands int,
  campaigns int
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_seed, p.avatar_path, p.country, p.bio,
         p.favourite_warband_type, p.created_at,
         coalesce(b.battles, 0), coalesce(b.wins, 0), coalesce(b.losses, 0), coalesce(b.draws, 0),
         (select count(*)::int from public.warbands w
            where w.owner_id = p.id and w.deleted_at is null),
         (select count(*)::int from public.campaign_members m where m.user_id = p.id)
  from public.profiles p
  left join lateral (
    select count(*)::int as battles,
           count(*) filter (where bt.data->>'result' = 'win')::int  as wins,
           count(*) filter (where bt.data->>'result' = 'loss')::int as losses,
           count(*) filter (where bt.data->>'result' = 'draw')::int as draws
    from public.battles bt
    where bt.reported_by = p.id
  ) b on true
  where p.id = p_uid
    and (select auth.uid()) is not null;
$$;

revoke all on function public.get_player_profile(uuid) from public, anon;
grant execute on function public.get_player_profile(uuid) to authenticated;

-- ── Read: avatar paths for a list of players ────────────────────────────────
-- Lists (members, comments) show a photo beside each name. The column is not
-- client-grantable without also exposing it to anon, so lists ask for the
-- paths they need in one batch. Capped so it can't be used to page the table.
create or replace function public.get_avatar_paths(p_ids uuid[])
returns table (id uuid, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.avatar_path
  from public.profiles p
  where p.id = any (p_ids[1:200])
    and p.avatar_path is not null
    and (select auth.uid()) is not null;
$$;

revoke all on function public.get_avatar_paths(uuid[]) from public, anon;
grant execute on function public.get_avatar_paths(uuid[]) to authenticated;

-- ── Write: your own profile ─────────────────────────────────────────────────
-- One function rather than widening the 0047 UPDATE grant: the grant is
-- per-column, and the acquisition columns must never gain a client write path.
-- 40 matches MAX_DISPLAY_NAME in src/api/profile.ts.
create or replace function public.update_my_profile(
  p_display_name text,
  p_bio text,
  p_favourite_warband_type text,
  p_country text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := trim(coalesce(p_display_name, ''));
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;
  if char_length(v_name) not between 1 and 40 then
    raise exception 'Your display name must be 1 to 40 characters.';
  end if;

  update public.profiles set
    display_name           = v_name,
    bio                    = nullif(trim(p_bio), ''),
    favourite_warband_type = nullif(trim(p_favourite_warband_type), ''),
    country                = nullif(upper(trim(p_country)), '')
  where id = v_uid;
end;
$$;

revoke all on function public.update_my_profile(text, text, text, text) from public, anon;
grant execute on function public.update_my_profile(text, text, text, text) to authenticated;

-- ── Write: your own photo ───────────────────────────────────────────────────
-- The client uploads to a fresh path first, then records it here; the row is
-- only ever written once the bytes exist (same rule as api/photos.ts). Returns
-- the previous path so the client can delete that object — deleting storage
-- objects from SQL bypasses the storage API and leaves the file behind.
create or replace function public.set_my_avatar(p_path text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_old text;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;
  if p_path is null or p_path not like 'avatars/' || v_uid::text || '/%' then
    raise exception 'That photo is not in your own folder.';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'images' and o.name = p_path) then
    raise exception 'The photo has not finished uploading.';
  end if;

  select avatar_path into v_old from public.profiles where id = v_uid;
  update public.profiles set avatar_path = p_path where id = v_uid;
  return v_old;
end;
$$;

create or replace function public.clear_my_avatar()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_old text;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;
  select avatar_path into v_old from public.profiles where id = v_uid;
  update public.profiles set avatar_path = null where id = v_uid;
  return v_old;
end;
$$;

-- The generated fallback for players without a photo.
create or replace function public.reroll_my_avatar()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_seed text := gen_random_uuid()::text;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;
  update public.profiles set avatar_seed = v_seed where id = v_uid;
  return v_seed;
end;
$$;

revoke all on function public.set_my_avatar(text) from public, anon;
revoke all on function public.clear_my_avatar() from public, anon;
revoke all on function public.reroll_my_avatar() from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;
grant execute on function public.clear_my_avatar() to authenticated;
grant execute on function public.reroll_my_avatar() to authenticated;

-- ── Moderation ──────────────────────────────────────────────────────────────
-- A photo and a bio are user content other players see. Reports land in the
-- existing issue inbox (context kind 'profile'); these are the admin's two
-- actions on /admin/players/:id. admin_clear_avatar returns the path so the
-- admin client can delete the object (allowed by the admin storage policy below).
create or replace function public.admin_clear_avatar(p_uid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;
  select avatar_path into v_old from public.profiles where id = p_uid;
  update public.profiles set avatar_path = null where id = p_uid;
  return v_old;
end;
$$;

create or replace function public.admin_clear_bio(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;
  update public.profiles set bio = null where id = p_uid;
end;
$$;

revoke all on function public.admin_clear_avatar(uuid) from public, anon;
revoke all on function public.admin_clear_bio(uuid) from public, anon;
grant execute on function public.admin_clear_avatar(uuid) to authenticated;
grant execute on function public.admin_clear_bio(uuid) to authenticated;

-- ── Storage: avatars/{user_id}/{stamp}.webp in the private `images` bucket ──
-- Same bucket as warband photos (0013), its own prefix so these policies claim
-- nothing else. The bucket must stay private — 0013 refuses to run otherwise.
--
-- Read: any signed-in player (decided: photos visible to everyone with an
-- account). No anon policy, matching warband photos (§11.5).
drop policy if exists "avatar_object_select" on storage.objects;
create policy "avatar_object_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'avatars'
  );

drop policy if exists "avatar_object_insert" on storage.objects;
create policy "avatar_object_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'avatars'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- Own folder, or an admin removing a reported photo.
drop policy if exists "avatar_object_delete" on storage.objects;
create policy "avatar_object_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'images'
    and (storage.foldername(name))[1] = 'avatars'
    and ((storage.foldername(name))[2] = (select auth.uid())::text or public.is_admin())
  );

-- No UPDATE policy: a new photo is a new path, never an overwrite (see 0013).

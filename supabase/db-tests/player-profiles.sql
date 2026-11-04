-- §38 part A: player profiles. What a profile exposes, who can write it, and
-- that the avatar storage policies stay inside each player's own folder.
--
--   A  player with a profile      B  another player      X  admin

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'x@example.test');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000c1');

insert into public.warbands (id, owner_id, name, warband_type, visibility, data) values
  ('a0000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'Private', 'Reikland', 'private', '{}'),
  ('a0000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1', 'Public', 'Reikland', 'public', '{}');
insert into public.battles (campaign_id, reported_by, data) values
  (null, '00000000-0000-0000-0000-0000000000a1', '{"result":"win"}'),
  (null, '00000000-0000-0000-0000-0000000000a1', '{"result":"loss"}'),
  (null, '00000000-0000-0000-0000-0000000000a1', '{"result":"win"}');

-- Stand-in for an uploaded object, as the storage API would have created it.
insert into storage.objects (bucket_id, name) values
  ('images', 'avatars/00000000-0000-0000-0000-0000000000a1/1.webp'),
  ('images', 'avatars/00000000-0000-0000-0000-0000000000b1/1.webp');

-- ── A edits their own profile ────────────────────────────────────────────────
select t.login('00000000-0000-0000-0000-0000000000a1');
select public.update_my_profile('  Anna  ', 'Plays Skaven.', 'skaven', 'nl');
select t.ok(public.set_my_avatar('avatars/00000000-0000-0000-0000-0000000000a1/1.webp') is null,
  'set_my_avatar returns the previous path (none yet)');
select t.logout();

select t.ok((select display_name = 'Anna' and country = 'NL' and bio = 'Plays Skaven.'
             from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'update_my_profile trims the name and upper-cases the country');

-- ── B reads A ────────────────────────────────────────────────────────────────
select t.login('00000000-0000-0000-0000-0000000000b1');
select t.ok((select battles = 3 and wins = 2 and losses = 1 and warbands = 2
             from public.get_player_profile('00000000-0000-0000-0000-0000000000a1')),
  'profile counts include battles and warbands B cannot read');
select t.ok((select country = 'NL' and avatar_path like 'avatars/%'
             from public.get_player_profile('00000000-0000-0000-0000-0000000000a1')),
  'profile returns country and photo path');
select t.ok((select count(*) = 1 from public.get_avatar_paths(
               array['00000000-0000-0000-0000-0000000000a1'::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid])),
  'get_avatar_paths returns only players with a photo');

-- The new columns are not client-selectable; only the RPC carries them.
do $$ begin
  begin
    perform bio from public.profiles;
    raise exception 'FAILED: authenticated could select profiles.bio';
  exception when insufficient_privilege then
    raise notice 'ok - profiles.bio is not client-selectable';
  end;
  begin
    perform avatar_path from public.profiles;
    raise exception 'FAILED: authenticated could select profiles.avatar_path';
  exception when insufficient_privilege then
    raise notice 'ok - profiles.avatar_path is not client-selectable';
  end;
end $$;

-- B can't point their avatar at A's file, or at a file that doesn't exist.
do $$ begin
  begin
    perform public.set_my_avatar('avatars/00000000-0000-0000-0000-0000000000a1/1.webp');
    raise exception 'FAILED: B set an avatar in A''s folder';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice 'ok - set_my_avatar refuses another player''s folder';
  end;
  begin
    perform public.set_my_avatar('avatars/00000000-0000-0000-0000-0000000000b1/missing.webp');
    raise exception 'FAILED: B set an avatar that was never uploaded';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice 'ok - set_my_avatar refuses a path with no object';
  end;
end $$;

-- B is not an admin.
do $$ begin
  begin
    perform public.admin_clear_bio('00000000-0000-0000-0000-0000000000a1');
    raise exception 'FAILED: non-admin cleared a bio';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice 'ok - admin_clear_bio is admin-only';
  end;
end $$;

-- Storage: B may write into their own folder only.
insert into storage.objects (bucket_id, name) values ('images', 'avatars/00000000-0000-0000-0000-0000000000b1/2.webp');
select t.ok(true, 'B uploads into their own avatars folder');
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('images', 'avatars/00000000-0000-0000-0000-0000000000a1/evil.webp');
    raise exception 'FAILED: B uploaded into A''s folder';
  exception when insufficient_privilege then
    raise notice 'ok - B cannot upload into A''s folder';
  end;
end $$;
with d as (delete from storage.objects where name = 'avatars/00000000-0000-0000-0000-0000000000a1/1.webp' returning 1)
select t.ok((select count(*) from d) = 0, 'B cannot delete A''s photo');
select t.ok((select count(*) from storage.objects where name like 'avatars/00000000-0000-0000-0000-0000000000a1/%') = 1,
  'B can read A''s photo object');
select t.logout();

-- ── Signed out ───────────────────────────────────────────────────────────────
select t.login(null);
do $$ begin
  begin
    perform * from public.get_player_profile('00000000-0000-0000-0000-0000000000a1');
    raise exception 'FAILED: anon read a profile';
  exception when insufficient_privilege then
    raise notice 'ok - anon cannot call get_player_profile';
  end;
end $$;
-- Real Supabase grants anon the table and lets RLS return nothing; the shim
-- doesn't grant it at all. Either way anon must see no avatar.
do $$ declare n bigint; begin
  begin
    select count(*) into n from storage.objects where name like 'avatars/%';
  exception when insufficient_privilege then
    n := 0;
  end;
  if n <> 0 then raise exception 'FAILED: anon read % avatar objects', n; end if;
  raise notice 'ok - anon cannot read avatar objects';
end $$;
select t.logout();

-- ── Validation in the database, not just the form ────────────────────────────
select t.login('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  begin
    perform public.update_my_profile('Anna', repeat('x', 281), null, null);
    raise exception 'FAILED: a 281-character bio was accepted';
  exception when check_violation then
    raise notice 'ok - bio over 280 characters is rejected';
  end;
  begin
    perform public.update_my_profile('Anna', null, null, 'Netherlands');
    raise exception 'FAILED: a malformed country was accepted';
  exception when check_violation then
    raise notice 'ok - malformed country code is rejected';
  end;
  begin
    perform public.update_my_profile('   ', null, null, null);
    raise exception 'FAILED: an empty name was accepted';
  exception when raise_exception then
    if sqlerrm like 'FAILED%' then raise; end if;
    raise notice 'ok - empty display name is rejected';
  end;
end $$;
select t.logout();

-- ── Admin removes a reported photo and bio ───────────────────────────────────
select t.login('00000000-0000-0000-0000-0000000000c1');
select t.ok(public.admin_clear_avatar('00000000-0000-0000-0000-0000000000a1')
            = 'avatars/00000000-0000-0000-0000-0000000000a1/1.webp',
  'admin_clear_avatar returns the path to delete');
select public.admin_clear_bio('00000000-0000-0000-0000-0000000000a1');
with d as (delete from storage.objects where name = 'avatars/00000000-0000-0000-0000-0000000000a1/1.webp' returning 1)
select t.ok((select count(*) from d) = 1, 'admin can delete a reported photo object');
select t.logout();
select t.ok((select avatar_path is null and bio is null
             from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'photo and bio are cleared');

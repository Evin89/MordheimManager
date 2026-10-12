-- §35.4 admin_restore_warband (migration 0056).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'player@example.test');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000ad');
insert into public.warbands (id, owner_id, name, warband_type, data, deleted_at) values
  ('20000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', 'Gone', 'Reikland', '{}', now() - interval '3 days'),
  ('20000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b1', 'Alive', 'Reikland', '{}', null);

-- A player, even the owner, cannot restore.
select t.login('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  perform public.admin_restore_warband('20000000-0000-0000-0000-0000000000d1');
  raise exception 'FAILED: a non-admin restored a warband';
exception when insufficient_privilege then
  raise notice 'ok - non-admin is refused';
end $$;
select t.logout();
select t.ok((select deleted_at is not null from public.warbands where name = 'Gone'), 'still deleted after the refused call');

-- An admin can.
select t.login('00000000-0000-0000-0000-0000000000ad');
select public.admin_restore_warband('20000000-0000-0000-0000-0000000000d1');
-- A warband that isn't deleted (or no longer exists) is an error, not a no-op.
do $$ begin
  perform public.admin_restore_warband('20000000-0000-0000-0000-0000000000d2');
  raise exception 'FAILED: restoring a live warband succeeded';
exception when no_data_found then
  raise notice 'ok - a live warband cannot be restored';
end $$;
select t.logout();
select t.ok((select deleted_at is null from public.warbands where name = 'Gone'), 'restored by the admin');
select t.ok((select owner_id = '00000000-0000-0000-0000-0000000000b1' from public.warbands where name = 'Gone'), 'owner unchanged');

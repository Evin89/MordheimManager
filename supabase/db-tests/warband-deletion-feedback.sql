-- §42 warband deletion feedback (migration 0069).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'one@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'two@example.test');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000ad');

insert into public.warbands (id, owner_id, name, warband_type, data, created_at) values
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Tryout', 'Reikland', '{}', now() - interval '30 minutes'),
  ('20000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', 'Silent', 'Skaven', '{}', now() - interval '5 days'),
  ('20000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b1', 'Noted', 'Middenheim', '{}', now() - interval '50 hours'),
  ('20000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000b1', 'Bogus', 'Marienburg', '{}', now()),
  ('20000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000b2', 'Theirs', 'Reikland', '{}', now());
insert into public.warband_edits (warband_id, owner_id) values
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1'),
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1');

select t.login('00000000-0000-0000-0000-0000000000b1');

-- With a reason: deleted, and the answer filed with its context.
select public.soft_delete_warband('20000000-0000-0000-0000-0000000000a1', 'trying_out', null);
-- Without one: deleted, nothing filed. The one-argument call old clients make.
select public.soft_delete_warband('20000000-0000-0000-0000-0000000000a2');
-- A note alone is filed under "other", trimmed.
select public.soft_delete_warband('20000000-0000-0000-0000-0000000000a3', null, '  The Middenheim list was wrong  ');
-- An unknown reason never blocks the delete; it is just dropped.
select public.soft_delete_warband('20000000-0000-0000-0000-0000000000a4', 'nonsense', '');
-- Deleting again is a no-op: no error, no second answer.
select public.soft_delete_warband('20000000-0000-0000-0000-0000000000a1', 'starting_over', null);

-- Someone else's warband: refused, nothing filed.
do $$ begin
  perform public.soft_delete_warband('20000000-0000-0000-0000-0000000000a5', 'mistake', null);
  raise exception 'FAILED: deleted another player''s warband';
exception when insufficient_privilege then
  raise notice 'ok - another player''s warband is refused';
end $$;

-- Players can't read the answers, not even their own.
do $$ begin
  perform 1 from public.warband_deletion_feedback;
  raise exception 'FAILED: a player read warband_deletion_feedback';
exception when insufficient_privilege then
  raise notice 'ok - the table is not readable by players';
end $$;
do $$ begin
  perform public.admin_deletion_feedback(90);
  raise exception 'FAILED: a player read the deletion feedback';
exception when insufficient_privilege then
  raise notice 'ok - non-admin is refused';
end $$;
select t.logout();

select t.ok((select count(*) = 4 from public.warbands where deleted_at is not null), 'all four of their warbands are deleted');
select t.ok((select deleted_at is null from public.warbands where name = 'Theirs'), 'the other player''s warband is untouched');
select t.ok((select count(*) = 2 from public.warband_deletion_feedback), 'two answers: the reason and the note');

select t.ok((
  select reason = 'trying_out' and warband_type = 'Reikland' and age_hours = 0 and edit_count = 2
     and not in_campaign and note is null
  from public.warband_deletion_feedback where warband_type = 'Reikland'
), 'the answer carries type, age in hours and edit count');
select t.ok((
  select reason = 'other' and note = 'The Middenheim list was wrong' and age_hours = 50
  from public.warband_deletion_feedback where warband_type = 'Middenheim'
), 'a note alone is filed under other, trimmed');

-- Anonymous: nothing in the table points back at a player or a warband.
select t.ok(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'warband_deletion_feedback'
    and column_name in ('owner_id', 'user_id', 'warband_id', 'name')
), 'no owner, warband id or name is stored');

-- The answers outlive the warband.
delete from public.warbands where name = 'Tryout';
select t.ok((select count(*) = 2 from public.warband_deletion_feedback), 'purging the warband keeps the answer');

-- The admin read.
select t.login('00000000-0000-0000-0000-0000000000ad');
create temp table fb as select public.admin_deletion_feedback(90) as r;
select t.logout();
select t.ok((select (r->>'answered')::int = 2 from fb), 'admin: 2 answered');
select t.ok((select (r->>'deleted')::int = 3 from fb), 'admin: 3 still-deleted warbands in range (one was purged)');
select t.ok((select jsonb_array_length(r->'reasons') = 2 from fb), 'admin: two reasons');
select t.ok((select r->'notes'->0->>'note' = 'The Middenheim list was wrong' from fb), 'admin: the note');

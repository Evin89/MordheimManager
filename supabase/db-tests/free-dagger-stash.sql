-- §45 free daggers out of the treasury (migration 0073).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'one@example.test');

-- a1: three free daggers (one without a note, one with "Dagger " spacing),
--     one bought dagger, one sword in the treasury; a hero without a dagger.
-- a2: nothing to clean.
-- a3: soft-deleted, one free dagger in the treasury.
-- a4: no treasury key at all.
insert into public.warbands (id, owner_id, name, warband_type, data, updated_at, deleted_at) values
  ('30000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'Messy', 'reiklanders',
   '{"heroes":[{"id":"h1","equipment":[{"id":"s0","name":"Sword","category":"melee","cost":10}]}],
     "henchmenGroups":[{"id":"g1","isAnimal":true,"equipment":[]}],
     "treasury":[
       {"id":"d1","name":"Dagger","category":"melee","cost":0,"notes":"Free — every warrior carries one (rulebook, Equipment)."},
       {"id":"d2","name":"Dagger ","category":"melee","cost":0},
       {"id":"b1","name":"Dagger","category":"melee","cost":2},
       {"id":"d3","name":"dagger","category":"melee"},
       {"id":"s1","name":"Sword","category":"melee","cost":10}
     ]}', '2026-01-01 00:00:00+00', null),
  ('30000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1', 'Tidy', 'skaven',
   '{"heroes":[],"treasury":[{"id":"b2","name":"Dagger","category":"melee","cost":2}]}', '2026-01-01 00:00:00+00', null),
  ('30000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000c1', 'Gone', 'undead',
   '{"treasury":[{"id":"d4","name":"Dagger","category":"melee","cost":0}]}', '2026-01-01 00:00:00+00', now()),
  ('30000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000c1', 'Bare', 'undead',
   '{"heroes":[]}', '2026-01-01 00:00:00+00', null);

create temp table before as select id, data, updated_at, rating from public.warbands;
create temp table edits_before as select count(*) as n from public.warband_edits;
create temp table history_before as select count(*) as n from public.warband_rating_history;

select t.ok(public.cleanup_free_dagger_stash() = 2, 'two warbands changed (a1 and the soft-deleted a3)');

select t.ok(
  (select jsonb_agg(e ->> 'id' order by e ->> 'id') from public.warbands w, jsonb_array_elements(w.data -> 'treasury') e
   where w.id = '30000000-0000-0000-0000-0000000000a1') = '["b1", "s1"]'::jsonb,
  'a1 keeps only the bought dagger and the sword');
select t.ok(
  (select data -> 'heroes' from public.warbands where id = '30000000-0000-0000-0000-0000000000a1')
    = (select data -> 'heroes' from before where id = '30000000-0000-0000-0000-0000000000a1'),
  'a1''s hero gets no dagger back');
select t.ok(
  (select data -> 'henchmenGroups' from public.warbands where id = '30000000-0000-0000-0000-0000000000a1')
    = (select data -> 'henchmenGroups' from before where id = '30000000-0000-0000-0000-0000000000a1'),
  'a1''s henchmen are untouched');
select t.ok(
  (select data from public.warbands where id = '30000000-0000-0000-0000-0000000000a2')
    = (select data from before where id = '30000000-0000-0000-0000-0000000000a2'),
  'a warband with nothing to clean is unchanged');
select t.ok(
  (select data -> 'treasury' from public.warbands where id = '30000000-0000-0000-0000-0000000000a3') = '[]'::jsonb,
  'a soft-deleted warband is cleaned too');
select t.ok(
  (select data from public.warbands where id = '30000000-0000-0000-0000-0000000000a4') = '{"heroes":[]}'::jsonb,
  'a warband without a treasury key is unchanged');
select t.ok(
  not exists (select 1 from public.warbands w join before b using (id) where w.updated_at is distinct from b.updated_at),
  'updated_at is untouched everywhere');
select t.ok(
  not exists (select 1 from public.warbands w join before b using (id) where w.rating is distinct from b.rating),
  'ratings are untouched');
select t.ok((select count(*) from public.warband_edits) = (select n from edits_before), 'no edit-log rows written');
select t.ok((select count(*) from public.warband_rating_history) = (select n from history_before), 'no rating-history rows written');

-- The edit log is back on afterwards: a normal edit still counts.
update public.warbands set data = data || '{"notes":"x"}' where id = '30000000-0000-0000-0000-0000000000a2';
select t.ok((select count(*) from public.warband_edits) = (select n from edits_before) + 1, 'edit-log trigger is enabled again');

select t.ok(public.cleanup_free_dagger_stash() = 0, 'running it again changes nothing');

-- Players can't call either function.
select t.login('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  perform public.cleanup_free_dagger_stash();
  raise exception 'FAILED: a player could run the cleanup';
exception when insufficient_privilege then
  raise notice 'ok - a player can''t run the cleanup';
end $$;
select t.logout();

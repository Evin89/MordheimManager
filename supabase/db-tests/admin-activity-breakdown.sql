-- §4.9.9 admin_activity_breakdown (migrations 0068, 0070).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'one@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'two@example.test'),
  ('00000000-0000-0000-0000-0000000000b3', 'three@example.test');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000ad');

insert into public.campaigns (id, name, created_by) values
  ('c0000000-0000-0000-0000-0000000000c1', 'C', '00000000-0000-0000-0000-0000000000b1');
insert into public.campaign_members (campaign_id, user_id, role) values
  ('c0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'campaign_leader'),
  ('c0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'player');

insert into public.warbands (id, owner_id, campaign_id, name, warband_type, data, created_at, deleted_at) values
  -- In the campaign, made today.
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1',
   'c0000000-0000-0000-0000-0000000000c1', 'One', 'Reikland', '{}', now(), null),
  -- Not in a campaign, made today.
  ('20000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2',
   null, 'Two', 'Reikland', '{}', now(), null),
  -- Made long ago, deleted yesterday: a deletion in range, a creation outside it.
  ('20000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b1',
   null, 'Old', 'Reikland', '{}', now() - interval '40 days', now() - interval '1 day');

-- Inserting the warbands logs no edits (only updates do), so these are all of them.
insert into public.warband_edits (warband_id, owner_id, edited_at) values
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', now()),
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', now()),
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', now()),
  ('20000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', now()),
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', now() - interval '2 days'),
  ('20000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', now() - interval '20 days');

insert into public.battles (campaign_id, reported_by, data) values
  ('c0000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', '{}'),
  (null, '00000000-0000-0000-0000-0000000000b2', '{}');
insert into public.campaign_events (campaign_id, title, event_datetime, created_by) values
  ('c0000000-0000-0000-0000-0000000000c1', 'Game night', now() + interval '3 days', '00000000-0000-0000-0000-0000000000b1');

-- App opens (0070's active players): the admin today, and a third player who
-- only opened the app four days ago and did nothing else.
insert into public.user_visits (user_id, visit_day, first_seen_at) values
  ('00000000-0000-0000-0000-0000000000ad', current_date, now()),
  ('00000000-0000-0000-0000-0000000000b3', current_date - 4, now() - interval '4 days');

-- A player cannot read it.
select t.login('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  perform public.admin_activity_breakdown('day', 7);
  raise exception 'FAILED: a non-admin read the activity breakdown';
exception when insufficient_privilege then
  raise notice 'ok - non-admin is refused';
end $$;
select t.logout();

-- Anonymous callers have no execute grant at all.
set role anon;
do $$ begin
  perform public.admin_activity_breakdown('day', 7);
  raise exception 'FAILED: anon read the activity breakdown';
exception when insufficient_privilege then
  raise notice 'ok - anon is refused';
end $$;
reset role;

select t.login('00000000-0000-0000-0000-0000000000ad');
create temp table d as select public.admin_activity_breakdown('day', 7) as r;
create temp table w as select public.admin_activity_breakdown('week', 4) as r;
select t.logout();

-- Shape: seven zero-filled daily buckets, ending today.
select t.ok((select jsonb_array_length(r->'buckets') = 7 from d), '7 daily buckets');
select t.ok((select jsonb_array_length(r->'series'->'game_nights') = 7 from d), 'every series has a value per bucket');
select t.ok((select (r->'series'->'warbands_deleted'->>0)::int = 0 from d), 'empty buckets are 0, not missing');

-- Totals over the 7 days.
select t.ok((select (r->'totals'->>'edits')::int = 5 from d), 'edits: 5 in range (the 20-day-old one is out)');
select t.ok((select (r->'totals'->>'editors')::int = 2 from d), 'editors: distinct players, not edits');
select t.ok((select (r->'totals'->>'warbands_created')::int = 2 from d), 'warbands created: the 40-day-old one is out');
select t.ok((select (r->'totals'->>'warbands_deleted')::int = 1 from d), 'warbands deleted: 1');
select t.ok((select (r->'totals'->>'campaigns_created')::int = 1 from d), 'campaigns created: 1');
select t.ok((select (r->'totals'->>'campaign_battles')::int = 1 from d), 'campaign battles: the friendly one is not counted');
select t.ok((select (r->'totals'->>'campaign_joins')::int = 2 from d), 'campaign joins: 2');
select t.ok((select (r->'totals'->>'game_nights')::int = 1 from d), 'game nights: 1');
select t.ok((select (r->'totals'->>'active_campaigns')::int = 1 from d), 'active campaigns: one campaign, however much happened in it');

-- Per bucket: today holds four edits, two days ago one.
select t.ok((select (r->'series'->'edits'->>6)::int = 4 from d), 'today: 4 edits');
select t.ok((select (r->'series'->'edits'->>4)::int = 1 from d), 'two days ago: 1 edit');
select t.ok((select (r->'series'->'editors'->>6)::int = 2 from d), 'today: 2 players editing');

-- Active players (0070): opened the app or did anything that day.
select t.ok((select (r->'series'->'active_players'->>6)::int = 3 from d), 'today: 3 active players (two acting, one visit only)');
select t.ok((select (r->'series'->'active_players'->>5)::int = 0 from d), 'yesterday: a deletion alone is not activity');
select t.ok((select (r->'series'->'active_players'->>4)::int = 1 from d), 'two days ago: the player who edited');
select t.ok((select (r->'series'->'active_players'->>2)::int = 1 from d), 'four days ago: a visit with no action still counts');
select t.ok((select (r->'totals'->>'active_players')::int = 4 from d), 'active players total: distinct over the range, not a sum');

-- Weekly: four buckets, and the 20-day-old edit is now in range.
select t.ok((select jsonb_array_length(r->'buckets') = 4 from w), '4 weekly buckets');
select t.ok((select (r->'totals'->>'edits')::int = 6 from w), 'weekly: all 6 edits in range');
select t.ok((select extract(isodow from (r->'buckets'->>0)::date) = 1 from w), 'weeks start on Monday');

-- An unknown bucket is an error, not a silent default.
select t.login('00000000-0000-0000-0000-0000000000ad');
do $$ begin
  perform public.admin_activity_breakdown('month', 3);
  raise exception 'FAILED: an unknown bucket was accepted';
exception when invalid_parameter_value then
  raise notice 'ok - unknown bucket is refused';
end $$;
select t.logout();

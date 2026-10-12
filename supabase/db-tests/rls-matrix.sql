-- §14.4 The RLS matrix: owner, campaign-mate, unrelated user and anonymous
-- against one campaign. Re-run after any schema change: `npm run db:test`.
--
--   O  owner (campaign leader of C)    M  campaign-mate (player in C)
--   U  unrelated (no shared campaign)  anon  signed out
--
--   W1 O's private warband entered in C     W2 O's private warband, no campaign
--   W3 O's public warband                   OB the BTB objective on W1
--   WM M's private warband entered in C

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000f', 'owner@example.test'),
  ('00000000-0000-0000-0000-00000000000e', 'mate@example.test'),
  ('00000000-0000-0000-0000-00000000000d', 'unrelated@example.test');
insert into public.campaigns (id, name, created_by) values
  ('c0000000-0000-0000-0000-000000000001', 'C', '00000000-0000-0000-0000-00000000000f');
insert into public.campaign_members (campaign_id, user_id, role) values
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000f', 'campaign_leader'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000e', 'player');
insert into public.warbands (id, owner_id, campaign_id, name, warband_type, visibility, data) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000f', 'c0000000-0000-0000-0000-000000000001', 'W1', 'Reikland', 'private', '{}'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000f', null, 'W2', 'Reikland', 'private', '{}'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000f', null, 'W3', 'Reikland', 'public', '{}'),
  ('a0000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000e', 'c0000000-0000-0000-0000-000000000001', 'WM', 'Middenheim', 'private', '{}');
insert into public.objectives (id, warband_id, owner_id, data) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000f', '{"secret": true}'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000f', '{"secret": true}');

-- How many of the named warbands / objectives the current role can see.
create function t.seen(p_names text[]) returns bigint language sql as
  $$ select count(*) from public.warbands where name = any (p_names) $$;
create function t.objectives_seen() returns bigint language sql as
  $$ select count(*) from public.objectives $$;
grant execute on function t.seen(text[]), t.objectives_seen() to anon, authenticated;

-- ── Owner: everything of their own ───────────────────────────────────────────
select t.login('00000000-0000-0000-0000-00000000000f');
select t.ok(t.seen('{W1,W2,W3}') = 3, 'owner reads W1, W2, W3');
select t.ok(t.objectives_seen() = 2, 'owner reads own objectives');
with u as (update public.warbands set rating = 1 where name in ('W1','W2','W3') returning 1)
  select t.ok(count(*) = 3, 'owner writes W1, W2, W3') from u;
with u as (update public.objectives set data = '{"secret": "edited"}' where warband_id = 'a0000000-0000-0000-0000-000000000001' returning 1)
  select t.ok(count(*) = 1, 'owner writes own objective') from u;
select t.ok(t.seen('{WM}') = 1, 'owner (leader) reads campaign-mate''s entered warband');
select t.logout();

-- ── Campaign-mate ────────────────────────────────────────────────────────────
select t.login('00000000-0000-0000-0000-00000000000e');
select t.ok(t.seen('{W1}') = 1, 'mate reads owner''s private warband in the shared campaign');
select t.ok(t.seen('{W2}') = 0, 'mate cannot read owner''s private warband outside the campaign');
select t.ok(t.seen('{W3}') = 1, 'mate reads owner''s public warband');
select t.ok(t.objectives_seen() = 0, 'mate is DENIED the owner''s BTB objectives');
with u as (update public.warbands set rating = 99 where owner_id = '00000000-0000-0000-0000-00000000000f' returning 1)
  select t.ok(count(*) = 0, 'mate cannot write owner''s warbands') from u;
with u as (update public.objectives set data = '{}' returning 1)
  select t.ok(count(*) = 0, 'mate cannot write owner''s objectives') from u;
do $$ begin
  insert into public.objectives (warband_id, owner_id, data)
  values ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000f', '{}');
  raise exception 'FAILED: mate inserted an objective on the owner''s warband';
exception when insufficient_privilege or unique_violation then
  raise notice 'ok - mate cannot add objectives to the owner''s warband';
end $$;
select t.ok(not public.is_admin(), 'mate is not an admin');
do $$ begin
  perform public.admin_stats();
  raise exception 'FAILED: a non-admin read admin_stats()';
exception when others then
  if sqlerrm like 'FAILED:%' then raise; end if;
  raise notice 'ok - /admin RPCs refuse a non-admin (%)', sqlerrm;
end $$;
select t.logout();

-- ── Unrelated user ───────────────────────────────────────────────────────────
select t.login('00000000-0000-0000-0000-00000000000d');
select t.ok(t.seen('{W1,W2}') = 0, 'unrelated cannot read owner''s private warbands');
select t.ok(t.seen('{W3}') = 1, 'unrelated reads owner''s public warband');
select t.ok(t.objectives_seen() = 0, 'unrelated is DENIED the owner''s objectives');
select t.ok((select count(*) from public.campaigns where id = 'c0000000-0000-0000-0000-000000000001') = 0,
  'unrelated cannot read a private campaign');
with u as (update public.warbands set rating = 99 returning 1)
  select t.ok(count(*) = 0, 'unrelated cannot write anything') from u;
select t.logout();

-- ── Anonymous ────────────────────────────────────────────────────────────────
select t.login(null);
select t.ok(t.seen('{W1,W2}') = 0, 'anon cannot read private warbands');
select t.ok(t.seen('{W3}') = 1, 'anon reads public warbands (0004)');
select t.ok(t.objectives_seen() = 0, 'anon is DENIED objectives, even on a public warband');
with u as (update public.warbands set rating = 99 returning 1)
  select t.ok(count(*) = 0, 'anon cannot write anything') from u;
select t.logout();

-- ── Removing a player drops their warband out of the campaign (0003) ─────────
select t.login('00000000-0000-0000-0000-00000000000f');
delete from public.campaign_members
  where campaign_id = 'c0000000-0000-0000-0000-000000000001'
    and user_id = '00000000-0000-0000-0000-00000000000e';
select t.ok(t.seen('{WM}') = 0, 'leader no longer sees a removed player''s private warband');
select t.logout();
select t.ok((select campaign_id is null from public.warbands where name = 'WM'),
  'removed player''s warband is unlinked from the campaign (0003 trigger)');

select t.login('00000000-0000-0000-0000-00000000000e');
select t.ok(t.seen('{W1}') = 0, 'a removed player loses read access to the campaign''s private warbands');
select t.logout();

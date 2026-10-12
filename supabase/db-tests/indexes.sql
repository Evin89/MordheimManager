-- §35.6 pre-scale indexes (migration 0058): present, and chosen by the planner
-- for the queries they exist for (seq scans disabled, so "chosen" means usable).
select t.ok(
  (select count(*) from pg_indexes where schemaname = 'public' and indexname in (
    'campaign_members_user_id_idx', 'warbands_public_gallery_idx', 'campaign_events_created_by_idx',
    'campaign_log_entries_author_id_idx', 'campaign_log_entries_battle_id_idx', 'issue_reports_reporter_id_idx',
    -- the older §8.2 / §23.3 set, so a dropped one is noticed too
    'warbands_owner_id_idx', 'warbands_campaign_id_idx', 'warbands_owner_created_idx',
    'battles_reporter_created_idx', 'profiles_created_at_idx')) = 11,
  'all pre-scale indexes exist');

create function t.plan(p_sql text) returns text language plpgsql as $$
declare r text; plan text := '';
begin
  for r in execute 'explain ' || p_sql loop plan := plan || r || E'\n'; end loop;
  return plan;
end $$;

set enable_seqscan = off;
select t.ok(t.plan($q$select campaign_id from public.campaign_members where user_id = '00000000-0000-0000-0000-000000000001'$q$)
  like '%campaign_members_user_id_idx%', 'my-campaigns lookup uses campaign_members (user_id)');
select t.ok(t.plan($q$select id from public.warbands where visibility = 'public' and deleted_at is null
  order by rating desc, id limit 24$q$) like '%warbands_public_gallery_idx%', 'gallery page uses the partial gallery index');
reset enable_seqscan;

-- No foreign key in public is left without an index on its columns.
select t.ok(not exists (
  select 1 from pg_constraint c
  where c.contype = 'f' and c.connamespace = 'public'::regnamespace
    and not exists (
      select 1 from pg_index i
      where i.indrelid = c.conrelid
        and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] @> c.conkey
        and c.conkey @> (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1])
), 'every foreign key has a covering index');

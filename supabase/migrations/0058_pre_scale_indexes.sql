-- The remaining pre-scale indexes (§8.2, §13.4, §23.3; spec §35.6).
--
-- Most of the §8.2 list already exists: warbands (owner_id), (campaign_id) and
-- (owner_id, created_at), battles (reported_by, created_at), profiles
-- (created_at). What was still missing, found by listing every foreign key
-- without a covering index and every hot filter without one:
--
--   campaign_members (user_id) — the big one. The primary key is
--     (campaign_id, user_id), which serves `is_campaign_member(campaign_id)`
--     but not "which campaigns am I in?", the lookup behind the campaign list,
--     the leaderless checks and the membership subqueries in RLS. At a few
--     hundred memberships that is a sequential scan per request.
--   warbands public gallery — `visibility = 'public'` ordered by rating, id
--     (api/warbands.ts fetchPublicWarbands). A partial index matching the
--     filter and the order serves each page without sorting the table.
--   Foreign keys with no index, which make every delete of the parent scan
--     the child (and account deletion, §35.5, deletes parents):
--     campaign_events (created_by), campaign_log_entries (author_id),
--     campaign_log_entries (battle_id), issue_reports (reporter_id).
--
-- `visibility` alone is not indexed: two values, and the gallery index above
-- is the only query that filters on it.

create index if not exists campaign_members_user_id_idx
  on public.campaign_members (user_id);

create index if not exists warbands_public_gallery_idx
  on public.warbands (rating desc, id)
  where visibility = 'public' and deleted_at is null;

create index if not exists campaign_events_created_by_idx
  on public.campaign_events (created_by);

create index if not exists campaign_log_entries_author_id_idx
  on public.campaign_log_entries (author_id);

create index if not exists campaign_log_entries_battle_id_idx
  on public.campaign_log_entries (battle_id);

create index if not exists issue_reports_reporter_id_idx
  on public.issue_reports (reporter_id);

-- Warband-cluster cleanup, from a full audit of the tables/policies/indexes
-- around `warbands` (0-19-21 area getting crowded with fixes and new tables).
-- Three low-risk items pulled out of that audit; the rest (unbounded audit-log
-- retention, the auth.uid() row-re-eval pattern) are left for a deliberate pass.

-- ----------------------------------------------------------------------------
-- 1. Drop the dead, dangerous DELETE policy on warbands.
--
-- `warbands_delete_own` dates to migration 0001, before soft-delete existed.
-- Since 0009, deletion is `deleted_at`, not a real DELETE, and since 0040 it
-- goes through `soft_delete_warband()` — nothing client-side has issued a real
-- DELETE on this table in a long time. Leaving the policy live means a future
-- `.from('warbands').delete()` would silently succeed as a genuine hard delete,
-- cascading away `warband_photos` without queuing their Storage files first —
-- exactly the orphaned-bytes failure mode migration 0014's purge queue exists
-- to prevent. The purge job itself doesn't need this policy: it runs as
-- `purge_deleted_warbands()`, SECURITY DEFINER, which bypasses RLS entirely.
drop policy if exists "warbands_delete_own" on public.warbands;

-- ----------------------------------------------------------------------------
-- 2. Drop the duplicate index on objectives.warband_id.
--
-- `objectives_warband_id_key` (unique) already covers every lookup and range
-- scan `objectives_warband_id_idx` (plain) would serve — the unique index does
-- not need a second, weaker one alongside it. Pure write-overhead, no read ever
-- prefers the plain one over the unique one.
drop index if exists public.objectives_warband_id_idx;

-- ----------------------------------------------------------------------------
-- 3. Add the missing FK-covering indexes the advisor flagged in this cluster.
--
-- Each of these is a foreign key with no index backing it, so a delete/update
-- on the referenced row (or any query filtering by the FK column) table-scans
-- instead of using an index. Low cost now, at low row counts; avoids becoming
-- one more thing to notice only once it's slow.
create index if not exists objectives_owner_id_idx on public.objectives (owner_id);
create index if not exists warband_comments_author_id_idx on public.warband_comments (author_id);
create index if not exists campaign_awards_created_by_idx on public.campaign_awards (created_by);

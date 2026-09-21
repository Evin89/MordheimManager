-- An owner must always be able to delete their own warband.
--
-- The warband delete is a soft delete — an UPDATE that sets `deleted_at`, not a
-- DELETE (see api/warbands.ts). It is therefore governed by `warbands_update_own`,
-- whose WITH CHECK (migration 0002) re-validates the NEW row and requires
-- `campaign_id IS NULL OR is_campaign_member(campaign_id)`. That guard exists to
-- stop a player pushing a *live* warband into a campaign they don't belong to.
--
-- But it also catches the soft delete: a warband still pointing at a campaign the
-- owner has left cannot be deleted, because the NEW row keeps the same
-- (non-member) campaign_id and fails the check. The UPDATE is rejected with a
-- row-level-security error, which the app surfaces as a generic "connection
-- failed" — so it reads as "the app won't let me delete my warband".
--
-- Migration 0003 already unlinks warbands when a membership row is deleted, so in
-- practice no rows sit in that orphaned state today. This is defence in depth:
-- deleting your own warband should never depend on campaign membership at all.
-- We carve out the soft delete — a NEW row whose `deleted_at` is set — from the
-- membership requirement, while a normal (non-deleted) edit still needs it.

drop policy "warbands_update_own" on public.warbands;
create policy "warbands_update_own" on public.warbands
  for update to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (
      deleted_at is not null
      or campaign_id is null
      or public.is_campaign_member(campaign_id)
    )
  );

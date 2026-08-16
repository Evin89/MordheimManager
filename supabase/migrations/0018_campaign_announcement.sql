-- §19.3 Leader announcements: a single pinned announcement per campaign.
-- Stored as columns on `campaigns` rather than a table because there is exactly
-- one at a time (setting a new one replaces the old). No new RLS is needed:
-- reading rides the existing `campaigns_select` policy (public or member), and
-- writing rides `campaigns_update_leader`, so only a leader can pin or clear it.

alter table public.campaigns
  add column if not exists pinned_announcement text,
  add column if not exists pinned_announcement_at timestamptz;

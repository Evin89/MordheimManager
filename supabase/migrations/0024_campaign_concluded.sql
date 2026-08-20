-- End-of-campaign state.
--
-- A campaign can be "concluded" — a season ends, and its final standings, awards
-- and rivalries become a recap rather than a live table. A nullable timestamp
-- rather than a boolean so the app can show *when* it wrapped; clearing it
-- reopens the campaign. Leader-only via the existing campaigns_update_leader
-- policy; readable by every member with the row.

alter table public.campaigns
  add column if not exists concluded_at timestamptz;

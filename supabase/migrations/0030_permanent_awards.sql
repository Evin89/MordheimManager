-- Permanent per-warband awards — two small columns on campaign_awards.
--
-- Until now campaign_awards held only leader-granted honours (§19.2/0027). The
-- computed §17.4 awards (most battles, bloodiest, …) were live snapshots that
-- changed with the standings and vanished when a campaign wound down. When a
-- leader concludes a campaign, the client now freezes those winners into this
-- same table as `kind = 'computed'` rows, so a warband keeps the awards it
-- earned — shown on its roster ever after. Reopening a campaign clears them
-- again; both writes ride the existing leader-only insert/delete policies (0027).
--
-- `award_key` carries the computed award's id (e.g. 'most-battles') so the roster
-- can show its badge art; it's null for a free-text honour.

alter table public.campaign_awards
  add column if not exists kind text not null default 'honour'
    check (kind in ('honour', 'computed'));

alter table public.campaign_awards
  add column if not exists award_key text;

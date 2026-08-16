-- ----------------------------------------------------------------------------
-- Campaign narrative log (spec §17.3).
--
-- Battle records are a tally — who won, what was found. This is the other half:
-- the story between games, the grudge sworn, the thing that happened at the
-- table that isn't a win or a loss. Same instinct as campaign_events splitting
-- off from the Players tab — a tally and a story do not want the same shape —
-- but it lives on the same Log tab, interleaved with battles by time.
--
-- RLS is the campaign_events pattern exactly (§8.3): read by campaign
-- membership, write by any member, edit/delete by the author or a leader.
-- ----------------------------------------------------------------------------

create table if not exists public.campaign_log_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  title text not null,
  body text not null default '',
  -- An optional link to the battle this entry narrates. NULL FK with SET NULL:
  -- deleting a battle record must not delete the story written about it, matching
  -- §10.4's "battles stay, they are campaign history".
  battle_id uuid references public.battles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists campaign_log_entries_campaign_idx
  on public.campaign_log_entries (campaign_id, created_at);

alter table public.campaign_log_entries enable row level security;

-- Read follows the parent campaign's own rule (public campaign, or a member).
create policy "campaign_log_select" on public.campaign_log_entries
  for select to authenticated
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id
        and (c.visibility = 'public' or public.is_campaign_member(c.id))
    )
  );

-- Any member may add an entry, authored as themselves.
create policy "campaign_log_insert" on public.campaign_log_entries
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_campaign_member(campaign_id));

-- The author edits their own; a leader may edit or remove any (moderation).
create policy "campaign_log_update" on public.campaign_log_entries
  for update to authenticated
  using (author_id = auth.uid() or public.is_campaign_leader(campaign_id));
create policy "campaign_log_delete" on public.campaign_log_entries
  for delete to authenticated
  using (author_id = auth.uid() or public.is_campaign_leader(campaign_id));

-- §17.4 (manual) Campaign awards — honours a leader grants to a warband.
--
-- The persisted complement to the computed award *snapshots* in src/lib/awards.ts:
-- those are derived from the battle log and never stored (Most Wyrdstone, Longest
-- Streak); these are deliberate, human-granted distinctions ("Best Painted",
-- "Bloodiest Battle") that stay put. Granted by the leader, read by every member,
-- and tied to the warband — deleting the warband takes its honours with it
-- (ON DELETE CASCADE), since an honour with no holder is meaningless.

create table public.campaign_awards (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  warband_id uuid not null references public.warbands (id) on delete cascade,
  title text not null,
  note text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index campaign_awards_campaign_id_idx on public.campaign_awards (campaign_id);
create index campaign_awards_warband_id_idx on public.campaign_awards (warband_id);

alter table public.campaign_awards enable row level security;

-- Read: anyone who can see the campaign (member or public), same reach as the
-- standings and territories these sit beside.
create policy "campaign_awards_select" on public.campaign_awards
  for select to authenticated
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_awards.campaign_id
        and (c.visibility = 'public' or public.is_campaign_member(c.id))
    )
  );

-- Write: the campaign leader only. Granting a distinction is a leader's call, not
-- the shared job the territory map is. created_by is pinned to the granter so it
-- can't be spoofed.
create policy "campaign_awards_insert" on public.campaign_awards
  for insert to authenticated
  with check (public.is_campaign_leader(campaign_id) and created_by = auth.uid());
create policy "campaign_awards_update" on public.campaign_awards
  for update to authenticated
  using (public.is_campaign_leader(campaign_id));
create policy "campaign_awards_delete" on public.campaign_awards
  for delete to authenticated
  using (public.is_campaign_leader(campaign_id));

-- §17.1 Territory control: the places a campaign's warbands fight over.
--
-- A territory belongs to a campaign and may be held by one of its warbands, or
-- by nobody. The warband link is ON DELETE SET NULL: deleting a warband frees
-- its territories rather than cascading them out of existence — the ground is
-- still there, it's just unclaimed again.

create table public.territories (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  kind text,
  notes text,
  controlled_by_warband_id uuid references public.warbands (id) on delete set null,
  created_at timestamptz not null default now()
);

create index territories_campaign_id_idx on public.territories (campaign_id);
create index territories_warband_id_idx on public.territories (controlled_by_warband_id);

alter table public.territories enable row level security;

-- Read: anyone who can see the campaign (member or public).
create policy "territories_select" on public.territories
  for select to authenticated
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = territories.campaign_id
        and (c.visibility = 'public' or public.is_campaign_member(c.id))
    )
  );

-- Write: any member of the campaign. Managing the map is a shared job, not a
-- leader-only one — the same call the events table makes. The type-to-confirm
-- guard on the client is what stops an accidental delete, not a role check.
create policy "territories_insert" on public.territories
  for insert to authenticated
  with check (public.is_campaign_member(campaign_id));
create policy "territories_update" on public.territories
  for update to authenticated
  using (public.is_campaign_member(campaign_id));
create policy "territories_delete" on public.territories
  for delete to authenticated
  using (public.is_campaign_member(campaign_id));

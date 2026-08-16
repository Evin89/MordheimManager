-- §19.1 Event RSVPs: who is coming to a game night.
--
-- One row per (event, user); the primary key enforces "one answer each", and a
-- new answer upserts over the old one. `status` is a plain checked string rather
-- than an enum so adding a fourth option later is an ALTER of the constraint,
-- not a type migration.

create table public.campaign_event_rsvps (
  event_id uuid not null references public.campaign_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'cant')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index campaign_event_rsvps_event_id_idx on public.campaign_event_rsvps (event_id);

alter table public.campaign_event_rsvps enable row level security;

-- Helper: the campaign an event belongs to, so the policies below can test
-- membership/visibility without repeating the join. SECURITY DEFINER to dodge a
-- recursive RLS check on campaign_events while resolving the parent.
create function public.event_campaign_id(p_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select campaign_id from public.campaign_events where id = p_event_id;
$$;

-- Read: anyone who can see the event's campaign (member, or it's public) sees
-- every RSVP — the whole point is knowing who else is coming.
create policy "event_rsvps_select" on public.campaign_event_rsvps
  for select to authenticated
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = public.event_campaign_id(event_id)
        and (c.visibility = 'public' or public.is_campaign_member(c.id))
    )
  );

-- Write: only your own row, and only if you're actually in the campaign. A
-- public-campaign onlooker can read the list but not add themselves to it.
create policy "event_rsvps_insert_own" on public.campaign_event_rsvps
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_campaign_member(public.event_campaign_id(event_id))
  );
create policy "event_rsvps_update_own" on public.campaign_event_rsvps
  for update to authenticated
  using (user_id = auth.uid());
create policy "event_rsvps_delete_own" on public.campaign_event_rsvps
  for delete to authenticated
  using (user_id = auth.uid());
